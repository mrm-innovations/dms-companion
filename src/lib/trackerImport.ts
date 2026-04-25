import { captureCurrentRouting, captureSubjectTitle } from "@/lib/presetCapture";
import { serializeFieldValue } from "@/lib/utils";
import type { AppSettings, RoutingSnapshot } from "@/types/app";

export type TrackerPriority = "LOW" | "NORMAL" | "URGENT" | "RUSH";
export type TrackerSectionCode = "PMES" | "PCIS" | "PLRS";

export type DmsImportPayload = {
  dmsReferenceNo?: string;
  subject: string;
  sourceName?: string;
  sourceOffice?: string;
  dateReceived?: string;
  dateRouted?: string;
  assignedSectionCode?: TrackerSectionCode;
  assignedUserEmail?: string;
  priority?: TrackerPriority;
  officialDeadline?: string;
  internalDeadline?: string;
  actionRequired?: string;
  remarks?: string;
  rawSnapshot?: Record<string, unknown>;
};

export type TrackerImportResult = {
  communicationId: string;
  appUrl: string;
};

const SECTION_CODES: TrackerSectionCode[] = ["PMES", "PCIS", "PLRS"];

const labelAliases: Record<string, string[]> = {
  dmsReferenceNo: [
    "DMS Reference No",
    "DMS Reference Number",
    "Reference No",
    "Reference Number",
    "Document Tracking No",
    "Document Tracking Number",
  ],
  sourceName: ["Source Name", "Sender", "From", "Originator"],
  sourceOffice: ["Source Office", "Office", "Originating Office"],
  dateReceived: ["Date Received", "Received Date"],
  officialDeadline: ["Deadline", "Official Deadline", "Due Date"],
};

export const normalizeTrackerBaseUrl = (value: string): string =>
  value.trim().replace(/\/+$/, "");

export const mapTrackerPriority = (value: string | null): TrackerPriority => {
  const normalized = (value ?? "").toUpperCase();
  if (normalized.includes("RUSH")) {
    return "RUSH";
  }

  if (normalized.includes("URGENT")) {
    return "URGENT";
  }

  if (normalized.includes("LOW")) {
    return "LOW";
  }

  return "NORMAL";
};

export const mapTrackerSectionCode = (
  value: string | null,
): TrackerSectionCode | undefined => {
  const normalized = (value ?? "").toUpperCase();
  return SECTION_CODES.find((code) => normalized.includes(code));
};

export const findFirstEmail = (value: string | string[] | null): string | undefined => {
  const text = Array.isArray(value) ? value.join(", ") : value ?? "";
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
};

const normalizeDateValue = (value: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return new Date(timestamp).toISOString();
};

const normalizeDateOnlyValue = (value: string | null): string | undefined => {
  const iso = normalizeDateValue(value);
  return iso?.slice(0, 10);
};

const getCandidateText = (element: Element | null): string | null => {
  if (!element) {
    return null;
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value.trim() || null;
  }

  if (element instanceof HTMLSelectElement) {
    return element.selectedOptions[0]?.textContent?.trim() || element.value.trim() || null;
  }

  return element.textContent?.trim() || null;
};

const findValueNearLabel = (label: string, root: ParentNode = document): string | null => {
  const normalizedLabel = label.toLowerCase();
  const candidates = Array.from(root.querySelectorAll("label, th, td, dt, div, span, p"));

  for (const candidate of candidates) {
    const text = candidate.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (!text.toLowerCase().includes(normalizedLabel)) {
      continue;
    }

    const labelElement = candidate instanceof HTMLLabelElement ? candidate : null;
    const labelledControl = labelElement?.control ?? null;
    const labelledValue = getCandidateText(labelledControl);
    if (labelledValue) {
      return labelledValue;
    }

    const nextElement = candidate.nextElementSibling;
    const nextValue = getCandidateText(nextElement);
    if (nextValue && nextValue.toLowerCase() !== text.toLowerCase()) {
      return nextValue;
    }

    const row = candidate.closest("tr");
    const rowCells = row ? Array.from(row.querySelectorAll("td, th")) : [];
    const cellIndex = rowCells.indexOf(candidate);
    const adjacentCell = cellIndex >= 0 ? rowCells[cellIndex + 1] ?? null : null;
    const adjacentValue = getCandidateText(adjacentCell);
    if (adjacentValue) {
      return adjacentValue;
    }

    const inlineMatch = text.match(new RegExp(`${label}\\s*:?\\s*(.+)$`, "i"));
    if (inlineMatch?.[1]) {
      return inlineMatch[1].trim();
    }
  }

  return null;
};

