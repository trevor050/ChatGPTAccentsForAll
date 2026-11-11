// Upgrade check: install v1.1.0 (from git), pick a theme in its popup, then swap in
// the current build at the same path (same extension ID and storage) and confirm the
// user's colour survives the migration. Needs a visible browser, like e2e-live.
// Usage: npm run build && node scripts/e2e-upgrade.mjs [v1-ref]
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { unpackedExtensionId } from "./extension-id.mjs";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ref = process.argv[2] || "13f2f89"; // last v1.1.0 commit on main
const slot = path.join(root, "dist/upgrade-slot");
const profile = path.join(root, ".e2e-profile-upgrade");
fs.rmSync(slot, { recursive: true, force: true });
fs.rmSync(profile, { recursive: true, force: true });
fs.mkdirSync(slot, { recursive: true });
for (const f of ["manifest.json", "content.js", "popup.html", "popup.js"]) {
  fs.writeFileSync(path.join(slot, f), execFileSync("git", ["show", `${ref}:${f}`], { cwd: root }));
}
const extId = unpackedExtensionId(fs.realpathSync(slot));
const launch = () => chromium.launchPersistentContext(profile, {
  channel: "chromium", headless: false, viewport: { width: 1280, height: 800 },
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled", `--disable-extensions-except=${slot}`, `--load-extension=${slot}`],
});

let ok = true;
// 1. v1: choose the "Ocean" preset through the old popup UI.
let ctx = await launch();
let popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/popup.html`);
await popup.locator('.theme-card[data-id="ocean"]').click();
await popup.waitForTimeout(500);
const v1 = await popup.evaluate(() => new Promise((r) => chrome.storage.sync.get(null, r)));
console.log("v1 storage:", JSON.stringify(v1).slice(0, 160), "...");
await ctx.close();

// 2. Upgrade in place.
fs.rmSync(slot, { recursive: true, force: true });
fs.cpSync(path.join(root, "dist/chrome"), slot, { recursive: true });
ctx = await launch();
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(6000);
popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/popup.html`);
await popup.waitForTimeout(500);
const v2 = await popup.evaluate(() => new Promise((r) => chrome.storage.sync.get(null, r)));
console.log("v2 storage:", JSON.stringify(v2));
const expectLight = v1.themeVars?.["--interactive-bg-accent-default"];
const pass = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"} ${name}`); ok &&= cond; };
pass("accent carried over", v2.settings?.light === expectLight);
pass("background theme became a tint", v2.settings?.tint > 0);
pass("v1 keys cleaned up", !("themeVars" in v2));
const fill = await page.evaluate(() => {
  const css = document.getElementById("chatgpt-accents-for-all")?.textContent || "";
  return css.includes("--x1e4keym") ? getComputedStyle(document.documentElement).getPropertyValue("--x1e4keym").trim() : css.slice(0, 80);
});
pass(`page painted with migrated colour (${fill})`, fill.includes(expectLight));
await popup.screenshot({ path: path.join(root, "dist/upgrade-popup.png") });
await ctx.close();
fs.rmSync(profile, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
