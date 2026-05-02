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
    expect(stdout).toContain("--temporary");
    expect(stdout).toContain("--no-temporary");
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

  test("preserves extended and temporary flags in dry-run resume command", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-cli-resume-"));
    tempDirs.push(cwd);

    const cli = path.join(process.cwd(), "bin", "ask-pro-cli.ts");
    const tsxLoader = pathToFileURL(
      path.join(process.cwd(), "node_modules", "tsx", "dist", "esm", "index.mjs"),
    ).href;
    await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--dry-run", "--extended", "--temporary", "Review this."],
      { cwd },
    );

    const sessions = await fs.readdir(path.join(cwd, ".ask-pro", "sessions"));
    const statusRaw = await fs.readFile(
      path.join(cwd, ".ask-pro", "sessions", sessions[0]!, "status.json"),
      "utf8",
    );
    expect(JSON.parse(statusRaw)).toMatchObject({
      thinkingTime: "extended",
      temporary: true,
      resumeCommand: expect.stringContaining("--extended --temporary --resume"),
    });
  }, 30000);

  test("does not infer source checkout launcher from an unrelated npm start script", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-cli-npm-start-"));
    tempDirs.push(cwd);

    const cli = path.join(process.cwd(), "bin", "ask-pro-cli.ts");
    const tsxLoader = pathToFileURL(
      path.join(process.cwd(), "node_modules", "tsx", "dist", "esm", "index.mjs"),
    ).href;
    await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--dry-run", "--extended", "Review this."],
      { cwd, env: { ...process.env, npm_lifecycle_event: "start" } },
    );

    const sessions = await fs.readdir(path.join(cwd, ".ask-pro", "sessions"));
    const statusRaw = await fs.readFile(
      path.join(cwd, ".ask-pro", "sessions", sessions[0]!, "status.json"),
      "utf8",
    );
    expect(JSON.parse(statusRaw)).toMatchObject({
      resumeCommand: expect.stringMatching(/^ask-pro --extended --resume /),
    });
  }, 30000);

  test("uses source-checkout launcher in resume command when invoked through pnpm start", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-cli-source-resume-"));
    tempDirs.push(cwd);

    const cli = path.join(process.cwd(), "bin", "ask-pro-cli.ts");
    const tsxLoader = pathToFileURL(
      path.join(process.cwd(), "node_modules", "tsx", "dist", "esm", "index.mjs"),
    ).href;
    await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--dry-run", "--extended", "Review this."],
      {
        cwd,
        env: {
          ...process.env,
          ASK_PRO_SOURCE_CHECKOUT_LAUNCHER:
            'npm exec --yes pnpm@10.33.2 -- --dir "C:/Code/ask-pro" start --',
          INIT_CWD: cwd,
        },
      },
    );

    const sessions = await fs.readdir(path.join(cwd, ".ask-pro", "sessions"));
    const statusRaw = await fs.readFile(
      path.join(cwd, ".ask-pro", "sessions", sessions[0]!, "status.json"),
      "utf8",
    );
    expect(JSON.parse(statusRaw)).toMatchObject({
      resumeCommand: expect.stringMatching(
        /^npm exec --yes pnpm@10\.33\.2 -- --dir "C:\/Code\/ask-pro" start -- --cwd ".+" --extended --resume /,
      ),
      harvestCommand: expect.stringMatching(
        /^npm exec --yes pnpm@10\.33\.2 -- --dir "C:\/Code\/ask-pro" start -- --cwd ".+" --harvest /,
      ),
    });
  }, 30000);

  test("source-checkout launcher uses INIT_CWD as the project directory", async () => {
    const projectCwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-cli-source-cwd-"));
    tempDirs.push(projectCwd);

    const cli = path.join(process.cwd(), "bin", "ask-pro-cli.ts");
    const tsxLoader = pathToFileURL(
      path.join(process.cwd(), "node_modules", "tsx", "dist", "esm", "index.mjs"),
    ).href;
    await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--dry-run", "Review this."],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ASK_PRO_SOURCE_CHECKOUT_LAUNCHER:
            'npm exec --yes pnpm@10.33.2 -- --dir "C:/Code/ask-pro" start --',
          INIT_CWD: projectCwd,
        },
      },
    );

    const sessions = await fs.readdir(path.join(projectCwd, ".ask-pro", "sessions"));
    expect(sessions).toHaveLength(1);
  }, 30000);
});
