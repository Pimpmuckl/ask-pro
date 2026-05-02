#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = parseArgs(process.argv.slice(2));
const pluginName = args.pluginName ?? "ask-pro";
const marketplacePath =
  args.marketplacePath ?? path.join(os.homedir(), ".agents", "plugins", "marketplace.json");
const codexHome = args.codexHome ?? process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const marketplaceFile = path.resolve(marketplacePath);
const marketplace = JSON.parse(await fs.readFile(marketplaceFile, "utf8"));
const marketplaceName = String(marketplace.name ?? "").trim();
if (!marketplaceName) {
  throw new Error("Marketplace file must include a top-level name.");
}

const plugin = Array.isArray(marketplace.plugins)
  ? marketplace.plugins.find((entry) => entry?.name === pluginName)
  : null;
if (!plugin) {
  throw new Error(`Plugin '${pluginName}' was not found in ${marketplaceFile}.`);
}
if (plugin.source?.source !== "local") {
  throw new Error(`Plugin '${pluginName}' is not a local marketplace plugin.`);
}

const manifestPath = path.join(repoRoot, ".codex-plugin", "plugin.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
if (manifest.name !== pluginName) {
  throw new Error(
    `Plugin manifest name '${manifest.name}' does not match requested plugin '${pluginName}'.`,
  );
}

const cacheRoot = path.resolve(codexHome, "plugins", "cache");
const pluginCacheRoot = path.resolve(cacheRoot, marketplaceName, pluginName);
const targetRoot = path.resolve(pluginCacheRoot, "local");
assertInside(
  pluginCacheRoot,
  cacheRoot,
  "Resolved plugin cache path is outside Codex plugin cache",
);

await fs.rm(targetRoot, { recursive: true, force: true });
await fs.mkdir(targetRoot, { recursive: true });

for (const item of [".codex-plugin", "skills", "references", "README.md", "LICENSE"]) {
  const source = path.join(repoRoot, item);
  if (!(await exists(source))) continue;
  await fs.cp(source, path.join(targetRoot, item), { recursive: true, force: true });
}

console.log("Refreshed local Codex plugin cache:");
console.log(`  source: ${repoRoot}`);
console.log(`  target: ${targetRoot}`);
console.log("");
console.log("Restart or reload Codex to pick up refreshed plugin skills.");

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (!arg.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error(`Expected --name value argument, got '${arg}'.`);
    }
    i += 1;
    if (arg === "--marketplace-path") result.marketplacePath = value;
    else if (arg === "--codex-home") result.codexHome = value;
    else if (arg === "--plugin-name") result.pluginName = value;
    else throw new Error(`Unknown argument '${arg}'.`);
  }
  return result;
}

function assertInside(child, parent, message) {
  const relative = path.relative(parent, child);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${message}: ${child}`);
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
