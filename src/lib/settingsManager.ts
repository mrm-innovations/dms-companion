import { DEFAULT_SETTINGS, STORAGE_KEYS } from "@/lib/constants";
import { getFromStorage, setInStorage } from "@/lib/storage";
import type { AppSettings, FieldMapping, RoutingFieldKey } from "@/types/app";

const LEGACY_TRACKER_APP_BASE_URLS = new Set(["http://localhost:3000"]);

export const migrateTrackerAppBaseUrl = (value: string | undefined): string =>
  value && !LEGACY_TRACKER_APP_BASE_URLS.has(value)
    ? value
    : DEFAULT_SETTINGS.tracker.appBaseUrl;

const needsTrackerAppBaseUrlMigration = (
  value: Partial<AppSettings> | null | undefined,
): boolean => Boolean(value?.tracker?.appBaseUrl && LEGACY_TRACKER_APP_BASE_URLS.has(value.tracker.appBaseUrl));

const mergeFieldMapping = (
  base: FieldMapping,
  override: Partial<FieldMapping> | undefined,
): FieldMapping => ({
  ...base,
  ...override,
  selectors: override?.selectors?.length ? override.selectors : base.selectors,
  fallbackSelectors: override?.fallbackSelectors?.length
    ? override.fallbackSelectors
    : base.fallbackSelectors,
  labelHints: override?.labelHints?.length ? override.labelHints : base.labelHints,
  inputSelectors: override?.inputSelectors?.length ? override.inputSelectors : base.inputSelectors,
  triggerSelectors: override?.triggerSelectors?.length ? override.triggerSelectors : base.triggerSelectors,
  optionSelectors: override?.optionSelectors?.length ? override.optionSelectors : base.optionSelectors,
  valueSelectors: override?.valueSelectors?.length ? override.valueSelectors : base.valueSelectors,
  radioOptions: override?.radioOptions?.length ? override.radioOptions : base.radioOptions,
});

const mergeSettings = (value: Partial<AppSettings> | null | undefined): AppSettings => {
  const source = value ?? {};
  const fieldMappings = { ...DEFAULT_SETTINGS.fieldMappings };

  (Object.keys(DEFAULT_SETTINGS.fieldMappings) as RoutingFieldKey[]).forEach((key) => {
    fieldMappings[key] = mergeFieldMapping(
      DEFAULT_SETTINGS.fieldMappings[key],
      source.fieldMappings?.[key],
    );
  });

  return {
    debug: source.debug ?? DEFAULT_SETTINGS.debug,
    previewBeforeApply: source.previewBeforeApply ?? DEFAULT_SETTINGS.previewBeforeApply,
    carryPriorityForward: source.carryPriorityForward ?? DEFAULT_SETTINGS.carryPriorityForward,
    tracker: {
      enabled: source.tracker?.enabled ?? DEFAULT_SETTINGS.tracker.enabled,
      appBaseUrl: migrateTrackerAppBaseUrl(source.tracker?.appBaseUrl),
      sharedSecret: source.tracker?.sharedSecret ?? DEFAULT_SETTINGS.tracker.sharedSecret,
      openCreatedRecord:
        source.tracker?.openCreatedRecord ?? DEFAULT_SETTINGS.tracker.openCreatedRecord,
    },
    pageDetection: {
      hostIncludes: source.pageDetection?.hostIncludes?.length
        ? source.pageDetection.hostIncludes
        : DEFAULT_SETTINGS.pageDetection.hostIncludes,
      urlIncludes: source.pageDetection?.urlIncludes?.length
        ? source.pageDetection.urlIncludes
        : DEFAULT_SETTINGS.pageDetection.urlIncludes,
      headingText: source.pageDetection?.headingText?.length
        ? source.pageDetection.headingText
        : DEFAULT_SETTINGS.pageDetection.headingText,
      requiredFieldLabels: source.pageDetection?.requiredFieldLabels?.length
        ? source.pageDetection.requiredFieldLabels
        : DEFAULT_SETTINGS.pageDetection.requiredFieldLabels,
    },
    fieldMappings,
  };
};

export const loadSettings = async (): Promise<AppSettings> => {
  const value = await getFromStorage<Partial<AppSettings> | null>(STORAGE_KEYS.settings, null);
  const settings = mergeSettings(value);

  if (needsTrackerAppBaseUrlMigration(value)) {
    await saveSettings(settings);
  }

  return settings;
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  await setInStorage({
    [STORAGE_KEYS.settings]: settings,
  });
};

export const resetSettings = async (): Promise<AppSettings> => {
  await saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
};

export const stringifySettings = (settings: AppSettings): string =>
  JSON.stringify(settings, null, 2);

export const parseSettings = (value: string): AppSettings =>
  mergeSettings(JSON.parse(value) as Partial<AppSettings>);
