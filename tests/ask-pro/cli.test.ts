import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("ask-pro cli", () => {
  test("documents the extended thinking switch", async () => {
    const cli = path.join(process.cwd(), "bin", "ask-pro-cli.ts");
    const tsxLoader = pathToFileURL(
      path.join(process.cwd(), "node_modules", "tsx", "dist", "esm", "index.mjs"),
    ).href;
    const { stdout } = await execFileAsync(process.execPath, [
      "--import",
      tsxLoader,
      cli,
      "--help",
    ]);

    expect(stdout).toContain("--extended");
    expect(stdout).toContain("multi-hour wait");
  }, 30000);

  test("creates a dry-run session", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-cli-"));
    tempDirs.push(cwd);
    await fs.mkdir(path.join(cwd, "src"), { recursive: true });
    await fs.writeFile(path.join(cwd, "src", "a.ts"), "export const a = 1;\n");

    const cli = path.join(process.cwd(), "bin", "ask-pro-cli.ts");
    const tsxLoader = pathToFileURL(
      path.join(process.cwd(), "node_modules", "tsx", "dist", "esm", "index.mjs"),
    ).href;
    const { stdout } = await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--dry-run", "--files", "src/**/*.ts", "Review this."],
      { cwd },
    );

    expect(stdout).toContain("ask-pro session created:");
    const sessions = await fs.readdir(path.join(cwd, ".ask-pro", "sessions"));
    expect(sessions).toHaveLength(1);
    const statusRaw = await fs.readFile(
      path.join(cwd, ".ask-pro", "sessions", sessions[0]!, "status.json"),
      "utf8",
    );
    expect(JSON.parse(statusRaw)).toMatchObject({ status: "DRY_RUN_COMPLETE", dryRun: true });
  }, 30000);
});
