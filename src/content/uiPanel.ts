import panelCss from "@/styles/panel.css?inline";
import { STORAGE_KEYS } from "@/lib/constants";
import { applyPreset, buildPreview } from "@/lib/presetApplier";
import { captureCurrentRouting, captureSubjectTitle } from "@/lib/presetCapture";
import { applyCarriedPriorityToRoutingForm } from "@/lib/priorityCarryover";
import {
  deletePreset,
  exportPresets,
  getLastRouting,
  importPresets,
  listPresets,
  savePreset,
} from "@/lib/presetStore";
import { loadSettings } from "@/lib/settingsManager";
import { getFromStorage, setInStorage } from "@/lib/storage";
import { getSuggestedPresets } from "@/lib/suggestionEngine";
import {
  cloneMatchingRules,
  parseCommaSeparated,
  serializeFieldValue,
} from "@/lib/utils";
import type {
  AppSettings,
  PreviewItem,
  RoutingPreset,
  RoutingSnapshot,
} from "@/types/app";

type StatusTone = "neutral" | "success" | "warn" | "error";

type PanelPosition = {
  top: number;
  left: number;
};

type EditorState = {
  id?: string;
  name: string;
  description: string;
  enabled: boolean;
  routeTo: string;
  division: string;
  section: string;
  actionOfficer: string;
  action: string;
  forwardedOriginalDocument: boolean;
  priority: string;
  containsAny: string;
  containsAll: string;
  startsWith: string;
  exactPhrase: string;
};

type PanelState = {
  settings: AppSettings;
  presets: RoutingPreset[];
  subjectTitle: string;
  selectedPresetId: string | null;
  collapsed: boolean;
  manageOpen: boolean;
  editorOpen: boolean;
  editor: EditorState | null;
  previewPresetId: string | null;
  previewPreset: RoutingPreset | null;
  previewItems: PreviewItem[];
  statusText: string;
  statusTone: StatusTone;
  panelPosition: PanelPosition | null;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startTop: number;
  startLeft: number;
};

const DEFAULT_STATUS = {
  text: "Ready on Internal Routing page",
  tone: "neutral" as StatusTone,
};

const createEditorState = (
  preset?: Partial<RoutingPreset> | null,
  snapshot?: RoutingSnapshot | null,
): EditorState => {
  const actionOfficer = preset?.actionOfficer ?? snapshot?.actionOfficer ?? null;
  return {
    id: preset?.id,
    name: preset?.name ?? "",
    description: preset?.description ?? "",
    enabled: preset?.enabled ?? true,
    routeTo: preset?.routeTo ?? snapshot?.routeTo ?? "",
    division: preset?.division ?? snapshot?.division ?? "",
    section: preset?.section ?? snapshot?.section ?? "",
    actionOfficer: Array.isArray(actionOfficer)
      ? actionOfficer.join(", ")
      : actionOfficer ?? "",
    action: preset?.action ?? snapshot?.action ?? "",
    forwardedOriginalDocument:
      preset?.forwardedOriginalDocument ??
      snapshot?.forwardedOriginalDocument ??
      false,
    priority: preset?.priority ?? snapshot?.priority ?? "",
    containsAny: preset?.matchingRules?.containsAny?.join(", ") ?? "",
    containsAll: preset?.matchingRules?.containsAll?.join(", ") ?? "",
    startsWith: preset?.matchingRules?.startsWith?.join(", ") ?? "",
    exactPhrase: preset?.matchingRules?.exactPhrase?.join(", ") ?? "",
  };
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const isPanelPosition = (value: unknown): value is PanelPosition => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PanelPosition>;
  return Number.isFinite(candidate.top) && Number.isFinite(candidate.left);
};

export class DmsCompanionPanel {
  private readonly host: HTMLDivElement;
  private readonly shadow: ShadowRoot;
  private readonly fileInput: HTMLInputElement;
  private state: PanelState | null = null;
  private dragState: DragState | null = null;
  private priorityCarryoverAttempted = false;
  private readonly handleWindowResize = (): void => {
    this.clampPanelToViewport();
  };

  constructor() {
    this.host = document.createElement("div");
    this.host.id = "dms-companion-root";
    this.shadow = this.host.attachShadow({ mode: "open" });
    this.fileInput = document.createElement("input");
    this.fileInput.type = "file";
    this.fileInput.accept = "application/json";
    this.fileInput.hidden = true;
    this.fileInput.addEventListener("change", () => {
      void this.handleImportFile();
    });
  }

