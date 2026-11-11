// Renders the extension icon PNGs from the SVG sources in assets/icon/. Dev-only; output is committed.
// Usage: node scripts/icons.mjs   (needs Playwright's Chromium: npx playwright install chromium)
//
// The toolbar sizes are drawn separately so they stay crisp instead of being scaled down:
//   16 px  <- assets/icon/icon-16.svg
//   32 px  <- assets/icon/icon-32.svg
//   48, 64, 96, 128 px <- assets/icon/icon.svg (128 grid; its edges land on whole pixels at these sizes)
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "assets/icon");
const out = path.join(root, "src/icons");

const TARGETS = [
  { size: 16, file: "icon-16.svg" },
  { size: 32, file: "icon-32.svg" },
  { size: 48, file: "icon.svg" },
  { size: 64, file: "icon.svg" },
  { size: 96, file: "icon.svg" },
  { size: 128, file: "icon.svg" },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const { size, file } of TARGETS) {
  const svg = (await fs.readFile(path.join(src, file), "utf8"))
    .replace(/\bwidth="\d+"/, `width="${size}"`)
    .replace(/\bheight="\d+"/, `height="${size}"`);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.screenshot({ path: path.join(out, `icon-${size}.png`), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
console.log("icons written to", path.relative(root, out));
