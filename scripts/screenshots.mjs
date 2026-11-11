// Captures the README screenshots from the real chatgpt.com (logged out) with the
// built extension loaded. Needs a visible browser. Usage: npm run build && node scripts/screenshots.mjs
import { chromium } from "playwright";
import { unpackedExtensionId } from "./extension-id.mjs";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const extDir = path.join(root, "dist/chrome");
const out = path.join(root, "readme-imgs");
const profile = path.join(root, ".e2e-profile");
fs.rmSync(profile, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const extId = unpackedExtensionId(fs.realpathSync(extDir));

// Chosen by clicking the theme's card in the real popup, so the screenshots also exercise it.
const SHOTS = [
  { file: "chatgpt-default-light.png", scheme: "light", theme: "default" },
  { file: "crimson-light.png", scheme: "light", theme: "crimson" },
  { file: "ocean-dark.png", scheme: "dark", theme: "ocean" },
  { file: "synthwave-dark.png", scheme: "dark", theme: "synthwave" },
  { file: "mocha-dark.png", scheme: "dark", theme: "mocha" },
  { file: "pastel-mint-light.png", scheme: "light", theme: "pastel_mint" },
];
const POPUP_THEME = "pink"; // selected in the popup screenshots

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
await popup.setViewportSize({ width: 380, height: 600 });
await popup.goto(`chrome-extension://${extId}/popup.html`);
await popup.locator("body[data-ready]").waitFor({ state: "attached" });

for (const shot of SHOTS) {
  await popup.locator(`.theme-card[data-id="${shot.theme}"]`).click();
  await page.bringToFront();
  await page.emulateMedia({ colorScheme: shot.scheme });
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: path.join(out, shot.file) });
  console.log("wrote", shot.file);
}

// The popup itself (Chrome shows it at most 600px tall), Basic and Advanced, in both schemes.
await popup.locator(`.theme-card[data-id="${POPUP_THEME}"]`).click();
for (const scheme of ["light", "dark"]) {
  await popup.emulateMedia({ colorScheme: scheme });
  await popup.reload();
  await popup.locator("body[data-ready]").waitFor({ state: "attached" });
  await popup.waitForTimeout(400);
  await popup.screenshot({ path: path.join(out, `popup-basic-${scheme}.png`) });
  await popup.click("#seg-advanced");
  await popup.waitForTimeout(500);
  await popup.screenshot({ path: path.join(out, `popup-advanced-${scheme}.png`) });
  console.log(`wrote popup-basic-${scheme}.png, popup-advanced-${scheme}.png`);
}
await ctx.close();
fs.rmSync(profile, { recursive: true, force: true });