  async mount(): Promise<void> {
    const settings = await loadSettings();
    const presets = await listPresets();
    const subjectTitle = captureSubjectTitle(settings);
    const savedPosition = await getFromStorage<unknown>(STORAGE_KEYS.panelPosition, null);

    this.state = {
      settings,
      presets,
      subjectTitle,
      selectedPresetId: presets[0]?.id ?? null,
      collapsed: false,
      manageOpen: false,
      editorOpen: false,
      editor: null,
      previewPresetId: null,
      previewPreset: null,
      previewItems: [],
      statusText: DEFAULT_STATUS.text,
      statusTone: DEFAULT_STATUS.tone,
      panelPosition: isPanelPosition(savedPosition) ? savedPosition : null,
    };

    this.render();
    if (!this.host.isConnected) {
      document.body.append(this.host);
    }
    window.addEventListener("resize", this.handleWindowResize);
    requestAnimationFrame(() => {
      this.clampPanelToViewport();
    });
    void this.applyPriorityCarryover();
  }

  destroy(): void {
    window.removeEventListener("resize", this.handleWindowResize);
    this.host.remove();
  }

  async refresh(): Promise<void> {
    if (!this.state) {
      return;
    }

    const settings = await loadSettings();
    const presets = await listPresets();
    const subjectTitle = captureSubjectTitle(settings);

    this.state = {
      ...this.state,
      settings,
      presets,
      subjectTitle,
      selectedPresetId:
        presets.find((preset) => preset.id === this.state?.selectedPresetId)?.id ??
        presets[0]?.id ??
        null,
    };

    this.render();
    void this.applyPriorityCarryover();
  }

  private setStatus(text: string, tone: StatusTone = "neutral"): void {
    if (!this.state) {
      return;
    }

    this.state.statusText = text;
    this.state.statusTone = tone;
    this.render();
  }

  private getPanelElement(): HTMLElement | null {
    return this.shadow.querySelector<HTMLElement>(".dms-companion");
  }

  private getPanelPositionStyle(): string {
    if (!this.state?.panelPosition) {
      return "";
    }

    const { top, left } = this.state.panelPosition;
    return ` style="top: ${top}px; left: ${left}px; right: auto;"`;
  }

  private clampPosition(position: PanelPosition): PanelPosition {
    const panel = this.getPanelElement();
    const width = panel?.offsetWidth || 380;
    const height = panel?.offsetHeight || 240;
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);

