# Changelog

## 2.0.0 (2026-11-10)

Store listing text:

> Rebuilt for the current ChatGPT, with the original popup back: 72 named themes in one click, or build your own with separate colors for the accent, message bubble, send button and page background. Text contrast is fixed automatically. Your previous theme carries over by name.

- Works with ChatGPT's current design again (1.x stopped working after ChatGPT's redesign).
- The 1.x popup is back: Basic (themes) and Advanced (live preview, five core colors, surfaces, saved themes), with the same themes and colors.
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
