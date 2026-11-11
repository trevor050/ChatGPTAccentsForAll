# Changelog

## 2.0.0 (2026-11-10)

Store listing text:

> Rebuilt for the current ChatGPT: 40 named themes in one click, or build your own with separate colors for the accent, message bubble, send button and page background. Text contrast is fixed automatically. Your previous theme carries over by name.

- Works with ChatGPT's current design again (1.x stopped working after ChatGPT's redesign).
- A calmer popup: themes in four short groups (Classic, Dark, Light, Characters), each drawn as a tiny chat in its colors, and a separate Customize view (live preview, five colors, page background, saved themes).
- 40 themes instead of 72: near-duplicates merged, a few weak ones dropped, Nord and Amber CRT added, and every theme now passes its own contrast check. Anyone using a theme that was removed or recolored keeps its exact colors, saved under the old name.
- Each theme sets its accent, bubble, bubble text, send button and send button text independently.
- Text colors are checked against WCAG contrast and adjusted only when a pair would be unreadable.
- Page backgrounds (Dark, Light, Custom, or a theme's own) work in both modes without forcing a dark page into light mode.
- Settings from 1.x migrate automatically: the theme you picked comes back under the same name, saved themes included.
- Firefox build (not yet on addons.mozilla.org).
- No remote fonts or network requests (1.x loaded Google Fonts in the popup).
- Works on today's ChatGPT, signed in and out: its new theme system (appearance presets such as Linear or Codex, light and dark) is recognised by variable name, including the send button and bubble overrides ChatGPT re-declares inside the composer.
- Checks its own work: after recoloring, it confirms the bubble and send button really changed. If nothing did, it removes its colors and the popup says so, for the ChatGPT tab it is attached to.
- "Copy diagnostics" (Advanced, and in the warning) copies a short report of what it found: no messages, no account details.

## 1.1.0 (2025-08-12)

First Chrome Web Store release: presets, advanced color pickers, saved themes.
