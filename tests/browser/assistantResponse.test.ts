import { describe, expect, test } from "vitest";
import { __test__ } from "../../src/browser/actions/assistantResponse.js";

describe("assistant response actions", () => {
  test("observer does not click ChatGPT stop controls", () => {
    const expression = __test__.buildResponseObserverExpression(120_000);

    expect(expression).not.toContain("dispatchClickSequence(stop)");
  });
});
