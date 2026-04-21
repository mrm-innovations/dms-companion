import { STORAGE_KEYS } from "@/lib/constants";
import { applyFieldValue, readFieldValue } from "@/lib/fieldAdapter";
import { getFromStorage, setInStorage } from "@/lib/storage";
import { normalizeText, nowIso } from "@/lib/utils";
import type { AppSettings, FieldValue } from "@/types/app";

type CarriedPriority = {
  priority: "RUSH DOCUMENT" | "URGENT DOCUMENT" | "NORMAL";
  sourceUrl: string;
  sourceLabel: string | null;
  capturedAt: string;
};

const PRIORITY_MAX_AGE_MS = 30 * 60 * 1000;

const normalizePriorityValue = (value: string | null | undefined): CarriedPriority["priority"] | null => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  if (normalized.includes("rush")) {
    return "RUSH DOCUMENT";
  }

  if (normalized.includes("urgent")) {
    return "URGENT DOCUMENT";
  }

  if (normalized.includes("normal")) {
    return "NORMAL";
  }

  if (["no", "none", "not priority", "not a priority"].includes(normalized)) {
    return "NORMAL";
  }

  return null;
};

const getElementText = (element: Element | null): string =>
  (element?.textContent ?? "").replace(/\s+/g, " ").trim();

const findDetailsRowPriority = (root: Document): string | null => {
  const rows = Array.from(root.querySelectorAll("tr"));
  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll("th, td"));
    if (cells.length < 2) {
      continue;
    }

    const label = normalizeText(cells[0]?.textContent);
    if (label === "priority") {
      return getElementText(cells[1] ?? null);
    }
  }

  return null;
};

const findSourceLabel = (root: Document): string | null => {
  const heading = root.querySelector("h1, h2, .page-title");
  const headingText = getElementText(heading);
  if (headingText) {
    return headingText;
  }

  const routeRow = Array.from(root.querySelectorAll("tr")).find((row) => {
    const cells = Array.from(row.querySelectorAll("th, td"));
    return normalizeText(cells[0]?.textContent) === "route no.";
  });

  if (!routeRow) {
    return null;
  }

  const cells = Array.from(routeRow.querySelectorAll("th, td"));
  return getElementText(cells[1] ?? null) || null;
};

const isFreshCarry = (value: CarriedPriority): boolean => {
  const capturedAt = Date.parse(value.capturedAt);
  if (!Number.isFinite(capturedAt)) {
    return false;
  }

  return Date.now() - capturedAt <= PRIORITY_MAX_AGE_MS;
};

const valuesEqual = (left: FieldValue, right: FieldValue): boolean => {
  const leftText = Array.isArray(left) ? left.join(", ") : String(left ?? "");
  const rightText = Array.isArray(right) ? right.join(", ") : String(right ?? "");
  return normalizePriorityValue(leftText) === normalizePriorityValue(rightText);
};

export const capturePriorityFromDetailsPage = async (
  root: Document,
  settings: AppSettings,
): Promise<CarriedPriority | null> => {
  if (!settings.carryPriorityForward) {
    return null;
  }

  const priority = normalizePriorityValue(findDetailsRowPriority(root));
  if (!priority) {
    return null;
  }

  const carried: CarriedPriority = {
    priority,
    sourceUrl: root.location.href,
    sourceLabel: findSourceLabel(root),
    capturedAt: nowIso(),
  };

  await setInStorage({ [STORAGE_KEYS.carriedPriority]: carried });
  return carried;
};

export const applyCarriedPriorityToRoutingForm = async (
  settings: AppSettings,
): Promise<CarriedPriority | null> => {
  if (!settings.carryPriorityForward) {
    return null;
  }

  const carried = await getFromStorage<CarriedPriority | null>(STORAGE_KEYS.carriedPriority, null);
  if (!carried || !isFreshCarry(carried)) {
    return null;
  }

  const currentPriority = readFieldValue(settings.fieldMappings.priority);
  const currentNormalized = normalizePriorityValue(
    Array.isArray(currentPriority) ? currentPriority.join(", ") : String(currentPriority ?? ""),
  );

  if (currentNormalized && currentNormalized !== "NORMAL") {
    return null;
  }

  if (valuesEqual(currentPriority, carried.priority)) {
    return null;
  }

  const result = await applyFieldValue(settings.fieldMappings.priority, carried.priority);
  return result.applied ? carried : null;
};
