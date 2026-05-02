#!/usr/bin/env node
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { Command, Option } from "commander";
import {
  createAskProSession,
  getAskProSessionPaths,
  type AskProStatusFile,
  readAskProAnswer,
  readAskProStatus,
  updateAskProResumeCommand,
  updateAskProStatus,
} from "../src/ask-pro/session.js";
import {
  AskProNeedsAuthError,
  resumeAskProBrowserSession,
  runAskProBrowserSession,
} from "../src/ask-pro/browserRunner.js";
import { renderToonRecord, type AskProToonFields } from "../src/ask-pro/toon.js";
import { getCliVersion } from "../src/version.js";

interface AskProOptions {
  dryRun?: boolean;
  files?: string[];
  resume?: string | boolean;
  status?: string | boolean;
  harvest?: string | boolean;
  copy?: string | boolean;
  extended?: boolean;
  temporary?: boolean;
  cwd?: string;
  verbose?: boolean;
}

const program = new Command();

program
  .name("ask-pro")
  .description("Browser-backed ChatGPT Pro escalation for hard engineering questions.")
  .version(getCliVersion())
  .argument("[question...]", "question to send to ChatGPT Pro")
  .option("--dry-run", "prepare the session and context bundle without opening the browser")
  .option("--files <pattern>", "include files or globs in the context bundle", collectFiles, [])
  .option("--resume [session-id]", "resume a prepared or waiting ask-pro session")
  .option("--status [session-id]", "show ask-pro session status")
  .option("--harvest [session-id]", "print harvested ANSWER.md for a session")
  .option("--copy [session-id]", "print the copy target for a session")
  .option(
    "--extended",
    "request Extended Pro thinking; use only when a multi-hour wait is acceptable",
  )
  .option("--temporary", "require ChatGPT Temporary Chat; default runs already try it first")
  .option("--no-temporary", "retry a session outside ChatGPT Temporary Chat")
  .addOption(new Option("--cwd <path>", "project working directory").hideHelp())
  .option("--verbose", "print browser automation diagnostics")
  .action(async (questionParts: string[], options: AskProOptions) => {
    try {
      await runAskPro(questionParts.join(" "), options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeToon("ask_pro_error", {
        code: classifyCliError(message),
        message,
        action: "inspect_session",
      });
      process.exitCode = 1;
    }
  });

await program.parseAsync(process.argv);

async function runAskPro(question: string, options: AskProOptions): Promise<void> {
  const cwd = resolveProjectCwd(options);
  if (options.status !== undefined) {
    const { status } = await readAskProStatus({ cwd, sessionId: optionSessionId(options.status) });
    printStatusRecord(status, {
      profile: await readStatusBrowserProfile(cwd, status),
      ...answerExtraForStatus(status, status.sessionId),
    });
    return;
  }
  if (options.harvest !== undefined) {
    const result = await readAskProAnswer({ cwd, sessionId: optionSessionId(options.harvest) });
    await writeStdout(result.answer);
    try {
      await updateAskProStatus({ cwd, sessionId: result.sessionId, status: "HARVESTED" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ask-pro harvest status update failed: ${message}`);
    }
    return;
  }
  if (options.copy !== undefined) {
    const { dir, status } = await readAskProStatus({
      cwd,
      sessionId: optionSessionId(options.copy),
    });
    if (isAnswerBearingStatus(status)) {
      writeToon("ask_pro", {
        session: status.sessionId,
        state: normalizeState(status.status),
        target: path.join(dir, "ANSWER.md"),
        action: "copy_target",
      });
    } else {
      printStatusRecord(status, { profile: await readStatusBrowserProfile(cwd, status) });
    }
    return;
  }
  if (options.resume !== undefined) {
    const { status } = await readAskProStatus({ cwd, sessionId: optionSessionId(options.resume) });
    const effectiveOptions = mergeStatusOptions(options, status);
    const resumeCommand = buildResumeCommand(status.sessionId, effectiveOptions, cwd);
    const harvestCommand = buildHarvestCommand(status.sessionId, cwd);
    if (resumeCommand !== status.resumeCommand || harvestCommand !== status.harvestCommand) {
      await updateAskProResumeCommand({
        cwd,
        sessionId: status.sessionId,
        resumeCommand,
        harvestCommand,
        thinkingTime: effectiveOptions.extended ? "extended" : undefined,
        temporary: effectiveOptions.temporary,
      });
    }
    await submitOrResumeBrowserSession(cwd, status.sessionId, effectiveOptions);
    return;
  }

  const dryRun = options.dryRun === true;
  const session = await createAskProSession({
    cwd,
    question,
    filePatterns: options.files ?? [],
    dryRun,
  });
  const resumeCommand = buildResumeCommand(session.id, options, cwd);
  const harvestCommand = buildHarvestCommand(session.id, cwd);
  if (
    resumeCommand !== session.status.resumeCommand ||
    harvestCommand !== session.status.harvestCommand
  ) {
    await updateAskProResumeCommand({
      cwd,
      sessionId: session.id,
      resumeCommand,
      harvestCommand,
      thinkingTime: options.extended ? "extended" : undefined,
      temporary: options.temporary,
    });
    session.status.resumeCommand = resumeCommand;
    session.status.harvestCommand = harvestCommand;
  }
  if (dryRun) {
    printStatusRecord(session.status, { files: session.manifest.includedFiles.length });
    return;
  }
  await submitOrResumeBrowserSession(cwd, session.id, options);
}

function collectFiles(value: string, previous: string[]): string[] {
  return previous.concat(value);
}

function optionSessionId(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

async function submitOrResumeBrowserSession(
  cwd: string,
  sessionId: string,
  options: AskProOptions,
): Promise<void> {
  const { status } = await readAskProStatus({ cwd, sessionId });
  if (status.status === "COMPLETED" || status.status === "HARVESTED") {
    printStatusRecord(status, answerExtraForStatus(status, sessionId));
    return;
  }
  if (
    status.status === "SUBMITTED" ||
    status.status === "WAITING" ||
    status.status === "WAIT_TIMED_OUT" ||
    status.status === "NEEDS_USER_AUTH"
  ) {
    try {
      await resumeAskProBrowserSession({
        cwd,
        sessionId,
        thinkingTime: requestedThinkingTime(options),
        temporary: options.temporary,
        verbose: options.verbose,
      });
    } catch (error) {
      if (error instanceof AskProNeedsAuthError) {
        printAuthInstructions(sessionId, options, cwd, error);
        return;
      }
      throw error;
    }
    const { status: completed } = await readAskProStatus({ cwd, sessionId });
    printStatusRecord(completed, answerExtraForStatus(completed, sessionId));
    return;
  }
  try {
    await runAskProBrowserSession({
      cwd,
      sessionId,
      thinkingTime: requestedThinkingTime(options),
      temporary: options.temporary,
      verbose: options.verbose,
    });
    const { status: completed } = await readAskProStatus({ cwd, sessionId });
    printStatusRecord(completed, answerExtraForStatus(completed, sessionId));
  } catch (error) {
    if (error instanceof AskProNeedsAuthError) {
      printAuthInstructions(sessionId, options, cwd, error);
      return;
    }
    throw error;
  }
}

function requestedThinkingTime(options: AskProOptions): "extended" | undefined {
  return options.extended ? "extended" : undefined;
}

function buildResumeCommand(sessionId: string, options: AskProOptions, cwd: string): string {
  const flags = [
    options.extended ? "--extended" : null,
    options.temporary === true ? "--temporary" : null,
    options.temporary === false ? "--no-temporary" : null,
  ];
  return buildSessionCommand(cwd, [...flags, "--resume", sessionId]);
}

function buildHarvestCommand(sessionId: string, cwd: string): string {
  return buildSessionCommand(cwd, ["--harvest", sessionId]);
}

function buildSessionCommand(cwd: string, args: Array<string | null>): string {
  const launcher = buildLauncherCommand();
  const flags = [
    needsExplicitCwd(launcher) ? "--cwd" : null,
    needsExplicitCwd(launcher) ? quoteCommandArg(cwd) : null,
    ...args,
  ].filter(Boolean);
  return `${launcher} ${flags.join(" ")}`;
}

function buildLauncherCommand(): string {
  const sourceLauncher = process.env.ASK_PRO_SOURCE_CHECKOUT_LAUNCHER?.trim();
  if (sourceLauncher) {
    return sourceLauncher;
  }
  return "ask-pro";
}

function needsExplicitCwd(launcher: string): boolean {
  return launcher !== "ask-pro";
}

function resolveProjectCwd(options: AskProOptions): string {
  if (options.cwd) {
    return path.resolve(options.cwd);
  }
  if (process.env.ASK_PRO_SOURCE_CHECKOUT_LAUNCHER && process.env.INIT_CWD) {
    return path.resolve(process.env.INIT_CWD);
  }
  return process.cwd();
}

function printAuthInstructions(
  sessionId: string,
  options: AskProOptions,
  cwd: string,
  error: AskProNeedsAuthError,
): void {
  const resumeCommand = buildResumeCommand(sessionId, options, cwd);
  writeToon("ask_pro", {
    session: sessionId,
    state: "needs_auth",
    reason: error.reason,
    profile: collapseHome(error.browserProfile),
    action: "human_login_then_resume",
    resume: resumeCommand,
  });
}

function quoteCommandArg(value: string): string {
  if (process.platform !== "win32") {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

function mergeStatusOptions(
  options: AskProOptions,
  status: { thinkingTime?: "extended"; temporary?: boolean },
): AskProOptions {
  const temporary = options.temporary !== undefined ? options.temporary : status.temporary;
  return {
    ...options,
    extended: options.extended === true || status.thinkingTime === "extended",
    temporary,
  };
}

function printStatusRecord(status: AskProStatusFile, extra: AskProToonFields = {}): void {
  writeToon("ask_pro", {
    session: status.sessionId,
    state: normalizeState(status.status),
    reason: status.reason,
    thinking: status.thinkingTime ?? "standard",
    temporary: normalizeTemporary(status.temporary),
    action: actionForStatus(status),
    resume: shouldPrintResume(status) ? status.resumeCommand : undefined,
    harvest: shouldPrintHarvest(status) ? status.harvestCommand : undefined,
    ...extra,
  });
}

function writeToon(name: string, fields: AskProToonFields): void {
  process.stdout.write(`${renderToonRecord(name, fields)}\n`);
}

async function writeStdout(value: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(value, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function normalizeState(status: AskProStatusFile["status"]): string {
  if (status === "NEEDS_USER_AUTH") return "needs_auth";
  return status.toLowerCase();
}

function normalizeTemporary(temporary: boolean | undefined): string {
  if (temporary === true) return "strict";
  if (temporary === false) return "off";
  return "default";
}

function actionForStatus(status: AskProStatusFile): string {
  switch (status.status) {
    case "DRY_RUN_COMPLETE":
    case "READY_TO_SUBMIT":
    case "WAIT_TIMED_OUT":
    case "FAILED":
      return "resume";
    case "NEEDS_USER_AUTH":
      return "human_login_then_resume";
    case "COMPLETED":
    case "READY_TO_HARVEST":
      return "harvest";
    case "HARVESTED":
      return "read_answer";
    case "SUBMITTED":
    case "WAITING":
    case "BROWSER_STARTING":
    case "CHECKING_AUTH":
    case "AUTH_OK":
    case "SUBMITTING":
      return "wait";
    case "CREATED":
    case "CONTEXT_READY":
      return "none";
  }
}

function shouldPrintResume(status: AskProStatusFile): boolean {
  return [
    "BROWSER_STARTING",
    "CHECKING_AUTH",
    "AUTH_OK",
    "SUBMITTING",
    "DRY_RUN_COMPLETE",
    "SUBMITTED",
    "WAITING",
    "READY_TO_SUBMIT",
    "NEEDS_USER_AUTH",
    "WAIT_TIMED_OUT",
    "FAILED",
  ].includes(status.status);
}

function shouldPrintHarvest(status: AskProStatusFile): boolean {
  return ["COMPLETED", "READY_TO_HARVEST"].includes(status.status);
}

function answerPath(sessionId: string): string {
  return `.ask-pro/sessions/${sessionId}/ANSWER.md`;
}

function answerExtraForStatus(status: AskProStatusFile, sessionId: string): AskProToonFields {
  return isAnswerBearingStatus(status) ? { answer: answerPath(sessionId) } : {};
}

function isAnswerBearingStatus(status: AskProStatusFile): boolean {
  return ["COMPLETED", "READY_TO_HARVEST", "HARVESTED"].includes(status.status);
}

async function readStatusBrowserProfile(
  cwd: string,
  status: AskProStatusFile,
): Promise<string | undefined> {
  if (status.status !== "NEEDS_USER_AUTH") {
    return undefined;
  }
  try {
    const paths = getAskProSessionPaths(cwd, status.sessionId);
    const raw = await fs.readFile(paths.browser, "utf8");
    const metadata = JSON.parse(raw) as { profileDir?: unknown };
    return typeof metadata.profileDir === "string" ? collapseHome(metadata.profileDir) : undefined;
  } catch {
    return undefined;
  }
}

function collapseHome(filePath: string): string {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) return filePath;
  const resolvedHome = path.resolve(home);
  const resolvedPath = path.resolve(filePath);
  if (resolvedPath === resolvedHome) return "~";
  if (resolvedPath.startsWith(`${resolvedHome}${path.sep}`)) {
    return `~${path.sep}${path.relative(resolvedHome, resolvedPath)}`;
  }
  return filePath;
}

function classifyCliError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("requires a question") || normalized.includes("no ask-pro sessions")) {
    return "usage";
  }
  if (normalized.includes("auth") || normalized.includes("login")) {
    return "auth_required";
  }
  if (normalized.includes("browser") || normalized.includes("chatgpt")) {
    return "browser_failed";
  }
  return "failed";
}
