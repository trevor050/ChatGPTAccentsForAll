// Live end-to-end check against the real chatgpt.com (logged out). Not run in CI:
// it needs a visible browser window (Cloudflare challenges headless Chromium).
// Usage: npm run build && node scripts/e2e-live.mjs [--shots dir]
import { launchWithExtension } from "./launch.mjs";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const extDir = path.join(root, "dist/chrome");
const shotsArg = process.argv.indexOf("--shots");
const shots = shotsArg > 0 ? path.resolve(process.argv[shotsArg + 1]) : null;

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? "  " + detail : ""}`); };

// A fresh install every run (see launch.mjs for installed browsers and reused profiles).
const { ctx, extId, close } = await launchWithExtension(extDir, { profileName: ".e2e-profile", viewport: { width: 1280, height: 800 }, headless: process.env.ACCENTS_HEADLESS === "1" });
try {
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => document.styleSheets.length > 2, null, { timeout: 60_000 });
  await page.waitForTimeout(3000);

  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForSelector(".theme-card");

  const status = await popup.evaluate(() => new Promise((r) => chrome.storage.local.get(["status"], r)));
  check("ChatGPT's theme variables recognised", status.status?.ok && (status.status.appVars > 5 || status.status.accentTokens > 5), JSON.stringify({ shell: status.status?.shell, appVars: status.status?.appVars, accentTokens: status.status?.accentTokens }));

  // What the user sees: the composer's send/voice button colour.
  const sendColor = () => page.evaluate(() => {
    const el = document.querySelector("[data-composer-voice-start], #composer-submit-button, [data-testid=send-button]");
    return el ? getComputedStyle(el).backgroundColor : "";
  });
  const before = await sendColor();

  // Click a named theme: its send-button colour lands on the page.
  await popup.locator('.theme-card[data-id="crimson"]').click();
  await page.waitForTimeout(800);
  check("clicking a theme recolours the live page", (await sendColor()) === "rgb(185, 28, 28)", `${before} -> ${await sendColor()}`);

  // The effect check runs ~1 s after painting and must confirm it.
  await page.waitForTimeout(2500);
  const after = await popup.evaluate(() => new Promise((r) => chrome.storage.local.get(["status"], r)));
  check("effect check confirms the colours took", after.status?.effect?.state === "pass", JSON.stringify(after.status?.effect?.roles));

  // Reload the ChatGPT tab: colour must persist (and be painted from cache at document_start).
  await page.reload({ waitUntil: "domcontentloaded" });
  const early = await page.evaluate(() => document.getElementById("chatgpt-accents-for-all")?.getAttribute("data-early") ?? "none").catch(() => "");
  await page.waitForTimeout(3000);
  check("colour persists across reload", (await sendColor()) === "rgb(185, 28, 28)", `early paint at ${early} ms`);

  // Advanced: make a custom theme, apply it.
  await popup.click("#seg-advanced");
  await popup.fill("#submitBgHex", "#7c3aed");
  await popup.click("#save");
  await page.waitForTimeout(800);
  check("Advanced Apply recolours the live page", (await sendColor()) === "rgb(124, 58, 237)", await sendColor());
  await popup.click("#seg-basic");

  const stored = await popup.evaluate(() => new Promise((r) => chrome.storage.sync.get(["settings"], r)));
  check("settings saved to storage.sync", stored.settings?.theme === "custom" && stored.settings?.roles?.submitBg === "#7c3aed", JSON.stringify(stored.settings));

  // Turning it off restores ChatGPT's own value.
  await popup.click(".switch");
  await page.waitForTimeout(600);
  check("switch off restores ChatGPT default", (await sendColor()) === before, await sendColor());
  await popup.click(".switch");
  await page.waitForTimeout(600);

  // Contrast: every recoloured foreground token vs ChatGPT's page surfaces.
  const report = await page.evaluate(() => [...document.styleSheets].find((s) => s.ownerNode?.id === "chatgpt-accents-for-all")?.cssRules.length ?? 0);
  check("override stylesheet present", report > 0, `${report} rules`);

  if (shots) {
    fs.mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: path.join(shots, "e2e-page.png") });
    await popup.setViewportSize({ width: 344, height: 640 });
    await popup.screenshot({ path: path.join(shots, "e2e-popup.png") });
  }
} finally {
  await close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
