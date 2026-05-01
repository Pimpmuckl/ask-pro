#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rawArgs = process.argv.slice(2);
const args: string[] = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

const here = path.dirname(fileURLToPath(import.meta.url));
const cliEntry = path.join(here, "../bin/ask-pro-cli.js");

const child = spawn(process.execPath, ["--", cliEntry, ...args], {
  stdio: "inherit",
});
child.on("exit", (code) => {
  process.exit(code ?? 0);
});
