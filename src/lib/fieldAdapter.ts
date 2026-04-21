import {
  resolveDisplayTextCandidate,
  resolveFieldCandidates,
  resolveFieldElement,
} from "@/lib/fieldRegistry";
import { logger } from "@/lib/logger";
import { normalizeText, sleep, toArrayValue, uniqueStrings } from "@/lib/utils";
import type { ApplyFieldResult, FieldMapping, FieldValue, RadioOptionMapping } from "@/types/app";

const defaultOptionSelectors = [
  "[role='option']",
  "[role='treeitem']",
  "li",
  ".dropdown-item",
  ".select2-results__option",
  ".k-list-item",
  ".k-item",
  ".ui-menu-item",
];

const defaultSelectedValueSelectors = [
  ".select2-selection__rendered",
  ".select2-selection__choice",
  ".select2-selection__choice__display",
  ".k-input-value-text",
  ".choices__item",
  ".k-chip",
  ".k-chip-content",
  ".multiselect-selected-text",
  ".ms-choice > span",
  ".ms-selection .ms-selected",
  ".selected-item",
  ".selection .item",
  ".selection .tag",
  ".tag",
  ".token",
  ".ts-control .item",
  ".selected",
];

const normalizeComparable = (value: string): string =>
  normalizeText(value).replace(/[*:]/g, "");

const dispatchFieldEvents = (element: HTMLElement): void => {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("blur", { bubbles: true }));
};

const asStringValue = (value: FieldValue): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return value ?? "";
};

const findNestedElement = (root: Element, selectors: string[] | undefined): Element | null => {
  if (!selectors?.length) {
    return null;
  }

  for (const selector of selectors) {
    const nested = root.matches(selector) ? root : root.querySelector(selector);
    if (nested) {
      return nested;
    }
  }

  return null;
};

const getVisibleText = (element: Element | null): string => {
  if (!element) {
    return "";
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value.trim();
  }

  if (element instanceof HTMLSelectElement) {
    return element.selectedOptions[0]?.textContent?.trim() ?? "";
  }

  return element.textContent?.trim() ?? "";
};

const isContextRootCandidate = (element: Element | null): element is Element => {
  if (!element) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();
  return tagName !== "body" && tagName !== "html" && tagName !== "form";
};

const getSelectionReadRoots = (element: Element, mapping: FieldMapping): Element[] => {
  if (mapping.type !== "custom-select" && mapping.type !== "custom-multiselect") {
    return [element];
  }

  const roots: Element[] = [];
  const addRoot = (candidate: Element | null): void => {
    if (!isContextRootCandidate(candidate) || roots.includes(candidate)) {
      return;
    }

    roots.push(candidate);
  };

  addRoot(element);
  addRoot(
    element.closest(
      ".form-group, .form-field, .field, .k-form-field, .control-group, .form-row, .input-group, .select2-container, .ms-parent, .bootstrap-select, .chosen-container, .choices, .ts-wrapper",
    ),
  );
  addRoot(element.parentElement);
  addRoot(element.previousElementSibling);
  addRoot(element.nextElementSibling);
  addRoot(element.parentElement?.previousElementSibling ?? null);
  addRoot(element.parentElement?.nextElementSibling ?? null);

  return roots;
};

const cleanSelectedText = (text: string): string =>
  text
    .replace(/\s+/g, " ")
    .replace(/^\s*(?:\u00d7|\u2715|\u2716|\u2717|\u2a2f|\u00c3\u0097|\u00c3\u2014)\s*/, "")
    .replace(/^\s*x\s+/i, "")
    .replace(/\s*(?:\u00d7|\u2715|\u2716|\u2717|\u2a2f|\u00c3\u0097|\u00c3\u2014)\s*$/, "")
    .replace(/\s+x\s*$/i, "")
    .trim();

