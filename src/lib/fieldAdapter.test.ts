// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { applyFieldValue, readFieldValue } from "@/lib/fieldAdapter";
import type { FieldMapping } from "@/types/app";

const routeToMapping: FieldMapping = {
  key: "routeTo",
  label: "Route to",
  type: "select",
  selectors: ["#routeTo"],
  labelHints: ["Route to"],
  matchStrategy: "both",
};

const divisionMapping: FieldMapping = {
  key: "division",
  label: "Division",
  type: "select",
  selectors: [],
  fallbackSelectors: ["select"],
  labelHints: ["Division"],
  matchStrategy: "both",
};

const forwardedMapping: FieldMapping = {
  key: "forwardedOriginalDocument",
  label: "Original document forwarded",
  type: "checkbox",
  selectors: [],
  labelHints: ["Is the original document forwarded"],
};

const priorityMapping: FieldMapping = {
  key: "priority",
  label: "Priority",
  type: "radio",
  selectors: [],
  labelHints: ["Is the routed document a priority"],
  radioOptions: [
    { value: "RUSH DOCUMENT", labelHints: ["RUSH DOCUMENT"] },
    { value: "URGENT DOCUMENT", labelHints: ["URGENT DOCUMENT"] },
    { value: "NORMAL", labelHints: ["NORMAL"] },
  ],
};

const subjectMapping: FieldMapping = {
  key: "subjectTitle",
  label: "Document Subject/Title",
  type: "display-text",
  selectors: [],
  labelHints: ["Document Subject/Title"],
};

const actionOfficerMultiMapping: FieldMapping = {
  key: "actionOfficer",
  label: "Action Officer",
  type: "custom-multiselect",
  selectors: [],
  labelHints: ["Action Officer"],
  multiple: true,
  valueSelectors: [".tag"],
};

const customRouteMapping: FieldMapping = {
  key: "routeTo",
  label: "Route to",
  type: "custom-select",
  selectors: ["#routeCustom"],
  labelHints: ["Route to"],
  inputSelectors: ["#routeCustom"],
  optionSelectors: ["[role='option']"],
  valueSelectors: [".selected-value"],
  matchStrategy: "both",
};

const actionMapping: FieldMapping = {
  key: "action",
  label: "Action",
  type: "custom-select",
  selectors: [],
  fallbackSelectors: ["input"],
  labelHints: ["Action"],
  inputSelectors: ["input"],
  matchStrategy: "both",
};


