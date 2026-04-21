# DMS Companion Installation

DMS Companion is a Chromium extension for the DMS Internal Routing page.

## Install From Release ZIP

1. Extract the release ZIP, for example `dms-companion-0.1.0.zip`.
2. Open Chrome or Microsoft Edge.
3. Go to `chrome://extensions` or `edge://extensions`.
4. Turn on **Developer mode**.
5. Click **Load unpacked**.
6. Select the extracted folder that contains `manifest.json`.
7. Open or refresh DMS.

The panel appears on supported DMS pages.

## Update Existing Installation

1. Extract the new release ZIP.
2. Go to `chrome://extensions` or `edge://extensions`.
3. Remove the old DMS Companion extension or click **Reload** after replacing the folder contents.
4. Refresh DMS.

If fields do not capture or apply correctly after an update:

1. Open the extension settings.
2. Click **Reset Defaults**.
3. Refresh DMS.

## Build A Release ZIP

From the project folder:

```powershell
npm.cmd run package:zip
```

The release ZIP is created in `release/`.

## Permissions

The extension uses:

- `storage` for presets, settings, panel position, and temporary priority carry-over.
- `https://dms.dilg.gov.ph/*` so it only runs on DMS pages.

## Current Notes

- The extension fills routing fields only. It does not submit the DMS form.
- Priority carry-over applies once when the Internal Routing form opens and only when the form priority is blank or normal.
- Presets and settings are stored locally in the user's browser profile.
