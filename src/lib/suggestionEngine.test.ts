import { describe, expect, it } from "vitest";

import { getSuggestedPresets, matchesRules } from "@/lib/suggestionEngine";
import type { RoutingPreset } from "@/types/app";

const basePreset = (overrides: Partial<RoutingPreset>): RoutingPreset => ({
  id: overrides.id ?? "preset-1",
  name: overrides.name ?? "Preset",
  description: overrides.description ?? "",
  enabled: overrides.enabled ?? true,
  routeTo: overrides.routeTo ?? "HR",
  division: overrides.division ?? null,
  section: overrides.section ?? null,
  actionOfficer: overrides.actionOfficer ?? null,
  action: overrides.action ?? null,
  forwardedOriginalDocument: overrides.forwardedOriginalDocument ?? false,
  priority: overrides.priority ?? "NORMAL",
  matchingRules: overrides.matchingRules ?? {},
  createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
});

describe("matchesRules", () => {
  it("matches containsAny rules", () => {
    expect(
      matchesRules("ABSENTEEISM OF MAYOR FOR MARCH", {
        containsAny: ["absence", "absenteeism"],
      }),
    ).toBe(true);
  });

  it("requires all configured rule groups to pass", () => {
    expect(
      matchesRules("LEGAL REVIEW REQUEST", {
        containsAny: ["legal"],
        containsAll: ["legal", "review"],
        startsWith: ["legal"],
      }),
    ).toBe(true);

    expect(
      matchesRules("LEGAL REVIEW REQUEST", {
        containsAny: ["legal"],
        containsAll: ["legal", "routing"],
      }),
    ).toBe(false);
  });
});

describe("getSuggestedPresets", () => {
  it("returns only enabled presets with matching rules", () => {
    const presets = [
      basePreset({
        id: "hr",
        name: "HR Absence",
        matchingRules: { containsAny: ["absence", "absenteeism"] },
      }),
      basePreset({
        id: "legal",
        name: "Legal",
        enabled: false,
        matchingRules: { containsAny: ["legal"] },
      }),
    ];

    expect(
      getSuggestedPresets(presets, "ABSENTEEISM OF MAYOR FOR MARCH 2026").map(
        (preset) => preset.id,
      ),
    ).toEqual(["hr"]);
  });
});
