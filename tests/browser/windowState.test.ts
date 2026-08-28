import { describe, expect, test, vi } from "vitest";
import {
  isChromeWindowMinimized,
  setChromeWindowState,
} from "../../src/browser/actions/windowState.js";

describe("Chrome window state actions", () => {
  test("reads the current target window's minimized state", async () => {
    const getWindowForTarget = vi
      .fn()
      .mockResolvedValueOnce({ windowId: 42, bounds: { windowState: "minimized" } })
      .mockResolvedValueOnce({ windowId: 42, bounds: { windowState: "normal" } });
    const getTargetInfo = vi.fn().mockResolvedValue({ targetInfo: { targetId: "current-target" } });

    await expect(
      isChromeWindowMinimized({
        Browser: { getWindowForTarget },
        Target: { getTargetInfo },
      } as never),
    ).resolves.toBe(true);
    await expect(
      isChromeWindowMinimized({
        Browser: { getWindowForTarget },
        Target: { getTargetInfo },
      } as never),
    ).resolves.toBe(false);
    expect(getWindowForTarget).toHaveBeenCalledWith({ targetId: "current-target" });
  });

  test("minimizes the current target window", async () => {
    const getWindowForTarget = vi.fn().mockResolvedValue({ windowId: 42 });
    const setWindowBounds = vi.fn().mockResolvedValue(undefined);
    const logger = vi.fn<(message: string) => void>();

    const result = await setChromeWindowState(
      { Browser: { getWindowForTarget, setWindowBounds } } as never,
      "minimized",
      logger,
      { targetId: "target-1", reason: "concurrent-tab" },
    );

    expect(result).toBe(true);
    expect(getWindowForTarget).toHaveBeenCalledWith({ targetId: "target-1" });
    expect(setWindowBounds).toHaveBeenCalledWith({
      windowId: 42,
      bounds: { windowState: "minimized" },
    });
    expect(logger).toHaveBeenCalledWith(
      "[browser] Chrome window parked (minimized) (concurrent-tab)",
    );
  });

  test("restores the current target window", async () => {
    const getWindowForTarget = vi.fn().mockResolvedValue({ windowId: 42 });
    const setWindowBounds = vi.fn().mockResolvedValue(undefined);
    const getTargetInfo = vi.fn().mockResolvedValue({ targetInfo: { targetId: "current-target" } });
    const logger = vi.fn<(message: string) => void>();

    await setChromeWindowState(
      { Browser: { getWindowForTarget, setWindowBounds }, Target: { getTargetInfo } } as never,
      "normal",
      logger,
      { reason: "manual-recovery" },
    );

    expect(getTargetInfo).toHaveBeenCalledWith({});
    expect(getWindowForTarget).toHaveBeenCalledWith({ targetId: "current-target" });
    expect(setWindowBounds).toHaveBeenCalledWith({
      windowId: 42,
      bounds: { windowState: "normal" },
    });
    expect(logger).toHaveBeenCalledWith("[browser] Chrome window restored (manual-recovery)");
  });

  test("returns false when Browser window APIs are unavailable", async () => {
    const logger = vi.fn<(message: string) => void>();

    const result = await setChromeWindowState({ Browser: {} } as never, "minimized", logger);

    expect(result).toBe(false);
    expect(logger).toHaveBeenCalledWith(
      "[browser] Chrome window parking unavailable in this DevTools session.",
    );
  });
});
