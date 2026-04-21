import { FIELD_ORDER } from "@/lib/constants";
import { readFieldValue } from "@/lib/fieldAdapter";
import { nowIso } from "@/lib/utils";
import type { AppSettings, RoutingSnapshot } from "@/types/app";

export const captureCurrentRouting = (settings: AppSettings): RoutingSnapshot => ({
  routeTo: readFieldValue(settings.fieldMappings.routeTo) as string | null,
  division: readFieldValue(settings.fieldMappings.division) as string | null,
  section: readFieldValue(settings.fieldMappings.section) as string | null,
  actionOfficer: readFieldValue(settings.fieldMappings.actionOfficer) as string | string[] | null,
  action: readFieldValue(settings.fieldMappings.action) as string | null,
  forwardedOriginalDocument: readFieldValue(settings.fieldMappings.forwardedOriginalDocument) as boolean | null,
  priority: readFieldValue(settings.fieldMappings.priority) as string | null,
  capturedAt: nowIso(),
});

export const captureSubjectTitle = (settings: AppSettings): string =>
  (readFieldValue(settings.fieldMappings.subjectTitle) as string | null) ?? "";

export const listCaptureFields = (): typeof FIELD_ORDER => FIELD_ORDER;
