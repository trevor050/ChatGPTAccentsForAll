# Privacy Policy for ChatGPT Accents For All

Effective date: 2026-11-11

## Summary
This extension does not collect, transmit, or sell any data. It stores your color choices in your browser's extension storage, plus one copy of the generated color stylesheet in chatgpt.com's local storage (see below), and nothing else.

## Data collection
- No personal data is collected
- No analytics, telemetry, or tracking
- No network requests of any kind are made by the extension

## Data storage
- `storage.sync`: your color settings and saved favorites. If you have browser sync turned on, your browser syncs these between your own devices through your browser account (Google or Mozilla). The extension itself never sends them anywhere.
- `storage.local`: a copy of your current settings for instant preview, a cached list of ChatGPT's color variable names, and a small status record (how many color variables were found on the last page load and ChatGPT's build id) used to warn you in the popup if ChatGPT's styles changed. This never leaves your computer.
- chatgpt.com's own `localStorage`, key `chatgpt-accents-for-all:paint`: a copy of the last recoloring stylesheet the extension applied (color values and ChatGPT's CSS variable names) and ChatGPT's build id. It lets your colors appear on the very first frame of a page load, before extension storage can answer. Because it lives in chatgpt.com's storage, ChatGPT's own page scripts can read it, as they can read the colors on the page itself; it contains nothing else. It is removed when you turn colors off, and clearing chatgpt.com's site data removes it.

## Permissions used
- `storage`: save and load your color settings.
- Content script on `https://chatgpt.com/*`: inject one stylesheet that recolors the page. The script reads ChatGPT's stylesheets to find its color variables. It does not read, store, or transmit the content of your chats or anything else on the page.

## Remote code
No remote JavaScript, WebAssembly, or stylesheets. All code ships inside the extension package, and nothing uses `eval` or dynamic code execution.

## Third parties
No data is shared with anyone.

## Changes to this policy
Changes are committed to the repository and the effective date above is updated.

## Contact
Open an issue on the GitHub repository: https://github.com/trevor050/ChatGPTAccentsForAll/issues
