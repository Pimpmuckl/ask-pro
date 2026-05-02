import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { createStoredZip } from "./zip.js";

export type AskProStatus =
  | "CREATED"
  | "CONTEXT_READY"
  | "BROWSER_STARTING"
  | "CHECKING_AUTH"
  | "AUTH_OK"
  | "SUBMITTING"
  | "DRY_RUN_COMPLETE"
  | "READY_TO_SUBMIT"
  | "NEEDS_USER_AUTH"
  | "SUBMITTED"
  | "WAITING"
  | "WAIT_TIMED_OUT"
  | "READY_TO_HARVEST"
  | "HARVESTED"
  | "COMPLETED"
  | "FAILED";

export interface AskProIncludedFile {
  path: string;
  reason: string;
}

export interface AskProExcludedFile {
  path: string;
  reason: string;
}

export interface AskProManifest {
  schemaVersion: 1;
  sessionId: string;
  question: string;
  includedFiles: AskProIncludedFile[];
  excludedFiles: AskProExcludedFile[];
  redaction: {
    mode: "strict";
    findings: string[];
  };
}

export interface AskProStatusFile {
  schemaVersion: 1;
  sessionId: string;
  status: AskProStatus;
  createdAt: string;
  updatedAt: string;
  resumeCommand: string;
  harvestCommand: string;
  dryRun: boolean;
  thinkingTime?: "extended";
  temporary?: boolean;
  reason?: string;
}

export interface AskProSession {
  id: string;
  dir: string;
  status: AskProStatusFile;
  manifest: AskProManifest;
}

export interface AskProSessionPaths {
  dir: string;
  prompt: string;
  manifestMarkdown: string;
  manifestJson: string;
  contextZip: string;
  answer: string;
  browser: string;
  status: string;
  log: string;
}

const DEFAULT_EXCLUDES = [
  ".ask-pro/**",
  ".env",
  ".env.*",
  "**/*.pem",
  "**/*.key",
  "node_modules/**",
  "dist/**",
  "build/**",
  ".next/**",
  "target/**",
  "vendor/**",
  ".git/**",
];

