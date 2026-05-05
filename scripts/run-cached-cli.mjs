#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cacheRoot = path.resolve(scriptDir, "..");
const cliEntry = path.join(cacheRoot, "dist", "bin", "ask-pro-cli.js");
const launcher = `${quoteCommandPart(process.execPath)} ${quoteCommandPart(fileURLToPath(import.meta.url))} --`;

const child = spawn(process.execPath, [cliEntry, ...args], {
  env: {
    ...process.env,
    ASK_PRO_SOURCE_CHECKOUT_LAUNCHER: launcher,
  },
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

function quoteCommandPart(value) {
  if (process.platform !== "win32") {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }
  return `"${value.replace(/"/g, '""')}"`;
}
