// Renders every concept at 128/48/32/16 on light and dark toolbar colours into one PNG.
/* global process, console */
// Usage: node docs/icon-concepts/sheet.mjs [hue] [pick-id] [out.png]
import { chromium } from "playwright";
import path from "node:path";
import { CONCEPTS, HUES } from "./concepts.mjs";

const hue = process.argv[2] || "indigo";
const pick = Number(process.argv[3] || 0);
const out = path.resolve(process.argv[4] || path.join(import.meta.dirname, "../icon-concepts.png"));
const SIZES = [128, 48, 32, 16];
const BGS = [
  { name: "light toolbar", bg: "#f1f3f4", fg: "#3c4043" },
  { name: "dark toolbar", bg: "#35363a", fg: "#e8eaed" },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function raster(svgText, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svgText}</body></html>`);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  return `data:image/png;base64,${buf.toString("base64")}`;
}

const rows = [];
for (const c of CONCEPTS) {
  const imgs = {};
  for (const s of SIZES) imgs[s] = await raster(c.draw(s, HUES[hue]), s);
  rows.push({ c, imgs });
}

// Hue study for the picked concept.
const hueRow = [];
if (pick) {
  const c = CONCEPTS.find((x) => x.id === pick);
  for (const [name, pal] of Object.entries(HUES)) {
    hueRow.push({ name, i128: await raster(c.draw(128, pal), 128), i16: await raster(c.draw(16, pal), 16), i32: await raster(c.draw(32, pal), 32) });
  }
}

const cell = (bg, imgs) => `
  <div class="bg" style="background:${bg.bg};color:${bg.fg}">
    ${SIZES.map((s) => `<img src="${imgs[s]}" width="${s}" height="${s}">`).join("")}
    <img class="zoom" src="${imgs[16]}" width="64" height="64">
    <span class="bar">${["#8ab4f8", "#9aa0a6", "#9aa0a6"].map((col) => `<i style="background:${col}"></i>`).join("")}<img src="${imgs[16]}" width="16" height="16"><i style="background:#f28b82"></i></span>
  </div>`;

const html = `<!doctype html><html><head><style>
  body{margin:0;padding:28px;background:#0f1012;color:#e8eaed;font:14px/1.3 -apple-system,system-ui,sans-serif;width:1500px}
  h1{font-size:20px;margin:0 0 4px} p.sub{margin:0 0 20px;color:#9aa0a6}
  .row{display:grid;grid-template-columns:230px 1fr 1fr;gap:12px;align-items:stretch;margin-bottom:12px;padding:10px;border-radius:14px}
  .row.pick{outline:3px solid #fff;outline-offset:-3px;background:#1d1e22}
  .meta b{font-size:16px} .meta .n{display:inline-block;width:26px;color:#9aa0a6} .meta p{margin:6px 0 0;color:#9aa0a6}
  .pickTag{display:inline-block;margin-top:8px;background:#fff;color:#000;font-weight:700;padding:2px 8px;border-radius:6px}
  .bg{border-radius:10px;display:flex;align-items:center;gap:18px;padding:14px 16px}
  .zoom{image-rendering:pixelated;outline:1px dashed rgba(127,127,127,.5)}
  .bar{display:flex;gap:10px;align-items:center;margin-left:auto;padding:6px 10px;border-radius:8px;background:rgba(127,127,127,.12)}
  .bar i{display:block;width:14px;height:14px;border-radius:4px;opacity:.85}
  .hues{display:flex;gap:16px;margin-top:20px} .hue{background:#1d1e22;border-radius:12px;padding:12px;text-align:center}
  .hue .l,.hue .d{display:flex;gap:10px;align-items:center;justify-content:center;padding:8px;border-radius:8px;margin-top:6px}
  .hue .l{background:#f1f3f4}.hue .d{background:#35363a}
  .heads{display:grid;grid-template-columns:230px 1fr 1fr;gap:12px;color:#9aa0a6;padding:0 10px 6px}
</style></head><body>
<h1>ChatGPT Accents: icon concepts</h1>
<p class="sub">Each row: 128, 48, 32, 16 px at 1:1, then the 16 px icon zoomed 4x (pixelated), then the 16 px icon in a mock toolbar. Hue: ${hue}.${pick ? ` Pick: #${pick}.` : ""}</p>
<div class="heads"><span></span><span>On a light toolbar (#f1f3f4)</span><span>On a dark toolbar (#35363a)</span></div>
${rows.map(({ c, imgs }) => `<div class="row${c.id === pick ? " pick" : ""}">
  <div class="meta"><b><span class="n">${c.id}</span>${c.name}</b><p>${c.note}</p>${c.id === pick ? '<span class="pickTag">PICK</span>' : ""}</div>
  ${BGS.map((bg) => cell(bg, imgs)).join("")}
</div>`).join("")}
${pick ? `<h1 style="margin-top:26px">Hue study for #${pick}</h1><div class="hues">${hueRow.map((h) => `<div class="hue"><b>${h.name}</b>
  <div class="l"><img src="${h.i128}" width="64" height="64"><img src="${h.i32}" width="32"><img src="${h.i16}" width="16"></div>
  <div class="d"><img src="${h.i128}" width="64" height="64"><img src="${h.i32}" width="32"><img src="${h.i16}" width="16"></div></div>`).join("")}</div>` : ""}
</body></html>`;

await page.setViewportSize({ width: 1556, height: 800 });
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("wrote", out);
