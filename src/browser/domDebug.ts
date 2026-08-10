import type { ChromeClient, BrowserLogger } from "./types.js";

const MAX_CONTROLS = 32;
const MAX_JSON_BYTES = 8 * 1024;

export function buildDomControlInventoryExpression(): string {
  return `(() => {
    const selector = [
      'button', 'input', 'select', 'textarea',
      '[role="button"]', '[role="combobox"]', '[role="dialog"]', '[role="listbox"]',
      '[role="menu"]', '[role="menuitem"]', '[role="option"]', '[role="radio"]',
      '[role="switch"]', '[role="tab"]', '[aria-expanded]', '[aria-haspopup]'
    ].join(',');
    const allowed = (value, values) => values.includes(value) ? value : null;
    const state = (node, name) => allowed(node.getAttribute(name), ['true', 'false', 'mixed']);
    const nodes = Array.from(document.querySelectorAll(selector));
    const controls = nodes.slice(0, ${MAX_CONTROLS}).map((node, index) => {
      const style = getComputedStyle(node);
      let depth = 0;
      for (let parent = node.parentElement; parent && depth < 12; parent = parent.parentElement) depth += 1;
      return {
        index,
        tag: allowed(node.tagName.toLowerCase(), ['button', 'input', 'select', 'textarea']) ?? 'other',
        role: allowed(node.getAttribute('role'), ['button', 'combobox', 'dialog', 'listbox', 'menu', 'menuitem', 'option', 'radio', 'switch', 'tab']),
        type: allowed(node.getAttribute('type'), ['button', 'checkbox', 'file', 'radio', 'reset', 'submit', 'text']),
        visible: node.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden',
        disabled: node.disabled === true || node.getAttribute('aria-disabled') === 'true',
        focused: document.activeElement === node,
        expanded: state(node, 'aria-expanded'),
        pressed: state(node, 'aria-pressed'),
        checked: state(node, 'aria-checked'),
        selected: state(node, 'aria-selected'),
        popup: allowed(node.getAttribute('aria-haspopup'), ['true', 'false', 'menu', 'listbox', 'tree', 'grid', 'dialog']),
        modal: state(node, 'aria-modal'),
        depth,
        childControls: Math.min(node.querySelectorAll(selector).length, ${MAX_CONTROLS}),
      };
    });
    return { matchedControls: nodes.length, truncated: nodes.length > ${MAX_CONTROLS}, controls };
  })()`;
}

export async function logDomFailure(
  Runtime: ChromeClient["Runtime"],
  logger: BrowserLogger,
  context: string,
) {
  if (!logger?.verbose) return;
  try {
    const { result } = await Runtime.evaluate({
      expression: buildDomControlInventoryExpression(),
      returnByValue: true,
    });
    const value = result.value as {
      matchedControls?: unknown;
      truncated?: unknown;
      controls?: unknown;
    };
    const inventory = {
      context: context.slice(0, 64),
      matchedControls: Number.isSafeInteger(value?.matchedControls) ? value.matchedControls : 0,
      truncated: value?.truncated === true,
      controls: Array.isArray(value?.controls) ? value.controls.slice(0, MAX_CONTROLS) : [],
    };
    let json = JSON.stringify(inventory);
    while (
      new TextEncoder().encode(json).byteLength > MAX_JSON_BYTES &&
      inventory.controls.length
    ) {
      inventory.controls.pop();
      inventory.truncated = true;
      json = JSON.stringify(inventory);
    }
    logger(json);
  } catch {
    // Diagnostics must not replace the original browser failure.
  }
}
