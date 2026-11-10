# Releasing

The Chrome Web Store listing is live (`eojjhpainjcepfniefegkdjjemhigmgh`). Firefox is not listed yet.

## Every release
1. Bump `version` in **both** `package.json` and `src/manifest.json` (the build refuses to run if they differ). Add an entry to `CHANGELOG.md`.
2. `npm ci && npm run check && npm run zip` produces `dist/chatgpt-accents-chrome-<version>.zip` and `dist/chatgpt-accents-firefox-<version>.zip`. CI attaches the same zips to every PR run as an artifact.
3. Run `node scripts/e2e-live.mjs` once against the real site before uploading.

## Chrome Web Store (update)
1. Developer Dashboard -> the item -> Package -> Upload new package -> the chrome zip.
2. Store listing: paste the quoted text from `CHANGELOG.md` into the description's "What's new" part; replace screenshots with `readme-imgs/crimson-light.png`, `ocean-dark.png`, `synthwave-dark.png`, `mocha-light.png` resized to 1280x800 (`sips -z 800 1280 file.png --out store-file.png`). Icon: `src/icons/icon-128.png`.
3. Privacy tab: single purpose "Change the colors of the ChatGPT website". Permission justification: `storage` saves color settings; host access to chatgpt.com injects the stylesheet. Remote code: No. Data usage: collects nothing. Privacy policy URL: `https://github.com/trevor050/ChatGPTAccentsForAll/blob/main/PRIVACY.md`.
4. Submit for review.

## Firefox (first listing, optional)
1. addons.mozilla.org Developer Hub -> Submit a New Add-on -> "On this site" -> the firefox zip.
2. AMO asks for source code because the bundle is built: upload a zip of the repo (without `node_modules`/`dist`) and say "npm ci && npm run build; output in dist/firefox".
3. The add-on id is fixed in `scripts/build.mjs` (`chatgpt-accents-for-all@trevor050.github.io`); keep it forever once listed.
