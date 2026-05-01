import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  createAskProSession,
  readAskProAnswer,
  readAskProStatus,
} from "../../src/ask-pro/session.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("ask-pro sessions", () => {
  test("creates a dry-run session with manifests and a context zip", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-session-"));
    tempDirs.push(cwd);
    await fs.mkdir(path.join(cwd, "src"), { recursive: true });
    await fs.writeFile(
      path.join(cwd, "src", "example.ts"),
      "const token = 'sk-testsecretsecretsecretsecret';\n",
    );

    const session = await createAskProSession({
      cwd,
      question: "Review this billing queue plan.",
      filePatterns: ["src/**/*.ts"],
      dryRun: true,
    });

    expect(session.status.status).toBe("DRY_RUN_COMPLETE");
    expect(session.manifest.includedFiles).toEqual([
      { path: "src/example.ts", reason: "Matched by --files pattern." },
    ]);

    const files = await fs.readdir(session.dir);
    expect(files).toEqual(
      expect.arrayContaining([
        "PROMPT.md",
        "MANIFEST.md",
        "MANIFEST.json",
        "CONTEXT.zip",
        "ANSWER.md",
        "browser.json",
        "status.json",
        "log.txt",
      ]),
    );
    const zip = await fs.readFile(path.join(session.dir, "CONTEXT.zip"));
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.toString("utf8")).toContain("[REDACTED_OPENAI_KEY]");
  });

  test("reads latest status and answer", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-session-"));
    tempDirs.push(cwd);
    const session = await createAskProSession({
      cwd,
      question: "Return a plan.",
      filePatterns: [],
      dryRun: true,
    });

    const latest = await readAskProStatus({ cwd });
    expect(latest.status.sessionId).toBe(session.id);

    const answer = await readAskProAnswer({ cwd, sessionId: session.id });
    expect(answer.answer).toContain("No browser submission");
  });
});
