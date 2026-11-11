// Upgrade check: install v1.1.0 (from git), pick a theme in its popup, then swap in
// the current build at the same path (same extension ID and storage) and confirm the
// user's colour survives the migration. Needs a visible browser, like e2e-live.
// Usage: npm run build && node scripts/e2e-upgrade.mjs [v1-ref]
import { execFileSync } from "node:child_process";
import { launchWithExtension } from "./launch.mjs";
import { pickTheme } from "./popup-helpers.mjs";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ref = process.argv[2] || "13f2f89"; // last v1.1.0 commit on main
const slot = path.join(root, "dist/upgrade-slot");
fs.rmSync(slot, { recursive: true, force: true });
fs.mkdirSync(slot, { recursive: true });
for (const f of ["manifest.json", "content.js", "popup.html", "popup.js"]) {
  fs.writeFileSync(path.join(slot, f), execFileSync("git", ["show", `${ref}:${f}`], { cwd: root }));
}
const launch = (fresh) => launchWithExtension(slot, { profileName: ".e2e-profile-upgrade", viewport: { width: 1280, height: 800 }, fresh });

let ok = true;
// 1. v1: choose the "Ocean" preset through the old popup UI.
let { ctx, extId, close } = await launch(true);
let popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/popup.html`);
await pickTheme(popup, "ocean");
await popup.waitForTimeout(500);
const v1 = await popup.evaluate(() => new Promise((r) => chrome.storage.sync.get(null, r)));
console.log("v1 storage:", JSON.stringify(v1).slice(0, 160), "...");
await close({ keep: true });

// 2. Upgrade in place.
fs.rmSync(slot, { recursive: true, force: true });
fs.cpSync(path.join(root, "dist/chrome"), slot, { recursive: true });
({ ctx, extId, close } = await launch(false));
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(6000);
popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/popup.html`);
await popup.waitForTimeout(500);
const v2 = await popup.evaluate(() => new Promise((r) => chrome.storage.sync.get(null, r)));
console.log("v2 storage:", JSON.stringify(v2));
const expectLight = v1.themeVars?.["--interactive-bg-accent-default"];
const expectSubmit = v1.themeVars?.["--theme-submit-btn-bg"];
const pass = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"} ${name}`); ok &&= cond; };
pass("accent carried over", v2.settings?.light === expectLight);
pass("comes back as the same named theme", v2.settings?.theme === "ocean");
pass("all five colours carried over", v2.settings?.roles?.bubbleBg === "#073642" && v2.settings?.roles?.submitBg === expectSubmit && v2.settings?.roles?.submitText === "#002b36");
pass("background theme became a surface", v2.settings?.surface?.kind === "custom");
pass("v1 keys cleaned up", !("themeVars" in v2));
pass("popup shows that theme selected", await popup.locator('.theme[data-id="ocean"][aria-checked="true"]').count() === 1);
const fill = await page.evaluate(() => {
  const css = document.getElementById("chatgpt-accents-for-all")?.textContent || "";
  return css.includes("--x1e4keym") ? getComputedStyle(document.documentElement).getPropertyValue("--x1e4keym").trim() : css.slice(0, 80);
});
pass(`page painted with the migrated send-button colour (${fill})`, fill.includes(expectSubmit));
await popup.screenshot({ path: path.join(root, "dist/upgrade-popup.png") });
await close();
process.exit(ok ? 0 : 1);
