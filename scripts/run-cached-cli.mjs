#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
const sourceScript = fileURLToPath(import.meta.url);
const sourceRoot = path.resolve(path.dirname(sourceScript), "..");
const codexHome = path.resolve(process.env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex"));
const runtimeRoot = await ensureRuntime();
const cliEntry = path.join(runtimeRoot, "dist", "bin", "ask-pro-cli.js");
const launcher = `${quoteCommandPart(process.execPath)} ${quoteCommandPart(sourceScript)} --`;

process.exitCode = await run(
  process.execPath,
  [cliEntry, ...args],
  {
    cwd: runtimeRoot,
    env: {
      ...process.env,
      ASK_PRO_SOURCE_CHECKOUT_LAUNCHER: launcher,
    },
  },
  true,
);

async function ensureRuntime() {
  const packageJsonPath = path.join(sourceRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`ask-pro plugin cache is missing package.json at ${packageJsonPath}`);
  }
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const contentHash = hashSource();
  const version = safeKeyPart(packageJson.version || "0.0.0");
  const parent = path.join(codexHome, "plugin-runtimes", "ask-pro");
  const target = path.join(parent, `${version}-${contentHash.slice(0, 16)}`);
  if (fs.existsSync(path.join(target, ".ask-pro-runtime-ready"))) return target;

  fs.mkdirSync(parent, { recursive: true });
  const staging = path.join(parent, `.staging-${process.pid}-${randomUUID()}`);
  try {
    fs.cpSync(sourceRoot, staging, {
      recursive: true,
      filter: (source) => !excluded(path.relative(sourceRoot, source)),
    });
    await bootstrap(staging, packageJson);
    fs.writeFileSync(
      path.join(staging, ".ask-pro-runtime-ready"),
      `${JSON.stringify({ version, contentHash }, null, 2)}\n`,
    );
    try {
      fs.renameSync(staging, target);
    } catch (error) {
      if (!fs.existsSync(path.join(target, ".ask-pro-runtime-ready"))) throw error;
      fs.rmSync(staging, { recursive: true, force: true });
    }
    return target;
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

async function bootstrap(root, packageJson) {
  const cli = path.join(root, "dist", "bin", "ask-pro-cli.js");
  const needsBuild = !fs.existsSync(cli);
  const needsInstall =
    needsBuild ||
    Object.keys(packageJson.dependencies || {}).length > 0 ||
    Object.keys(packageJson.optionalDependencies || {}).length > 0;
  if (needsInstall) {
    console.error("[ask-pro] preparing immutable plugin runtime.");
    await runNpm(["exec", "--yes", "pnpm@10.33.2", "--", "install", "--frozen-lockfile"], root);
  }
  if (needsBuild) {
    await runNpm(["exec", "--yes", "pnpm@10.33.2", "--", "run", "build"], root);
  }
  if (!fs.existsSync(cli)) {
    throw new Error(`ask-pro bootstrap completed but CLI entry is still missing: ${cli}`);
  }
}

function hashSource() {
  const digest = createHash("sha256");
  for (const file of sourceFiles(sourceRoot)) {
    const relative = path.relative(sourceRoot, file).split(path.sep).join("/");
    digest.update(relative);
    digest.update("\0");
    digest.update(fs.readFileSync(file));
    digest.update("\0");
  }
  return digest.digest("hex");
}

function sourceFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (excluded(entry.name)) continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function excluded(relative) {
  const first = relative.split(path.sep)[0];
  return first === "node_modules" || first === ".git" || first === ".ask-pro";
}

function safeKeyPart(value) {
  return (
    String(value)
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/^[._-]+|[._-]+$/g, "") || "0.0.0"
  );
}

function quoteCommandPart(value) {
  if (process.platform !== "win32") return `'${value.replace(/'/g, "'\\''")}'`;
  return `"${value.replace(/"/g, '""')}"`;
}

function runNpm(args, cwd) {
  const npmCli = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
  if (fs.existsSync(npmCli)) {
    return run(process.execPath, [npmCli, ...args], { cwd, env: process.env });
  }
  return run("npm", args, { cwd, env: process.env, shell: process.platform === "win32" });
}

function run(command, args, options, allowNonzero = false) {
  const child = spawn(command, args, { ...options, stdio: "inherit" });
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0 || allowNonzero) resolve(code ?? 1);
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? "unknown"}`));
    });
  });
}
