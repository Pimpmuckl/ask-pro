import fs from "node:fs/promises";
import path from "node:path";
import type { BrowserLogger, ChromeClient } from "./types.js";
import { isAskProStatePath } from "./profilePaths.js";

const DEFAULT_ACCEPT_LANGUAGE = "en-US,en";

export async function seedChromeProfileLanguage(
  userDataDir: string,
  acceptLanguage = DEFAULT_ACCEPT_LANGUAGE,
  logger?: BrowserLogger,
): Promise<void> {
  if (!isAskProStatePath(userDataDir)) {
    return;
  }
  const patch = buildChromeProfileLanguagePatch(acceptLanguage);
  await mergeJsonFile(path.join(userDataDir, "Default", "Preferences"), patch.preferences);
  await mergeJsonFile(path.join(userDataDir, "Local State"), patch.localState);
  if (logger?.verbose) {
    logger(`Chrome profile language: ${acceptLanguage} (selected=${acceptLanguage})`);
  }
}

export function buildChromeProfileLanguagePatchForTest(acceptLanguage = DEFAULT_ACCEPT_LANGUAGE) {
  return buildChromeProfileLanguagePatch(acceptLanguage);
}

export async function applyPageLanguageOverrides(
  client: ChromeClient,
  acceptLanguage = DEFAULT_ACCEPT_LANGUAGE,
  logger?: BrowserLogger,
): Promise<void> {
  const headersPromise = client.Network?.setExtraHTTPHeaders?.({
    headers: { "Accept-Language": acceptLanguage },
  });
  await headersPromise?.catch(() => undefined);
  const primaryLanguage = acceptLanguage.split(",", 1)[0]?.trim() || "en-US";
  const locale = primaryLanguage.replace("-", "_");
  const localePromise = client.Emulation?.setLocaleOverride?.({ locale });
  await localePromise?.catch(() => undefined);
  if (logger?.verbose) {
    logger(`Page language override: Accept-Language=${acceptLanguage}, locale=${locale}`);
  }
}

async function mergeJsonFile(filePath: string, patch: Record<string, unknown>): Promise<void> {
  let current: Record<string, unknown> = {};
  let raw: string | null = null;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (!isMissingFileError(error)) {
      return;
    }
  }
  if (raw !== null) {
    try {
      current = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
  }
  const merged = mergeObjects(current, patch);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(merged, null, 2)}\n`);
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function mergeObjects(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const baseValue = merged[key];
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      merged[key] = mergeObjects(baseValue, value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function buildChromeProfileLanguagePatch(acceptLanguage: string): {
  preferences: Record<string, unknown>;
  localState: Record<string, unknown>;
} {
  const primaryLanguage = acceptLanguage.split(",", 1)[0]?.trim() || "en-US";
  const baseLanguage = primaryLanguage.split("-", 1)[0] || primaryLanguage;
  return {
    preferences: {
      intl: {
        accept_languages: acceptLanguage,
        app_locale: primaryLanguage,
        selected_languages: acceptLanguage,
      },
      spellcheck: {
        dictionaries: Array.from(new Set([primaryLanguage, baseLanguage].filter(Boolean))),
      },
    },
    localState: {
      intl: {
        app_locale: primaryLanguage,
      },
    },
  };
}
