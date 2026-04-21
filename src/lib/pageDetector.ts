import { normalizeText } from "@/lib/utils";
import type { AppSettings, DetectionResult } from "@/types/app";

const findTextMatches = (root: ParentNode, values: string[]): string[] => {
  const haystack = normalizeText(root.textContent);
  return values.filter((value) => haystack.includes(normalizeText(value)));
};

export const detectRoutingPage = (
  documentRoot: Document,
  settings: AppSettings,
): DetectionResult => {
  const reasons: string[] = [];
  let confidence = 0;

  const locationText = `${documentRoot.title} ${documentRoot.location.href}`;
  const host = documentRoot.location.hostname;

  const matchedHosts = settings.pageDetection.hostIncludes.filter((hint) =>
    normalizeText(host).includes(normalizeText(hint)),
  );

  if (matchedHosts.length > 0) {
    confidence += 0.2;
    reasons.push(`Host matched: ${matchedHosts.join(", ")}`);
  }

  const matchedUrlHints = settings.pageDetection.urlIncludes.filter((hint) =>
    normalizeText(locationText).includes(normalizeText(hint)),
  );

  if (matchedUrlHints.length > 0) {
    confidence += Math.min(0.45, 0.18 + matchedUrlHints.length * 0.12);
    reasons.push(`URL/title matched: ${matchedUrlHints.join(", ")}`);
  }

  const headingMatches = Array.from(
    documentRoot.querySelectorAll("h1, h2, h3, .page-title, .card-title"),
  )
    .map((element) => normalizeText(element.textContent))
    .filter(Boolean);

  const matchedHeading = settings.pageDetection.headingText.find((hint) =>
    headingMatches.some((heading) => heading.includes(normalizeText(hint))),
  );

  if (matchedHeading) {
    confidence += 0.45;
    reasons.push(`Heading matched: ${matchedHeading}`);
  }

  const fieldMatches = findTextMatches(documentRoot.body, settings.pageDetection.requiredFieldLabels);
  if (fieldMatches.length >= 2) {
    confidence += Math.min(0.3, fieldMatches.length * 0.08);
    reasons.push(`Field labels matched: ${fieldMatches.join(", ")}`);
  }

  const strongUrlMatch =
    matchedHosts.length > 0 &&
    matchedUrlHints.some((hint) =>
      ["documentroute", "createroutenew", "routing", "route"].includes(
        normalizeText(hint),
      ),
    );

  if (strongUrlMatch && confidence >= 0.38) {
    confidence = Math.max(confidence, 0.55);
    reasons.push("Strong DMS route URL match");
  }

  return {
    matched: confidence >= 0.5,
    confidence: Math.min(1, confidence),
    reasons,
  };
};