const findMetadataValue = (key: keyof typeof labelAliases): string | null => {
  for (const alias of labelAliases[key]) {
    const value = findValueNearLabel(alias);
    if (value) {
      return value;
    }
  }

  return null;
};

export const buildDmsImportPayload = (
  settings: AppSettings,
  locationHref = window.location.href,
): DmsImportPayload => {
  const routing = captureCurrentRouting(settings);
  const subject = captureSubjectTitle(settings) || document.title || "Untitled DMS communication";
  const dmsReferenceNo = findMetadataValue("dmsReferenceNo") ?? undefined;
  const sourceName = findMetadataValue("sourceName") ?? undefined;
  const sourceOffice = findMetadataValue("sourceOffice") ?? undefined;
  const dateReceived = normalizeDateOnlyValue(findMetadataValue("dateReceived"));
  const officialDeadline = normalizeDateValue(findMetadataValue("officialDeadline"));

  return buildDmsImportPayloadFromSnapshot({
    subject,
    routing,
    dmsReferenceNo,
    sourceName,
    sourceOffice,
    dateReceived,
    officialDeadline,
    locationHref,
    title: document.title,
  });
};

export const buildDmsImportPayloadFromSnapshot = ({
  subject,
  routing,
  dmsReferenceNo,
  sourceName,
  sourceOffice,
  dateReceived,
  officialDeadline,
  locationHref,
  title,
}: {
  subject: string;
  routing: RoutingSnapshot;
  dmsReferenceNo?: string;
  sourceName?: string;
  sourceOffice?: string;
  dateReceived?: string;
  officialDeadline?: string;
  locationHref: string;
  title: string;
}): DmsImportPayload => {
  const assignedSectionCode = mapTrackerSectionCode(routing.section);
  const assignedUserEmail = findFirstEmail(routing.actionOfficer);
  const priority = mapTrackerPriority(routing.priority);
  const actionRequired = routing.action ?? undefined;

  return {
    dmsReferenceNo,
    subject,
    sourceName,
    sourceOffice,
    dateReceived,
    dateRouted: routing.capturedAt,
    assignedSectionCode,
    assignedUserEmail,
    priority,
    officialDeadline,
    actionRequired,
    remarks: [
      routing.routeTo ? `Route to: ${routing.routeTo}` : null,
      routing.division ? `Division: ${routing.division}` : null,
      routing.actionOfficer ? `Action officer: ${serializeFieldValue(routing.actionOfficer)}` : null,
    ]
      .filter(Boolean)
      .join("\n") || undefined,
    rawSnapshot: {
      source: "dms-companion",
      url: locationHref,
      title,
      routing,
    },
  };
};

export const sendDmsImportToTracker = async (
  settings: AppSettings,
  payload: DmsImportPayload,
): Promise<TrackerImportResult> => {
  if (!settings.tracker.enabled) {
    throw new Error("Tracker import is disabled in settings.");
  }

  const appBaseUrl = normalizeTrackerBaseUrl(settings.tracker.appBaseUrl);
  const sharedSecret = settings.tracker.sharedSecret.trim();

  if (!appBaseUrl || !sharedSecret) {
    throw new Error("Tracker URL and shared secret are required.");
  }

  const response = await fetch(`${appBaseUrl}/api/communications/import-from-dms`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-extension-secret": sharedSecret,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof body.error === "string"
        ? body.error
        : `Tracker import failed with HTTP ${response.status}.`;
    throw new Error(message);
  }

  if (typeof body.communicationId !== "string" || typeof body.appUrl !== "string") {
    throw new Error("Tracker response did not include the created communication.");
  }

  return {
    communicationId: body.communicationId,
    appUrl: `${appBaseUrl}${body.appUrl}`,
  };
};
