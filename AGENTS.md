# AGENTS.md

MV3 browser extension: recolors chatgpt.com's accent (any color, separate light/dark, optional background tint) with automatic WCAG contrast repair. One source, builds for Chromium + Firefox. Published on Chrome Web Store (id `eojjhpainjcepfniefegkdjjemhigmgh`); not on AMO.

## Layout
- `src/lib/` pure logic, unit tested: `color.js` (parse, OKLCH, WCAG, ensureContrast, HSV), `discover.js` (find tokens in CSS rules), `theme.js` (palette math, REFERENCE palette, tint), `css.js` (build override stylesheet), `settings.js` (v2 schema, presets, v1 migration), `storage.js` (chrome.storage wrapper).
- `src/content/index.js` content script (document_start). `src/popup/` popup UI. `src/manifest.json` base manifest; `scripts/build.mjs` writes per-browser manifests into `dist/chrome`, `dist/firefox` (esbuild IIFE bundles, unminified for store review).
- `test/fixtures/chatgpt-*.json` captured chatgpt.com CSS rules (`:root` + theme-class rules with custom props).

## Commands (Node >= 22.12; `/opt/homebrew/bin/node` on Trevor's Mac, default shell node is 20)
- `npm run build | test | lint | zip` ; `npm run check` = all.
- Live checks (headed browser, NOT CI; Cloudflare blocks headless): `node scripts/e2e-live.mjs`, `e2e-upgrade.mjs` (v1.1.0 -> current migration), `e2e-firefox.mjs` (needs `brew install geckodriver`, stock Firefox), `screenshots.mjs` (README images), `capture-fixture.mjs` (fresh CSS fixture). Headed Chromium + `--disable-blink-features=AutomationControlled` + no `--enable-automation` gets past Cloudflare on chatgpt.com.
- Chromium unpacked extension id = sha256(realpath) first 32 hex mapped 0-f -> a-p (used by scripts to open popup.html).
- Firefox WebDriver: open extension pages from chrome context (`--allow-system-access`), using the runtime WebExtensionPolicy hostname. Install the local ZIP by `path`; Selenium's Base64 install left Windows Firefox referring to a deleted addon-test XPI (active addon, but empty popup and no content script). `ACCENTS_TEST_PROFILE` reuses a persistent test profile.

## How theming works (ChatGPT as of 2026-11-10)
- ChatGPT uses StyleX: hashed var names (`--x1e4keym`), atomic classes. Built-in accent setting = theme class on `<html>` (blue `x13qp82k` default; ~10 variants) shaped `.X.X, .X.X:root { --a; --b; ... }`, defaults in `:root, .xsajpkq`.
- Light/dark: lightningcss polyfill `var(--lightningcss-light,A)var(--lightningcss-dark,B)`; ChatGPT's Appearance=Dark sets `color-scheme: dark` on html. We emit native `light-dark(A, B)`, which follows the same color-scheme (verified live).
- discover.js: cluster theme classes sharing var names; accent cluster = >=4 classes spanning >=4 hue buckets. Reference theme = has mode-invariant chromatic value (the fill), closest to hue 265. Fill = chromatic value equal in light and dark (text/tint are pairs). Neutrals = achromatic vars with light != dark in any `:root, .Y` group.
- Base class `.xsajpkq` is on `<body>` too and RESETS raw accent tokens to black/white there; themed colors reach the UI via `:root`-declared semantic aliases resolved at html. Some controls ("Log in" pill: bg=text-primary, fg=raw on-accent token) depend on that reset. So accent overrides go on `:root` + theme classes ONLY; neutral-tint overrides go on `:root` + base classes. Mixing these up = invisible button text (seen at 390px dark).
- css.js: selectors are repeated x5 (beats `.X.X:root` = 0,3,0). Per token: pure grey (C<0.008) -> onColor(fill); reference fill -> user fill; light-L>=0.85 / dark-L<=0.35 -> surface (retint, `accentSurface`); else foreground -> retint + ensureContrast vs [surface, tint] (4.5; 7 in `prefers-contrast: more`). var()/color-mix exprs restated verbatim.
- Legacy named tokens (`--theme-user-msg-bg` etc., pre-StyleX ChatGPT) only emitted if a page stylesheet still declares them.

## When ChatGPT changes (re-fix playbook)
1. `npm run build && node scripts/e2e-live.mjs`. First line prints discovery status (accentTokens/neutralTokens). Popup shows a warning when `local.status.ok` is false.
2. If discovery fails: `node scripts/capture-fixture.mjs test/fixtures/chatgpt-<date>.json`, point a test at it, adjust heuristics in `discover.js` (`THEME_SELECTOR`, `ROOT_SELECTOR`, `parseValue` for new light/dark syntax). Keep the old fixture's tests passing.
3. If discovery works but colors look wrong: check which token an element uses (elementFromPoint -> matched rule -> var chain) and the classification thresholds in `css.js recolorToken`. Update `REFERENCE` in theme.js if OpenAI repaints its blue palette.
4. Recapture README shots with `scripts/screenshots.mjs`.

## Hazards
- Only logged-out chatgpt.com has been verified (no account available). Logged-in UI may use extra groups.
- Content script must never throw into the page; everything is try/catch'd and degrades to no styling. Cached tokens are candidates only: validate current CSS before rendering; a null discovery must clear tokens, remove overrides and write failed status even with zero rules.
- storage.sync quotas: popup writes `local.live` per change (instant repaint) and debounces `sync.settings` (400 ms, flushed on pagehide). Content picks the newer by `updatedAt`.
- Native `<input type=color>` closes Firefox popups; hence the custom HSV picker.
- `npm` 11 warns about blocked install scripts; esbuild still works through its optional platform package.
- Version lives in both `package.json` and `src/manifest.json`; build fails if they differ.
