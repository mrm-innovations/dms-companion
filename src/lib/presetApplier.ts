import { FIELD_ORDER } from "@/lib/constants";
import { applyFieldValue, readFieldValue, waitForFieldReady } from "@/lib/fieldAdapter";
import { captureCurrentRouting } from "@/lib/presetCapture";
import { saveLastRouting } from "@/lib/presetStore";
import { serializeFieldValue } from "@/lib/utils";
import type { AppSettings, ApplyFieldResult, PreviewItem, RoutingPreset } from "@/types/app";

export const buildPreview = (
  preset: RoutingPreset,
  settings: AppSettings,
): PreviewItem[] => {
  return FIELD_ORDER.map((key) => {
    const mapping = settings.fieldMappings[key];
    const currentValue = readFieldValue(mapping);
    const nextValue = preset[key];

    return {
      key,
      label: mapping.label,
      currentValue,
      nextValue,
      willChange: serializeFieldValue(currentValue) !== serializeFieldValue(nextValue),
    };
  });
};

export const applyPreset = async (
  preset: RoutingPreset,
  settings: AppSettings,
): Promise<ApplyFieldResult[]> => {
  const results: ApplyFieldResult[] = [];

  for (const key of FIELD_ORDER) {
    const mapping = settings.fieldMappings[key];
    const targetValue = preset[key];

    if (targetValue === null || targetValue === "") {
      results.push({
        key,
        applied: false,
        skipped: true,
        reason: "Preset does not define a value for this field",
        targetValue,
        actualValue: readFieldValue(mapping),
      });
      continue;
    }

    const attempts = mapping.retryCount ?? 1;
    let finalResult: ApplyFieldResult | null = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await waitForFieldReady(mapping);
      finalResult = await applyFieldValue(mapping, targetValue);
      if (finalResult.applied) {
        break;
      }
    }

    results.push(
      finalResult ?? {
        key,
        applied: false,
        skipped: false,
        reason: "Field application failed",
        targetValue,
        actualValue: null,
      },
    );
  }

  await saveLastRouting(captureCurrentRouting(settings));
  return results;
};