const readSelectedValuesFromElement = (
  element: Element,
  mapping: FieldMapping,
): string[] => {
  const values = new Set<string>();

  const roots = getSelectionReadRoots(element, mapping);
  const nestedSelects = roots.flatMap((root) =>
    root.matches("select") ? [root] : Array.from(root.querySelectorAll("select")),
  );

  for (const selectElement of nestedSelects) {
    if (!(selectElement instanceof HTMLSelectElement)) {
      continue;
    }

    for (const option of Array.from(selectElement.selectedOptions)) {
      if (!option.value.trim() && !option.textContent?.trim()) {
        continue;
      }

      const value = cleanSelectedText(option.textContent ?? option.value);
      if (value) {
        values.add(value);
      }
    }
  }

  const selectors = Array.from(
    new Set([...(mapping.valueSelectors ?? []), ...defaultSelectedValueSelectors]),
  );

  for (const root of roots) {
    for (const selector of selectors) {
      for (const node of Array.from(root.querySelectorAll(selector))) {
        if (node instanceof HTMLSelectElement) {
          continue;
        }

        const text = cleanSelectedText(node.textContent ?? "");
        if (!text) {
          continue;
        }

        values.add(text);
      }
    }
  }

  return uniqueStrings(Array.from(values).map(cleanSelectedText));

  selectors.length = 0;

  for (const selector of selectors) {
    for (const node of Array.from(element.querySelectorAll(selector))) {
      const text = (node.textContent ?? "").replace(/\s*[×x]\s*$/, "").trim();
      if (!text) {
        continue;
      }

      values.add(text);
    }
  }

  return Array.from(values);
};

const removeLabelPrefix = (text: string, labelHints: string[] | undefined): string => {
  let next = text.trim();

  for (const hint of labelHints ?? []) {
    const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(new RegExp(`^${escaped}\\s*:?[\\s-]*`, "i"), "").trim();
  }

  return next;
};

const readDisplayTextValue = (mapping: FieldMapping, root: ParentNode): string | null => {
  const candidate = resolveDisplayTextCandidate(root, mapping);
  if (!candidate) {
    const fallback = resolveFieldElement(root, mapping);
    const text = removeLabelPrefix(getVisibleText(fallback), mapping.labelHints);
    return text || null;
  }

  const { container, labelElement } = candidate;
  const directTextParts: string[] = [];

  for (const node of Array.from(container.childNodes)) {
    if (node === labelElement) {
      continue;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const value = removeLabelPrefix(node.textContent ?? "", mapping.labelHints);
      if (value) {
        directTextParts.push(value);
      }
      continue;
    }

    if (node instanceof HTMLElement && !labelElement.contains(node)) {
      const value = removeLabelPrefix(node.innerText || node.textContent || "", mapping.labelHints);
      if (value) {
        directTextParts.push(value);
      }
    }
  }

  const joinedDirectText = directTextParts.join(" ").replace(/\s+/g, " ").trim();
  if (joinedDirectText) {
    return joinedDirectText;
  }

  const fullText = removeLabelPrefix(container.textContent ?? "", mapping.labelHints);
  return fullText || null;
};

const findMatchingOption = (
  options: Element[],
  target: string,
  matchStrategy: FieldMapping["matchStrategy"],
): Element | null => {
  const normalizedTarget = normalizeComparable(target);

  for (const option of options) {
    const optionText = normalizeComparable(option.textContent ?? "");
    const optionValue = normalizeComparable(option.getAttribute("value") ?? "");
    const matchesValue = optionValue === normalizedTarget;
    const matchesText = Boolean(optionText) &&
      (optionText.includes(normalizedTarget) || normalizedTarget.includes(optionText));

    if (
      (matchStrategy === "value" && matchesValue) ||
      (matchStrategy === "text" && matchesText) ||
      (matchStrategy === "both" && (matchesValue || matchesText)) ||
      (!matchStrategy && (matchesValue || matchesText))
    ) {
      return option;
    }
  }

  return null;
};

const readRadioValue = (candidates: Element[], mapping: FieldMapping): string | null => {
  const checked = candidates.find(
    (candidate) => candidate instanceof HTMLInputElement && candidate.checked,
  );
  if (!(checked instanceof HTMLInputElement)) {
    return null;
  }

  const matchedOption = mapping.radioOptions?.find((option) => {
    if (option.selectors?.some((selector) => checked.matches(selector))) {
      return true;
    }

    const labelText = normalizeText(
      checked.closest("label")?.textContent ??
        checked.parentElement?.textContent ??
        checked.value,
    );

    return option.labelHints?.some((hint) => labelText.includes(normalizeText(hint))) ?? false;
  });

  return matchedOption?.value ?? checked.value ?? null;
};

const readSelectValue = (element: Element, mapping: FieldMapping): FieldValue => {
  if (element instanceof HTMLSelectElement) {
    if (element.multiple || mapping.multiple) {
      const values = Array.from(element.selectedOptions)
        .map((option) => option.textContent?.trim() ?? option.value)
        .filter(Boolean);
      return values.length > 0 ? values : null;
    }

    const selectedOption = element.selectedOptions[0];
    if (!selectedOption) {
      return null;
    }

    if (!selectedOption.value.trim()) {
      return null;
    }

    return selectedOption.textContent?.trim() ?? selectedOption.value ?? null;
  }

  if (mapping.multiple) {
    const selectedValues = readSelectedValuesFromElement(element, mapping);
    if (selectedValues.length > 0) {
      return selectedValues;
    }
  }

  const input = findNestedElement(element, mapping.inputSelectors) ?? findNestedElement(element, ["input:not([type='hidden'])"]);
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    return input.value.trim() || null;
  }

  const selectedValues = readSelectedValuesFromElement(element, mapping);

  if (mapping.multiple && selectedValues.length > 0) {
    return selectedValues;
  }

  if (selectedValues.length > 0) {
    return selectedValues[0];
  }

  const text = getVisibleText(element);
  return text || null;
};

