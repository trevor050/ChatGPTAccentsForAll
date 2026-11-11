## ChatGPT Accents For All

A browser extension that themes ChatGPT. Click one of 40 named themes, or build your own: accent, message bubble, send button, even the page background. It checks the contrast for you, so you can't accidentally make your chats unreadable.

Why it exists: when ChatGPT added accent colors in August 2025, purple was for paying subscribers and black was Pro only. As in $200 a month. For a color. I wanted black, so I made all of them free and open source. Purple and Black are still in here with their old price tags crossed out.

ChatGPT has a proper accent setting of its own now, so this has a new job too: everything the built-in setting doesn't do.

| Default | Crimson, light mode | Ocean, dark mode |
| --- | --- | --- |
| ![Stock ChatGPT in light mode](readme-imgs/chatgpt-default-light.png) | ![ChatGPT with the Crimson theme in light mode](readme-imgs/crimson-light.png) | ![ChatGPT with the Ocean theme in dark mode: teal send button, deep teal page](readme-imgs/ocean-dark.png) |
| **Synthwave, dark mode** | **Mocha, dark mode** | **Pastel Mint, light mode** |
| ![ChatGPT with the Synthwave theme: dark purple bubble, hot pink send button](readme-imgs/synthwave-dark.png) | ![ChatGPT with the Mocha theme: warm brown page and bubble](readme-imgs/mocha-dark.png) | ![ChatGPT with the Pastel Mint theme: pale green page, green send button](readme-imgs/pastel-mint-light.png) |

Real screenshots of chatgpt.com with the extension loaded, taken by `scripts/screenshots.mjs`.

### The popup

| Themes | Themes, dark | Customize | Customize, dark |
| --- | --- | --- | --- |
| <img src="readme-imgs/popup-themes-light.png" alt="Themes view: group tabs (Classic, Dark, Light, Characters) and a two-column list of themes, each shown as a tiny chat in its colors" width="190"> | <img src="readme-imgs/popup-themes-dark.png" alt="Themes view in dark mode" width="190"> | <img src="readme-imgs/popup-customize-light.png" alt="Customize view: live preview and the five colors" width="190"> | <img src="readme-imgs/popup-customize-dark.png" alt="Customize view in dark mode" width="190"> |

**Themes** is the fast way. They're split into four short groups (Classic, Dark, Light, Characters), and each one is drawn as a tiny chat: the page, your bubble, the send button and the accent. One click and ChatGPT changes. "ChatGPT's own" puts the original colors back. Themes you save get a fifth group.

**Customize** is for tinkering. A live preview (flip it between light and dark), the five colors each with a picker and a hex field, a page background choice, then *Apply*. Save the ones you like under a name. Edits show up in the preview right away and reach ChatGPT when you hit *Apply*. *Copy diagnostics* lives down there too, for when ChatGPT changes and something looks off.

The switch in the corner turns the colors on and off without forgetting your theme.

### What you get

- **40 themes**, from plain accents (Blue, Green, Pink) to full looks (Mocha, Ocean, Synthwave, Game Boy, Amber CRT). Plus *Black*, the one I built this for. There used to be 72, but a lot of them were the same blue with a different name, so they got merged. If you were using one that's gone, your colors stay exactly as they were and show up under Saved with the old name.
- **Every role is its own color.** Accent, bubble, bubble text, send button and send button text are chosen separately, so a theme can have a pink accent, an orange send button and a brown bubble. Leave a role empty and it's derived from the accent.
- **Readable no matter what.** Bubble text is checked against its bubble (4.5:1, or 7:1 if your OS asks for more contrast) and the arrow on the send button against the button (3:1). A pair that already passes is left exactly as designed. A pair that doesn't gets nudged just enough. Every built-in theme passes on its own (that's tested), so the safety net is really for colors you pick yourself.
- **Surfaces that can't wreck your eyes.** *Dark*, *Light* and *Custom* change ChatGPT's page, sidebar and composer. They never force a dark page onto light mode (dark text on a dark page was the old bug): a dark background reshapes dark mode and only lightly tints light mode, and a light one does the reverse. The popup says what each choice does.
- **Live and synced.** Changes show up instantly in every open ChatGPT tab, and your themes follow your browser profile to your other computers.
- **Works logged out.** The built-in accent setting doesn't.

### ChatGPT's own setting vs this

To be honest about it: if one of ChatGPT's built-in accents is good enough for you, use that. It's built in, it works on the phone apps, and nothing can break.

| | ChatGPT's accent setting | This extension |
| --- | --- | --- |
| Colors | A fixed set of presets | 40 themes or any colors you pick |
| Parts | One accent | Accent, bubble, bubble text, send button, send button text |
| Backgrounds | Neutral grey only | Themes can reshape or tint them |
| Contrast | Tuned by OpenAI for its presets | Checked and fixed for whatever you pick |
| Logged out | No accent option | Works |
| Phone apps | Yes | No, desktop browsers only |
| Can break when ChatGPT updates | No | Yes (see below) |

