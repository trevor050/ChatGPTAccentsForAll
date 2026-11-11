// README screenshots of the popup itself, from the built extension, offline and headless.
// Usage: npm run build && node scripts/popup-shots.mjs [outDir]
//
// The viewport never changes size: each capture is clipped to the popup's measured
// box instead. (Resizing the headless viewport between captures once produced an
// image of the right size whose content was a smaller surface tiled across it.)
// Every capture is checked before it is written; see capture-check.mjs.
import fs from "node:fs";
import path from "node:path";
import { assertCapture } from "./capture-check.mjs";
import { launchWithExtension } from "./launch.mjs";
import { pickTheme } from "./popup-helpers.mjs";

const root = path.resolve(import.meta.dirname, "..");
const out = path.resolve(process.argv[2] || path.join(root, "readme-imgs"));
const SCALE = 2;
const { ctx, extId, close } = await launchWithExtension(path.join(root, "dist/chrome"), {
  profileName: ".e2e-profile-shots", headless: true, viewport: { width: 360, height: 600 }, deviceScaleFactor: SCALE,
});

/** Capture the popup's own box (body), check it, write it. */
async function capture(popup, file) {
  await popup.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const box = await popup.evaluate(() => { const r = document.body.getBoundingClientRect(); return { width: Math.round(r.width), height: Math.ceil(r.height) }; });
  if (box.width !== 360 || box.height > 600) throw new Error(`${file}: popup is ${box.width}x${box.height}, expected 360 wide and at most 600 tall (Chrome's popup limit)`);
  const png = await popup.screenshot({ clip: { x: 0, y: 0, ...box } });
  await assertCapture(ctx, png, { ...box, scale: SCALE, name: file });
  fs.writeFileSync(path.join(out, file), png);
  console.log(`wrote ${file} (${box.width}x${box.height} @${SCALE}x)`);
}

try {
  const popup = ctx.pages()[0];
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.locator("body[data-ready]").waitFor({ state: "attached" });
  await pickTheme(popup, "purple_plus");
  for (const scheme of ["light", "dark"]) {
    await popup.emulateMedia({ colorScheme: scheme });
    await popup.reload();
    await popup.locator("body[data-ready]").waitFor({ state: "attached" });
    await capture(popup, `popup-themes-${scheme}.png`);
    await popup.click("#openCustomize");
    await capture(popup, `popup-customize-${scheme}.png`);
  }
} finally {
  await close();
}