const applyNativeText = (element: Element, value: FieldValue): ApplyFieldResult => {
  const target = asStringValue(value);

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus();
    element.value = target;
    dispatchFieldEvents(element);
    return {
      key: "subjectTitle",
      applied: true,
      skipped: false,
      targetValue: target,
      actualValue: element.value,
    };
  }

  if (element instanceof HTMLElement && element.isContentEditable) {
    element.textContent = target;
    dispatchFieldEvents(element);
    return {
      key: "subjectTitle",
      applied: true,
      skipped: false,
      targetValue: target,
      actualValue: element.textContent?.trim() ?? "",
    };
  }

  return {
    key: "subjectTitle",
    applied: false,
    skipped: false,
    reason: "Unsupported text field",
    targetValue: target,
    actualValue: null,
  };
};

const setCheckboxValue = (element: Element, value: FieldValue): ApplyFieldResult => {
  const checkbox =
    element instanceof HTMLInputElement && element.type === "checkbox"
      ? element
      : element.querySelector<HTMLInputElement>("input[type='checkbox']");

  if (!checkbox) {
    return {
      key: "forwardedOriginalDocument",
      applied: false,
      skipped: false,
      reason: "Checkbox not found",
      targetValue: value,
      actualValue: null,
    };
  }

  checkbox.checked = Boolean(value);
  dispatchFieldEvents(checkbox);

  return {
    key: "forwardedOriginalDocument",
    applied: true,
    skipped: false,
    targetValue: Boolean(value),
    actualValue: checkbox.checked,
  };
};

const getAllOptions = (mapping: FieldMapping): Element[] => {
  const selectors = mapping.optionSelectors?.length ? mapping.optionSelectors : defaultOptionSelectors;
  return selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
};

const getEventTarget = (element: Element): Element => {
  const nestedChoice = element.querySelector(
    "input[type='checkbox'], input[type='radio'], label, button, [role='option'], [role='treeitem']",
  );

  return nestedChoice ?? element;
};

const dispatchMouseEvent = (element: HTMLElement, type: string): void => {
  const view = element.ownerDocument.defaultView ?? window;
  element.dispatchEvent(
    new view.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
    }),
  );
};

const clickElement = (element: Element): void => {
  if (element instanceof HTMLElement) {
    const target = getEventTarget(element);
    if (!(target instanceof HTMLElement)) {
      return;
    }

    target.focus();

    const view = target.ownerDocument.defaultView ?? window;
    if (typeof view.PointerEvent !== "undefined") {
      target.dispatchEvent(
        new view.PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerType: "mouse",
        }),
      );
      target.dispatchEvent(
        new view.PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          pointerType: "mouse",
        }),
      );
    }

    dispatchMouseEvent(target, "mousedown");
    dispatchMouseEvent(target, "mouseup");
    target.click();
  }
};

