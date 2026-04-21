import { normalizeText } from "@/lib/utils";
import type { FieldMapping } from "@/types/app";

const candidateFieldSelectors = [
  "input",
  "select",
  "textarea",
  "[role='combobox']",
  "[contenteditable='true']",
  ".select2",
  ".k-picker",
  ".k-dropdownlist",
  ".choices",
  ".ts-wrapper",
];

const customWidgetRootSelectors = [
  "[role='combobox']",
  ".select2",
  ".k-picker",
  ".k-dropdownlist",
  ".choices",
  ".ts-wrapper",
  ".ms-parent",
  ".ms-choice",
  ".bootstrap-select",
  ".chosen-container",
  ".dropdown",
];

const widgetContentSelectors = [
  ...customWidgetRootSelectors,
  ".selection",
  ".tag",
  ".token",
  ".selected",
  ".selected-item",
  ".k-chip",
  ".choices__item",
  "input",
  "select",
  "textarea",
];

type DisplayTextCandidate = {
  container: Element;
  labelElement: Element;
};

const labelCandidateSelectors = [
  "label",
  ".control-label",
  ".form-label",
  "th",
  "dt",
  "strong",
  "b",
  "span",
  "div",
  "p",
];

const labelBoundarySelectors = [
  "label",
  ".control-label",
  ".form-label",
  "th",
  "dt",
  "strong",
  "b",
];

const escapeCssIdentifier = (value: string): string => {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
};

const getClosestFieldContainer = (element: Element): Element => {
  return (
    element.closest(".form-group, .form-field, .field, .k-form-field") ??
    element.parentElement ??
    element
  );
};

const findElementFromSiblings = (
  labelElement: Element,
  mapping: FieldMapping,
): Element | null => {
  let sibling: Element | null = labelElement.nextElementSibling;

  while (sibling) {
    if (sibling.matches(labelBoundarySelectors.join(", "))) {
      break;
    }

    if (mapping.type === "custom-select" || mapping.type === "custom-multiselect") {
      if (sibling.matches(customWidgetRootSelectors.join(", "))) {
        return sibling;
      }

      const nestedCustomRoot = sibling.querySelector(customWidgetRootSelectors.join(", "));
      if (nestedCustomRoot) {
        return nestedCustomRoot;
      }

      if (sibling.querySelector(widgetContentSelectors.join(", "))) {
        return sibling;
      }
    }

    const nestedField =
      sibling.matches(candidateFieldSelectors.join(", "))
        ? sibling
        : sibling.querySelector(candidateFieldSelectors.join(", "));
    if (nestedField) {
      return nestedField;
    }

    sibling = sibling.nextElementSibling;
  }

  return null;
};

const findLabelElement = (root: ParentNode, labelHints: string[]): Element | null => {
  const normalizedHints = labelHints.map(normalizeText);
  const strictCandidates = Array.from(root.querySelectorAll(labelBoundarySelectors.join(", ")));
  const looseCandidates = Array.from(root.querySelectorAll(labelCandidateSelectors.join(", ")));

  for (const candidates of [strictCandidates, looseCandidates]) {
    for (const candidate of candidates) {
      const text = normalizeText(candidate.textContent);
      if (!text) {
        continue;
      }

      if (
        normalizedHints.some((hint) => {
          if (text === hint) {
            return true;
          }

          const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(`^${escaped}\\s*(?:[:*?\\-]|$)`).test(text);
        })
      ) {
        return candidate;
      }
    }
  }

  return null;
};

const findElementByLabel = (root: ParentNode, mapping: FieldMapping): Element | null => {
  if (!mapping.labelHints?.length) {
    return null;
  }

  const labelElement = findLabelElement(root, mapping.labelHints);
  if (!labelElement) {
    return null;
  }

  if (mapping.type === "display-text") {
    const container = getClosestFieldContainer(labelElement);
    container.setAttribute("data-dms-display-text", "true");
    return container;
  }

  const explicitFor = labelElement.getAttribute("for");
  if (explicitFor) {
    const byFor = root.querySelector(`#${escapeCssIdentifier(explicitFor)}`);
    if (byFor) {
      return byFor;
    }
  }

  const siblingMatch = findElementFromSiblings(labelElement, mapping);
  if (siblingMatch) {
    return siblingMatch;
  }

  const container = getClosestFieldContainer(labelElement);
  if (mapping.type === "custom-select" || mapping.type === "custom-multiselect") {
    const customRoot = container.querySelector(customWidgetRootSelectors.join(", "));
    if (customRoot) {
      return customRoot;
    }
  }

  const directMatch = container.querySelector(candidateFieldSelectors.join(", "));
  if (directMatch) {
    return directMatch;
  }

  return null;
};

