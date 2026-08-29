import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import {
  buildChromeLaunchFlags,
  buildChromeFlags,
  maybeReuseRunningChrome,
  restoreChromeWindowByPid,
  shouldLaunchChromeMinimized,
  spawnWindowsProcessOutsideJob,
} from "../../src/browser/chromeLifecycle.js";
import {
  markChromeLaunchStarting,
  writeDevToolsActivePort,
} from "../../src/browser/profileState.js";

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
  test.runIf(process.platform === "win32")(
    "launches managed processes outside the Windows controller job at below-normal priority",
    async () => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "ask pro broker-"));
      const marker = path.join(dir, "child.json");
      const expectedArgs = ["plain", "with spaces", 'quote"and\\trailing\\'];
      const script = `require("node:fs").writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ argv: process.argv.slice(1), cwd: process.cwd(), env: process.env.ASK_PRO_BROKER_TEST, ppid: process.ppid, priority: require("node:os").getPriority() }))`;
      type BrokerPayload = {
        argv: string[];
        cwd: string;
        env: string;
        ppid: number;
        priority: number;
      };
      spawnWindowsProcessOutsideJob(process.execPath, ["-e", script, ...expectedArgs], {
        cwd: dir,
        env: { ...process.env, ASK_PRO_BROKER_TEST: "round trip" },
      });

      try {
        let payload: BrokerPayload | null = null;
        for (let attempt = 0; attempt < 100 && !payload; attempt += 1) {
          payload = await readFile(marker, "utf8")
            .then((value) => JSON.parse(value) as BrokerPayload)
            .catch(() => null);
          if (!payload) await new Promise((resolve) => setTimeout(resolve, 100));
        }

        expect(payload).not.toBeNull();
        if (!payload) throw new Error("Brokered child did not write its marker.");
        expect(payload.argv).toEqual(expectedArgs);
        expect(payload.cwd).toBe(dir);
        expect(payload.env).toBe("round trip");
        expect(payload.priority).toBe(os.constants.priority.PRIORITY_BELOW_NORMAL);
        const parentName = execFileSync(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `(Get-Process -Id ${payload.ppid} -ErrorAction SilentlyContinue).Name`,
          ],
          { encoding: "utf8", windowsHide: true },
        ).trim();
        expect(parentName).toMatch(/^WmiPrvSE$/i);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    15_000,
  );

  test("reattaches when brokered Chrome outlives its startup controller", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ask pro handoff-"));
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server has no TCP port.");
    await markChromeLaunchStarting(dir);
    const publishPort = setTimeout(() => {
      void writeDevToolsActivePort(dir, address.port);
    }, 50);
    const logger = vi.fn<(message: string) => void>();

    try {
      const chrome = await maybeReuseRunningChrome(dir, logger);

      expect(chrome?.port).toBe(address.port);
      expect(logger).toHaveBeenCalledWith(expect.stringMatching(/startup handoff/u));
    } finally {
      clearTimeout(publishPort);
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(dir, { recursive: true, force: true });
    }
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