describe("fieldAdapter", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="form-group">
        <label for="routeTo">Route to</label>
        <select id="routeTo">
          <option value="">Select</option>
          <option value="hr">HR</option>
          <option value="legal">Legal</option>
        </select>
      </div>
      <div class="form-group">
        <label for="division">Division</label>
        <select id="division">
          <option value="">Select</option>
          <option value="lgmed">LGMED</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="forwarded" />
          Is the original document forwarded?
        </label>
      </div>
      <div class="form-group">
        <div>Is the routed document a priority?</div>
        <label><input type="radio" name="priority" value="rush" /> RUSH DOCUMENT</label>
        <label><input type="radio" name="priority" value="urgent" /> URGENT DOCUMENT</label>
        <label><input type="radio" name="priority" value="normal" /> NORMAL</label>
      </div>
    `;
  });

  it("applies native select values by option text", async () => {
    const result = await applyFieldValue(routeToMapping, "Legal");

    expect(result.applied).toBe(true);
    expect((document.querySelector("#routeTo") as HTMLSelectElement).value).toBe(
      "legal",
    );
  });

  it("prefers label-based resolution over generic fallback selectors", () => {
    const value = readFieldValue(divisionMapping);

    expect(value).toBe(null);
    (document.querySelector("#division") as HTMLSelectElement).value = "lgmed";
    expect(readFieldValue(divisionMapping)).toBe("LGMED");
  });

  it("applies checkbox and radio values", async () => {
    const checkboxResult = await applyFieldValue(forwardedMapping, true);
    const radioResult = await applyFieldValue(priorityMapping, "NORMAL");

    expect(checkboxResult.applied).toBe(true);
    expect(
      (document.querySelector("#forwarded") as HTMLInputElement).checked,
    ).toBe(true);
    expect(radioResult.applied).toBe(true);
    expect(
      (
        document.querySelector(
          "input[name='priority'][value='normal']",
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(readFieldValue(priorityMapping)).toBe("NORMAL");
  });

  it("extracts display text next to the subject label", () => {
    document.body.innerHTML = `
      <div class="form-group">
        <label>Document Subject/Title:</label>
        ABSENTEEISM OF MAYOR FOR THE MONTH OF MARCH 2026 - GLAN
      </div>
    `;

    expect(readFieldValue(subjectMapping)).toBe(
      "ABSENTEEISM OF MAYOR FOR THE MONTH OF MARCH 2026 - GLAN",
    );
  });

  it("captures selected values from a custom multi-select tag container", () => {
    document.body.innerHTML = `
      <div class="form-group">
        <label>Action Officer</label>
        <div class="ms-parent">
          <div class="selection">
            <span class="tag">GENEVIEVE MORALES &lt;@gvmorales&gt; ×</span>
          </div>
          <input type="text" value="" />
        </div>
      </div>
    `;

    expect(readFieldValue(actionOfficerMultiMapping)).toEqual([
      "GENEVIEVE MORALES <@gvmorales>",
    ]);
  });

  it("captures select2 multi-select tokens rendered beside a hidden input", () => {
    document.body.innerHTML = `
      <div class="form-group">
        <label>Action Officer *</label>
        <input id="actionOfficer" name="actionOfficer" type="hidden" value="" />
        <span class="select2 select2-container">
          <span class="selection">
            <ul class="select2-selection__rendered">
              <li class="select2-selection__choice">
                <span class="select2-selection__choice__remove">\u00d7</span>
                KIMBERLY TUANZON &lt;@kimya083&gt;
              </li>
            </ul>
          </span>
        </span>
      </div>
    `;

    expect(
      readFieldValue({
        ...actionOfficerMultiMapping,
        selectors: ["#actionOfficer"],
        valueSelectors: [".tag"],
      }),
    ).toEqual(["KIMBERLY TUANZON <@kimya083>"]);
  });

  it("deduplicates action officer tokens that include remove-button text", () => {
    document.body.innerHTML = `
      <div class="form-group">
        <label>Action Officer *</label>
        <input id="actionOfficer" name="actionOfficer" type="hidden" value="" />
        <span class="select2 select2-container">
          <span class="selection">
            <ul class="select2-selection__rendered">
              <li class="select2-selection__choice">
                <span class="select2-selection__choice__remove">\u00d7</span>KIMBERLY TUANZON &lt;@kimay083&gt;
              </li>
            </ul>
          </span>
        </span>
      </div>
    `;

    expect(
      readFieldValue({
        ...actionOfficerMultiMapping,
        selectors: ["#actionOfficer"],
      }),
    ).toEqual(["KIMBERLY TUANZON <@kimay083>"]);
  });

  it("captures the checked priority radio from the priority field group", () => {
    document.body.innerHTML = `
      <div class="form-group">
        <div>Is the routed document a priority?</div>
        <label><input type="radio" name="docPriority" value="rush" /> RUSH DOCUMENT</label>
        <label><input type="radio" name="docPriority" value="urgent" checked /> URGENT DOCUMENT</label>
        <label><input type="radio" name="docPriority" value="normal" /> NORMAL</label>
      </div>
    `;

    expect(
      readFieldValue({
        ...priorityMapping,
        selectors: ["input[type='radio'][name*='priority']"],
        fallbackSelectors: ["input[type='radio']"],
      }),
    ).toBe("URGENT DOCUMENT");
  });

  it("captures priority radios by question text when radio names are generic", () => {
    document.body.innerHTML = `
      <div class="routing-form">
        <label><input type="checkbox" /> Is the original document forwarded?</label>
        <div>
          <strong>Is the routed document a priority?</strong>
          <span><input type="radio" name="priorityChoice42" value="1" /> RUSH DOCUMENT</span>
          <span><input type="radio" name="priorityChoice42" value="2" checked /> URGENT DOCUMENT</span>
          <span><input type="radio" name="priorityChoice42" value="3" /> NORMAL</span>
        </div>
      </div>
    `;

    expect(
      readFieldValue({
        ...priorityMapping,
        selectors: ["input[type='radio'][name='not-present']"],
        fallbackSelectors: ["input[type='radio']"],
      }),
    ).toBe("URGENT DOCUMENT");
  });

  it("resolves Action separately from Action Officer", () => {
    document.body.innerHTML = `
      <div class="form-group">
        <label>Action Officer *</label>
        <input value="KIMBERLY TUANZON &lt;@kimay083&gt;" />
      </div>
      <div class="form-group">
        <label>Action *</label>
        <input value="APPROPRIATE STAFF ACTION" />
      </div>
    `;

    expect(readFieldValue(actionMapping)).toBe("APPROPRIATE STAFF ACTION");
  });

  it("applies custom dropdown values using mouse events and verifies selection", async () => {
    document.body.innerHTML = `
      <div class="form-group">
        <label>Route to</label>
        <input id="routeCustom" value="" />
        <span class="selected-value"></span>
      </div>
      <div role="listbox">
        <div role="option">Action Officer</div>
      </div>
    `;

    document.querySelector("[role='option']")?.addEventListener("mousedown", () => {
      const selected = document.querySelector(".selected-value");
      if (selected) {
        selected.textContent = "Action Officer";
      }
    });

    const result = await applyFieldValue(customRouteMapping, "Action Officer");

    expect(result.applied).toBe(true);
    expect(result.actualValue).toBe("Action Officer");
  });

  it("does not report custom dropdown values as applied when the option does not select", async () => {
    document.body.innerHTML = `
      <div class="form-group">
        <label>Route to</label>
        <input id="routeCustom" value="" />
        <span class="selected-value"></span>
      </div>
      <div role="listbox">
        <div role="option">Action Officer</div>
      </div>
    `;

    const result = await applyFieldValue(customRouteMapping, "Action Officer");

    expect(result.applied).toBe(false);
    expect(result.reason).toContain("was not selected");
  });

});
