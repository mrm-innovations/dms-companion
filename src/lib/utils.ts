import type { FieldValue, MatchingRules, RoutingFieldKey, RoutingPreset } from "@/types/app";

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

export const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export const uniqueStrings = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = normalizeText(trimmed);
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(trimmed);
  }

  return result;
};

export const createId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `preset-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

export const nowIso = (): string => new Date().toISOString();

export const toArrayValue = (value: FieldValue): string[] => {
  if (Array.isArray(value)) {
    return uniqueStrings(value.map(String));
  }

  if (typeof value === "string") {
    return uniqueStrings(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }

  return [];
};

export const serializeFieldValue = (value: FieldValue): string => {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return value ?? "";
};

export const hasPresetFieldValue = (
  preset: RoutingPreset,
  key: RoutingFieldKey,
): boolean => {
  const value = preset[key as keyof RoutingPreset];
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== null && value !== "";
};

export const parseCommaSeparated = (value: string): string[] =>
  uniqueStrings(value.split(",").map((item) => item.trim()).filter(Boolean));

export const cloneMatchingRules = (rules: MatchingRules): MatchingRules => ({
  containsAny: [...(rules.containsAny ?? [])],
  containsAll: [...(rules.containsAll ?? [])],
  startsWith: [...(rules.startsWith ?? [])],
  exactPhrase: [...(rules.exactPhrase ?? [])],
});
