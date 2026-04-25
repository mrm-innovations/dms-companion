import { describe, expect, it } from "vitest";
import {
  buildDmsImportPayloadFromSnapshot,
  findFirstEmail,
  getDmsReferenceNoFromUrl,
  getDmsRouteNoFromUrl,
  mapTrackerPriority,
  mapTrackerSectionCode,
  normalizeTrackerBaseUrl,
} from "@/lib/trackerImport";
import type { RoutingSnapshot } from "@/types/app";

const snapshot: RoutingSnapshot = {
  routeTo: "LGMED",
  division: "Monitoring Division",
  section: "Project Monitoring and Evaluation Section (PMES)",
  actionOfficer: "Juan Dela Cruz <juan@example.test>",
  action: "Prepare draft response",
  forwardedOriginalDocument: true,
  priority: "URGENT DOCUMENT",
  capturedAt: "2026-04-25T00:00:00.000Z",
};

describe("tracker import mapping", () => {
  it("normalizes tracker base URLs", () => {
    expect(normalizeTrackerBaseUrl(" http://localhost:3000/// ")).toBe("http://localhost:3000");
  });

  it("maps DMS priority labels to tracker priorities", () => {
    expect(mapTrackerPriority("RUSH DOCUMENT")).toBe("RUSH");
    expect(mapTrackerPriority("URGENT DOCUMENT")).toBe("URGENT");
    expect(mapTrackerPriority("")).toBe("NORMAL");
  });

  it("maps DMS section labels to tracker section codes", () => {
    expect(mapTrackerSectionCode("Policy Compliance and Implementation Section - PCIS")).toBe("PCIS");
    expect(mapTrackerSectionCode("Unknown")).toBeUndefined();
  });

  it("extracts an assigned user email when available", () => {
    expect(findFirstEmail(["No email", "staff@example.test"])).toBe("staff@example.test");
    expect(findFirstEmail("No email")).toBeUndefined();
  });

  it("extracts DMS URL identifiers as fallback metadata", () => {
    const url = "https://dms.dilg.gov.ph/createroutenew?id=R12-LGMED-2026-03-26-003&routeno=11127887";

    expect(getDmsReferenceNoFromUrl(url)).toBe("R12-LGMED-2026-03-26-003");
    expect(getDmsRouteNoFromUrl(url)).toBe("11127887");
  });

  it("builds a tracker import payload from a routing snapshot", () => {
    expect(
      buildDmsImportPayloadFromSnapshot({
        subject: "Request for technical comments",
        routing: snapshot,
        dmsReferenceNo: "DMS-001",
        locationHref: "https://dms.dilg.gov.ph/routing",
        routeNo: "11127887",
        title: "DMS",
      }),
    ).toMatchObject({
      dmsReferenceNo: "DMS-001",
      subject: "Request for technical comments",
      assignedSectionCode: "PMES",
      assignedUserEmail: "juan@example.test",
      priority: "URGENT",
      actionRequired: "Prepare draft response",
      dateRouted: "2026-04-25T00:00:00.000Z",
    });
  });
});