const pressEnter = (element: Element | null): void => {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  const view = element.ownerDocument.defaultView ?? window;
  element.dispatchEvent(
    new view.KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
  element.dispatchEvent(
    new view.KeyboardEvent("keyup", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
};

const openCustomDropdown = async (element: Element, mapping: FieldMapping): Promise<void> => {
  const trigger = findNestedElement(element, mapping.triggerSelectors) ?? element;
  clickElement(trigger);
  if (trigger instanceof HTMLElement) {
    trigger.focus();
  }
  await sleep(50);
};

const setSearchInputValue = (
  element: Element,
  mapping: FieldMapping,
  value: string,
): HTMLElement | null => {
  const input = findNestedElement(element, mapping.inputSelectors) ??
    findNestedElement(element, ["input:not([type='hidden'])", "[contenteditable='true']"]);

  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    input.focus();
    input.value = value;
    dispatchFieldEvents(input);
    return input;
  }

  if (input instanceof HTMLElement && input.isContentEditable) {
    input.textContent = value;
    dispatchFieldEvents(input);
    return input;
  }

  return null;
};

const readConfirmedCustomValue = (element: Element, mapping: FieldMapping): FieldValue => {
  const selectedValues = readSelectedValuesFromElement(element, mapping);
  if (mapping.multiple) {
    return selectedValues.length > 0 ? selectedValues : null;
  }

  if (selectedValues.length > 0) {
    return selectedValues[0];
  }

  return element instanceof HTMLSelectElement ? readSelectValue(element, mapping) : null;
};

const fieldValueIncludesTarget = (actualValue: FieldValue, target: string): boolean => {
  const normalizedTarget = normalizeComparable(target);
  if (!normalizedTarget) {
    return false;
  }

  const actualValues = Array.isArray(actualValue)
    ? actualValue
    : typeof actualValue === "string"
      ? [actualValue]
      : [];

  return actualValues.some((actual) => {
    const normalizedActual = normalizeComparable(cleanSelectedText(actual));
    return Boolean(normalizedActual) &&
      (normalizedActual === normalizedTarget ||
        normalizedActual.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedActual));
  });
};

const getAppliedCustomValues = (
  currentValue: FieldValue,
  selectedValues: string[],
): FieldValue => {
  if (Array.isArray(currentValue)) {
    return uniqueStrings([...selectedValues, ...currentValue]);
  }

  if (typeof currentValue === "string" && currentValue) {
    return currentValue;
  }

  return selectedValues.length > 0 ? selectedValues : null;
};

const applyCustomValue = async (
  element: Element,
  mapping: FieldMapping,
  value: FieldValue,
): Promise<ApplyFieldResult> => {
  const targets = mapping.multiple ? toArrayValue(value) : [asStringValue(value)];
  const selectedValues: string[] = [];

  if (targets.length === 0 || !targets[0]) {
    return {
      key: mapping.key,
      applied: false,
      skipped: true,
      reason: "No value provided",
      targetValue: value,
      actualValue: null,
    };
  }

  for (const target of targets) {
    await openCustomDropdown(element, mapping);
    const searchInput = setSearchInputValue(element, mapping, target);
    await sleep(50);

    const option = findMatchingOption(getAllOptions(mapping), target, mapping.matchStrategy);
    if (option) {
      clickElement(option);
      await sleep(120);

      let actualValue = readConfirmedCustomValue(element, mapping);
      if (fieldValueIncludesTarget(actualValue, target)) {
        selectedValues.push(target);
        continue;
      }

      pressEnter(searchInput ?? option);
      await sleep(120);
      actualValue = readConfirmedCustomValue(element, mapping);
      if (fieldValueIncludesTarget(actualValue, target)) {
        selectedValues.push(target);
        continue;
      }

      logger.warn(`Matched option did not select for ${mapping.key}`, target);
      return {
        key: mapping.key,
        applied: false,
        skipped: false,
        reason: `Option appeared but was not selected for "${target}"`,
        targetValue: value,
        actualValue,
      };
    }

    pressEnter(searchInput);
    await sleep(120);
    const actualValue = readConfirmedCustomValue(element, mapping);
    if (fieldValueIncludesTarget(actualValue, target)) {
      selectedValues.push(target);
      continue;
    }

    logger.warn(`Unable to match option for ${mapping.key}`, target);
    return {
      key: mapping.key,
      applied: false,
      skipped: false,
      reason: `Option not found for "${target}"`,
      targetValue: value,
      actualValue: readSelectValue(element, mapping),
    };
  }

  return {
    key: mapping.key,
    applied: true,
    skipped: false,
    targetValue: value,
    actualValue: getAppliedCustomValues(readConfirmedCustomValue(element, mapping), selectedValues),
  };
};

const trySetSelectOption = (
  select: HTMLSelectElement,
  value: string,
  matchStrategy: FieldMapping["matchStrategy"],
): boolean => {
  const options = Array.from(select.options);
  const matchedOption = options.find((option) => {
    const optionText = normalizeComparable(option.textContent ?? "");
    const optionValue = normalizeComparable(option.value);
    const target = normalizeComparable(value);
    const matchesValue = optionValue === target;
    const matchesText = optionText === target || optionText.includes(target) || target.includes(optionText);

    return (
      (matchStrategy === "value" && matchesValue) ||
      (matchStrategy === "text" && matchesText) ||
      (matchStrategy === "both" && (matchesValue || matchesText)) ||
      (!matchStrategy && (matchesValue || matchesText))
    );
  });

  if (!matchedOption) {
    return false;
  }

  matchedOption.selected = true;
  select.value = matchedOption.value;
  dispatchFieldEvents(select);
  return true;
};

const applySelectValue = async (
  element: Element,
  mapping: FieldMapping,
  value: FieldValue,
): Promise<ApplyFieldResult> => {
  if (element instanceof HTMLSelectElement) {
    if (element.multiple || mapping.multiple) {
      const values = toArrayValue(value);
      const applied = values.every((item) => trySetSelectOption(element, item, mapping.matchStrategy));
      return {
        key: mapping.key,
        applied,
        skipped: false,
        reason: applied ? undefined : "One or more select options were not found",
        targetValue: values,
        actualValue: readSelectValue(element, mapping),
      };
    }

    const target = asStringValue(value);
    const applied = trySetSelectOption(element, target, mapping.matchStrategy);
    return {
      key: mapping.key,
      applied,
      skipped: false,
      reason: applied ? undefined : `Select option not found for "${target}"`,
      targetValue: target,
      actualValue: readSelectValue(element, mapping),
    };
  }

  return applyCustomValue(element, mapping, value);
};

const findMatchingRadio = (
  radios: Element[],
  option: RadioOptionMapping,
): HTMLInputElement | null => {
  for (const radio of radios) {
    if (!(radio instanceof HTMLInputElement)) {
      continue;
    }

    if (option.selectors?.some((selector) => radio.matches(selector))) {
      return radio;
    }

    const labelText = normalizeText(
      radio.closest("label")?.textContent ??
        radio.parentElement?.textContent ??
        radio.value,
    );

    if (option.labelHints?.some((hint) => labelText.includes(normalizeText(hint)))) {
      return radio;
    }
  }

  return null;
};

const applyRadioValue = (
  candidates: Element[],
  mapping: FieldMapping,
  value: FieldValue,
): ApplyFieldResult => {
  const target = asStringValue(value);
  const matchedOption = mapping.radioOptions?.find((option) =>
    normalizeComparable(option.value) === normalizeComparable(target) ||
    option.labelHints?.some((hint) => normalizeComparable(hint) === normalizeComparable(target)),
  );

  const radio = matchedOption ? findMatchingRadio(candidates, matchedOption) : null;
  if (!radio) {
    return {
      key: mapping.key,
      applied: false,
      skipped: false,
      reason: `Radio option not found for "${target}"`,
      targetValue: target,
      actualValue: readRadioValue(candidates, mapping),
    };
  }

  radio.checked = true;
  dispatchFieldEvents(radio);

  return {
    key: mapping.key,
    applied: true,
    skipped: false,
    targetValue: target,
    actualValue: readRadioValue(candidates, mapping),
  };
};

export const readFieldValue = (mapping: FieldMapping, root: ParentNode = document): FieldValue => {
  const candidates = resolveFieldCandidates(root, mapping);

  if (mapping.type === "display-text") {
    return readDisplayTextValue(mapping, root);
  }

  if (candidates.length === 0) {
    return null;
  }

  if (mapping.type === "checkbox") {
    const checkbox = candidates.find(
      (candidate) => candidate instanceof HTMLInputElement && candidate.type === "checkbox",
    ) as HTMLInputElement | undefined;

    return checkbox?.checked ?? null;
  }

  if (mapping.type === "radio") {
    return readRadioValue(candidates, mapping);
  }

  const primary = candidates[0];
  if (!primary) {
    return null;
  }

  if (mapping.type === "text") {
    return getVisibleText(primary) || null;
  }

  return readSelectValue(primary, mapping);
};

export const applyFieldValue = async (
  mapping: FieldMapping,
  value: FieldValue,
  root: ParentNode = document,
): Promise<ApplyFieldResult> => {
  const element = resolveFieldElement(root, mapping);
  if (!element) {
    return {
      key: mapping.key,
      applied: false,
      skipped: false,
      reason: "Field element not found",
      targetValue: value,
      actualValue: null,
    };
  }

  if (mapping.type === "text") {
    return {
      ...(applyNativeText(element, value)),
      key: mapping.key,
    };
  }

  if (mapping.type === "checkbox") {
    return {
      ...(setCheckboxValue(element, value)),
      key: mapping.key,
    };
  }

  if (mapping.type === "radio") {
    return applyRadioValue(resolveFieldCandidates(root, mapping), mapping, value);
  }

  if (mapping.type === "select" || mapping.type === "custom-select" || mapping.type === "custom-multiselect") {
    return applySelectValue(element, mapping, value);
  }

  return {
    key: mapping.key,
    applied: false,
    skipped: false,
    reason: "Display-only field cannot be applied",
    targetValue: value,
    actualValue: readFieldValue(mapping, root),
  };
};

export const waitForFieldReady = async (mapping: FieldMapping): Promise<void> => {
  await sleep(mapping.waitForMs ?? 0);
};
