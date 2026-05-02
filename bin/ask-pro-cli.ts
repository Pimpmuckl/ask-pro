#!/usr/bin/env node
import "dotenv/config";
import path from "node:path";
import { Command } from "commander";
import {
  createAskProSession,
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
  .option("--temporary", "start the run in ChatGPT Temporary Chat")
  .option("--verbose", "print browser automation diagnostics")
  .action(async (questionParts: string[], options: AskProOptions) => {
    try {
      await runAskPro(questionParts.join(" "), options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ask-pro: ${message}`);
      process.exitCode = 1;
    }
  });

await program.parseAsync(process.argv);

async function runAskPro(question: string, options: AskProOptions): Promise<void> {
  const cwd = process.cwd();
  if (options.status !== undefined) {
    const { status } = await readAskProStatus({ cwd, sessionId: optionSessionId(options.status) });
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  if (options.harvest !== undefined) {
    const result = await readAskProAnswer({ cwd, sessionId: optionSessionId(options.harvest) });
    await updateAskProStatus({ cwd, sessionId: result.sessionId, status: "HARVESTED" });
    console.log(`# ask-pro ${result.sessionId}`);
    console.log("");
    console.log(result.answer.trimEnd());
    return;
  }
  if (options.copy !== undefined) {
    const { dir, status } = await readAskProStatus({
      cwd,
      sessionId: optionSessionId(options.copy),
    });
    console.log(path.join(dir, "ANSWER.md"));
    console.log(`session=${status.sessionId}`);
    return;
  }
  if (options.resume !== undefined) {
    const { status } = await readAskProStatus({ cwd, sessionId: optionSessionId(options.resume) });
    await submitOrResumeBrowserSession(cwd, status.sessionId, options);
    return;
  }

  const dryRun = options.dryRun === true;
  const session = await createAskProSession({
    cwd,
    question,
    filePatterns: options.files ?? [],
    dryRun,
  });
  const resumeCommand = buildResumeCommand(session.id, options);
  if (resumeCommand !== session.status.resumeCommand) {
    await updateAskProResumeCommand({ cwd, sessionId: session.id, resumeCommand });
    session.status.resumeCommand = resumeCommand;
  }
  console.log(`ask-pro session created: .ask-pro/sessions/${session.id}`);
  console.log(`Status: ${session.status.status}`);
  console.log(`Context files: ${session.manifest.includedFiles.length}`);
  console.log(`Resume: ${session.status.resumeCommand}`);
  if (!dryRun) {
    await submitOrResumeBrowserSession(cwd, session.id, options);
  }
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
    console.log(`Pro response already harvested: .ask-pro/sessions/${sessionId}/ANSWER.md`);
    return;
  }
  if (
    status.status === "SUBMITTED" ||
    status.status === "WAITING" ||
    status.status === "WAIT_TIMED_OUT"
  ) {
    console.log(`Reattaching to submitted ask-pro session: ${sessionId}`);
    await resumeAskProBrowserSession({
      cwd,
      sessionId,
      thinkingTime: requestedThinkingTime(options),
      temporary: options.temporary,
      verbose: options.verbose,
    });
    console.log(`Pro response harvested: .ask-pro/sessions/${sessionId}/ANSWER.md`);
    return;
  }
  try {
    console.log("Opening ChatGPT Pro. Waiting with 180m budget after submission.");
    await runAskProBrowserSession({
      cwd,
      sessionId,
      thinkingTime: requestedThinkingTime(options),
      temporary: options.temporary,
      verbose: options.verbose,
    });
    console.log(`Pro response harvested: .ask-pro/sessions/${sessionId}/ANSWER.md`);
  } catch (error) {
    if (error instanceof AskProNeedsAuthError) {
      console.log("ChatGPT authentication is required.");
      console.log("I opened a browser window. Please log into ChatGPT there.");
      console.log("Do not paste credentials into this terminal or agent chat.");
      const resumeCommand = buildResumeCommand(sessionId, options);
      console.log(`When the message composer is visible, run: ${resumeCommand}`);
      console.log(
        JSON.stringify(
          {
            status: "NEEDS_USER_AUTH",
            sessionId,
            reason: error.reason,
            resumeCommand,
            browserProfile: error.browserProfile,
          },
          null,
          2,
        ),
      );
      return;
    }
    throw error;
  }
}

function requestedThinkingTime(options: AskProOptions): "extended" | undefined {
  return options.extended ? "extended" : undefined;
}

function buildResumeCommand(sessionId: string, options: AskProOptions): string {
  const launcher = buildLauncherCommand();
  const flags = [
    options.extended ? "--extended" : null,
    options.temporary ? "--temporary" : null,
    "--resume",
    sessionId,
  ].filter(Boolean);
  return `${launcher} ${flags.join(" ")}`;
}

function buildLauncherCommand(): string {
  const sourceLauncher = process.env.ASK_PRO_SOURCE_CHECKOUT_LAUNCHER?.trim();
  if (sourceLauncher) {
    return sourceLauncher;
  }
  if (process.env.npm_lifecycle_event === "start") {
    return "npm exec --yes pnpm@10.33.2 -- start --";
  }
  return "ask-pro";
}
