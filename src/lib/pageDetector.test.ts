// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@/lib/constants";
import { detectRoutingPage } from "@/lib/pageDetector";

describe("detectRoutingPage", () => {
  it("recognizes the internal routing page", () => {
    document.title = "Internal Routing";
    document.body.innerHTML = `
      <h1>Internal Routing</h1>
      <label>Route to</label>
      <label>Division</label>
      <label>Section</label>
      <label>Action Officer</label>
    `;

    const result = detectRoutingPage(document, DEFAULT_SETTINGS);

    expect(result.matched).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
