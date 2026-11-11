// Offline popup regression checks in a real Chromium: keyboard use of the theme grid,
// tabs, Advanced editing and saved themes. No ChatGPT account or network needed.
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
  channel: "chromium", headless: true, viewport: { width: 352, height: 600 },
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
});
const active = (page) => page.evaluate(() => document.activeElement?.dataset?.id ?? document.activeElement?.id ?? null);
const checkedIds = (page) => page.$$eval('.theme-card[aria-checked="true"]', (els) => els.map((e) => e.dataset.id));
const pass = (msg) => console.log(`PASS ${msg}`);
try {
  const page = ctx.pages()[0];
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`chrome-extension://${extId}/popup.html`);
  await page.locator("body[data-ready]").waitFor({ state: "attached" });

  // The grid is one tab stop, and the hidden Advanced panel is not reachable.
  assert.equal(await page.locator(".theme-card").count(), 73);
  await page.locator("#seg-basic").focus();
  await page.keyboard.press("Tab"); // -> switch
  await page.keyboard.press("Tab"); // -> the grid's single tab stop
  assert.equal(await active(page), "default");
  await page.keyboard.press("Tab"); // leaves the grid; nothing inside Advanced is focusable
  assert.notEqual(await page.evaluate(() => document.activeElement?.closest("#advanced") !== null), true);
  pass("theme grid is a single tab stop and the inactive panel is skipped");

  // Arrow keys move and select; Space and Enter select too.
  await page.locator('.theme-card[data-id="default"]').focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await active(page), "blue");
  assert.deepEqual(await checkedIds(page), ["blue"]);
  await page.keyboard.press("ArrowDown");
  assert.equal(await active(page), "yellow");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowLeft");
  assert.deepEqual(await checkedIds(page), ["default"]);
  assert.equal(await page.locator("#enabled").isChecked(), false);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight"); // Green
  await page.keyboard.press("Space");
  assert.deepEqual(await checkedIds(page), ["green"]);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.id), "green", "selecting keeps keyboard focus");
  await page.keyboard.press("Enter");
  assert.deepEqual(await checkedIds(page), ["green"]);
  assert.equal(await page.locator("#enabled").isChecked(), true);
  pass("arrow keys, Space and Enter drive the grid and keep focus");

  // The switch turns it off; the colours come back when it is turned on.
  await page.locator("#enabled").press("Space");
  assert.deepEqual(await checkedIds(page), ["default"]);
  await page.locator("#enabled").press("Space");
  assert.deepEqual(await checkedIds(page), ["green"]);
  pass("switch is keyboard operable and remembers the theme");

  // Tabs: arrows move between them, panels follow.
  await page.locator("#seg-basic").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("#seg-advanced").getAttribute("aria-selected"), "true");
  assert.equal(await page.locator("#advanced").isVisible(), true);
  pass("tabs respond to arrow keys");

  // Advanced: edit, apply, save, delete.
  assert.equal(await page.inputValue("#accentHex"), "#16a34a");
  await page.fill("#submitBgHex", "#7c3aed");
  await page.locator("#save").click();
  await page.waitForFunction(() => document.getElementById("applied").textContent === "Applied");
  const live = await page.evaluate(() => new Promise((r) => chrome.storage.local.get("live", (v) => r(v.live))));
  assert.equal(live.roles.submitBg, "#7c3aed");
  assert.equal(live.theme, "custom");
  await page.fill("#saveName", "Violet");
  await page.getByRole("button", { name: "Save current" }).click();
  assert.equal(await page.locator(".saved-row .name").textContent(), "Violet");
  await page.getByRole("button", { name: "Delete Violet" }).click();
  assert.equal(await page.locator(".saved-row").count(), 0);
  pass("Advanced edit, Apply, save and delete work");

  // Surfaces are real radios: keyboard reachable.
  await page.locator("#surface-default").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("#surface-dark").isChecked(), true);
  assert.match(await page.locator("#surfaceNote").textContent(), /dark mode/i);
  pass("surface choice is keyboard operable");

  assert.deepEqual(errors, [], "no script errors");
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.reload();
  await page.locator("body[data-ready]").waitFor({ state: "attached" });
  assert.deepEqual(requests.filter((u) => !u.startsWith(`chrome-extension://${extId}/`)), [], "the popup makes no outside requests (fonts are bundled)");
  assert.equal(await page.evaluate(() => document.fonts.check('13px "DM Sans"')), true);
  pass("DM Sans is bundled; no network requests");
} finally {
  await ctx.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
