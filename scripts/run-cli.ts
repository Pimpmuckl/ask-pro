#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rawArgs = process.argv.slice(2);
const args: string[] = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot =
  path.basename(path.dirname(here)) === "dist"
    ? path.resolve(here, "../..")
    : path.resolve(here, "..");
const cliEntry = path.join(here, "../bin/ask-pro-cli.js");

const child = spawn(process.execPath, ["--", cliEntry, ...args], {
  env: {
    ...process.env,
    ASK_PRO_SOURCE_CHECKOUT_LAUNCHER: `npm exec --yes pnpm@10.33.2 -- --dir ${quoteCommandArg(repoRoot)} start --`,
  },
  stdio: "inherit",
});
child.on("exit", (code) => {
  process.exit(code ?? 0);
});

function quoteCommandArg(value: string): string {
  if (process.platform !== "win32") {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }
  return `"${value.replace(/"/g, '""')}"`;
}
