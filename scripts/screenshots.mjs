// Captures the README screenshots from the real chatgpt.com (logged out) with the
// built extension loaded. Needs a visible browser. Usage: npm run build && node scripts/screenshots.mjs
import { chromium } from "playwright";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const extDir = path.join(root, "dist/chrome");
const out = path.join(root, "readme-imgs");
const profile = path.join(root, ".e2e-profile");
fs.rmSync(profile, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const extId = [...crypto.createHash("sha256").update(fs.realpathSync(extDir)).digest("hex").slice(0, 32)]
  .map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");

const SHOTS = [
  { file: "chatgpt-default-light.png", scheme: "light", settings: null },
  { file: "crimson-light.png", scheme: "light", settings: { light: "#e11d48", dark: null, tint: 0 } },
  { file: "ocean-dark.png", scheme: "dark", settings: { light: "#0e7490", dark: "#2dd4bf", tint: 70 } },
  { file: "synthwave-dark.png", scheme: "dark", settings: { light: "#db2777", dark: "#ff0080", tint: 80 } },
  { file: "mocha-light.png", scheme: "light", settings: { light: "#8a5a3c", dark: "#d6b28d", tint: 60 } },
];

const ctx = await chromium.launchPersistentContext(profile, {
  channel: "chromium", headless: false, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2,
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled", `--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(6000);
await page.keyboard.press("Escape");
const box = page.locator('[contenteditable="true"], textarea').first();
await box.click();
await box.pressSequentially("In two short sentences: why do people care so much about accent colors in apps?");
await page.keyboard.press("Enter");
await page.waitForTimeout(18_000);
await page.keyboard.press("Escape");
await box.click();
await box.pressSequentially("Make it pop");

const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/popup.html`);
const apply = (s) => popup.evaluate((s) => new Promise((r) => {
  const settings = s ? { v: 2, enabled: true, preset: null, updatedAt: Date.now(), ...s } : { v: 2, enabled: false, light: null, dark: null, tint: 0, preset: null, updatedAt: Date.now() };
  chrome.storage.sync.set({ settings }, () => chrome.storage.local.set({ live: settings }, r));
}), s);

for (const shot of SHOTS) {
  await apply(shot.settings);
  await page.bringToFront();
  await page.emulateMedia({ colorScheme: shot.scheme });
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: path.join(out, shot.file) });
  console.log("wrote", shot.file);
}

// The popup itself, in both themes.
await apply({ light: "#e11d48", dark: null, tint: 0 });
await popup.reload();
for (const scheme of ["light", "dark"]) {
  await popup.emulateMedia({ colorScheme: scheme });
  await popup.setViewportSize({ width: 316, height: 600 });
  await popup.reload(); // the popup opens on the tab matching the OS theme
  await popup.waitForTimeout(400);
  const h = await popup.evaluate(() => document.body.scrollHeight);
  await popup.setViewportSize({ width: 316, height: h });
  await popup.screenshot({ path: path.join(out, `popup-${scheme}.png`) });
  console.log(`wrote popup-${scheme}.png`);
}
await ctx.close();
fs.rmSync(profile, { recursive: true, force: true });
