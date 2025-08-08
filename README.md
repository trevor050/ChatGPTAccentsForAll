## ChatGPT Accents For All

A simple browser extension that lets you change ChatGPT's accent color (and background) without paying for the $200 a month pro plan. I wanted the black accent. They wanted 200 bucks a month. So I built this instead.

Works on the web at `chatgpt.com`. Not on mobile. If I could make it work there I would. Maybe an Android APK could make it work there, that's beyond my scope though.

### Why this exists
- I wanted clean accents like true black and other vibes without a paywall
- Paying to change a color felt scummy and weird
- CSS variables are free and I can type
- Also I made some really good looking themes that I love

### Features
- Basic mode with curated presets including proper black
- Advanced mode where you can pick exact colors
- Optional tweaks for surfaces like sidebar and main area
- Reset button to go back to the site's defaults
- Runs only on `chatgpt.com`
- No tracking and no network calls at all, check the code yourself if you don't believe me

### Install from GitHub Releases
You can grab a zip from Releases and load it unpacked.

1. Go to Releases: `https://github.com/trevor050/ChatGPTAccentsForAll/releases`
2. Download the latest zip
3. Unzip it somewhere you can find later
4. Load it unpacked using the steps below

### Load unpacked
Chrome, Edge, Brave are all the same idea.

1. Open `chrome://extensions` or `edge://extensions`
2. Turn on Developer mode
3. Click Load unpacked
4. Select the unzipped folder you downloaded
5. Open `chatgpt.com`, click the extension icon, and pick a preset or hop into Advanced mode

### Roadmap
- Publishing on the Chrome Web Store is in progress
- A Firefox port is in progress

### Contributing
There are some bugs and rough edges. PRs are very welcome. If you see something cursed, fix it and flex those commits. If you want a preset added, drop an issue with the colors. 

### How it works in plain English
The extension sets CSS variables directly on the `<html>` element. That wins the cascade so it overrides the site's theme tokens like `--text-accent` and friends. It survives SPA route changes and light or dark mode flips.

### Privacy
Zero network calls. Your settings live in browser sync storage so they follow your profile.

### Branches
`main` is for releases. `dev` is where I work. Open PRs against `dev`.