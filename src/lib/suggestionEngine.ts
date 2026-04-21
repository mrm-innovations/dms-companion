import { normalizeText } from "@/lib/utils";
import type { MatchingRules, RoutingPreset } from "@/types/app";

const includesAll = (value: string, candidates: string[]): boolean =>
  candidates.every((candidate) => value.includes(normalizeText(candidate)));

const includesAny = (value: string, candidates: string[]): boolean =>
  candidates.some((candidate) => value.includes(normalizeText(candidate)));

const startsWithAny = (value: string, candidates: string[]): boolean =>
  candidates.some((candidate) => value.startsWith(normalizeText(candidate)));

const exactPhraseMatch = (value: string, candidates: string[]): boolean =>
  candidates.some((candidate) => value.includes(normalizeText(candidate)));

export const matchesRules = (subjectTitle: string, rules: MatchingRules): boolean => {
  const normalizedValue = normalizeText(subjectTitle);
  if (!normalizedValue) {
    return false;
  }

  const hasRules =
    (rules.containsAny?.length ?? 0) > 0 ||
    (rules.containsAll?.length ?? 0) > 0 ||
    (rules.startsWith?.length ?? 0) > 0 ||
    (rules.exactPhrase?.length ?? 0) > 0;

  if (!hasRules) {
    return false;
  }

  if (rules.containsAny?.length && !includesAny(normalizedValue, rules.containsAny)) {
    return false;
  }

  if (rules.containsAll?.length && !includesAll(normalizedValue, rules.containsAll)) {
    return false;
  }

  if (rules.startsWith?.length && !startsWithAny(normalizedValue, rules.startsWith)) {
    return false;
  }

  if (rules.exactPhrase?.length && !exactPhraseMatch(normalizedValue, rules.exactPhrase)) {
    return false;
  }

  return true;
};

export const getSuggestedPresets = (
  presets: RoutingPreset[],
  subjectTitle: string,
): RoutingPreset[] =>
  presets
    .filter((preset) => preset.enabled)
    .filter((preset) => matchesRules(subjectTitle, preset.matchingRules));
