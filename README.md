# DMS Companion

Lightweight Chromium extension for the DMS Internal Routing page. It reduces repetitive routing by saving presets, applying them in one click, and suggesting presets from document subject/title keywords.

## Architecture Plan

- Runtime model: Manifest V3 extension with a thin background worker, a content script, a popup, and an options page.
- UI model: compact floating panel injected only when the current page is detected as the DMS Internal Routing page.
- Data model: presets, last-routing snapshot, and selector settings stored locally in `chrome.storage.local`.
- Resilience model: selectors are centralized in settings, field lookup prefers label-based resolution, and the adapter layer supports both native fields and enhanced/custom dropdown flows.
- Portability model: the preset engine, page detector, field registry, and adapters are plain TypeScript modules so the content layer can be repurposed for a userscript build later.

## Technical Risks

- Internal DMS controls may be native, enhanced, or fully custom widgets, so apply/capture logic has to be defensive.
- Route dependencies may be async. A Division change can repopulate Section or Action Officer after a delay, so the applier retries staged field updates.
- DOM drift is the main long-term risk. Labels often remain stable longer than CSS classes, so field lookup uses labels before generic fallback selectors.
- The current manifest targets `<all_urls>` because the final DMS domain pattern is not yet fixed. Narrow this before wider rollout.

## Stack

- TypeScript
- Vite
- Chrome Extension Manifest V3
- Vanilla DOM UI
- `chrome.storage.local`
- Vitest + JSDOM for targeted tests

## Folder Structure

```text
public/
  manifest.json
examples/
  sample-presets.json
src/
  background/
  content/
  lib/
  options/
  popup/
  styles/
  types/
```

Key modules:

- `pageDetector`: decides whether the current page is the internal routing page.
- `fieldRegistry`: resolves fields from centralized mappings, preferring labels.
- `fieldAdapter`: reads/applies native and custom control values.
- `presetStore`: CRUD, import/export, and last-routing persistence.
- `presetCapture`: captures the current routing values from the form.
- `presetApplier`: builds previews and applies presets in a safe, ordered flow.
- `suggestionEngine`: keyword-based preset suggestions from subject/title rules.
- `settingsManager`: loads, merges, resets, and serializes selector settings.
- `uiPanel`: floating panel UI and user interactions.

## What Is Implemented

### Phase 1

- Vite + TypeScript extension scaffold
- Internal routing page detection
- Floating shadow-DOM panel
- Manual preset create/edit/delete
- Save current routing as preset
- Local storage persistence
- Preset application for standard HTML controls

### Phase 2

- Capture current form values
- Use Last Routing quick action
- Import/export presets as JSON
- Initial support for enhanced/custom dropdowns and multi-select Action Officer flows

### Phase 3

- Keyword suggestion engine
- Preview-before-apply mode
- Configurable selector settings page
- Defensive retries and missing-field handling

### Phase 4

- Vitest coverage for suggestions, detection, and native field application
- README, sample preset JSON, and troubleshooting notes

## How the Preset Engine Works

1. The content script loads settings and runs page detection.
2. If the page matches, it mounts the floating panel.
3. Saving a preset either captures current form values or uses manual editor input.
4. Applying a preset runs in field order:
   - `routeTo`
   - `division`
   - `section`
   - `actionOfficer`
   - `action`
   - `forwardedOriginalDocument`
   - `priority`
5. Each field uses the field registry to resolve the right DOM node.
6. The field adapter decides how to interact with that node:
   - native text/select/checkbox/radio
   - custom/select-like widgets through click + search + option matching
7. In preview mode, the engine shows current vs preset values first and waits for confirmation.
8. After application, the current routing is captured as the last-routing snapshot.

## Local Testing in Chrome or Edge

1. Install dependencies:

```powershell
npm.cmd install
```

2. Build the extension:

```powershell
npm.cmd run build
```

3. Open Chrome or Edge.
4. Go to `chrome://extensions` or `edge://extensions`.
5. Enable Developer mode.
6. Click Load unpacked.
7. Select the repo `dist` folder.
8. Open the DMS Internal Routing page.
9. Confirm the floating panel appears on the right side.
10. Save a preset, reload the browser, and verify it persists.

For active development:

```powershell
npm.cmd run dev
```

That rebuilds on file changes. Reload the unpacked extension after each rebuild.

## Running Tests

```powershell
npm.cmd test
```

## Adapting the Extension When the DMS Changes

Use the options page first. It exposes the full settings JSON, including:

- `pageDetection.urlIncludes`
- `pageDetection.headingText`
- `pageDetection.requiredFieldLabels`
- `fieldMappings.<field>.selectors`
- `fieldMappings.<field>.labelHints`
- `fieldMappings.<field>.inputSelectors`
- `fieldMappings.<field>.triggerSelectors`
- `fieldMappings.<field>.optionSelectors`

Recommended update order:

1. Keep label hints accurate.
2. Update direct selectors only after inspecting the live DOM.
3. For custom widgets, adjust trigger/input/option selectors together.
4. Test with Preview before Apply enabled.
5. Narrow `manifest.json` host permissions once the production DMS URL pattern is known.

## Troubleshooting Selector Mismatches

- Panel does not appear:
  Check heading text, page labels, and URL hints in the settings JSON.
- Preset saves but does not apply:
  The field mapping likely resolves the wrong element or the dropdown options are loaded asynchronously.
- Division changes but Section does not:
  Increase `waitForMs` or `retryCount` on dependent fields.
- Custom dropdown opens but selection does not stick:
  Update `triggerSelectors`, `inputSelectors`, and `optionSelectors` for that field.
- Suggestions do not appear:
  Confirm the subject/title field mapping and matching rules.

## Optional V2 Roadmap

- Domain-restricted manifest and enterprise deployment packaging
- Selector recorder/debugger from the options page
- Preset folders, favorites, and keyboard shortcuts
- Merge-mode import instead of replace-only import
- Userscript build target sharing the same core modules
- Better custom-widget plugins for known UI libraries such as Kendo, Select2, and Choices.js
