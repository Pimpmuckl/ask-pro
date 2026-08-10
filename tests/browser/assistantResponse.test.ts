import { describe, expect, test, vi } from "vitest";
import { __test__ } from "../../src/browser/actions/assistantResponse.js";
import type { BrowserLogger, ChromeClient } from "../../src/browser/types.js";

describe("assistant response actions", () => {
  test("observer does not click ChatGPT stop controls", () => {
    const expression = __test__.buildResponseObserverExpression(120_000);

    expect(expression).not.toContain("dispatchClickSequence(stop)");
  });

  test("routes failed recovery diagnostics through the verbose logger", async () => {
    vi.useFakeTimers();
    const evaluate = vi
      .fn()
      .mockResolvedValueOnce({ result: { value: null } })
      .mockResolvedValueOnce({
        result: { value: { matchedControls: 0, truncated: false, controls: [] } },
      });
    const logger = vi.fn() as unknown as BrowserLogger;
    logger.verbose = true;

    const recovery = __test__.recoverAssistantResponse(
      { evaluate } as unknown as ChromeClient["Runtime"],
      1,
      logger,
    );
    await vi.runAllTimersAsync();

    await expect(recovery).resolves.toBeNull();
    expect(JSON.parse(vi.mocked(logger).mock.calls[0]?.[0] as string)).toMatchObject({
      context: "assistant-response-recovery",
      controls: [],
    });
    vi.useRealTimers();
  });
});
