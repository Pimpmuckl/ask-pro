import { describe, expect, test, vi } from "vitest";
import {
  buildChromeLaunchFlags,
  buildChromeFlags,
  preserveChromeProcessLifetime,
  restoreChromeWindowByPid,
  shouldLaunchChromeMinimized,
} from "../../src/browser/chromeLifecycle.js";

describe("chrome lifecycle window restore", () => {
  test("uses a Windows pid fallback to restore retained Chrome windows", async () => {
    const execFileAsync = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    const logger = vi.fn<(message: string) => void>();

    const restored = await restoreChromeWindowByPid(1234, logger, {
      platform: "win32",
      execFileAsync: execFileAsync as never,
    });

    expect(restored).toBe(true);
    expect(execFileAsync).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"]),
      expect.objectContaining({ windowsHide: true, timeout: 5000 }),
    );
    const script = execFileAsync.mock.calls[0]?.[1]?.at(-1);
    expect(script).toContain("[uint32]1234");
    expect(script).toContain("ShowWindowAsync($hWnd, 9)");
    expect(logger).toHaveBeenCalledWith("[browser] Chrome window restored by pid fallback");
  });

  test("does not run the Windows restore fallback on other platforms", async () => {
    const execFileAsync = vi.fn();
    const logger = vi.fn<(message: string) => void>();

    const restored = await restoreChromeWindowByPid(1234, logger, {
      platform: "linux",
      execFileAsync: execFileAsync as never,
    });

    expect(restored).toBe(false);
    expect(execFileAsync).not.toHaveBeenCalled();
  });
});

describe("chrome lifecycle launch window state", () => {
  test("keeps managed Chrome independent of its Windows controller process", () => {
    const windowsOptions = preserveChromeProcessLifetime({ detached: false }, "win32");
    const linuxOptions = { detached: false };

    expect(windowsOptions).toMatchObject({ detached: true, windowsHide: true });
    expect(preserveChromeProcessLifetime(linuxOptions, "linux")).toBe(linuxOptions);
  });

  test("keeps Chrome CPU protections enabled for long headed waits", () => {
    const flags = buildChromeLaunchFlags(buildChromeFlags(false, undefined, "en-US,en"));

    expect(flags).toContain("--disable-extensions");
    expect(flags).not.toContain("--disable-backgrounding-occluded-windows");
    expect(flags).not.toContain("--disable-renderer-backgrounding");
    expect(flags).not.toContain("--disable-background-timer-throttling");
    expect(flags).not.toContain("--disable-ipc-flooding-protection");
  });

  test("adds start-minimized for headed Windows managed launches", () => {
    expect(buildChromeFlags(false, undefined, "en-US,en", { startMinimized: true })).toContain(
      "--start-minimized",
    );
  });

  test("does not add start-minimized for headless launches", () => {
    expect(buildChromeFlags(true, undefined, "en-US,en", { startMinimized: true })).not.toContain(
      "--start-minimized",
    );
  });

  test("starts minimized only for Windows managed local Chrome", () => {
    expect(
      shouldLaunchChromeMinimized(
        {
          headless: false,
          hideWindow: false,
          startMinimized: true,
          browserTabRef: null,
          remoteChrome: null,
        },
        "win32",
      ),
    ).toBe(true);
    expect(
      shouldLaunchChromeMinimized(
        {
          headless: false,
          hideWindow: false,
          startMinimized: true,
          browserTabRef: "current",
          remoteChrome: null,
        },
        "win32",
      ),
    ).toBe(false);
    expect(
      shouldLaunchChromeMinimized(
        {
          headless: false,
          hideWindow: false,
          startMinimized: true,
          browserTabRef: null,
          remoteChrome: null,
        },
        "linux",
      ),
    ).toBe(false);
  });

  test("does not start minimized unless the caller has opted in", () => {
    expect(
      shouldLaunchChromeMinimized(
        {
          headless: false,
          hideWindow: false,
          startMinimized: false,
          browserTabRef: null,
          remoteChrome: null,
        },
        "win32",
      ),
    ).toBe(false);
  });
});
