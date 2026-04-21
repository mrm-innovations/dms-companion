// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@/lib/constants";
import {
  applyCarriedPriorityToRoutingForm,
  capturePriorityFromDetailsPage,
} from "@/lib/priorityCarryover";

describe("priorityCarryover", () => {
  it("captures priority from details and applies it to a normal routing form", async () => {
    document.body.innerHTML = `
      <h1>R12-2026-04-21-029</h1>
      <table>
        <tr><td>Route no.</td><td>1130396</td></tr>
        <tr><td>Priority</td><td><span>RUSH</span></td></tr>
      </table>
    `;

    const captured = await capturePriorityFromDetailsPage(document, DEFAULT_SETTINGS);
    expect(captured?.priority).toBe("RUSH DOCUMENT");

    document.body.innerHTML = `
      <div class="form-group">
        <strong>Is the routed document a priority?</strong>
        <label><input type="radio" name="priority" value="rush" /> RUSH DOCUMENT</label>
        <label><input type="radio" name="priority" value="urgent" /> URGENT DOCUMENT</label>
        <label><input type="radio" name="priority" value="normal" checked /> NORMAL</label>
      </div>
    `;

    const applied = await applyCarriedPriorityToRoutingForm(DEFAULT_SETTINGS);
    expect(applied?.priority).toBe("RUSH DOCUMENT");
    expect(
      (document.querySelector("input[value='rush']") as HTMLInputElement).checked,
    ).toBe(true);
  });
});
