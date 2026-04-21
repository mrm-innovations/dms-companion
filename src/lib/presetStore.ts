import { STORAGE_KEYS } from "@/lib/constants";
import { getFromStorage, setInStorage } from "@/lib/storage";
import { createId, nowIso } from "@/lib/utils";
import type { RoutingPreset, RoutingSnapshot } from "@/types/app";

const normalizePreset = (value: Partial<RoutingPreset>): RoutingPreset => {
  const timestamp = value.createdAt ?? nowIso();

  return {
    id: value.id ?? createId(),
    name: value.name?.trim() ?? "Untitled preset",
    description: value.description?.trim() ?? "",
    enabled: value.enabled ?? true,
    routeTo: value.routeTo ?? null,
    division: value.division ?? null,
    section: value.section ?? null,
    actionOfficer: value.actionOfficer ?? null,
    action: value.action ?? null,
    forwardedOriginalDocument: value.forwardedOriginalDocument ?? null,
    priority: value.priority ?? null,
    matchingRules: {
      containsAny: value.matchingRules?.containsAny ?? [],
      containsAll: value.matchingRules?.containsAll ?? [],
      startsWith: value.matchingRules?.startsWith ?? [],
      exactPhrase: value.matchingRules?.exactPhrase ?? [],
    },
    createdAt: timestamp,
    updatedAt: value.updatedAt ?? timestamp,
  };
};

export const listPresets = async (): Promise<RoutingPreset[]> => {
  const presets = await getFromStorage<RoutingPreset[]>(STORAGE_KEYS.presets, []);
  return presets.map(normalizePreset).sort((left, right) => left.name.localeCompare(right.name));
};

export const savePreset = async (preset: Partial<RoutingPreset>): Promise<RoutingPreset> => {
  const presets = await listPresets();
  const normalized = normalizePreset({
    ...preset,
    updatedAt: nowIso(),
  });
  const index = presets.findIndex((item) => item.id === normalized.id);

  if (index >= 0) {
    presets[index] = {
      ...presets[index],
      ...normalized,
      createdAt: presets[index].createdAt,
    };
  } else {
    presets.push(normalized);
  }

  await setInStorage({
    [STORAGE_KEYS.presets]: presets,
  });

  return normalized;
};

export const deletePreset = async (presetId: string): Promise<void> => {
  const presets = await listPresets();
  await setInStorage({
    [STORAGE_KEYS.presets]: presets.filter((preset) => preset.id !== presetId),
  });
};

export const exportPresets = async (): Promise<string> => {
  const presets = await listPresets();
  return JSON.stringify(presets, null, 2);
};

export const importPresets = async (value: string): Promise<RoutingPreset[]> => {
  const parsed = JSON.parse(value) as Partial<RoutingPreset>[];
  const normalized = parsed.map(normalizePreset);
  await setInStorage({
    [STORAGE_KEYS.presets]: normalized,
  });
  return normalized;
};

export const getLastRouting = async (): Promise<RoutingSnapshot | null> =>
  getFromStorage<RoutingSnapshot | null>(STORAGE_KEYS.lastRouting, null);

export const saveLastRouting = async (value: RoutingSnapshot): Promise<void> => {
  await setInStorage({
    [STORAGE_KEYS.lastRouting]: value,
  });
};
