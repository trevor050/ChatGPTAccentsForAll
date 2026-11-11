// Live end-to-end check against the real chatgpt.com (logged out). Not run in CI:
// it needs a visible browser window (Cloudflare challenges headless Chromium).
// Usage: npm run build && node scripts/e2e-live.mjs [--shots dir]
import { chromium } from "playwright";
import { unpackedExtensionId } from "./extension-id.mjs";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const extDir = path.join(root, "dist/chrome");
const shotsArg = process.argv.indexOf("--shots");
const shots = shotsArg > 0 ? path.resolve(process.argv[shotsArg + 1]) : null;
const profile = path.join(root, ".e2e-profile");
fs.rmSync(profile, { recursive: true, force: true }); // fresh install every run

// Chromium derives unpacked extension IDs from the absolute path.
const extId = unpackedExtensionId(fs.realpathSync(extDir));

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? "  " + detail : ""}`); };

const ctx = await chromium.launchPersistentContext(profile, {
  channel: "chromium", headless: false, viewport: { width: 1280, height: 800 },
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled", `--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
});
try {
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => document.styleSheets.length > 2, null, { timeout: 60_000 });
  await page.waitForTimeout(3000);

  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForSelector("#swatches .swatch");

  const status = await popup.evaluate(() => new Promise((r) => chrome.storage.local.get(["status", "tokens"], r)));
  check("discovery found accent tokens", status.status?.accentTokens > 5, JSON.stringify(status.status));
  const tokens = status.tokens;
  const fillVar = Object.entries(tokens.accent).find(([, t]) => t.kind === "color" && t.light === tokens.referenceFill && t.dark === tokens.referenceFill)?.[0];
  check("reference fill token identified", Boolean(fillVar), `${fillVar} = ${tokens.referenceFill}`);

  const read = (name) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
  const before = await read(fillVar);

  // Type a custom colour into the popup.
  await popup.fill("#hex", "#e11d48");
  await popup.locator("#hex").dispatchEvent("change");
  await page.waitForTimeout(800);
  const after = await read(fillVar);
  check("custom hex recolours the live page", /e11d48/i.test(after), `${before} -> ${after}`);

  // Reload the ChatGPT tab: colour must persist (and be painted from cache at document_start).
  await page.reload({ waitUntil: "domcontentloaded" });
  const early = await read(fillVar).catch(() => "");
  await page.waitForTimeout(3000);
  check("colour persists across reload", /e11d48/i.test(await read(fillVar)), `at DOMContentLoaded: "${early}"`);

  const stored = await popup.evaluate(() => new Promise((r) => chrome.storage.sync.get(["settings"], r)));
  check("settings saved to storage.sync", stored.settings?.light === "#e11d48", JSON.stringify(stored.settings));

  // Turning it off restores ChatGPT's own value.
  await popup.click(".switch");
  await page.waitForTimeout(600);
  check("switch off restores ChatGPT default", (await read(fillVar)) === before, await read(fillVar));
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
  await ctx.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
