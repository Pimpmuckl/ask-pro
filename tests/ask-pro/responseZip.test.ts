import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createStoredZip } from "../../src/ask-pro/zip.js";
import {
  harvestAssistantZipDownloadButton,
  processResponseZip,
  writeResponseZipManifest,
} from "../../src/ask-pro/responseZip.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("ask-pro response zip", () => {
  test("extracts a valid implementation bundle", async () => {
    const sessionDir = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-response-"));
    tempDirs.push(sessionDir);
    const downloadsDir = path.join(sessionDir, "downloads");
    await fs.mkdir(downloadsDir, { recursive: true });
    const zipPath = path.join(downloadsDir, "ask-pro-response.zip");
    await fs.writeFile(
      zipPath,
      createStoredZip([
        { name: "IMPLEMENTATION_PLAN.md", data: "# Plan\n" },
        { name: "TASKS.json", data: '{"schemaVersion":1,"tasks":[]}\n' },
        { name: "TEST_PLAN.md", data: "# Tests\n" },
        { name: "RISK_REGISTER.md", data: "# Risks\n" },
        { name: "FILES_TO_EDIT.md", data: "# Files\n" },
        { name: "REPO_CONTEXT_USED.md", data: "# Context\n" },
      ]),
    );

    const manifest = await processResponseZip({ sessionDir });
    await writeResponseZipManifest(sessionDir, manifest);

    expect(manifest.responseZip.status).toBe("downloaded");
    expect(manifest.responseZip.requiredFilesPresent).toBe(true);
    await expect(
      fs.readFile(path.join(sessionDir, "pro-output", "TASKS.json"), "utf8"),
    ).resolves.toContain('"tasks"');
    await expect(
      fs.readFile(path.join(sessionDir, "PRO_OUTPUT_MANIFEST.json"), "utf8"),
    ).resolves.toContain('"downloaded"');
  });

  test("marks unavailable when no zip exists", async () => {
    const sessionDir = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-response-"));
    tempDirs.push(sessionDir);

    const manifest = await processResponseZip({ sessionDir });

    expect(manifest.responseZip.status).toBe("unavailable");
    expect(manifest.responseZip.requiredFilesPresent).toBe(false);
  });

  test("clicks ChatGPT file button downloads into the session directory", async () => {
    const sessionDir = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-response-"));
    tempDirs.push(sessionDir);
    let downloadPath = "";
    let mouseEvents = 0;
    const runtime = {
      evaluate: async () => {
        return {
          result: {
            value: {
              found: true,
              x: 12,
              y: 34,
              notes: ["Clicked response zip download button: Download ask-pro-response.zip"],
            },
          },
        };
      },
    };
    const page = {
      setDownloadBehavior: async ({ downloadPath: nextPath }: { downloadPath: string }) => {
        downloadPath = nextPath;
      },
    };
    const input = {
      dispatchMouseEvent: async () => {
        mouseEvents += 1;
        if (mouseEvents === 3) {
          await fs.writeFile(
            path.join(downloadPath, "ask-pro-response.zip"),
            createStoredZip([
              { name: "IMPLEMENTATION_PLAN.md", data: "# Plan\n" },
              { name: "TASKS.json", data: '{"schemaVersion":1,"tasks":[]}\n' },
              { name: "TEST_PLAN.md", data: "# Tests\n" },
              { name: "RISK_REGISTER.md", data: "# Risks\n" },
              { name: "FILES_TO_EDIT.md", data: "# Files\n" },
              { name: "REPO_CONTEXT_USED.md", data: "# Context\n" },
            ]),
          );
        }
      },
    };

    const manifest = await harvestAssistantZipDownloadButton({
      runtime: runtime as never,
      page: page as never,
      input: input as never,
      sessionDir,
    });

    expect(mouseEvents).toBe(3);
    expect(manifest?.responseZip.status).toBe("downloaded");
    expect(manifest?.responseZip.requiredFilesPresent).toBe(true);
    await expect(
      fs.readFile(path.join(sessionDir, "pro-output", "IMPLEMENTATION_PLAN.md"), "utf8"),
    ).resolves.toContain("# Plan");
  });
});