const getRadioLabelText = (radio: HTMLInputElement): string =>
  normalizeText(
    radio.closest("label")?.textContent ??
      radio.parentElement?.textContent ??
      radio.value,
  );

const getRadioGroupByName = (
  root: ParentNode,
  radio: HTMLInputElement,
): Element[] => {
  if (!radio.name) {
    return [];
  }

  return Array.from(
    root.querySelectorAll(`input[type='radio'][name='${escapeCssIdentifier(radio.name)}']`),
  );
};

const radioMatchesOption = (radio: HTMLInputElement, mapping: FieldMapping): boolean => {
  const radioText = getRadioLabelText(radio);
  return mapping.radioOptions?.some((option) =>
    option.labelHints?.some((hint) => radioText.includes(normalizeText(hint))) ||
    normalizeText(option.value) === normalizeText(radio.value),
  ) ?? false;
};

const findRadioCandidatesByLabel = (
  root: ParentNode,
  mapping: FieldMapping,
): Element[] => {
  if (mapping.type !== "radio" || !mapping.labelHints?.length) {
    return [];
  }

  const labelElement = findLabelElement(root, mapping.labelHints);
  if (!labelElement) {
    return [];
  }

  const explicitFor = labelElement.getAttribute("for");
  if (explicitFor) {
    const byFor = root.querySelector(`#${escapeCssIdentifier(explicitFor)}`);
    if (byFor instanceof HTMLInputElement && byFor.type === "radio") {
      const namedGroup = getRadioGroupByName(root, byFor);
      return namedGroup.length > 0 ? namedGroup : [byFor];
    }
  }

  for (
    let ancestor: Element | null = labelElement;
    ancestor && ancestor.tagName.toLowerCase() !== "body" && ancestor.tagName.toLowerCase() !== "html";
    ancestor = ancestor.parentElement
  ) {
    const radios = Array.from(
      ancestor.querySelectorAll<HTMLInputElement>("input[type='radio']"),
    );
    const optionRadios = radios.filter((radio) => radioMatchesOption(radio, mapping));
    if (optionRadios.length >= 2) {
      return optionRadios;
    }
  }

  const siblingRadios: HTMLInputElement[] = [];
  let sibling: Element | null = labelElement.nextElementSibling;
  while (sibling) {
    const radios = Array.from(
      sibling.matches("input[type='radio']")
        ? [sibling]
        : sibling.querySelectorAll<HTMLInputElement>("input[type='radio']"),
    ).filter(
      (radio): radio is HTMLInputElement =>
        radio instanceof HTMLInputElement && radioMatchesOption(radio, mapping),
    );

    siblingRadios.push(...radios);
    if (siblingRadios.length >= (mapping.radioOptions?.length ?? 2)) {
      break;
    }

    sibling = sibling.nextElementSibling;
  }

  return siblingRadios;
};

export const resolveDisplayTextCandidate = (
  root: ParentNode,
  mapping: FieldMapping,
): DisplayTextCandidate | null => {
  if (mapping.type !== "display-text" || !mapping.labelHints?.length) {
    return null;
  }

  const labelElement = findLabelElement(root, mapping.labelHints);
  if (!labelElement) {
    return null;
  }

  return {
    container: getClosestFieldContainer(labelElement),
    labelElement,
  };
};

const findBySelectors = (root: ParentNode, selectors: string[] | undefined): Element | null => {
  if (!selectors?.length) {
    return null;
  }

  for (const selector of selectors) {
    const element = root.querySelector(selector);
    if (element) {
      return element;
    }
  }

  return null;
};

export const resolveFieldElement = (
  root: ParentNode,
  mapping: FieldMapping,
): Element | null => {
  return (
    findBySelectors(root, mapping.selectors) ??
    findElementByLabel(root, mapping) ??
    findBySelectors(root, mapping.fallbackSelectors)
  );
};

export const resolveFieldCandidates = (
  root: ParentNode,
  mapping: FieldMapping,
): Element[] => {
  if (mapping.type === "radio") {
    const labelCandidates = findRadioCandidatesByLabel(root, mapping);
    if (labelCandidates.length > 0) {
      return labelCandidates;
    }
  }

  const primary = resolveFieldElement(root, mapping);
  if (!primary) {
    return [];
  }

  if (primary.matches("input[type='radio']")) {
    if (primary instanceof HTMLInputElement && primary.name) {
      const namedRadios = getRadioGroupByName(root, primary);
      if (namedRadios.length > 0) {
        return namedRadios;
      }
    }

    const container = getClosestFieldContainer(primary);
    return Array.from(container.querySelectorAll("input[type='radio']"));
  }

  if (primary.matches("input[type='checkbox']")) {
    const container = getClosestFieldContainer(primary);
    const matches = Array.from(container.querySelectorAll("input[type='checkbox']"));
    return matches.length > 0 ? matches : [primary];
  }

  return [primary];
};
