import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { migrateTrackerAppBaseUrl, parseSettings } from "@/lib/settingsManager";

describe("settingsManager", () => {
  it("migrates the old localhost tracker default to production", () => {
    expect(migrateTrackerAppBaseUrl("http://localhost:3000")).toBe(
      DEFAULT_SETTINGS.tracker.appBaseUrl,
    );
  });

  it("preserves explicitly configured non-legacy tracker URLs", () => {
    expect(migrateTrackerAppBaseUrl("https://example.test")).toBe("https://example.test");
  });

  it("preserves tracker flags and secret while migrating the old default URL", () => {
    const settings = parseSettings(
      JSON.stringify({
        tracker: {
          enabled: true,
          appBaseUrl: "http://localhost:3000",
          sharedSecret: "secret",
          openCreatedRecord: false,
        },
      }),
    );

    expect(settings.tracker).toEqual({
      enabled: true,
      appBaseUrl: DEFAULT_SETTINGS.tracker.appBaseUrl,
      sharedSecret: "secret",
      openCreatedRecord: false,
    });
  });
});
