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
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--dry-run", "--files", "src/**/*.ts", "Review this."],
      { cwd },
    );

    expect(stderr).toBe("");
    expect(stdout).toMatch(/^ask_pro\n/);
    expect(stdout).toContain("  state: dry_run_complete\n");
    expect(stdout).toContain("  files: 1\n");
    expect(stdout).toContain("  action: resume\n");
    expect(stdout).toContain('  resume: "ask-pro --resume ');
    expect(stdout).not.toContain("session created");
    const sessions = await fs.readdir(path.join(cwd, ".ask-pro", "sessions"));
    expect(sessions).toHaveLength(1);
    const statusRaw = await fs.readFile(
      path.join(cwd, ".ask-pro", "sessions", sessions[0]!, "status.json"),
      "utf8",
    );
    expect(JSON.parse(statusRaw)).toMatchObject({ status: "DRY_RUN_COMPLETE", dryRun: true });
    expect(JSON.parse(statusRaw).resumeCommand).not.toContain("--no-temporary");
  }, 30000);

  test("prints session status as compact TOON", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-cli-status-"));
    tempDirs.push(cwd);

    const cli = path.join(process.cwd(), "bin", "ask-pro-cli.ts");
    const tsxLoader = pathToFileURL(
      path.join(process.cwd(), "node_modules", "tsx", "dist", "esm", "index.mjs"),
    ).href;
    await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--dry-run", "--extended", "Review this."],
      { cwd },
    );

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--status"],
      { cwd },
    );

    expect(stderr).toBe("");
    expect(stdout).toMatch(/^ask_pro\n/);
    expect(stdout).toContain("  state: dry_run_complete\n");
    expect(stdout).toContain("  thinking: extended\n");
    expect(stdout).toContain("  temporary: default\n");
    expect(stdout).toContain("  action: resume\n");
    expect(stdout).not.toContain("{");
  }, 30000);

  test("prints harvest answer without metadata wrapper", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-cli-harvest-"));
    tempDirs.push(cwd);

    const cli = path.join(process.cwd(), "bin", "ask-pro-cli.ts");
    const tsxLoader = pathToFileURL(
      path.join(process.cwd(), "node_modules", "tsx", "dist", "esm", "index.mjs"),
    ).href;
    await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--dry-run", "Review this."],
      {
        cwd,
      },
    );
    const sessions = await fs.readdir(path.join(cwd, ".ask-pro", "sessions"));
    await fs.writeFile(
      path.join(cwd, ".ask-pro", "sessions", sessions[0]!, "ANSWER.md"),
      "line one\n\n  ",
      "utf8",
    );

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--harvest"],
      { cwd },
    );

    expect(stderr).toBe("");
    expect(stdout).toBe("line one\n\n  ");
  }, 30000);

  test("prints auth-gated status with login action", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-cli-auth-status-"));
    tempDirs.push(cwd);

    const cli = path.join(process.cwd(), "bin", "ask-pro-cli.ts");
    const tsxLoader = pathToFileURL(
      path.join(process.cwd(), "node_modules", "tsx", "dist", "esm", "index.mjs"),
    ).href;
    await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--dry-run", "Review this."],
      {
        cwd,
      },
    );
    const sessions = await fs.readdir(path.join(cwd, ".ask-pro", "sessions"));
    const statusPath = path.join(cwd, ".ask-pro", "sessions", sessions[0]!, "status.json");
    const status = JSON.parse(await fs.readFile(statusPath, "utf8"));
    await fs.writeFile(
      path.join(cwd, ".ask-pro", "sessions", sessions[0]!, "browser.json"),
      `${JSON.stringify({ schemaVersion: 1, status: "needs_user_auth", profileDir: "C:/AskPro/Profile" }, null, 2)}\n`,
      "utf8",
    );
    await fs.writeFile(
      statusPath,
      `${JSON.stringify(
        { ...status, status: "NEEDS_USER_AUTH", reason: "login_page_detected" },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--status"],
      { cwd },
    );

    expect(stderr).toBe("");
    expect(stdout).toContain("  state: needs_auth\n");
    expect(stdout).toContain("  action: human_login_then_resume\n");
    expect(stdout).toContain('  profile: "C:/AskPro/Profile"\n');
    expect(stdout).toContain('  resume: "ask-pro --resume ');
  }, 30000);

  test("prints resume command for waiting status", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-cli-waiting-status-"));
    tempDirs.push(cwd);

    const cli = path.join(process.cwd(), "bin", "ask-pro-cli.ts");
    const tsxLoader = pathToFileURL(
      path.join(process.cwd(), "node_modules", "tsx", "dist", "esm", "index.mjs"),
    ).href;
    await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--dry-run", "Review this."],
      {
        cwd,
      },
    );
    const sessions = await fs.readdir(path.join(cwd, ".ask-pro", "sessions"));
    const statusPath = path.join(cwd, ".ask-pro", "sessions", sessions[0]!, "status.json");
    const status = JSON.parse(await fs.readFile(statusPath, "utf8"));
    await fs.writeFile(
      statusPath,
      `${JSON.stringify({ ...status, status: "WAITING" }, null, 2)}\n`,
      "utf8",
    );

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--status"],
      { cwd },
    );

    expect(stderr).toBe("");
    expect(stdout).toContain("  state: waiting\n");
    expect(stdout).toContain("  action: wait\n");
    expect(stdout).toContain('  resume: "ask-pro --resume ');
    expect(stdout).not.toContain("  answer: ");
  }, 30000);

  test("prints copy target as compact TOON", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-cli-copy-"));
    tempDirs.push(cwd);

    const cli = path.join(process.cwd(), "bin", "ask-pro-cli.ts");
    const tsxLoader = pathToFileURL(
      path.join(process.cwd(), "node_modules", "tsx", "dist", "esm", "index.mjs"),
    ).href;
    await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--dry-run", "Review this."],
      {
        cwd,
      },
    );

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--copy"],
      { cwd },
    );

    expect(stderr).toBe("");
    expect(stdout).toMatch(/^ask_pro\n/);
    expect(stdout).toContain("  state: dry_run_complete\n");
    expect(stdout).toContain("  action: copy_target\n");
    expect(stdout).toContain("  target: ");
    expect(stdout).toContain("ANSWER.md");
  }, 30000);

  test("does not print harvest command after session is harvested", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-cli-harvested-status-"));
    tempDirs.push(cwd);

    const cli = path.join(process.cwd(), "bin", "ask-pro-cli.ts");
    const tsxLoader = pathToFileURL(
      path.join(process.cwd(), "node_modules", "tsx", "dist", "esm", "index.mjs"),
    ).href;
    await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--dry-run", "Review this."],
      {
        cwd,
      },
    );
    await execFileAsync(process.execPath, ["--import", tsxLoader, cli, "--harvest"], { cwd });

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--status"],
      { cwd },
    );

    expect(stderr).toBe("");
    expect(stdout).toContain("  state: harvested\n");
    expect(stdout).toContain("  action: read_answer\n");
    expect(stdout).toContain("  answer: ");
    expect(stdout).not.toContain("  harvest: ");
  }, 30000);

  test("prints errors as structured stdout", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-cli-error-"));
    tempDirs.push(cwd);

    const cli = path.join(process.cwd(), "bin", "ask-pro-cli.ts");
    const tsxLoader = pathToFileURL(
      path.join(process.cwd(), "node_modules", "tsx", "dist", "esm", "index.mjs"),
    ).href;

    await expect(
      execFileAsync(process.execPath, ["--import", tsxLoader, cli, "--dry-run"], { cwd }),
    ).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining("ask_pro_error\n"),
      stderr: "",
    });
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

  test("preserves explicit no-temporary mode in dry-run resume command", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-cli-no-temporary-"));
    tempDirs.push(cwd);

    const cli = path.join(process.cwd(), "bin", "ask-pro-cli.ts");
    const tsxLoader = pathToFileURL(
      path.join(process.cwd(), "node_modules", "tsx", "dist", "esm", "index.mjs"),
    ).href;
    await execFileAsync(
      process.execPath,
      ["--import", tsxLoader, cli, "--dry-run", "--no-temporary", "Review this."],
      { cwd },
    );

    const sessions = await fs.readdir(path.join(cwd, ".ask-pro", "sessions"));
    const statusRaw = await fs.readFile(
      path.join(cwd, ".ask-pro", "sessions", sessions[0]!, "status.json"),
      "utf8",
    );
    expect(JSON.parse(statusRaw)).toMatchObject({
      temporary: false,
      resumeCommand: expect.stringContaining("--no-temporary --resume"),
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
