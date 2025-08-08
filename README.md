# ChatGPT Accent Customizer

Override ChatGPT's accent and bubble colors by setting CSS variables inline on `<html>`. This sidesteps Tailwind utility classes and survives light/dark flips and SPA route changes.

## What's new
- Basic mode with 10 curated presets (+ Reset to Site)
- Advanced mode for hand-picking colors
- Modern glassy segmented UI with sliding animation
- Runs only on `chatgpt.com`

## Why it works
ChatGPT resolves colors through CSS variables such as `--text-accent`, `--icon-accent`, `--theme-user-msg-bg`, and interactive `--interactive-bg-accent-*`. Inline styles on `document.documentElement` win the cascade, so your palette overrides the site's.

## Install (Chrome / Edge / Brave)
1. Clone or download this folder.
2. Go to `chrome://extensions` (Edge: `edge://extensions`).
3. Toggle Developer mode (top-right).
4. Click "Load unpacked" and select this folder.
5. Open `chatgpt.com`, click the extension icon. In Basic, choose a preset, or switch to Advanced to dial it in.

## Files
- `manifest.json`: MV3 manifest with minimal permissions, scoped to `chatgpt.com`.
- `content.js`: Applies/removes CSS variables inline on `<html>` based on saved values.
- `popup.html` / `popup.js`: Segmented UI (Basic presets / Advanced custom).
  - Preset badges: Plus / Pro. "BG" badge marks presets that also tweak background/surfaces.
  - Advanced toggles to optionally set `--sidebar-surface` and `--main-surface-background`.

## Notes
- Reset fully clears inline variables so site defaults take over.
- Works across light/dark and on SPA navigations.
- If you want separate light/dark palettes or alpha selections, open an issue or tweak `popup.js` to store two sets and flip by `prefers-color-scheme`.

## Privacy
No network calls. Settings are stored in Chrome Sync storage so they follow you if you're signed in. 