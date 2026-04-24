import type { AppSettings, FieldMapping, PresetFieldKey, RoutingFieldKey } from "@/types/app";

export const STORAGE_KEYS = {
  presets: "dmsCompanion.presets",
  lastRouting: "dmsCompanion.lastRouting",
  settings: "dmsCompanion.settings",
  panelPosition: "dmsCompanion.panelPosition",
  panelCollapsed: "dmsCompanion.panelCollapsed",
  carriedPriority: "dmsCompanion.carriedPriority",
} as const;

export const FIELD_ORDER: PresetFieldKey[] = [
  "routeTo",
  "division",
  "section",
  "actionOfficer",
  "action",
  "forwardedOriginalDocument",
  "priority",
];

const baseSelectOptionSelectors = [
  "[role='option']",
  "li",
  ".dropdown-item",
  ".select2-results__option",
  ".k-list-item",
  ".k-item",
  ".ui-menu-item",
];

const baseTriggerSelectors = [
  "button",
  "[role='combobox']",
  "[aria-haspopup='listbox']",
  ".select2-selection",
  ".k-input-button",
  ".dropdown-toggle",
  ".k-select",
];

const selectField = (key: RoutingFieldKey, label: string, labelHints: string[]): FieldMapping => ({
  key,
  label,
  type: "custom-select",
  selectors: [
    `[name='${key}']`,
    `[id='${key}']`,
    `[data-field='${key}']`,
    `[aria-label='${label}']`,
  ],
  fallbackSelectors: [
    "select",
    "[role='combobox']",
    ".select2",
    ".k-dropdownlist",
    ".k-picker",
    ".dropdown",
  ],
  labelHints,
  inputSelectors: [
    "select",
    "input:not([type='hidden'])",
    "[contenteditable='true']",
    "[role='combobox'] input",
  ],
  triggerSelectors: baseTriggerSelectors,
  optionSelectors: baseSelectOptionSelectors,
  valueSelectors: [
    "select",
    "input:not([type='hidden'])",
    ".select2-selection__rendered",
    ".k-input-value-text",
    "[data-selected-text]",
    ".selected",
  ],
  matchStrategy: "both",
  retryCount: 4,
  waitForMs: 250,
});

export const DEFAULT_SETTINGS: AppSettings = {
  debug: false,
  previewBeforeApply: true,
  carryPriorityForward: true,
  pageDetection: {
    hostIncludes: ["dms.dilg.gov.ph"],
    urlIncludes: [
      "routing",
      "internal",
      "route",
      "documentroute",
      "createroutenew",
    ],
    headingText: ["internal routing"],
    requiredFieldLabels: ["route to", "division", "section", "action officer", "action", "priority"],
  },
  fieldMappings: {
    routeTo: selectField("routeTo", "Route to", ["Route to"]),
    division: selectField("division", "Division", ["Division"]),
    section: selectField("section", "Section", ["Section"]),
    actionOfficer: {
      ...selectField("actionOfficer", "Action Officer", ["Action Officer"]),
      type: "custom-multiselect",
      multiple: true,
      valueSelectors: [
        ".select2-selection__choice",
        ".select2-selection__choice__display",
        ".select2-selection__rendered",
        ".choices__item",
        ".k-chip",
        ".k-chip-content",
        ".multiselect-selected-text",
        ".ms-choice > span",
        ".ms-selection .ms-selected",
        ".selected-item",
        ".selection .item",
        ".selection .tag",
        ".tag",
        ".token",
        ".selected",
      ],
      selectors: [
        "[name='actionOfficer']",
        "[id='actionOfficer']",
        "[data-field='actionOfficer']",
        "[aria-label='Action Officer']",
      ],
    },
    action: selectField("action", "Action", ["Action"]),
    forwardedOriginalDocument: {
      key: "forwardedOriginalDocument",
      label: "Original document forwarded",
      type: "checkbox",
      selectors: [
        "input[type='checkbox'][name*='forward']",
        "input[type='checkbox'][id*='forward']",
      ],
      fallbackSelectors: ["input[type='checkbox']"],
      labelHints: [
        "Is the original document forwarded",
        "original document forwarded",
      ],
      retryCount: 2,
      waitForMs: 150,
    },
    priority: {
      key: "priority",
      label: "Priority",
      type: "radio",
      selectors: [
        "input[type='radio'][name*='priority']",
        "input[type='radio'][id*='priority']",
      ],
      fallbackSelectors: ["input[type='radio']"],
      labelHints: [
        "Is the routed document a priority",
        "Priority",
      ],
      radioOptions: [
        { value: "RUSH DOCUMENT", labelHints: ["RUSH DOCUMENT", "RUSH"] },
        { value: "URGENT DOCUMENT", labelHints: ["URGENT DOCUMENT", "URGENT"] },
        { value: "NORMAL", labelHints: ["NORMAL"] },
      ],
      retryCount: 2,
      waitForMs: 150,
    },
    subjectTitle: {
      key: "subjectTitle",
      label: "Document Subject/Title",
      type: "display-text",
      selectors: [
        "[data-field='subjectTitle']",
        "[name='subjectTitle']",
        "[id='subjectTitle']",
      ],
      fallbackSelectors: [
        ".document-subject",
        ".subject-title",
        ".subject-value",
      ],
      labelHints: ["Document Subject/Title", "Subject/Title"],
      retryCount: 1,
      waitForMs: 100,
    },
  },
};
