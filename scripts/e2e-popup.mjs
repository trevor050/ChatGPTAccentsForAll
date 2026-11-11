// Offline popup regression checks in Chromium. No ChatGPT account or network needed.
// Usage: npm run build && node scripts/e2e-popup.mjs
import assert from "node:assert/strict";
import { unpackedExtensionId } from "./extension-id.mjs";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const extDir = path.join(root, "dist/chrome");
const profile = path.join(root, ".e2e-profile-popup");
const extId = unpackedExtensionId(fs.realpathSync(extDir));
fs.rmSync(profile, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(profile, {
  channel: "chromium", headless: true, viewport: { width: 344, height: 640 },
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
});
try {
  const page = ctx.pages()[0];
  await page.goto(`chrome-extension://${extId}/popup.html`);
  await page.locator("#swatches .swatch").first().waitFor();
  await page.locator("#tab-light").click();
  assert.equal(await page.locator("#auto-row").isVisible(), false, "Auto belongs only to the dark-mode editor");
  await page.locator("#tab-light").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("#tab-dark").getAttribute("aria-selected"), "true");
  assert.equal(await page.locator("#auto-row").isVisible(), true);
  console.log("PASS Auto is hidden in light mode and arrow navigation opens dark mode");
  await page.getByRole("button", { name: "Crimson", exact: true }).focus();
  await page.keyboard.press("Space");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Crimson", "Choosing a preset must retain keyboard focus");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Orange");
  console.log("PASS preset selection keeps focus and Tab continues to the next preset");
} finally {
  await ctx.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