### What it changes

Colors only. It recolors ChatGPT's accent (send button, toggles, your message bubble and its text, accent-colored text) and, when a theme or Surfaces choice has its own background, the grey surfaces and borders. It never touches the layout, never reads your chats, and never adds anything to the page except one `<style>` tag.

### Install

**Chrome, Edge, Brave, Arc and friends:** it's on the [Chrome Web Store](https://chromewebstore.google.com/detail/eojjhpainjcepfniefegkdjjemhigmgh). Heads up: if the store still says version 1.1.0, that version no longer works on today's ChatGPT. Build 2.0 from source (below) until the update lands.

**Firefox:** not on addons.mozilla.org yet. You can try it as a temporary add-on: grab `chatgpt-accents-firefox-*.zip` from the latest CI run or build it yourself (below), open `about:debugging#/runtime/this-firefox`, click *Load Temporary Add-on* and pick the zip. Firefox removes temporary add-ons when it restarts.

**From source:**

```sh
git clone https://github.com/trevor050/ChatGPTAccentsForAll
cd ChatGPTAccentsForAll
npm ci
npm run build        # -> dist/chrome and dist/firefox
```

Then open `chrome://extensions`, turn on Developer mode, click *Load unpacked* and pick `dist/chrome`. Open chatgpt.com, click the extension icon, pick a color.

### How it works (plain English)

ChatGPT's colors are CSS variables. As of November 2026, signed in and logged out, it uses a theme system with readable names like `--color-background-user-message` and `--color-background-composer-primary`, switched by `data-theme="light|dark"` and its own appearance presets. The extension reads ChatGPT's stylesheets, finds those variables by what their names and values say they do (bubble, bubble text, send button, accent, page), and writes one stylesheet that sets them to your theme. It also covers the spots where ChatGPT sets a variable a second time on a component, like the composer, which is where a naive override silently loses. The older hashed-name design is still recognized too, in case it comes back.

A theme's colors go where their jobs are: the send button color replaces the button's fill, the bubble colors replace the bubble's background and text, and the accent is mapped onto ChatGPT's own palette for everything else, with accent text kept dark or light enough to read on the real page. A page background reshapes ChatGPT's greys while keeping their lightness steps, so text contrast barely moves.

Then it checks its own work. After painting, it finds the elements ChatGPT draws with those variables (the send button, your bubble, accent text) and compares their actual colors with and without its stylesheet. If nothing changed, it takes its colors off and the popup says colors are paused, instead of pretending everything's fine. No half-broken page.

### Privacy

No analytics, no network requests, no remote code. The popup's font (DM Sans, SIL Open Font License) is bundled, not loaded from Google. Your settings live in your browser's extension storage (synced through your browser profile if you have that on). Full policy: [PRIVACY.md](PRIVACY.md).

### Development

```sh
npm test          # unit tests: color math, contrast, token discovery, theme roles, migrations, the popup
npm run lint      # eslint + Mozilla's web-ext linter
npm run zip       # store-ready zips in dist/
npm run watch     # rebuild on change
```

Discovery is tested against real snapshots of chatgpt.com's CSS in `test/fixtures/` (signed in, logged out, and the older design). There are also live checks that drive a real browser against chatgpt.com (they need a visible window, so they don't run in CI):

```sh
npx playwright install chromium # one-time browser download for the Chromium scripts
npm run zip                    # the Firefox check installs the packaged zip
node scripts/e2e-live.mjs       # Chromium: pick a theme, reload, check it stuck
node scripts/e2e-themes.mjs     # Chromium: 12 themes in light and dark, compares what the page painted
node scripts/e2e-upgrade.mjs    # install v1.1.0, pick a theme, upgrade in place, check it comes back by name
node scripts/e2e-firefox.mjs    # same idea in real Firefox (needs geckodriver)
node scripts/screenshots.mjs    # regenerates the README screenshots of ChatGPT
node scripts/popup-shots.mjs    # offline, headless: regenerates the popup screenshots
node scripts/e2e-popup.mjs      # offline, headless: drives the popup with a keyboard
```

For the Firefox check, install Firefox and put [geckodriver](https://github.com/mozilla/geckodriver/releases) on your `PATH` (`brew install geckodriver` on macOS). Windows and Linux use Selenium's installed-browser detection; set `FIREFOX_BIN` to test a different Firefox-compatible executable, such as Zen. Each run uses a fresh test profile unless you set `ACCENTS_TEST_PROFILE` to a folder to reuse across runs.

The Chromium scripts use Playwright's bundled Chromium by default. To test your installed Chrome or Edge instead, set `ACCENTS_BROWSER` to its executable. Branded Chrome has ignored `--load-extension` since version 137, so the scripts then load the extension through the DevTools protocol and remove it again when they finish.

### Contributing

There will be rough edges, and ChatGPT will change again. PRs are very welcome. If it stops working, open an issue with the date and what you see. Even better, run `node scripts/e2e-live.mjs` and paste the output.

`main` is for releases. `dev` is where I work.
