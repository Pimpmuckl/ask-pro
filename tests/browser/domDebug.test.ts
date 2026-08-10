import { describe, expect, test, vi } from "vitest";
import { buildDomControlInventoryExpression, logDomFailure } from "../../src/browser/domDebug.js";
import type { BrowserLogger, ChromeClient } from "../../src/browser/types.js";

function node(
  tagName: string,
  attributes: Record<string, string> = {},
  extras: Record<string, unknown> = {},
) {
  return {
    tagName,
    parentElement: null,
    disabled: false,
    getAttribute: (name: string) => attributes[name] ?? null,
    getClientRects: () => [1],
    querySelectorAll: () => [],
    closest: () => null,
    innerText: "SECRET PROMPT",
    innerHTML: "<b>SECRET ANSWER</b>",
    value: "C:/private/file.txt",
    ...extras,
  };
}

function evaluateInventory(nodes: unknown[], activeElement = nodes[0]) {
  const document = { querySelectorAll: () => nodes, activeElement };
  return new Function(
    "document",
    "getComputedStyle",
    `return ${buildDomControlInventoryExpression()}`,
  )(document, () => ({ display: "block", visibility: "visible" }));
}

describe("DOM failure diagnostics", () => {
  test("builds a bounded structural inventory without rendered content", () => {
    const controls = [
      node("BUTTON", { role: "button", "aria-expanded": "true", "aria-haspopup": "menu" }),
      node("INPUT", { type: "radio", "aria-checked": "true" }, { disabled: true }),
      ...Array.from({ length: 38 }, () =>
        node("SECRET-CUSTOM-ELEMENT", { role: "SECRET LABEL", type: "SECRET VALUE" }),
      ),
    ];

    const inventory = evaluateInventory(controls);
    const json = JSON.stringify(inventory);

    expect(inventory).toMatchObject({ matchedControls: 40, truncated: true });
    expect(inventory.controls).toHaveLength(32);
    expect(inventory.controls[0]).toMatchObject({
      index: 0,
      tag: "button",
      role: "button",
      visible: true,
      focused: true,
      expanded: "true",
      popup: "menu",
      childControls: 0,
    });
    expect(inventory.controls[1]).toMatchObject({
      tag: "input",
      type: "radio",
      disabled: true,
      checked: "true",
    });
    expect(json).not.toMatch(
      /SECRET|private|file\.txt|innerText|innerHTML|value|href|cookie|token/i,
    );

    const latePicker = controls.at(-1);
    expect(evaluateInventory(controls, latePicker).controls).toContainEqual(
      expect.objectContaining({ index: 39, focused: true }),
    );
  });

  test("uses the verbose gate and emits valid JSON no larger than 8 KiB", async () => {
    const value = evaluateInventory(
      Array.from({ length: 40 }, () => node("BUTTON", { role: "button" })),
    );
    const evaluate = vi.fn().mockResolvedValue({ result: { value } });
    const Runtime = { evaluate } as unknown as ChromeClient["Runtime"];
    const logger = vi.fn() as unknown as BrowserLogger;

    await logDomFailure(Runtime, logger, "model-picker");
    expect(evaluate).not.toHaveBeenCalled();

    logger.verbose = true;
    await logDomFailure(Runtime, logger, "model-picker");
    const json = vi.mocked(logger).mock.calls[0]?.[0] as string;
    expect(() => JSON.parse(json)).not.toThrow();
    expect(new TextEncoder().encode(json).byteLength).toBeLessThanOrEqual(8 * 1024);
    expect(JSON.parse(json).controls.length).toBeLessThanOrEqual(32);
  });
});
