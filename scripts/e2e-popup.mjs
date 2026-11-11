// Offline popup regression checks in Chromium. No ChatGPT account or network needed.
// Usage: npm run build && node scripts/e2e-popup.mjs
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const extDir = path.join(root, "dist/chrome");
const profile = path.join(root, ".e2e-profile-popup");
const extId = [...crypto.createHash("sha256").update(fs.realpathSync(extDir)).digest("hex").slice(0, 32)]
  .map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
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
} finally {
  await ctx.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
