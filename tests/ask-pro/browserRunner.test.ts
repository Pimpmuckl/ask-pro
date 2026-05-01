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

vi.mock("../../src/browser/reattach.js", () => ({
  resumeBrowserSession: resumeBrowserSessionMock,
}));

const { resumeAskProBrowserSession } = await import("../../src/ask-pro/browserRunner.js");

const tempDirs: string[] = [];

afterEach(async () => {
  resumeBrowserSessionMock.mockClear();
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("ask-pro browser runner", () => {
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
    const answer = await readAskProAnswer({ cwd, sessionId: session.id });
    expect(answer.answer).toBe("# Reattached\n");
    const { status } = await readAskProStatus({ cwd, sessionId: session.id });
    expect(status.status).toBe("COMPLETED");
    const manifest = JSON.parse(
      await fs.readFile(path.join(session.dir, "PRO_OUTPUT_MANIFEST.json"), "utf8"),
    );
    expect(manifest.responseZip.status).toBe("unavailable");
  });
});
