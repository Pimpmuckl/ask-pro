import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createAskProSession,
  readAskProAnswer,
  readAskProStatus,
  updateAskProStatus,
  writeAskProBrowserMetadata,
} from "../../src/ask-pro/session.js";

const resumeBrowserSessionMock = vi.fn(async () => ({
  answerText: "reattached answer",
  answerMarkdown: "# Reattached\n",
}));
const runBrowserModeMock = vi.fn(async () => ({
  answerText: "agent answer",
  answerMarkdown: "# Agent\n",
  browserTransport: "launched",
}));

vi.mock("../../src/browser/reattach.js", () => ({
  resumeBrowserSession: resumeBrowserSessionMock,
}));
vi.mock("../../src/browserMode.js", () => ({
  runBrowserMode: runBrowserModeMock,
}));

const { resumeAskProBrowserSession, runAskProBrowserSession } =
  await import("../../src/ask-pro/browserRunner.js");

const tempDirs: string[] = [];

afterEach(async () => {
  resumeBrowserSessionMock.mockClear();
  runBrowserModeMock.mockClear();
  vi.unstubAllEnvs();
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("ask-pro browser runner", () => {
  test("runs ask-pro sessions with the explicit agent profile", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-run-agent-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Review with the agent profile.",
      filePatterns: [],
      dryRun: false,
    });

    vi.stubEnv("ASK_PRO_AGENT_ID", "review-t1");
    await runAskProBrowserSession({ cwd, sessionId: session.id });

    const firstCall = runBrowserModeMock.mock.calls[0] as unknown[] | undefined;
    expect(firstCall?.[0]).toMatchObject({
      config: {
        manualLoginProfileDir: expect.stringMatching(
          /agents[\\/]+review-t1-[a-f0-9]{10}[\\/]+browser-profile$/,
        ),
      },
    });
  });

  test("reattaches submitted sessions without resubmitting", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-reattach-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Review the saved browser session.",
      filePatterns: [],
      dryRun: false,
    });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "running",
        profileDir: path.join(cwd, "profile"),
        runtime: {
          chromePort: 9222,
          chromeHost: "127.0.0.1",
          tabUrl: "https://chatgpt.com/c/test",
        },
      },
    });
    await updateAskProStatus({ cwd, sessionId: session.id, status: "WAIT_TIMED_OUT" });

    await resumeAskProBrowserSession({ cwd, sessionId: session.id });

    expect(resumeBrowserSessionMock).toHaveBeenCalledTimes(1);
    const firstCall = resumeBrowserSessionMock.mock.calls[0] as unknown[] | undefined;
    expect(firstCall?.[0]).toMatchObject({ chromePort: 9222 });
    expect(firstCall?.[1]).toMatchObject({
      attachRunning: true,
      manualLoginProfileDir: path.join(cwd, "profile"),
    });
    const answer = await readAskProAnswer({ cwd, sessionId: session.id });
    expect(answer.answer).toBe("# Reattached\n");
    const { status } = await readAskProStatus({ cwd, sessionId: session.id });
    expect(status.status).toBe("COMPLETED");
    const manifest = JSON.parse(
      await fs.readFile(path.join(session.dir, "PRO_OUTPUT_MANIFEST.json"), "utf8"),
    );
    expect(manifest.responseZip.status).toBe("unavailable");
  });

  test("reattach fallback uses recorded agent id instead of ambient env", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-reattach-agent-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Review the saved agent browser session.",
      filePatterns: [],
      dryRun: false,
    });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "running",
        agentId: "review-t1-59cd6bada6",
        runtime: {
          chromePort: 9333,
          chromeHost: "127.0.0.1",
          tabUrl: "https://chatgpt.com/c/test-agent",
        },
      },
    });
    await updateAskProStatus({ cwd, sessionId: session.id, status: "WAIT_TIMED_OUT" });

    vi.stubEnv("ASK_PRO_AGENT_ID", "other-agent");
    await resumeAskProBrowserSession({ cwd, sessionId: session.id });

    const firstCall = resumeBrowserSessionMock.mock.calls[0] as unknown[] | undefined;
    expect(firstCall?.[1]).toMatchObject({
      attachRunning: false,
      manualLoginProfileDir: expect.stringContaining(
        path.join("agents", "review-t1-59cd6bada6", "browser-profile"),
      ),
    });
    const metadata = JSON.parse(
      await fs.readFile(path.join(session.dir, "browser.json"), "utf8"),
    ) as { profileDir?: string };
    expect(metadata.profileDir).toContain(
      path.join("agents", "review-t1-59cd6bada6", "browser-profile"),
    );
  });

  test("reattach rejects unsafe agent-scoped profile metadata", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-reattach-unsafe-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Review the unsafe stored browser session.",
      filePatterns: [],
      dryRun: false,
    });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "running",
        agentId: "../bad-agent",
        profileDir: path.join(cwd, "other-agent-profile"),
        runtime: {
          chromePort: 9444,
          chromeHost: "127.0.0.1",
          tabUrl: "https://chatgpt.com/c/test-unsafe",
        },
      },
    });
    await updateAskProStatus({ cwd, sessionId: session.id, status: "WAIT_TIMED_OUT" });

    await expect(resumeAskProBrowserSession({ cwd, sessionId: session.id })).rejects.toThrow(
      /stored ask-pro agent id is invalid/i,
    );
    expect(resumeBrowserSessionMock).not.toHaveBeenCalled();
  });

  test("reattach validates stored agent id before accepting a managed profile path", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-reattach-invalid-managed-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Review the invalid managed browser session.",
      filePatterns: [],
      dryRun: false,
    });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "running",
        agentId: "../bad-agent",
        profileDir: path.join(
          os.homedir(),
          ".agents",
          "skills",
          "ask-pro",
          "agents",
          "review-t1-6d908a4714",
          "browser-profile",
        ),
        runtime: {
          chromePort: 9666,
          chromeHost: "127.0.0.1",
          tabUrl: "https://chatgpt.com/c/test-invalid-managed",
        },
      },
    });
    await updateAskProStatus({ cwd, sessionId: session.id, status: "WAIT_TIMED_OUT" });

    await expect(resumeAskProBrowserSession({ cwd, sessionId: session.id })).rejects.toThrow(
      /stored ask-pro agent id is invalid/i,
    );
    expect(resumeBrowserSessionMock).not.toHaveBeenCalled();
  });

  test("reattach keeps a safe recorded managed profile authoritative", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-reattach-managed-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Review the saved managed browser session.",
      filePatterns: [],
      dryRun: false,
    });
    const recordedProfile = path.join(
      os.homedir(),
      ".agents",
      "skills",
      "ask-pro",
      "agents",
      "review-t2-91dc99b944",
      "browser-profile",
    );
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "running",
        agentId: "review-t1-6d908a4714",
        profileDir: recordedProfile,
        runtime: {
          chromePort: 9555,
          chromeHost: "127.0.0.1",
          tabUrl: "https://chatgpt.com/c/test-managed",
        },
      },
    });
    await updateAskProStatus({ cwd, sessionId: session.id, status: "WAIT_TIMED_OUT" });

    await resumeAskProBrowserSession({ cwd, sessionId: session.id });

    const firstCall = resumeBrowserSessionMock.mock.calls[0] as unknown[] | undefined;
    expect(firstCall?.[1]).toMatchObject({
      manualLoginProfileDir: recordedProfile,
    });
  });
});
