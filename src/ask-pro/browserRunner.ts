import fs from "node:fs/promises";
import path from "node:path";
import { BrowserAutomationError } from "../browser/errors.js";
import {
  askProBrowserProfileDirForAgentId,
  defaultAskProBrowserProfileDir,
  isAskProManagedBrowserProfileDir,
  resolveAskProAgentId,
} from "../browser/profilePaths.js";
import { runBrowserMode, type BrowserRunResult } from "../browserMode.js";
import { resumeBrowserSession } from "../browser/reattach.js";
import type { BrowserLogger } from "../browser/types.js";
import {
  appendAskProLog,
  getAskProSessionPaths,
  readAskProPrompt,
  updateAskProStatus,
  writeAskProAnswer,
  writeAskProBrowserMetadata,
} from "./session.js";
import { harvestLatestAssistantZip, writeResponseZipManifest } from "./responseZip.js";

const DEFAULT_TIMEOUT_MS = 180 * 60 * 1000;
const MANUAL_LOGIN_WAIT_MS = 10 * 60 * 1000;

export interface RunAskProBrowserSessionOptions {
  cwd: string;
  sessionId: string;
  verbose?: boolean;
}

export async function runAskProBrowserSession({
  cwd,
  sessionId,
  verbose,
}: RunAskProBrowserSessionOptions): Promise<BrowserRunResult> {
  const paths = getAskProSessionPaths(cwd, sessionId);
  const prompt = await readAskProPrompt({ cwd, sessionId });
  const agentId = resolveAskProAgentId();
  const browserProfile = askProBrowserProfileDirForAgentId(agentId);
  await fs.mkdir(browserProfile, { recursive: true });
  await updateAskProStatus({ cwd, sessionId, status: "BROWSER_STARTING" });

  const logger = buildAskProBrowserLogger(cwd, sessionId, verbose);
  try {
    await updateAskProStatus({ cwd, sessionId, status: "WAITING" });
    const result = await runBrowserMode({
      prompt,
      attachments: [
        {
          path: paths.contextZip,
          displayPath: "CONTEXT.zip",
        },
      ],
      config: {
        manualLogin: true,
        attachRunning: false,
        manualLoginProfileDir: browserProfile,
        manualLoginWaitMs: MANUAL_LOGIN_WAIT_MS,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        inputTimeoutMs: 90_000,
        assistantRecheckDelayMs: 30_000,
        assistantRecheckTimeoutMs: 180_000,
        desiredModel: "GPT-5.5 Pro",
        modelStrategy: "select",
        thinkingTime: "extended",
        acceptLanguage: "en-US,en",
        keepBrowser: true,
        allowCookieErrors: true,
      },
      log: logger,
      heartbeatIntervalMs: 30_000,
      verbose,
      runtimeHintCb: async (runtime) => {
        await writeAskProBrowserMetadata({
          cwd,
          sessionId,
          metadata: {
            schemaVersion: 1,
            status: "running",
            agentId,
            profileDir: browserProfile,
            runtime,
          },
        });
      },
      afterAnswerCb: async ({ Runtime, Page, Input }) => {
        const manifest = await harvestLatestAssistantZip({
          runtime: Runtime,
          page: Page,
          input: Input,
          sessionDir: paths.dir,
        });
        await writeResponseZipManifest(paths.dir, manifest);
      },
    });

    await writeAskProAnswer({ cwd, sessionId, answer: result.answerMarkdown || result.answerText });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId,
      metadata: {
        schemaVersion: 1,
        status: "completed",
        agentId,
        profileDir: browserProfile,
        runtime: browserResultToRuntime(result),
      },
    });
    await ensureResponseZipManifest(paths.dir);
    await updateAskProStatus({ cwd, sessionId, status: "COMPLETED" });
    return result;
  } catch (error) {
    if (isAuthGateError(error)) {
      await writeAskProBrowserMetadata({
        cwd,
        sessionId,
        metadata: {
          schemaVersion: 1,
          status: "needs_user_auth",
          agentId,
          profileDir: browserProfile,
          reason: classifyBrowserError(error),
        },
      });
      await updateAskProStatus({
        cwd,
        sessionId,
        status: "NEEDS_USER_AUTH",
        reason: classifyBrowserError(error),
      });
      throw new AskProNeedsAuthError(sessionId, browserProfile, classifyBrowserError(error));
    }

    if (isAssistantTimeoutError(error)) {
      await updateAskProStatus({
        cwd,
        sessionId,
        status: "WAIT_TIMED_OUT",
        reason: "assistant_timeout",
      });
    } else {
      await updateAskProStatus({
        cwd,
        sessionId,
        status: "FAILED",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}

export async function resumeAskProBrowserSession({
  cwd,
  sessionId,
  verbose,
}: RunAskProBrowserSessionOptions): Promise<void> {
  const paths = getAskProSessionPaths(cwd, sessionId);
  const prompt = await readAskProPrompt({ cwd, sessionId });
  const logger = buildAskProBrowserLogger(cwd, sessionId, verbose);
  const metadata = await readBrowserMetadata(paths.browser);
  const fallbackProfile = resolveResumeBrowserProfile(metadata);
  const attachRunning = hasLegacyNonManagedProfile(metadata);
  if (!metadata.runtime) {
    throw new Error(`session ${sessionId} has no saved browser runtime metadata`);
  }

  await updateAskProStatus({ cwd, sessionId, status: "WAITING" });
  try {
    const result = await resumeBrowserSession(
      metadata.runtime,
      {
        manualLogin: true,
        attachRunning,
        manualLoginProfileDir: fallbackProfile,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        inputTimeoutMs: 90_000,
        url: metadata.url,
      },
      logger,
      { promptPreview: prompt },
    );
    await writeAskProAnswer({
      cwd,
      sessionId,
      answer: result.answerMarkdown || result.answerText,
    });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId,
      metadata: {
        ...metadata,
        schemaVersion: 1,
        status: "completed",
        profileDir: fallbackProfile,
      },
    });
    await ensureResponseZipManifest(paths.dir);
    await updateAskProStatus({ cwd, sessionId, status: "COMPLETED" });
  } catch (error) {
    if (isAuthGateError(error)) {
      await updateAskProStatus({
        cwd,
        sessionId,
        status: "NEEDS_USER_AUTH",
        reason: classifyBrowserError(error),
      });
      throw new AskProNeedsAuthError(sessionId, fallbackProfile, classifyBrowserError(error));
    }
    await updateAskProStatus({
      cwd,
      sessionId,
      status: "FAILED",
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function ensureResponseZipManifest(sessionDir: string): Promise<void> {
  try {
    await fs.access(path.join(sessionDir, "PRO_OUTPUT_MANIFEST.json"));
  } catch {
    await writeResponseZipManifest(sessionDir, {
      schemaVersion: 1,
      responseZip: {
        status: "unavailable",
        actualFileName: null,
        downloadPath: null,
        extractPath: null,
        requiredFilesPresent: false,
        notes: ["Generated zip was unavailable; harvested markdown answer to ANSWER.md."],
      },
    });
  }
}

function resolveResumeBrowserProfile(metadata: AskProBrowserMetadata): string {
  if (metadata.profileDir && isAskProManagedBrowserProfileDir(metadata.profileDir)) {
    return metadata.profileDir;
  }
  if (hasLegacyNonManagedProfile(metadata)) return metadata.profileDir!;

  const agentProfile = resolveStoredAgentProfile(metadata.agentId);
  if (agentProfile) return agentProfile;
  return defaultAskProBrowserProfileDir();
}

function hasLegacyNonManagedProfile(metadata: AskProBrowserMetadata): boolean {
  return Boolean(
    metadata.profileDir &&
    !metadata.agentId &&
    !isAskProManagedBrowserProfileDir(metadata.profileDir),
  );
}

function resolveStoredAgentProfile(agentId: string | null | undefined): string | null {
  if (!agentId) return null;
  return askProBrowserProfileDirForAgentId(agentId);
}

export class AskProNeedsAuthError extends Error {
  constructor(
    readonly sessionId: string,
    readonly browserProfile: string,
    readonly reason: string,
  ) {
    super("ChatGPT authentication is required.");
    this.name = "AskProNeedsAuthError";
  }
}

function buildAskProBrowserLogger(
  cwd: string,
  sessionId: string,
  verbose?: boolean,
): BrowserLogger {
  const logger = ((message?: string) => {
    if (typeof message !== "string") return;
    void appendAskProLog(cwd, sessionId, message);
    const shouldPrint =
      verbose || /\b(thinking|waiting|fallback|retry|url|reattach)\b/i.test(message);
    if (shouldPrint) {
      console.log(message);
    }
  }) as BrowserLogger;
  logger.verbose = Boolean(verbose);
  logger.sessionLog = (message: string) => {
    void appendAskProLog(cwd, sessionId, message);
  };
  return logger;
}

function isAuthGateError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const stage = error instanceof BrowserAutomationError ? String(error.details?.stage ?? "") : "";
  return (
    stage.includes("cloudflare") ||
    message.includes("login") ||
    message.includes("auth") ||
    message.includes("captcha") ||
    message.includes("cloudflare") ||
    message.includes("session expired") ||
    message.includes("prompt textarea not available") ||
    message.includes("no chatgpt cookies")
  );
}

function isAssistantTimeoutError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("assistant") && message.includes("timed out");
}

function classifyBrowserError(error: unknown): string {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("cloudflare") || message.includes("captcha")) return "challenge_detected";
  if (message.includes("mfa")) return "mfa_detected";
  if (message.includes("auth")) return "auth_page_detected";
  if (message.includes("login") || message.includes("no chatgpt cookies")) {
    return "login_page_detected";
  }
  if (message.includes("prompt textarea not available")) return "composer_not_visible";
  return "auth_required";
}

function browserResultToRuntime(result: BrowserRunResult): Record<string, unknown> {
  return {
    browserTransport: result.browserTransport,
    chromePid: result.chromePid,
    chromePort: result.chromePort,
    chromeHost: result.chromeHost,
    chromeBrowserWSEndpoint: result.chromeBrowserWSEndpoint,
    chromeProfileRoot: result.chromeProfileRoot,
    userDataDir: result.userDataDir,
    chromeTargetId: result.chromeTargetId,
    tabUrl: result.tabUrl,
    controllerPid: result.controllerPid,
  };
}

interface AskProBrowserMetadata {
  schemaVersion?: number;
  status?: string;
  profileDir?: string;
  agentId?: string | null;
  url?: string;
  runtime?: {
    chromePid?: number;
    chromePort?: number;
    chromeHost?: string;
    chromeBrowserWSEndpoint?: string;
    chromeProfileRoot?: string;
    userDataDir?: string;
    chromeTargetId?: string;
    tabUrl?: string;
    conversationId?: string;
    controllerPid?: number;
  };
}

async function readBrowserMetadata(filePath: string): Promise<AskProBrowserMetadata> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as AskProBrowserMetadata;
  return parsed;
}
