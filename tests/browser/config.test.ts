import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { resolveBrowserConfig } from "../../src/browser/config.js";
import { CHATGPT_URL } from "../../src/browser/constants.js";
import {
  defaultAskProBrowserProfileDir,
  resolveAskProAgentId,
} from "../../src/browser/profilePaths.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveBrowserConfig", () => {
  test("returns defaults when config missing", () => {
    const resolved = resolveBrowserConfig(undefined);
    expect(resolved.url).toBe(CHATGPT_URL);
    const isWindows = process.platform === "win32";
    expect(resolved.cookieSync).toBe(!isWindows);
    expect(resolved.headless).toBe(false);
    expect(resolved.manualLogin).toBe(isWindows);
    if (isWindows) expect(resolved.manualLoginProfileDir).toBe(defaultAskProBrowserProfileDir());
    expect(resolved.profileLockTimeoutMs).toBe(300_000);
    expect(resolved.manualLoginWaitMs).toBe(1_200_000);
    expect(resolved.acceptLanguage).toBe("en-US,en");
  });

  test("applies overrides", () => {
    const resolved = resolveBrowserConfig({
      url: "https://example.com",
      timeoutMs: 123,
      inputTimeoutMs: 456,
      cookieSync: false,
      headless: true,
      desiredModel: "Custom",
      chromeProfile: "Profile 1",
      chromePath: "/Applications/Chrome",
      browserTabRef: "current",
      manualLoginWaitMs: 12_000,
      acceptLanguage: "en-GB,en",
      debug: true,
    });
    expect(resolved.url).toBe("https://example.com/");
    expect(resolved.timeoutMs).toBe(123);
    expect(resolved.inputTimeoutMs).toBe(456);
    expect(resolved.cookieSync).toBe(false);
    expect(resolved.headless).toBe(true);
    expect(resolved.desiredModel).toBe("Custom");
    expect(resolved.chromeProfile).toBe("Profile 1");
    expect(resolved.chromePath).toBe("/Applications/Chrome");
    expect(resolved.browserTabRef).toBe("current");
    expect(resolved.manualLoginWaitMs).toBe(12_000);
    expect(resolved.acceptLanguage).toBe("en-GB,en");
    expect(resolved.debug).toBe(true);
  });

  test("uses the agent skill profile for manual login by default", () => {
    const resolved = resolveBrowserConfig({ manualLogin: true });

    expect(resolved.manualLoginProfileDir).toBe(defaultAskProBrowserProfileDir());
  });

  test("uses an isolated browser profile when ASK_PRO_AGENT_ID is set", () => {
    vi.stubEnv("ASK_PRO_AGENT_ID", "Review T1 / Windows");
    const resolved = resolveBrowserConfig({ manualLogin: true });
    const profileDir = defaultAskProBrowserProfileDir();

    const agentId = resolveAskProAgentId();
    expect(agentId).toMatch(/^review-t1-windows-[a-f0-9]{10}$/);
    expect(resolved.manualLoginProfileDir).toBe(profileDir);
    expect(profileDir).toContain(
      path.join(".agents", "skills", "ask-pro", "agents", agentId!, "browser-profile"),
    );
  });

  test("keeps colliding agent slugs isolated with a stable hash suffix", () => {
    const first = resolveAskProAgentId({ ASK_PRO_AGENT_ID: "review t1" });
    const second = resolveAskProAgentId({ ASK_PRO_AGENT_ID: "review/t1" });
    const invalid = resolveAskProAgentId({ ASK_PRO_AGENT_ID: "🔒" });
    const reserved = resolveAskProAgentId({ ASK_PRO_AGENT_ID: "con" });

    expect(first).toMatch(/^review-t1-[a-f0-9]{10}$/);
    expect(second).toMatch(/^review-t1-[a-f0-9]{10}$/);
    expect(first).not.toBe(second);
    expect(invalid).toMatch(/^agent-[a-f0-9]{10}$/);
    expect(reserved).toMatch(/^con-[a-f0-9]{10}$/);
  });

  test("rejects temporary chat URLs when desiredModel is Pro", () => {
    expect(() =>
      resolveBrowserConfig({
        url: "https://chatgpt.com/?temporary-chat=true",
        desiredModel: "GPT-5.2 Pro",
      }),
    ).toThrow(/Temporary Chat/i);
  });
});
