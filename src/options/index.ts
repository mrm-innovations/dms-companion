import "@/styles/options.css";

import { DEFAULT_SETTINGS } from "@/lib/constants";
import {
  loadSettings,
  parseSettings,
  resetSettings,
  saveSettings,
  stringifySettings,
} from "@/lib/settingsManager";

const root = document.querySelector<HTMLDivElement>("#app");

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const render = async (): Promise<void> => {
  if (!root) {
    return;
  }

  const settings = await loadSettings();

  root.innerHTML = `
    <main class="options-shell">
      <header>
        <h1>DMS Companion Settings</h1>
        <p>Adjust page detection and field selectors here if the DMS DOM changes.</p>
      </header>
      <section class="options-card">
        <div class="options-meta">
          <div>
            <strong>Preview before apply</strong>
            <p>Currently ${settings.previewBeforeApply ? "enabled" : "disabled"}.</p>
          </div>
          <div>
            <strong>Debug logging</strong>
            <p>Currently ${settings.debug ? "enabled" : "disabled"}.</p>
          </div>
        </div>
        <div class="options-tracker">
          <h2>Communication Action Tracker</h2>
          <label>
            <input type="checkbox" id="tracker-enabled" ${settings.tracker.enabled ? "checked" : ""} />
            Enable Send to Tracker
          </label>
          <div class="options-grid">
            <label>
              <span>Tracker App URL</span>
              <input id="tracker-url" value="${escapeHtml(settings.tracker.appBaseUrl)}" />
            </label>
            <label>
              <span>Extension Shared Secret</span>
              <input id="tracker-secret" type="password" value="${escapeHtml(settings.tracker.sharedSecret)}" />
            </label>
          </div>
          <label>
            <input type="checkbox" id="tracker-open-created" ${settings.tracker.openCreatedRecord ? "checked" : ""} />
            Open created tracker record after import
          </label>
          <div class="options-actions options-actions--compact">
            <button type="button" id="save-tracker-settings">Save Tracker Settings</button>
          </div>
        </div>
        <label class="options-label" for="settings-json">Settings JSON</label>
        <textarea id="settings-json" class="options-textarea">${stringifySettings(settings)}</textarea>
        <div class="options-actions">
          <button type="button" id="save-settings">Save Settings</button>
          <button type="button" id="reset-settings" class="secondary">Reset Defaults</button>
          <button type="button" id="load-defaults" class="secondary">View Defaults</button>
        </div>
        <p class="options-help">
          Keep selectors centralized here. Update only the values inside <code>pageDetection</code> and <code>fieldMappings</code> when the DMS markup changes.
        </p>
        <div id="settings-status" class="options-status"></div>
      </section>
    </main>
  `;

  const textarea = root.querySelector<HTMLTextAreaElement>("#settings-json");
  const status = root.querySelector<HTMLDivElement>("#settings-status");
  const trackerEnabled = root.querySelector<HTMLInputElement>("#tracker-enabled");
  const trackerUrl = root.querySelector<HTMLInputElement>("#tracker-url");
  const trackerSecret = root.querySelector<HTMLInputElement>("#tracker-secret");
  const trackerOpenCreated = root.querySelector<HTMLInputElement>("#tracker-open-created");

  root
    .querySelector<HTMLButtonElement>("#save-tracker-settings")
    ?.addEventListener("click", async () => {
      if (
        !textarea ||
        !status ||
        !trackerEnabled ||
        !trackerUrl ||
        !trackerSecret ||
        !trackerOpenCreated
      ) {
        return;
      }

      try {
        const parsed = parseSettings(textarea.value);
        parsed.tracker = {
          enabled: trackerEnabled.checked,
          appBaseUrl: trackerUrl.value.trim(),
          sharedSecret: trackerSecret.value.trim(),
          openCreatedRecord: trackerOpenCreated.checked,
        };
        await saveSettings(parsed);
        textarea.value = stringifySettings(parsed);
        status.textContent = "Tracker settings saved.";
        status.dataset.tone = "success";
      } catch (error) {
        status.textContent = `Invalid settings: ${(error as Error).message}`;
        status.dataset.tone = "error";
      }
    });

  root
    .querySelector<HTMLButtonElement>("#save-settings")
    ?.addEventListener("click", async () => {
      if (!textarea || !status) {
        return;
      }

      try {
        const parsed = parseSettings(textarea.value);
        await saveSettings(parsed);
        status.textContent = "Settings saved.";
        status.dataset.tone = "success";
      } catch (error) {
        status.textContent = `Invalid JSON: ${(error as Error).message}`;
        status.dataset.tone = "error";
      }
    });

  root
    .querySelector<HTMLButtonElement>("#reset-settings")
    ?.addEventListener("click", async () => {
      if (!textarea || !status) {
        return;
      }

      if (!window.confirm("Reset selector settings to defaults?")) {
        return;
      }

      const resetValue = await resetSettings();
      textarea.value = stringifySettings(resetValue);
      status.textContent = "Settings reset to defaults.";
      status.dataset.tone = "success";
    });

  root
    .querySelector<HTMLButtonElement>("#load-defaults")
    ?.addEventListener("click", () => {
      if (!textarea || !status) {
        return;
      }

      textarea.value = JSON.stringify(DEFAULT_SETTINGS, null, 2);
      status.textContent = "Loaded default settings into the editor. Save to apply.";
      status.dataset.tone = "neutral";
    });
};

void render();
