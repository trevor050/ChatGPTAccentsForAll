// Captures chatgpt.com's custom-property rules (`:root` groups and `.X.X` theme
// classes) into a JSON fixture for discovery tests. Needs a visible browser.
// Usage: node scripts/capture-fixture.mjs test/fixtures/chatgpt-YYYY-MM-DD.json
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const outFile = process.argv[2];
if (!outFile) throw new Error("usage: node scripts/capture-fixture.mjs <out.json>");
const profile = path.resolve(import.meta.dirname, "../.e2e-profile");
fs.rmSync(profile, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(profile, {
  channel: "chromium", headless: false, viewport: { width: 1280, height: 800 },
  ignoreDefaultArgs: ["--enable-automation"], args: ["--disable-blink-features=AutomationControlled"],
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(6000);
const data = await page.evaluate(() => {
  const rules = [];
  let total = 0;
  const walk = (list, cond) => {
    for (const r of list) {
      total++;
      if (r.cssRules && !r.selectorText) {
        walk(r.cssRules, cond ? `${cond} and ${r.conditionText || ""}` : r.conditionText || "");
        continue;
      }
      if (!r.selectorText || !r.style || !/:root|^\.([\w-]+)\.\1/.test(r.selectorText)) continue;
      const decls = {};
      for (let i = 0; i < r.style.length; i++) {
        const p = r.style.item(i);
        if (p.startsWith("--")) decls[p] = r.style.getPropertyValue(p).trim();
      }
      if (Object.keys(decls).length) rules.push(cond ? { selector: r.selectorText, condition: cond, decls } : { selector: r.selectorText, decls });
    }
  };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules, ""); } catch { /* cross-origin */ }
  }
  return { build: document.documentElement.dataset.build, htmlClasses: document.documentElement.className.split(/\s+/), total, rules };
});
fs.writeFileSync(outFile, JSON.stringify({ capturedAt: new Date().toISOString().slice(0, 10), url: "https://chatgpt.com/ (logged out)", ...data }, null, 1));
console.log(`${data.rules.length} rules (of ${data.total}) from build ${data.build} -> ${outFile}`);
await ctx.close();
fs.rmSync(profile, { recursive: true, force: true });