    return {
      left: Math.min(Math.max(position.left, margin), maxLeft),
      top: Math.min(Math.max(position.top, margin), maxTop),
    };
  }

  private applyPanelPosition(position: PanelPosition): PanelPosition {
    const clamped = this.clampPosition(position);
    if (this.state) {
      this.state.panelPosition = clamped;
    }

    const panel = this.getPanelElement();
    if (panel) {
      panel.style.top = `${clamped.top}px`;
      panel.style.left = `${clamped.left}px`;
      panel.style.right = "auto";
    }

    return clamped;
  }

  private clampPanelToViewport(): void {
    if (!this.state?.panelPosition) {
      return;
    }

    const clamped = this.applyPanelPosition(this.state.panelPosition);
    void setInStorage({ [STORAGE_KEYS.panelPosition]: clamped });
  }

  private async applyPriorityCarryover(): Promise<void> {
    if (!this.state || this.priorityCarryoverAttempted) {
      return;
    }

    this.priorityCarryoverAttempted = true;
    const carried = await applyCarriedPriorityToRoutingForm(this.state.settings);
    if (!carried || !this.state) {
      return;
    }

    this.setStatus(`Priority carried over: ${carried.priority}`, "success");
  }

  private beginPanelDrag(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest("button, input, select, textarea, a")) {
      return;
    }

    const panel = this.getPanelElement();
    if (!panel) {
      return;
    }

    const rect = panel.getBoundingClientRect();
    this.dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTop: rect.top,
      startLeft: rect.left,
    };

    panel.classList.add("dms-companion--dragging");
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  }

  private updatePanelDrag(event: PointerEvent): void {
    if (!this.dragState || this.dragState.pointerId !== event.pointerId) {
      return;
    }

    this.applyPanelPosition({
      left: this.dragState.startLeft + event.clientX - this.dragState.startX,
      top: this.dragState.startTop + event.clientY - this.dragState.startY,
    });
    event.preventDefault();
  }

  private endPanelDrag(event: PointerEvent): void {
    if (!this.dragState || this.dragState.pointerId !== event.pointerId) {
      return;
    }

    this.dragState = null;
    this.getPanelElement()?.classList.remove("dms-companion--dragging");
    if (event.currentTarget instanceof HTMLElement && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (this.state?.panelPosition) {
      void setInStorage({ [STORAGE_KEYS.panelPosition]: this.state.panelPosition });
    }
  }

  private revealPreviewCard(): void {
    const previewCard = this.shadow.querySelector<HTMLElement>("[data-preview-card]");
    if (!previewCard) {
      return;
    }

    requestAnimationFrame(() => {
      previewCard.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
  }

  private revealEditorCard(): void {
    const editorCard = this.shadow.querySelector<HTMLElement>("[data-editor-form]");
    const nameInput = this.shadow.querySelector<HTMLInputElement>("#preset-name");
    if (!editorCard) {
      return;
    }

    requestAnimationFrame(() => {
      editorCard.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
      nameInput?.focus({ preventScroll: true });
    });
  }

  private getSelectedPreset(): RoutingPreset | null {
    if (!this.state?.selectedPresetId) {
      return null;
    }

    return (
      this.state.presets.find((preset) => preset.id === this.state?.selectedPresetId) ??
      null
    );
  }

  private getSuggestedPresets(): RoutingPreset[] {
    if (!this.state) {
      return [];
    }

    return getSuggestedPresets(this.state.presets, this.state.subjectTitle);
  }

  private openEditor(preset?: RoutingPreset | null, snapshot?: RoutingSnapshot | null): void {
    if (!this.state) {
      return;
    }

    this.state.editor = createEditorState(preset, snapshot);
    this.state.editorOpen = true;
    this.state.manageOpen = true;
    this.render();
    this.revealEditorCard();
  }

  private closeEditor(): void {
    if (!this.state) {
      return;
    }

    this.state.editorOpen = false;
    this.state.editor = null;
    this.render();
  }

  private async saveEditor(): Promise<void> {
    if (!this.state?.editor) {
      return;
    }

    const actionOfficerValues = parseCommaSeparated(this.state.editor.actionOfficer);
    const actionOfficer =
      actionOfficerValues.length > 1
        ? actionOfficerValues
        : actionOfficerValues[0] ?? null;

    const preset = await savePreset({
      id: this.state.editor.id,
      name: this.state.editor.name,
      description: this.state.editor.description,
      enabled: this.state.editor.enabled,
      routeTo: this.state.editor.routeTo || null,
      division: this.state.editor.division || null,
      section: this.state.editor.section || null,
      actionOfficer,
      action: this.state.editor.action || null,
      forwardedOriginalDocument: this.state.editor.forwardedOriginalDocument,
      priority: this.state.editor.priority || null,
      matchingRules: {
        containsAny: parseCommaSeparated(this.state.editor.containsAny),
        containsAll: parseCommaSeparated(this.state.editor.containsAll),
        startsWith: parseCommaSeparated(this.state.editor.startsWith),
        exactPhrase: parseCommaSeparated(this.state.editor.exactPhrase),
      },
    });

    await this.refresh();
    if (this.state) {
      this.state.selectedPresetId = preset.id;
      this.closeEditor();
    }
    this.setStatus(`Saved preset "${preset.name}"`, "success");
  }

  private async removePreset(presetId: string): Promise<void> {
    if (!window.confirm("Delete this preset? This cannot be undone.")) {
      return;
    }

    await deletePreset(presetId);
    await this.refresh();
    this.setStatus("Preset deleted", "success");
  }

  private async handleSaveCurrent(): Promise<void> {
    if (!this.state) {
      return;
    }

    const snapshot = captureCurrentRouting(this.state.settings);
    this.openEditor(null, snapshot);
    this.setStatus("Captured current routing into the preset editor. Enter a preset name to save.", "success");
    this.revealEditorCard();
  }

  private async handleUseLastRouting(): Promise<void> {
    if (!this.state) {
      return;
    }

    const lastRouting = await getLastRouting();
    if (!lastRouting) {
      this.setStatus("No last routing snapshot has been saved yet", "warn");
      return;
    }

    const transientPreset: RoutingPreset = {
      id: "last-routing",
      name: "Last Routing",
      description: "Most recently applied routing values",
      enabled: true,
      routeTo: lastRouting.routeTo,
      division: lastRouting.division,
      section: lastRouting.section,
      actionOfficer: lastRouting.actionOfficer,
      action: lastRouting.action,
      forwardedOriginalDocument: lastRouting.forwardedOriginalDocument,
      priority: lastRouting.priority,
      matchingRules: {},
      createdAt: lastRouting.capturedAt,
      updatedAt: lastRouting.capturedAt,
    };

    await this.runApplyFlow(transientPreset);
  }

  private async runApplyFlow(
    preset: RoutingPreset,
    options: { confirmed?: boolean } = {},
  ): Promise<void> {
    if (!this.state) {
      return;
    }

    if (this.state.settings.previewBeforeApply && !options.confirmed) {
      await this.openPreview(preset);
      return;
    }

    const results = await applyPreset(preset, this.state.settings);
    const failed = results.filter((result) => !result.applied && !result.skipped);
    const applied = results.filter((result) => result.applied).length;

    await this.refresh();

    if (failed.length > 0) {
      this.setStatus(
        `Applied ${applied} field${applied === 1 ? "" : "s"}; ${failed.length} issue${failed.length === 1 ? "" : "s"} need attention`,
        "warn",
      );
      return;
    }

    this.setStatus(`Applied preset "${preset.name}"`, "success");
  }

  private async openPreview(presetOrId: RoutingPreset | string): Promise<void> {
    if (!this.state) {
      return;
    }

    const preset =
      typeof presetOrId === "string"
        ? this.state.presets.find((item) => item.id === presetOrId) ?? null
        : presetOrId;

    if (!preset) {
      this.setStatus("Preset not found for preview", "error");
      return;
    }

    this.state.previewPresetId = preset.id;
    this.state.previewPreset = preset;
    this.state.previewItems = buildPreview(preset, this.state.settings);
    this.render();
    this.setStatus(
      `Review the preview for "${preset.name}", then click Apply to Form.`,
      "neutral",
    );
    this.revealPreviewCard();
  }

  private closePreview(): void {
    if (!this.state) {
      return;
    }

    this.state.previewPresetId = null;
    this.state.previewPreset = null;
    this.state.previewItems = [];
    this.render();
  }

  private async exportAllPresets(): Promise<void> {
    const contents = await exportPresets();
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "dms-companion-presets.json";
    anchor.click();
    URL.revokeObjectURL(url);
    this.setStatus("Exported presets as JSON", "success");
  }

  private async handleImportFile(): Promise<void> {
    const file = this.fileInput.files?.[0];
    if (!file) {
      return;
    }

    if (
      !window.confirm(
        "Importing presets will replace the current preset list. Continue?",
      )
    ) {
      this.fileInput.value = "";
      return;
    }

    try {
      const contents = await file.text();
      await importPresets(contents);
      this.fileInput.value = "";
      await this.refresh();
      this.setStatus("Imported presets from JSON", "success");
    } catch (error) {
      this.fileInput.value = "";
      this.setStatus(`Import failed: ${(error as Error).message}`, "error");
    }
  }

  private bindEditorFields(): void {
    const editorRoot = this.shadow.querySelector("[data-editor-form]");
    if (!editorRoot || !this.state?.editor) {
      return;
    }

    editorRoot
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        "input, textarea, select",
      )
      .forEach((field) => {
        field.addEventListener("input", () => {
          if (!this.state?.editor) {
            return;
          }

          const name = field.name as keyof EditorState;
          if (!name) {
            return;
          }

          if (field instanceof HTMLInputElement && field.type === "checkbox") {
            this.state.editor[name] = field.checked as never;
            return;
          }

          this.state.editor[name] = field.value as never;
        });

        if (field instanceof HTMLSelectElement) {
          field.addEventListener("change", () => {
            if (!this.state?.editor) {
              return;
            }

            const name = field.name as keyof EditorState;
            this.state.editor[name] = field.value as never;
          });
        }
      });
  }

  private bindEvents(): void {
    const root = this.shadow;
    const header = root.querySelector<HTMLElement>("[data-drag-handle]");
    header?.addEventListener("pointerdown", (event) => {
      this.beginPanelDrag(event);
    });
    header?.addEventListener("pointermove", (event) => {
      this.updatePanelDrag(event);
    });
    header?.addEventListener("pointerup", (event) => {
      this.endPanelDrag(event);
    });
    header?.addEventListener("pointercancel", (event) => {
      this.endPanelDrag(event);
    });

    root
      .querySelector("[data-action='toggle-collapse']")
      ?.addEventListener("click", () => {
        if (!this.state) {
          return;
        }

        this.state.collapsed = !this.state.collapsed;
        this.render();
      });

    root
      .querySelector("[data-action='select-preset']")
      ?.addEventListener("change", (event) => {
        if (!(event.currentTarget instanceof HTMLSelectElement) || !this.state) {
          return;
        }

        this.state.selectedPresetId = event.currentTarget.value || null;
      });

    root
      .querySelector("[data-action='apply-selected']")
      ?.addEventListener("click", () => {
        const preset = this.getSelectedPreset();
        if (!preset) {
          this.setStatus("Select a preset first", "warn");
          return;
        }

        void this.runApplyFlow(preset);
      });

    root
      .querySelector("[data-action='preview-selected']")
      ?.addEventListener("click", () => {
        const preset = this.getSelectedPreset();
        if (!preset) {
          this.setStatus("Select a preset first", "warn");
          return;
        }

        void this.openPreview(preset.id);
      });

    root
      .querySelector("[data-action='delete-selected']")
      ?.addEventListener("click", () => {
        const preset = this.getSelectedPreset();
        if (!preset) {
          this.setStatus("Select a preset first", "warn");
          return;
        }

        void this.removePreset(preset.id);
      });

    root
      .querySelector("[data-action='save-current']")
      ?.addEventListener("click", () => {
        void this.handleSaveCurrent();
      });

    root.querySelector("[data-action='new-preset']")?.addEventListener("click", () => {
      this.openEditor();
    });

    root.querySelector("[data-action='use-last']")?.addEventListener("click", () => {
      void this.handleUseLastRouting();
    });

    root
      .querySelector("[data-action='toggle-manage']")
      ?.addEventListener("click", () => {
        if (!this.state) {
          return;
        }

        this.state.manageOpen = !this.state.manageOpen;
        this.render();
      });

    root
      .querySelector("[data-action='open-settings']")
      ?.addEventListener("click", async () => {
        if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
          await chrome.runtime.openOptionsPage();
          return;
        }

        window.alert(
          "Settings page is only available in the browser extension context.",
        );
      });

    root
      .querySelector("[data-action='export-presets']")
      ?.addEventListener("click", () => {
        void this.exportAllPresets();
      });

    root
      .querySelector("[data-action='import-presets']")
      ?.addEventListener("click", () => {
        this.fileInput.click();
      });

    root.querySelector("[data-action='close-editor']")?.addEventListener("click", () => {
      this.closeEditor();
    });

    root.querySelector("[data-action='save-editor']")?.addEventListener("click", () => {
      void this.saveEditor();
    });

    root.querySelectorAll("[data-action='cancel-preview']").forEach((button) => {
      button.addEventListener("click", () => {
        this.closePreview();
      });
    });

    root.querySelectorAll("[data-action='confirm-preview']").forEach((button) => {
      button.addEventListener("click", () => {
        const preset = this.state?.previewPreset ?? null;

        if (!preset) {
          this.setStatus("Preview preset could not be found", "error");
          return;
        }

        this.closePreview();
        void this.runApplyFlow({ ...preset }, { confirmed: true });
      });
    });

    root.querySelectorAll<HTMLElement>("[data-edit-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const presetId = button.dataset.editPreset;
        const preset = this.state?.presets.find((item) => item.id === presetId);
        if (preset) {
          this.openEditor({
            ...preset,
            matchingRules: cloneMatchingRules(preset.matchingRules),
          });
        }
      });
    });

    root.querySelectorAll<HTMLElement>("[data-delete-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const presetId = button.dataset.deletePreset;
        if (presetId) {
          void this.removePreset(presetId);
        }
      });
    });

    root.querySelectorAll<HTMLElement>("[data-apply-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const presetId = button.dataset.applyPreset;
        const preset = this.state?.presets.find((item) => item.id === presetId);
        if (preset) {
          void this.runApplyFlow(preset);
        }
      });
    });

    root.querySelectorAll<HTMLElement>("[data-preview-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const presetId = button.dataset.previewPreset;
        if (presetId) {
          void this.openPreview(presetId);
        }
      });
    });

    root.querySelectorAll<HTMLElement>("[data-suggested-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const presetId = button.dataset.suggestedPreset;
        const preset = this.state?.presets.find((item) => item.id === presetId);
        if (preset) {
          void this.runApplyFlow(preset);
        }
      });
    });

    this.bindEditorFields();
  }

  private renderSuggestedSection(): string {
    const suggestions = this.getSuggestedPresets();
    if (suggestions.length === 0) {
      return `
        <section class="dms-companion__card">
          <h3>Suggested Presets</h3>
          <div class="dms-companion__empty">No keyword suggestions matched the current document subject/title.</div>
        </section>
      `;
    }

    return `
      <section class="dms-companion__card">
        <h3>Suggested Presets</h3>
        <div class="dms-companion__list">
          ${suggestions
            .map(
              (preset) => `
                <article class="dms-companion__list-item">
                  <header>
                    <div>
                      <h4>${escapeHtml(preset.name)}</h4>
                      <div class="dms-companion__muted">${escapeHtml(
                        preset.description || "Keyword match",
                      )}</div>
                    </div>
                    <span class="dms-companion__pill">Suggested</span>
                  </header>
                  <div class="dms-companion__actions">
                    <button class="dms-companion__button" data-suggested-preset="${preset.id}">Apply</button>
                    <button class="dms-companion__button-secondary" data-preview-preset="${preset.id}">Preview</button>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  private renderPreview(): string {
    if (!this.state?.previewPresetId) {
      return "";
    }

    const preset = this.state.previewPreset;
    if (!preset) {
      return "";
    }

    return `
      <section class="dms-companion__card" data-preview-card>
        <h3>Confirm Apply</h3>
        <div class="dms-companion__actions" style="margin: 0 0 10px;">
          <button class="dms-companion__button" data-action="confirm-preview">Apply to Form</button>
          <button class="dms-companion__button-secondary" data-action="cancel-preview">Cancel</button>
        </div>
        <p class="dms-companion__muted" style="margin-bottom: 10px;">
          This only fills the routing fields. It will not submit the form.
        </p>
        <div class="dms-companion__preview-list">
          ${this.state.previewItems
            .map(
              (item) => `
                <article class="dms-companion__preview-item ${item.willChange ? "dms-companion__preview-item--changed" : ""}">
                  <strong>${escapeHtml(item.label)}</strong>
                  <div class="dms-companion__preview-grid">
                    <div><span>Current:</span> ${escapeHtml(serializeFieldValue(item.currentValue) || "Blank")}</div>
                    <div><span>Preset:</span> ${escapeHtml(serializeFieldValue(item.nextValue) || "Blank")}</div>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
        <div class="dms-companion__actions" style="margin-top: 10px;">
          <button class="dms-companion__button" data-action="confirm-preview">Apply to Form: ${escapeHtml(
            preset.name,
          )}</button>
          <button class="dms-companion__button-secondary" data-action="cancel-preview">Cancel</button>
        </div>
      </section>
    `;
  }

  private renderEditor(): string {
    if (!this.state?.editorOpen || !this.state.editor) {
      return "";
    }

    const editor = this.state.editor;
    return `
      <section class="dms-companion__card" data-editor-form>
        <h3>${editor.id ? "Edit Preset" : "Preset Editor"}</h3>
        <div class="dms-companion__stack">
          <div class="dms-companion__field">
            <label for="preset-name">Preset Name</label>
            <input id="preset-name" class="dms-companion__input" name="name" value="${escapeHtml(
              editor.name,
            )}" />
          </div>
          <div class="dms-companion__field">
            <label for="preset-description">Description</label>
            <textarea id="preset-description" class="dms-companion__textarea" name="description">${escapeHtml(
              editor.description,
            )}</textarea>
          </div>
          <label class="dms-companion__checkbox">
            <input type="checkbox" name="enabled" ${editor.enabled ? "checked" : ""} />
            Enabled
          </label>
          <div class="dms-companion__row dms-companion__row--inline">
            <div class="dms-companion__field">
              <label>Route To</label>
              <input class="dms-companion__input" name="routeTo" value="${escapeHtml(
                editor.routeTo,
              )}" />
            </div>
            <div class="dms-companion__field">
              <label>Division</label>
              <input class="dms-companion__input" name="division" value="${escapeHtml(
                editor.division,
              )}" />
            </div>
          </div>
          <div class="dms-companion__row dms-companion__row--inline">
            <div class="dms-companion__field">
              <label>Section</label>
              <input class="dms-companion__input" name="section" value="${escapeHtml(
                editor.section,
              )}" />
            </div>
            <div class="dms-companion__field">
              <label>Priority</label>
              <select class="dms-companion__select" name="priority">
                <option value="">Select priority</option>
                <option value="RUSH DOCUMENT" ${editor.priority === "RUSH DOCUMENT" ? "selected" : ""}>RUSH DOCUMENT</option>
                <option value="URGENT DOCUMENT" ${editor.priority === "URGENT DOCUMENT" ? "selected" : ""}>URGENT DOCUMENT</option>
                <option value="NORMAL" ${editor.priority === "NORMAL" ? "selected" : ""}>NORMAL</option>
              </select>
            </div>
          </div>
          <div class="dms-companion__field">
            <label>Action Officer</label>
            <input class="dms-companion__input" name="actionOfficer" value="${escapeHtml(
              editor.actionOfficer,
            )}" placeholder="Comma separate for multi-select" />
          </div>
          <div class="dms-companion__field">
            <label>Action</label>
            <input class="dms-companion__input" name="action" value="${escapeHtml(
              editor.action,
            )}" />
          </div>
          <label class="dms-companion__checkbox">
            <input type="checkbox" name="forwardedOriginalDocument" ${editor.forwardedOriginalDocument ? "checked" : ""} />
            Original document forwarded
          </label>
          <div class="dms-companion__field">
            <label>Rule: Contains Any</label>
            <input class="dms-companion__input" name="containsAny" value="${escapeHtml(
              editor.containsAny,
            )}" placeholder="absence, legal, LGMED" />
          </div>
          <div class="dms-companion__field">
            <label>Rule: Contains All</label>
            <input class="dms-companion__input" name="containsAll" value="${escapeHtml(
              editor.containsAll,
            )}" />
          </div>
          <div class="dms-companion__field">
            <label>Rule: Starts With</label>
            <input class="dms-companion__input" name="startsWith" value="${escapeHtml(
              editor.startsWith,
            )}" />
          </div>
          <div class="dms-companion__field">
            <label>Rule: Exact Phrase</label>
            <input class="dms-companion__input" name="exactPhrase" value="${escapeHtml(
              editor.exactPhrase,
            )}" />
          </div>
          <div class="dms-companion__actions">
            <button class="dms-companion__button" data-action="save-editor">Save Preset</button>
            <button class="dms-companion__button-secondary" data-action="close-editor">Cancel</button>
          </div>
        </div>
      </section>
    `;
  }

  private renderManageSection(): string {
    if (!this.state?.manageOpen) {
      return "";
    }

    if (this.state.presets.length === 0) {
      return `
        <section class="dms-companion__card">
          <h3>Manage Presets</h3>
          <div class="dms-companion__empty">No presets saved yet. Capture your current routing or create one manually.</div>
        </section>
      `;
    }

    return `
      <section class="dms-companion__card">
        <h3>Manage Presets</h3>
        <div class="dms-companion__list">
          ${this.state.presets
            .map(
              (preset) => `
                <article class="dms-companion__list-item">
                  <header>
                    <div>
                      <h4>${escapeHtml(preset.name)}</h4>
                      <div class="dms-companion__muted">${escapeHtml(
                        preset.description || "No description",
                      )}</div>
                    </div>
                    <span class="dms-companion__pill">${preset.enabled ? "Enabled" : "Disabled"}</span>
                  </header>
                  <div class="dms-companion__muted">
                    Route to: ${escapeHtml(serializeFieldValue(preset.routeTo) || "Blank")}<br />
                    Division: ${escapeHtml(serializeFieldValue(preset.division) || "Blank")}<br />
                    Section: ${escapeHtml(serializeFieldValue(preset.section) || "Blank")}<br />
                    Action Officer: ${escapeHtml(
                      serializeFieldValue(preset.actionOfficer) || "Blank",
                    )}<br />
                    Action: ${escapeHtml(
                      serializeFieldValue(preset.action) || "Blank",
                    )}
                  </div>
                  <div class="dms-companion__actions">
                    <button class="dms-companion__button" data-apply-preset="${preset.id}">Apply</button>
                    <button class="dms-companion__button-secondary" data-preview-preset="${preset.id}">Preview</button>
                    <button class="dms-companion__button-secondary" data-edit-preset="${preset.id}">Edit</button>
                    <button class="dms-companion__button-danger" data-delete-preset="${preset.id}">Delete</button>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  private render(): void {
    if (!this.state) {
      return;
    }

    const selectedPreset = this.getSelectedPreset();
    const statusClass =
      this.state.statusTone === "success"
        ? "dms-companion__status dms-companion__status--success"
        : this.state.statusTone === "warn"
          ? "dms-companion__status dms-companion__status--warn"
          : this.state.statusTone === "error"
            ? "dms-companion__status dms-companion__status--error"
            : "dms-companion__status";

    this.shadow.innerHTML = `
      <style>${panelCss}</style>
      <div class="dms-companion"${this.getPanelPositionStyle()}>
        <div class="dms-companion__shell">
          <header class="dms-companion__header" data-drag-handle>
            <div>
              <h2>DMS Companion</h2>
              <p>Preset-based routing helper</p>
            </div>
            <button class="dms-companion__icon-button" data-action="toggle-collapse">${this.state.collapsed ? "+" : "-"}</button>
          </header>
          ${
            this.state.collapsed
              ? ""
              : `
                <div class="dms-companion__body">
                  <div class="dms-companion__stack">
                    <div class="${statusClass}">${escapeHtml(this.state.statusText)}</div>
                    <section class="dms-companion__card">
                      <h3>Apply Preset</h3>
                      <div class="dms-companion__field">
                        <label for="preset-select">Saved Presets</label>
                        <select id="preset-select" class="dms-companion__select" data-action="select-preset">
                          <option value="">Select a preset</option>
                          ${this.state.presets
                            .map(
                              (preset) => `
                                <option value="${preset.id}" ${preset.id === selectedPreset?.id ? "selected" : ""}>
                                  ${escapeHtml(preset.name)}
                                </option>
                              `,
                            )
                            .join("")}
                        </select>
                      </div>
                      <div class="dms-companion__actions dms-companion__actions--primary">
                        <button class="dms-companion__button" data-action="apply-selected" ${selectedPreset ? "" : "disabled"}>Apply</button>
                        <button class="dms-companion__button-secondary" data-action="preview-selected" ${selectedPreset ? "" : "disabled"}>Preview</button>
                        <button class="dms-companion__button-danger" data-action="delete-selected" ${selectedPreset ? "" : "disabled"}>Delete Preset</button>
                      </div>
                      ${
                        this.state.settings.previewBeforeApply
                          ? `<div class="dms-companion__footer-note">Apply opens confirmation first. Use Apply to Form inside the preview card to fill the fields.</div>`
                          : ""
                      }
                    </section>
                    ${this.renderPreview()}
                    <section class="dms-companion__card">
                      <h3>Quick Actions</h3>
                      <div class="dms-companion__actions dms-companion__actions--tools">
                        <button class="dms-companion__button" data-action="save-current">Save Current</button>
                        <button class="dms-companion__button-secondary" data-action="new-preset">New Blank</button>
                        <button class="dms-companion__button-secondary" data-action="use-last">Use Last Routing</button>
                        <button class="dms-companion__button-secondary" data-action="toggle-manage">${this.state.manageOpen ? "Hide Manage" : "Manage Presets"}</button>
                        <button class="dms-companion__button-secondary" data-action="export-presets">Export</button>
                        <button class="dms-companion__button-secondary" data-action="import-presets">Import</button>
                        <button class="dms-companion__button-secondary" data-action="open-settings">Settings</button>
                      </div>
                      <div class="dms-companion__footer-note">
                        Preview-before-apply is ${this.state.settings.previewBeforeApply ? "enabled" : "disabled"} in settings.
                      </div>
                    </section>
                    <section class="dms-companion__card">
                      <h3>Document Subject/Title</h3>
                      <p>${escapeHtml(this.state.subjectTitle || "No subject/title could be detected from the current page.")}</p>
                    </section>
                    ${this.renderEditor()}
                    ${this.renderSuggestedSection()}
                    ${this.renderManageSection()}
                  </div>
                </div>
              `
          }
        </div>
      </div>
    `;

    this.shadow.append(this.fileInput);
    this.bindEvents();
  }
}
