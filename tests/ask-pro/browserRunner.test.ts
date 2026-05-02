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
        url: "https://chatgpt.com/",
        attachRunning: false,
        thinkingTime: "standard",
        manualLoginProfileDir: expect.stringMatching(
          /agents[\\/]+review-t1-[a-f0-9]{10}[\\/]+browser-profile$/,
        ),
      },
    });
  });

  test("runs default ask-pro sessions on the shared managed profile", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-run-default-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Review with the default profile.",
      filePatterns: [],
      dryRun: false,
    });

    await runAskProBrowserSession({ cwd, sessionId: session.id });

    const firstCall = runBrowserModeMock.mock.calls[0] as unknown[] | undefined;
    expect(firstCall?.[0]).toMatchObject({
      config: {
        url: "https://chatgpt.com/",
        attachRunning: false,
        thinkingTime: "standard",
        manualLoginProfileDir: expect.stringContaining(
          path.join(".agents", "skills", "ask-pro", "browser-profile"),
        ),
      },
    });
  });

  test("runs ask-pro sessions with extended thinking when requested", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-run-extended-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Review with extended thinking.",
      filePatterns: [],
      dryRun: false,
    });

    await runAskProBrowserSession({ cwd, sessionId: session.id, thinkingTime: "extended" });

    const firstCall = runBrowserModeMock.mock.calls[0] as unknown[] | undefined;
    expect(firstCall?.[0]).toMatchObject({
      config: {
        thinkingTime: "extended",
      },
    });
  });

  test("runs ask-pro sessions in temporary chat when requested", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-run-temporary-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Review in temporary chat.",
      filePatterns: [],
      dryRun: false,
    });

    await runAskProBrowserSession({ cwd, sessionId: session.id, temporary: true });

    const firstCall = runBrowserModeMock.mock.calls[0] as unknown[] | undefined;
    expect(firstCall?.[0]).toMatchObject({
      config: {
        url: "https://chatgpt.com/?temporary-chat=true",
      },
    });
    const metadata = JSON.parse(
      await fs.readFile(path.join(session.dir, "browser.json"), "utf8"),
    ) as { url?: string };
    expect(metadata.url).toBe("https://chatgpt.com/?temporary-chat=true");
  });

  test("fresh retry honors no-temporary over a stored temporary URL", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-run-no-temporary-retry-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Retry outside temporary chat.",
      filePatterns: [],
      dryRun: false,
    });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "failed",
        profileDir: path.join(os.homedir(), ".agents", "skills", "ask-pro", "browser-profile"),
        url: "https://chatgpt.com/?temporary-chat=true",
      },
    });

    await runAskProBrowserSession({ cwd, sessionId: session.id, temporary: false });

    const firstCall = runBrowserModeMock.mock.calls[0] as unknown[] | undefined;
    expect(firstCall?.[0]).toMatchObject({
      config: {
        url: "https://chatgpt.com/",
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

  test("reattach preserves recorded extended thinking", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-reattach-thinking-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Review the saved extended-thinking browser session.",
      filePatterns: [],
      dryRun: false,
    });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "running",
        thinkingTime: "extended",
        profileDir: path.join(cwd, "profile"),
        runtime: {
          chromePort: 9223,
          chromeHost: "127.0.0.1",
          tabUrl: "https://chatgpt.com/c/test-thinking",
        },
      },
    });
    await updateAskProStatus({ cwd, sessionId: session.id, status: "WAIT_TIMED_OUT" });

    await resumeAskProBrowserSession({ cwd, sessionId: session.id });

    const firstCall = resumeBrowserSessionMock.mock.calls[0] as unknown[] | undefined;
    expect(firstCall?.[1]).toMatchObject({
      thinkingTime: "extended",
    });
    const metadata = JSON.parse(
      await fs.readFile(path.join(session.dir, "browser.json"), "utf8"),
    ) as { thinkingTime?: string };
    expect(metadata.thinkingTime).toBe("extended");
  });

  test("reattach without runtime metadata reopens the managed browser submission", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-reattach-no-runtime-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Resume after login without a saved runtime.",
      filePatterns: [],
      dryRun: false,
    });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "needs_user_auth",
        thinkingTime: "extended",
        profileDir: path.join(os.homedir(), ".agents", "skills", "ask-pro", "browser-profile"),
        url: "https://chatgpt.com/",
      },
    });
    await updateAskProStatus({ cwd, sessionId: session.id, status: "WAITING" });

    await resumeAskProBrowserSession({ cwd, sessionId: session.id });

    expect(resumeBrowserSessionMock).not.toHaveBeenCalled();
    expect(runBrowserModeMock).toHaveBeenCalledTimes(1);
    const firstCall = runBrowserModeMock.mock.calls[0] as unknown[] | undefined;
    expect(firstCall?.[0]).toMatchObject({
      config: {
        manualLoginProfileDir: path.join(
          os.homedir(),
          ".agents",
          "skills",
          "ask-pro",
          "browser-profile",
        ),
        thinkingTime: "extended",
        url: "https://chatgpt.com/",
      },
    });
  });

  test("auth relaunch preserves stored non-default ChatGPT URL", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-reattach-custom-url-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Resume after login on a custom ChatGPT URL.",
      filePatterns: [],
      dryRun: false,
    });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "needs_user_auth",
        profileDir: path.join(os.homedir(), ".agents", "skills", "ask-pro", "browser-profile"),
        url: "https://chatgpt.com/g/g-test-project",
      },
    });
    await updateAskProStatus({ cwd, sessionId: session.id, status: "NEEDS_USER_AUTH" });

    await resumeAskProBrowserSession({ cwd, sessionId: session.id });

    const firstCall = runBrowserModeMock.mock.calls[0] as unknown[] | undefined;
    expect(firstCall?.[0]).toMatchObject({
      config: {
        url: "https://chatgpt.com/g/g-test-project",
      },
    });
  });

  test("reattach without runtime metadata fails closed unless auth was pending", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-reattach-no-runtime-waiting-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Resume a waiting session without runtime metadata.",
      filePatterns: [],
      dryRun: false,
    });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "running",
        profileDir: path.join(os.homedir(), ".agents", "skills", "ask-pro", "browser-profile"),
        url: "https://chatgpt.com/",
      },
    });
    await updateAskProStatus({ cwd, sessionId: session.id, status: "WAITING" });

    await expect(resumeAskProBrowserSession({ cwd, sessionId: session.id })).rejects.toThrow(
      /no saved browser runtime metadata/i,
    );
    expect(runBrowserModeMock).not.toHaveBeenCalled();
    expect(resumeBrowserSessionMock).not.toHaveBeenCalled();
  });

  test("no-temporary resume opens a normal chat retry instead of reattaching temporary chat", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-reattach-no-temporary-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Retry outside temporary chat.",
      filePatterns: [],
      dryRun: false,
    });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "running",
        profileDir: path.join(os.homedir(), ".agents", "skills", "ask-pro", "browser-profile"),
        url: "https://chatgpt.com/?temporary-chat=true",
        runtime: {
          chromePort: 9224,
          chromeHost: "127.0.0.1",
          tabUrl: "https://chatgpt.com/?temporary-chat=true",
        },
      },
    });
    await updateAskProStatus({ cwd, sessionId: session.id, status: "WAITING" });

    await resumeAskProBrowserSession({ cwd, sessionId: session.id, temporary: false });

    expect(resumeBrowserSessionMock).not.toHaveBeenCalled();
    expect(runBrowserModeMock).toHaveBeenCalledTimes(1);
    const firstCall = runBrowserModeMock.mock.calls[0] as unknown[] | undefined;
    expect(firstCall?.[0]).toMatchObject({
      config: {
        url: "https://chatgpt.com/",
      },
    });
  });

  test("reattach without runtime metadata reuses the stored agent profile", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-reattach-no-runtime-agent-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Resume after agent login without a saved runtime.",
      filePatterns: [],
      dryRun: false,
    });
    const storedProfile = path.join(
      os.homedir(),
      ".agents",
      "skills",
      "ask-pro",
      "agents",
      "review-t1-59cd6bada6",
      "browser-profile",
    );
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "needs_user_auth",
        agentId: "review-t1-59cd6bada6",
        profileDir: storedProfile,
        url: "https://chatgpt.com/",
      },
    });
    await updateAskProStatus({ cwd, sessionId: session.id, status: "NEEDS_USER_AUTH" });

    vi.stubEnv("ASK_PRO_AGENT_ID", "other-agent");
    await resumeAskProBrowserSession({ cwd, sessionId: session.id });

    expect(resumeBrowserSessionMock).not.toHaveBeenCalled();
    const firstCall = runBrowserModeMock.mock.calls[0] as unknown[] | undefined;
    expect(firstCall?.[0]).toMatchObject({
      config: {
        manualLoginProfileDir: storedProfile,
      },
    });
    const metadata = JSON.parse(
      await fs.readFile(path.join(session.dir, "browser.json"), "utf8"),
    ) as { agentId?: string | null; profileDir?: string };
    expect(metadata.agentId).toBe("review-t1-59cd6bada6");
    expect(metadata.profileDir).toBe(storedProfile);
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

  test("reattach rejects agent profile paths without a stored agent id", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-reattach-missing-agent-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Review the missing-agent managed browser session.",
      filePatterns: [],
      dryRun: false,
    });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "running",
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
          chromePort: 9776,
          chromeHost: "127.0.0.1",
          tabUrl: "https://chatgpt.com/c/test-missing-agent",
        },
      },
    });
    await updateAskProStatus({ cwd, sessionId: session.id, status: "WAIT_TIMED_OUT" });

    await expect(resumeAskProBrowserSession({ cwd, sessionId: session.id })).rejects.toThrow(
      /does not match stored agent id/i,
    );
    expect(resumeBrowserSessionMock).not.toHaveBeenCalled();
  });

  test("reattach rejects malformed profile paths under the ask-pro state root", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-reattach-malformed-state-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Review the malformed managed-root browser session.",
      filePatterns: [],
      dryRun: false,
    });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "running",
        profileDir: path.join(
          os.homedir(),
          ".agents",
          "skills",
          "ask-pro",
          "agents",
          "review-t1",
          "browser-profile",
        ),
        runtime: {
          chromePort: 9778,
          chromeHost: "127.0.0.1",
          tabUrl: "https://chatgpt.com/c/test-malformed-state",
        },
      },
    });
    await updateAskProStatus({ cwd, sessionId: session.id, status: "WAIT_TIMED_OUT" });

    await expect(resumeAskProBrowserSession({ cwd, sessionId: session.id })).rejects.toThrow(
      /stored ask-pro profile path is invalid/i,
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
        agentId: "review-t2-91dc99b944",
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

  test("reattach rejects agent profile paths that do not match the stored agent id", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-reattach-mismatch-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Review the mismatched managed browser session.",
      filePatterns: [],
      dryRun: false,
    });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "running",
        agentId: "review-t1-6d908a4714",
        profileDir: path.join(
          os.homedir(),
          ".agents",
          "skills",
          "ask-pro",
          "agents",
          "review-t2-91dc99b944",
          "browser-profile",
        ),
        runtime: {
          chromePort: 9777,
          chromeHost: "127.0.0.1",
          tabUrl: "https://chatgpt.com/c/test-mismatch",
        },
      },
    });
    await updateAskProStatus({ cwd, sessionId: session.id, status: "WAIT_TIMED_OUT" });

    await expect(resumeAskProBrowserSession({ cwd, sessionId: session.id })).rejects.toThrow(
      /does not match stored agent id/i,
    );
    expect(resumeBrowserSessionMock).not.toHaveBeenCalled();
  });

  test("reattach rejects agent metadata paired with the shared default profile", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-reattach-shared-agent-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Review the shared-default agent browser session.",
      filePatterns: [],
      dryRun: false,
    });
    await writeAskProBrowserMetadata({
      cwd,
      sessionId: session.id,
      metadata: {
        schemaVersion: 1,
        status: "running",
        agentId: "review-t1-6d908a4714",
        profileDir: path.join(os.homedir(), ".agents", "skills", "ask-pro", "browser-profile"),
        runtime: {
          chromePort: 9888,
          chromeHost: "127.0.0.1",
          tabUrl: "https://chatgpt.com/c/test-shared-agent",
        },
      },
    });
    await updateAskProStatus({ cwd, sessionId: session.id, status: "WAIT_TIMED_OUT" });

    await expect(resumeAskProBrowserSession({ cwd, sessionId: session.id })).rejects.toThrow(
      /stored ask-pro profile path is invalid/i,
    );
    expect(resumeBrowserSessionMock).not.toHaveBeenCalled();
  });
});
