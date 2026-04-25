export type RoutingFieldKey =
  | "routeTo"
  | "division"
  | "section"
  | "actionOfficer"
  | "action"
  | "forwardedOriginalDocument"
  | "priority"
  | "subjectTitle";

export type PresetFieldKey = Exclude<RoutingFieldKey, "subjectTitle">;

export type FieldValue = string | string[] | boolean | null;

export type MatchingRules = {
  containsAny?: string[];
  containsAll?: string[];
  startsWith?: string[];
  exactPhrase?: string[];
};

export type RoutingPreset = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  routeTo: string | null;
  division: string | null;
  section: string | null;
  actionOfficer: string | string[] | null;
  action: string | null;
  forwardedOriginalDocument: boolean | null;
  priority: string | null;
  matchingRules: MatchingRules;
  createdAt: string;
  updatedAt: string;
};

export type RoutingSnapshot = {
  routeTo: string | null;
  division: string | null;
  section: string | null;
  actionOfficer: string | string[] | null;
  action: string | null;
  forwardedOriginalDocument: boolean | null;
  priority: string | null;
  capturedAt: string;
};

export type RadioOptionMapping = {
  value: string;
  selectors?: string[];
  labelHints?: string[];
};

export type FieldMapping = {
  key: RoutingFieldKey;
  label: string;
  type: "text" | "checkbox" | "radio" | "select" | "custom-select" | "custom-multiselect" | "display-text";
  selectors: string[];
  fallbackSelectors?: string[];
  labelHints?: string[];
  inputSelectors?: string[];
  triggerSelectors?: string[];
  optionSelectors?: string[];
  valueSelectors?: string[];
  matchStrategy?: "value" | "text" | "both";
  multiple?: boolean;
  radioOptions?: RadioOptionMapping[];
  waitForMs?: number;
  retryCount?: number;
};

export type PageDetectionSettings = {
  hostIncludes: string[];
  urlIncludes: string[];
  headingText: string[];
  requiredFieldLabels: string[];
};

export type TrackerSettings = {
  enabled: boolean;
  appBaseUrl: string;
  sharedSecret: string;
  openCreatedRecord: boolean;
};

export type AppSettings = {
  debug: boolean;
  previewBeforeApply: boolean;
  carryPriorityForward: boolean;
  tracker: TrackerSettings;
  pageDetection: PageDetectionSettings;
  fieldMappings: Record<RoutingFieldKey, FieldMapping>;
};

export type StorageShape = {
  presets: RoutingPreset[];
  lastRouting: RoutingSnapshot | null;
  settings: AppSettings;
};

export type ApplyFieldResult = {
  key: RoutingFieldKey;
  applied: boolean;
  skipped: boolean;
  reason?: string;
  targetValue: FieldValue;
  actualValue: FieldValue;
};

export type PreviewItem = {
  key: RoutingFieldKey;
  label: string;
  currentValue: FieldValue;
  nextValue: FieldValue;
  willChange: boolean;
};

export type DetectionResult = {
  matched: boolean;
  confidence: number;
  reasons: string[];
};
