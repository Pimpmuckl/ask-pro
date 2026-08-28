import type { BrowserLogger, ChromeClient } from "../types.js";

type BrowserWindowController = {
  getWindowForTarget?: (params?: { targetId?: string }) => Promise<{
    windowId?: number;
    bounds?: { windowState?: string };
  }>;
  setWindowBounds?: (params: {
    windowId: number;
    bounds: { windowState: "normal" | "minimized" };
  }) => Promise<unknown>;
};

export async function isChromeWindowMinimized(client: ChromeClient): Promise<boolean | null> {
  const browser = client.Browser as BrowserWindowController | undefined;
  if (typeof browser?.getWindowForTarget !== "function") return null;

  try {
    const targetId = await readCurrentTargetId(client);
    const { bounds } = await browser.getWindowForTarget(targetId ? { targetId } : undefined);
    return typeof bounds?.windowState === "string" ? bounds.windowState === "minimized" : null;
  } catch {
    return null;
  }
}

export async function setChromeWindowState(
  client: ChromeClient,
  windowState: "normal" | "minimized",
  logger: BrowserLogger,
  options: { targetId?: string; reason?: string } = {},
): Promise<boolean> {
  const browser = client.Browser as BrowserWindowController | undefined;
  if (
    typeof browser?.getWindowForTarget !== "function" ||
    typeof browser.setWindowBounds !== "function"
  ) {
    logger("[browser] Chrome window parking unavailable in this DevTools session.");
    return false;
  }

  try {
    const targetId = options.targetId ?? (await readCurrentTargetId(client));
    const targetParams = targetId ? { targetId } : undefined;
    const { windowId } = await browser.getWindowForTarget(targetParams);
    if (typeof windowId !== "number") {
      logger("[browser] Chrome window parking unavailable: missing window id.");
      return false;
    }
    await browser.setWindowBounds({ windowId, bounds: { windowState } });
    const action = windowState === "minimized" ? "parked (minimized)" : "restored";
    logger(`[browser] Chrome window ${action}${options.reason ? ` (${options.reason})` : ""}`);
    return true;
  } catch (error) {
    logger(
      `[browser] Failed to ${windowState === "minimized" ? "park" : "restore"} Chrome window: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

async function readCurrentTargetId(client: ChromeClient): Promise<string | undefined> {
  try {
    const info = await client.Target?.getTargetInfo?.({});
    return info?.targetInfo?.targetId;
  } catch {
    return undefined;
  }
}