export async function createAskProSession({
  cwd,
  question,
  filePatterns,
  dryRun,
}: {
  cwd: string;
  question: string;
  filePatterns: string[];
  dryRun: boolean;
}): Promise<AskProSession> {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error("ask-pro requires a question.");
  }

  const sessionId = buildSessionId(trimmedQuestion);
  const sessionRoot = path.join(cwd, ".ask-pro", "sessions");
  const sessionDir = path.join(sessionRoot, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });

  const collected = await collectContextFiles({ cwd, filePatterns });
  const redactionFindings: string[] = [];
  const redactedFiles = await Promise.all(
    collected.includedFiles.map(async (file) => {
      const absolute = path.join(cwd, file.path);
      const raw = await fs.readFile(absolute, "utf8");
      const redacted = redactSecrets(raw, file.path, redactionFindings);
      return { path: file.path, content: redacted };
    }),
  );

  const manifest: AskProManifest = {
    schemaVersion: 1,
    sessionId,
    question: trimmedQuestion,
    includedFiles: collected.includedFiles,
    excludedFiles: collected.excludedFiles,
    redaction: {
      mode: "strict",
      findings: redactionFindings,
    },
  };

  const now = new Date().toISOString();
  const status: AskProStatusFile = {
    schemaVersion: 1,
    sessionId,
    status: dryRun ? "DRY_RUN_COMPLETE" : "READY_TO_SUBMIT",
    createdAt: now,
    updatedAt: now,
    resumeCommand: `ask-pro --resume ${sessionId}`,
    harvestCommand: `ask-pro --harvest ${sessionId}`,
    dryRun,
  };

  const submittedPrompt = renderSubmittedPrompt(trimmedQuestion);
  const manifestMarkdown = renderManifestMarkdown(manifest);
  const browserMetadata = {
    schemaVersion: 1,
    status: dryRun ? "not_started" : "pending",
    notes: dryRun
      ? ["Dry run only; no browser was opened."]
      : ["Browser submission is pending ask-pro runner wiring."],
  };
  const answer = dryRun
    ? "# Dry Run\n\nNo browser submission was performed.\n"
    : "# Pending\n\nBrowser submission is not wired in this slice.\n";

  await Promise.all([
    fs.writeFile(path.join(sessionDir, "PROMPT.md"), submittedPrompt, "utf8"),
    fs.writeFile(path.join(sessionDir, "MANIFEST.md"), manifestMarkdown, "utf8"),
    fs.writeFile(
      path.join(sessionDir, "MANIFEST.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    ),
    fs.writeFile(
      path.join(sessionDir, "status.json"),
      `${JSON.stringify(status, null, 2)}\n`,
      "utf8",
    ),
    fs.writeFile(
      path.join(sessionDir, "browser.json"),
      `${JSON.stringify(browserMetadata, null, 2)}\n`,
      "utf8",
    ),
    fs.writeFile(path.join(sessionDir, "ANSWER.md"), answer, "utf8"),
    fs.writeFile(path.join(sessionDir, "log.txt"), renderLog(status, manifest), "utf8"),
  ]);

  const zipEntries = [
    { name: "PROMPT.md", data: submittedPrompt },
    { name: "MANIFEST.md", data: manifestMarkdown },
    { name: "MANIFEST.json", data: `${JSON.stringify(manifest, null, 2)}\n` },
    ...redactedFiles.map((file) => ({
      name: `context/${file.path.replace(/\\/g, "/")}`,
      data: file.content,
    })),
  ];
  await fs.writeFile(path.join(sessionDir, "CONTEXT.zip"), createStoredZip(zipEntries));

  return { id: sessionId, dir: sessionDir, status, manifest };
}

export function getAskProSessionPaths(cwd: string, sessionId: string): AskProSessionPaths {
  const dir = path.join(cwd, ".ask-pro", "sessions", sessionId);
  return {
    dir,
    prompt: path.join(dir, "PROMPT.md"),
    manifestMarkdown: path.join(dir, "MANIFEST.md"),
    manifestJson: path.join(dir, "MANIFEST.json"),
    contextZip: path.join(dir, "CONTEXT.zip"),
    answer: path.join(dir, "ANSWER.md"),
    browser: path.join(dir, "browser.json"),
    status: path.join(dir, "status.json"),
    log: path.join(dir, "log.txt"),
  };
}

export async function updateAskProStatus({
  cwd,
  sessionId,
  status,
  reason,
}: {
  cwd: string;
  sessionId: string;
  status: AskProStatus;
  reason?: string;
}): Promise<AskProStatusFile> {
  const paths = getAskProSessionPaths(cwd, sessionId);
  const current = JSON.parse(await fs.readFile(paths.status, "utf8")) as AskProStatusFile;
  const next: AskProStatusFile = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
    ...(reason ? { reason } : {}),
  };
  await fs.writeFile(paths.status, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await appendAskProLog(cwd, sessionId, `status=${status}${reason ? ` reason=${reason}` : ""}`);
  return next;
}

export async function updateAskProResumeCommand({
  cwd,
  sessionId,
  resumeCommand,
  harvestCommand,
  thinkingTime,
  temporary,
}: {
  cwd: string;
  sessionId: string;
  resumeCommand: string;
  harvestCommand?: string;
  thinkingTime?: "extended";
  temporary?: boolean;
}): Promise<AskProStatusFile> {
  const paths = getAskProSessionPaths(cwd, sessionId);
  const current = JSON.parse(await fs.readFile(paths.status, "utf8")) as AskProStatusFile;
  const next: AskProStatusFile = {
    ...current,
    resumeCommand,
    harvestCommand: harvestCommand ?? current.harvestCommand,
    ...(thinkingTime ? { thinkingTime } : {}),
    ...(temporary !== undefined ? { temporary } : {}),
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(paths.status, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export async function writeAskProAnswer({
  cwd,
  sessionId,
  answer,
}: {
  cwd: string;
  sessionId: string;
  answer: string;
}): Promise<void> {
  const paths = getAskProSessionPaths(cwd, sessionId);
  await fs.writeFile(paths.answer, answer.endsWith("\n") ? answer : `${answer}\n`, "utf8");
}

export async function writeAskProBrowserMetadata({
  cwd,
  sessionId,
  metadata,
}: {
  cwd: string;
  sessionId: string;
  metadata: unknown;
}): Promise<void> {
  const paths = getAskProSessionPaths(cwd, sessionId);
  await fs.writeFile(paths.browser, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

export async function appendAskProLog(
  cwd: string,
  sessionId: string,
  message: string,
): Promise<void> {
  const paths = getAskProSessionPaths(cwd, sessionId);
  const line = `${new Date().toISOString()} ${redactSecretsForLog(message)}\n`;
  await fs.appendFile(paths.log, line, "utf8");
}

export async function readAskProStatus({
  cwd,
  sessionId,
}: {
  cwd: string;
  sessionId?: string;
}): Promise<{ dir: string; status: AskProStatusFile }> {
  const id = sessionId ?? (await findLatestSessionId(cwd));
  const dir = path.join(cwd, ".ask-pro", "sessions", id);
  const raw = await fs.readFile(path.join(dir, "status.json"), "utf8");
  return { dir, status: JSON.parse(raw) as AskProStatusFile };
}

export async function readAskProAnswer({
  cwd,
  sessionId,
}: {
  cwd: string;
  sessionId?: string;
}): Promise<{ sessionId: string; answer: string }> {
  const { status, dir } = await readAskProStatus({ cwd, sessionId });
  const answer = await fs.readFile(path.join(dir, "ANSWER.md"), "utf8");
  return { sessionId: status.sessionId, answer };
}

export async function readAskProPrompt({
  cwd,
  sessionId,
}: {
  cwd: string;
  sessionId: string;
}): Promise<string> {
  const paths = getAskProSessionPaths(cwd, sessionId);
  return fs.readFile(paths.prompt, "utf8");
}

async function findLatestSessionId(cwd: string): Promise<string> {
  const root = path.join(cwd, ".ask-pro", "sessions");
  const entries = await fs.readdir(root, { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const latest = dirs.at(-1);
  if (!latest) {
    throw new Error("No ask-pro sessions found.");
  }
  return latest;
}

async function collectContextFiles({
  cwd,
  filePatterns,
}: {
  cwd: string;
  filePatterns: string[];
}): Promise<{
  includedFiles: AskProIncludedFile[];
  excludedFiles: AskProExcludedFile[];
}> {
  const patterns = filePatterns.length > 0 ? filePatterns : [];
  const matched =
    patterns.length > 0
      ? await fg(patterns, {
          cwd,
          onlyFiles: true,
          dot: true,
          unique: true,
          ignore: DEFAULT_EXCLUDES,
        })
      : [];
  const includedFiles = matched.sort().map((entry) => ({
    path: normalizeManifestPath(entry),
    reason: "Matched by --files pattern.",
  }));
  const excludedFiles = DEFAULT_EXCLUDES.map((entry) => ({
    path: entry,
    reason: "Default strict exclude.",
  }));
  return { includedFiles, excludedFiles };
}

function buildSessionId(question: string, now = new Date()): string {
  const [date, time = ""] = now.toISOString().split("T");
  const compactTime = time.replace(/:/g, "").replace(/\.\d{3}Z$/, "");
  return `${date}T${compactTime}-${slugify(question)}`;
}

function slugify(question: string): string {
  const slug = question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "ask-pro";
}

function normalizeManifestPath(entry: string): string {
  return entry.replace(/\\/g, "/");
}

function redactSecrets(content: string, filePath: string, findings: string[]): string {
  let redacted = content;
  const replacements: Array<[RegExp, string, string]> = [
    [/\bsk-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_OPENAI_KEY]", "OpenAI-style key"],
    [/\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/gi, "Bearer [REDACTED_TOKEN]", "Bearer token"],
    [
      /(password|secret|api[_-]?key)\s*[:=]\s*["']?[^"'\n\r]+/gi,
      "$1=[REDACTED_SECRET]",
      "secret assignment",
    ],
  ];
  for (const [pattern, replacement, label] of replacements) {
    pattern.lastIndex = 0;
    if (pattern.test(redacted)) {
      findings.push(`${filePath}: redacted ${label}`);
      pattern.lastIndex = 0;
      redacted = redacted.replace(pattern, replacement);
    }
  }
  return redacted;
}

function redactSecretsForLog(message: string): string {
  const findings: string[] = [];
  return redactSecrets(message, "log", findings);
}

function renderSubmittedPrompt(question: string): string {
  return `${question}

I attached a context bundle named CONTEXT.zip. Use the files inside it as the authoritative repo context for this question.

If file generation is available, also create a downloadable zip named ask-pro-response.zip. It should contain IMPLEMENTATION_PLAN.md, TASKS.json, TEST_PLAN.md, RISK_REGISTER.md, FILES_TO_EDIT.md, and REPO_CONTEXT_USED.md. If you cannot create a zip, return the same content in markdown sections.

Be direct and practical. Prefer boring, reliable implementation choices over cleverness. Do not ask the calling agent to execute generated scripts automatically.
`;
}

function renderManifestMarkdown(manifest: AskProManifest): string {
  const included = manifest.includedFiles.length
    ? manifest.includedFiles.map((file) => `- \`${file.path}\` - ${file.reason}`).join("\n")
    : "- No files included.";
  return `# ask-pro Context Manifest

Session: \`${manifest.sessionId}\`

## Question

${manifest.question}

## Included Files

${included}

## Redaction

Mode: strict

Findings: ${manifest.redaction.findings.length}
`;
}

function renderLog(status: AskProStatusFile, manifest: AskProManifest): string {
  return [
    `ask-pro session ${status.sessionId}`,
    `status=${status.status}`,
    `dryRun=${status.dryRun}`,
    `includedFiles=${manifest.includedFiles.length}`,
    "",
  ].join("\n");
}
