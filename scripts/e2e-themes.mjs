// Live walk through named themes on the real chatgpt.com (logged out), in light and dark mode.
// For each theme it clicks the card in the popup, then reads what the page actually painted
// (user bubble, bubble text, send button, body text on the page) and compares it with what the
// engine says it should be. Finishes by making, saving and reloading a custom theme in Advanced.
// Needs a visible browser (Cloudflare challenges headless). Not run in CI.
// Usage: npm run build && node scripts/e2e-themes.mjs [--shots dir] [theme-id ...]
import { chromium } from "playwright";
import { unpackedExtensionId } from "./extension-id.mjs";
import { contrastRatio, parseColor, toHex } from "../src/lib/color.js";
import { applyTheme, DEFAULT_SETTINGS, normalizeSettings } from "../src/lib/settings.js";
import { rolesFor } from "../src/lib/theme.js";
import { themeById } from "../src/lib/themes.js";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const extDir = path.join(root, "dist/chrome");
const args = process.argv.slice(2);
const shotsArg = args.indexOf("--shots");
const shots = shotsArg >= 0 ? path.resolve(args[shotsArg + 1]) : null;
const ids = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--shots");
const THEMES = ids.length ? ids : ["blue", "crimson", "sunset", "mocha", "ocean", "midnight", "synthwave", "black_bg", "gameboy", "pastel_mint", "frost", "cream"];
const profile = path.join(root, ".e2e-profile-themes");
fs.rmSync(profile, { recursive: true, force: true });
if (shots) fs.mkdirSync(shots, { recursive: true });
const extId = unpackedExtensionId(fs.realpathSync(extDir));

let failed = 0;
const check = (name, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? "  " + detail : ""}`); };
const rgbHex = (css) => { const c = parseColor(css.replace(/\s+/g, "")); return c ? toHex({ ...c, a: 1 }) : css; };
const MESSAGE = "In two short sentences: why do people care so much about accent colors in apps?";

const ctx = await chromium.launchPersistentContext(profile, {
  channel: "chromium", headless: false, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1,
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled", `--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
});
try {
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(6000);
  await page.keyboard.press("Escape");
  const box = page.locator('[contenteditable="true"], textarea').first();
  await box.click();
  await box.pressSequentially(MESSAGE);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(16_000);
  await page.keyboard.press("Escape");
  await box.click();
  await box.pressSequentially("Make it pop");

  const popup = await ctx.newPage();
  await popup.setViewportSize({ width: 352, height: 600 });
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.locator("body[data-ready]").waitFor({ state: "attached" });
  await page.bringToFront();

  const paint = () => page.evaluate((message) => {
    const solid = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; } return "rgb(255, 255, 255)"; };
    const leaf = [...document.querySelectorAll("p, span, div")].find((e) => !e.childElementCount && e.textContent.trim() === message);
    const send = document.querySelector('button[aria-label="Send message"]');
    const pageEl = document.elementFromPoint(640, 450);
    return {
      bubbleBg: leaf ? solid(leaf) : null,
      bubbleText: leaf ? getComputedStyle(leaf).color : null,
      sendBg: send ? getComputedStyle(send, "::before").backgroundColor : null,
      sendIcon: send ? getComputedStyle(send).color : null,
      pageBg: solid(pageEl),
      pageText: getComputedStyle(pageEl).color,
    };
  }, MESSAGE);

  for (const id of THEMES) {
    const theme = themeById(id);
    await popup.locator(`.theme-card[data-id="${id}"]`).click();
    for (const mode of ["light", "dark"]) {
      await page.bringToFront();
      await page.emulateMedia({ colorScheme: mode });
      await page.waitForTimeout(900);
      const got = await paint();
      const want = rolesFor(mode, normalizeSettings(applyTheme(DEFAULT_SETTINGS, theme)));
      const tag = `${theme.name} (${mode})`;
      check(`${tag}: user bubble`, rgbHex(got.bubbleBg) === want.tint.toLowerCase(), `${rgbHex(got.bubbleBg)} want ${want.tint}`);
      check(`${tag}: bubble text`, rgbHex(got.bubbleText) === want.onTint.toLowerCase(), `${rgbHex(got.bubbleText)} want ${want.onTint}`);
      check(`${tag}: send button`, rgbHex(got.sendBg) === want.submit.toLowerCase(), `${rgbHex(got.sendBg)} want ${want.submit}`);
      check(`${tag}: send glyph`, rgbHex(got.sendIcon) === want.onSubmit.toLowerCase(), `${rgbHex(got.sendIcon)} want ${want.onSubmit}`);
      check(`${tag}: page text readable`, contrastRatio(rgbHex(got.pageText), rgbHex(got.pageBg)) >= 7, `${rgbHex(got.pageText)} on ${rgbHex(got.pageBg)}`);
      if (shots) await page.screenshot({ path: path.join(shots, `${id}-${mode}.png`) });
    }
  }

  // Advanced: make a custom theme, save it, reload everything, find it again.
  await popup.bringToFront();
  await popup.click("#seg-advanced");
  await popup.fill("#bubbleBgHex", "#223344");
  await popup.fill("#bubbleTextHex", "#ffeecc");
  await popup.fill("#submitBgHex", "#ff6600");
  await popup.fill("#submitTextHex", "#111111");
  await popup.click("#surface-dark");
  await popup.click("#save");
  await popup.fill("#saveName", "E2E custom");
  await popup.click("#saveThemeBtn");
  await page.bringToFront();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(900);
  const custom = await paint();
  check("custom theme: bubble", rgbHex(custom.bubbleBg) === "#223344", rgbHex(custom.bubbleBg));
  check("custom theme: send button", rgbHex(custom.sendBg) === "#ff6600", rgbHex(custom.sendBg));
  if (shots) await page.screenshot({ path: path.join(shots, "custom-dark.png") });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(600);
  await page.locator('[contenteditable="true"], textarea').first().click();
  await page.locator('[contenteditable="true"], textarea').first().pressSequentially("hi");
  await page.waitForTimeout(500);
  const after = await paint();
  check("custom theme persists across a page reload", rgbHex(after.sendBg) === "#ff6600", rgbHex(after.sendBg));
  await popup.reload();
  await popup.locator("body[data-ready]").waitFor({ state: "attached" });
  await popup.click("#seg-advanced");
  check("saved theme survives a popup reload", (await popup.locator(".saved-row .name").allTextContents()).includes("E2E custom"));
  check("applied colours survive a popup reload", (await popup.inputValue("#submitBgHex")) === "#ff6600");
  if (shots) {
    await popup.setViewportSize({ width: 352, height: 1100 });
    await popup.screenshot({ path: path.join(shots, "popup-advanced-after-reload.png") });
  }
} finally {
  await ctx.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} checks FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
