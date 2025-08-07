# ChatGPT Accent Customizer

Override ChatGPT's accent and bubble colors by setting CSS variables inline on `<html>`. This sidesteps Tailwind utility classes and survives light/dark flips and SPA route changes.

## Why it works
ChatGPT resolves colors through CSS variables such as `--text-accent`, `--icon-accent`, `--theme-user-msg-bg`, and interactive `--interactive-bg-accent-*`. Inline styles on `document.documentElement` win the cascade, so your palette overrides the site's.

## Install (Chrome / Edge / Brave)
1. Clone or download this folder.
2. Go to `chrome://extensions` (Edge: `edge://extensions`).
3. Toggle Developer mode (top-right).
4. Click "Load unpacked" and select this folder.
5. Open ChatGPT (`chatgpt.com` or `chat.openai.com`), click the extension icon, pick colors, then "Save & Apply".

## Files
- `manifest.json`: MV3 manifest with minimal permissions.
- `content.js`: Applies/removes CSS variables inline on `<html>` based on saved values.
- `popup.html` / `popup.js`: Simple UI to pick an accent and a few key theme colors.

## Notes
- Reset fully clears inline variables so the site defaults take back over.
- Works across light/dark and on SPA navigations.
- If you want separate light/dark palettes or alpha selections, open an issue or tweak `popup.js` to store two sets and flip by `prefers-color-scheme`.

## Privacy
No network calls. Settings are stored in Chrome Sync storage so they follow you if you're signed in. 