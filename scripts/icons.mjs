// Renders the extension icon at every size the stores need. Dev-only; output is committed.
// Usage: node scripts/icons.mjs   (needs Playwright's Chromium)
import { chromium } from "playwright";
import path from "node:path";

const out = path.resolve(import.meta.dirname, "../src/icons");
const html = (size) => `<!doctype html><html><body style="margin:0;background:transparent">
<div style="width:${size}px;height:${size}px;border-radius:${size * 0.24}px;background:#111214;display:grid;place-items:center">
  <div style="width:${size * 0.62}px;height:${size * 0.62}px;border-radius:50%;
    background:conic-gradient(from 200deg,#2563eb,#7c3aed,#db2777,#f97316,#eab308,#10b981,#0ea5e9,#2563eb);
    box-shadow:inset 0 0 0 ${Math.max(1, size * 0.07)}px rgba(255,255,255,.92)"></div>
</div></body></html>`;

const browser = await chromium.launch();
for (const size of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(html(size));
  await page.screenshot({ path: path.join(out, `icon-${size}.png`), omitBackground: true });
  await page.close();
}
await browser.close();
console.log("icons written to", out);
