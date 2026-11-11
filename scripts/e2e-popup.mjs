// Offline popup regression checks in a real Chromium: keyboard use of the theme lists,
// group tabs, Customize and saved themes. No ChatGPT account or network needed.
// Usage: npm run build && node scripts/e2e-popup.mjs
import assert from "node:assert/strict";
import { launchWithExtension } from "./launch.mjs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const extDir = path.join(root, "dist/chrome");
const { ctx, extId, close } = await launchWithExtension(extDir, { profileName: ".e2e-profile-popup", headless: true, viewport: { width: 360, height: 600 } });
const active = (page) => page.evaluate(() => document.activeElement?.dataset?.id ?? document.activeElement?.id ?? null);
const checkedIds = (page) => page.$$eval('.theme[aria-checked="true"]', (els) => els.map((e) => e.dataset.id));
const pass = (msg) => console.log(`PASS ${msg}`);
try {
  const page = ctx.pages()[0];
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`chrome-extension://${extId}/popup.html`);
  await page.locator("body[data-ready]").waitFor({ state: "attached" });

  // Header, group tabs, then the visible group's single tab stop; hidden groups and
  // the Customize view are not reachable.
  assert.equal(await page.locator(".theme").count(), 41);
  await page.locator("#enabled").focus();
  await page.keyboard.press("Tab"); // -> the selected group tab
  assert.equal(await active(page), "tab-classic");
  await page.keyboard.press("Tab"); // -> the group's single tab stop
  assert.equal(await active(page), "default");
  await page.keyboard.press("Tab"); // leaves the list for the footer
  assert.equal(await active(page), "openCustomize");
  pass("each group is a single tab stop; hidden groups and Customize are skipped");

  // Arrow keys move and select; Space and Enter select too.
  await page.locator('.theme[data-id="default"]').focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await active(page), "blue");
  assert.deepEqual(await checkedIds(page), ["blue"]);
  await page.keyboard.press("ArrowDown");
  assert.equal(await active(page), "teal");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowLeft");
  assert.deepEqual(await checkedIds(page), ["default"]);
  assert.equal(await page.locator("#enabled").isChecked(), false);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown"); // Green
  await page.keyboard.press("Space");
  assert.deepEqual(await checkedIds(page), ["green"]);
  assert.equal(await active(page), "green", "selecting keeps keyboard focus");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#enabled").isChecked(), true);
  pass("arrow keys, Space and Enter drive the list and keep focus");

  // Group tabs: arrows move between them, panels follow.
  await page.locator("#tab-classic").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("#tab-dark").getAttribute("aria-selected"), "true");
  assert.equal(await page.locator("#panel-dark").isVisible(), true);
  assert.equal(await page.locator("#panel-classic").isVisible(), false);
  pass("group tabs respond to arrow keys");

  // The switch turns it off; the colours come back when it is turned on.
  await page.locator("#enabled").press("Space");
  assert.deepEqual(await checkedIds(page), ["default"]);
  await page.locator("#enabled").press("Space");
  assert.deepEqual(await checkedIds(page), ["green"]);
  pass("switch is keyboard operable and remembers the theme");

  // Customize: edit, apply, save, delete, back with Escape.
  await page.locator("#openCustomize").press("Enter");
  assert.equal(await active(page), "back");
  assert.equal(await page.inputValue("#accentHex"), "#16a34a");
  await page.fill("#submitBgHex", "#7c3aed");
  await page.locator("#save").click();
  await page.waitForFunction(() => document.getElementById("applied").textContent === "Applied");
  const live = await page.evaluate(() => new Promise((r) => chrome.storage.local.get("live", (v) => r(v.live))));
  assert.equal(live.roles.submitBg, "#7c3aed");
  assert.equal(live.theme, "custom");
  await page.fill("#saveName", "Violet");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  assert.equal(await page.locator(".saved-list .label").textContent(), "Violet");
  assert.equal(await page.locator("#tab-saved").count(), 1);
  await page.getByRole("button", { name: "Delete Violet" }).click();
  assert.equal(await page.locator(".saved-list .row").count(), 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#themesView").isVisible(), true);
  pass("Customize edit, Apply, save, delete and Escape work");

  // Surfaces are real radios: keyboard reachable.
  await page.locator("#openCustomize").click();
  await page.locator("#surface-default").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator("#surface-dark").isChecked(), true);
  assert.match(await page.locator("#surfaceNote").textContent(), /dark mode/i);
  pass("page background choice is keyboard operable");

  assert.deepEqual(errors, [], "no script errors");
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.reload();
  await page.locator("body[data-ready]").waitFor({ state: "attached" });
  assert.deepEqual(requests.filter((u) => !u.startsWith(`chrome-extension://${extId}/`)), [], "the popup makes no outside requests (fonts are bundled)");
  assert.equal(await page.evaluate(() => document.fonts.check('13px "DM Sans"')), true);
  pass("DM Sans is bundled; no network requests");
} finally {
  await close();
}
