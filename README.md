# ChatGPT Accent Customizer

Glassy, modern Chrome Extension to override ChatGPT's theme CSS variables. Pick from curated presets (including Plus/Pro lookalikes), or craft your own in Advanced. Saves to `chrome.storage.sync` and survives SPA navigations.

## Features
- Basic mode: preset cards with selection ring
- Built-in themes: Default, Blue, Green, Yellow, Pink, Orange, Purple (Plus), Black (Pro)
- Extra curated + experimental themes (some change background surfaces)
- Advanced mode: tweak accent, user bubble, and submit button colors
- Save current as custom theme, export/import themes (JSON)
- Rearrange custom themes via drag-and-drop
- About modal, glassy UI with smooth transitions
- Only runs on `https://chatgpt.com/*`

## Install (Unpacked)
1. Clone this repo or download the folder.
2. Chrome → `chrome://extensions` → enable Developer mode.
3. Click "Load unpacked" → select this folder.
4. Open `https://chatgpt.com` → click the extension → choose a theme.

## Usage
- Basic: click a card to apply. Cards marked "BG" also adjust background/surfaces.
- Advanced: fine-tune colors → Save & Apply.
- Menu (⋮): Save current as theme, Export, Import, Rearrange, About.
- Reset: choose "Default" in Basic or use Reset in Advanced.

## Development
- Manifest V3, content script applies inline variables on `<html>` at `document_start` and on focus/pageshow.
- Variables list is in `content.js` (`THEME_KEYS`).
- Popup UI is in `popup.html` + `popup.js`.

### Publish to GitHub
```bash
# from project root
git init
git add .
git commit -m "feat: glassy UI, presets, custom themes, import/export, rearrange"
gh repo create ChatGPTAccentsForAll --public --source=. --remote=origin --push
```

## Export/Import format
Exports `{ "customPresets": [...] }` where each preset is:
```json
{
  "id": "custom_1710000000000",
  "name": "My Theme",
  "accent": "#66b5ff",
  "userBg": "#003f7a",
  "userText": "#f5faff",
  "submitBg": "#0169cc",
  "submitText": "#ffffff",
  "extras": { "--bg-primary": "#0f0f10" }
}
```

## Notes
- Inline CSS on `<html>` wins against ChatGPT light/dark flips and `[data-chat-theme]`.
- We clear all known keys before reapplying to avoid lingering styles. 