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
const projectCwd = process.cwd();
const codexHome = path.resolve(process.env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex"));
const runtimeRoot = await ensureRuntime();
const cliEntry = path.join(runtimeRoot, "dist", "bin", "ask-pro-cli.js");
const launcher = `${quoteCommandPart(process.execPath)} ${quoteCommandPart(sourceScript)} --`;
const lease = path.join(runtimeRoot, `.active-${process.pid}.json`);

try {
  process.exitCode = await run(
    process.execPath,
    [cliEntry, ...args],
    {
      cwd: projectCwd,
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
        INIT_CWD: projectCwd,
        ASK_PRO_SOURCE_CHECKOUT_LAUNCHER: launcher,
      },
    },
    true,
    (child) => fs.writeFileSync(lease, JSON.stringify({ pid: child.pid })),
  );
} finally {
  fs.rmSync(lease, { force: true });
}

async function ensureRuntime() {
  const packageJsonPath = path.join(sourceRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`ask-pro plugin cache is missing package.json at ${packageJsonPath}`);
  }
  const parent = path.join(codexHome, "plugin-runtimes", "ask-pro");
  fs.mkdirSync(parent, { recursive: true });
  pruneStaging(parent);
  const staging = path.join(parent, `.staging-${process.pid}-${randomUUID()}`);
  try {
    fs.cpSync(sourceRoot, staging, {
      recursive: true,
      filter: (source) => !excluded(path.relative(sourceRoot, source)),
    });
    const packageJson = JSON.parse(fs.readFileSync(path.join(staging, "package.json"), "utf8"));
    const contentHash = hashSource(staging);
    const version = safeKeyPart(packageJson.version || "0.0.0");
    const target = path.join(parent, `${version}-${contentHash.slice(0, 16)}`);
    if (fs.existsSync(path.join(target, ".ask-pro-runtime-ready"))) {
      fs.rmSync(staging, { recursive: true, force: true });
      fs.utimesSync(path.join(target, ".ask-pro-runtime-ready"), new Date(), new Date());
      pruneRuntimes(parent, target);
      return target;
    }
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
    pruneRuntimes(parent, target);
    return target;
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
}

function pruneStaging(parent) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(".staging-")) continue;
    const root = path.join(parent, entry.name);
    try {
      if (fs.statSync(root).mtimeMs < cutoff) fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
}

function pruneRuntimes(parent, keep) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const root = path.join(parent, entry.name);
    const ready = path.join(root, ".ask-pro-runtime-ready");
    if (root === keep) continue;
    try {
      if (entry.name.startsWith(".staging-")) continue;
      if (!fs.existsSync(ready) || fs.statSync(ready).mtimeMs >= cutoff || hasLiveLease(root)) {
        continue;
      }
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // best-effort cleanup must not block the selected runtime
    }
  }
}

function hasLiveLease(root) {
  let names;
  try {
    names = fs.readdirSync(root);
  } catch {
    return true;
  }
  for (const name of names) {
    if (!name.startsWith(".active-")) continue;
    const lease = path.join(root, name);
    try {
      const { pid } = JSON.parse(fs.readFileSync(lease, "utf8"));
      if (isProcessAlive(pid)) return true;
    } catch {
      // stale or unreadable lease
    }
    fs.rmSync(lease, { force: true });
  }
  return false;
}

function isProcessAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
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
    await runNpm(
      [
        "exec",
        "--yes",
        "pnpm@10.33.2",
        "--",
        "install",
        "--frozen-lockfile",
        "--ignore-scripts",
        ...(needsBuild ? ["--prod=false"] : []),
      ],
      root,
    );
  }
  if (needsBuild) {
    await runNpm(["exec", "--yes", "pnpm@10.33.2", "--", "run", "build"], root);
  }
  if (!fs.existsSync(cli)) {
    throw new Error(`ask-pro bootstrap completed but CLI entry is still missing: ${cli}`);
  }
}

function hashSource(root) {
  const digest = createHash("sha256");
  for (const file of sourceFiles(root)) {
    const relative = path.relative(root, file).split(path.sep).join("/");
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

function run(command, args, options, allowNonzero = false, onSpawn) {
  const child = spawn(command, args, { ...options, stdio: "inherit" });
  onSpawn?.(child);
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0 || allowNonzero) resolve(code ?? 1);
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? "unknown"}`));
    });
  });
}
