import { describe, expect, test } from "vitest";
import { buildComposerSendClickExpression } from "../../src/browser/actions/composerSendReadiness.js";

describe("composer send readiness", () => {
  test("send click expression rejects stop controls", () => {
    const expression = buildComposerSendClickExpression();

    expect(expression).toContain("isStopControl");
    expect(expression).toContain("return 'stop-button'");
  });
});
