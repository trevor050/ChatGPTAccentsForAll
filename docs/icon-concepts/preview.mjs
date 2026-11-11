// Large preview of the shipped icon. Usage: node docs/icon-concepts/preview.mjs out.png
/* global process */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
const icons = path.resolve(import.meta.dirname, "../../src/icons");
const big = fs.readFileSync(path.resolve(import.meta.dirname, "../../assets/icon/icon.svg"), "utf8").replace(/width="128"/, 'width="384"').replace(/height="128"/, 'height="384"');
const png = (s) => "data:image/png;base64," + fs.readFileSync(path.join(icons, `icon-${s}.png`)).toString("base64");
const toolbar = (bg, fg, field) => `<div style="background:${bg};display:flex;align-items:center;gap:12px;padding:8px 14px;border-radius:10px;width:560px">
  <div style="flex:1;height:30px;border-radius:15px;background:${field};color:${fg};font:13px system-ui;display:flex;align-items:center;padding:0 14px;opacity:.9">chatgpt.com</div>
  <span style="width:16px;height:16px;border-radius:3px;background:#8ab4f8"></span><span style="width:16px;height:16px;border-radius:50%;background:#9aa0a6"></span>
  <img src="${png(16)}" width="16" height="16"><span style="width:16px;height:16px;border-radius:3px;background:#f28b82"></span></div>`;
const side = (bg, fg) => `<div style="background:${bg};border-radius:18px;padding:28px;display:flex;flex-direction:column;gap:22px;align-items:center;color:${fg}">
  ${big}
  <div style="display:flex;gap:22px;align-items:flex-end">${[128, 48, 32, 16].map((s) => `<img src="${png(s)}" width="${s}" height="${s}">`).join("")}
    <img src="${png(32)}" width="96" height="96" style="image-rendering:pixelated"><img src="${png(16)}" width="96" height="96" style="image-rendering:pixelated"></div>
  ${toolbar(bg === "#ffffff" ? "#f1f3f4" : "#35363a", fg, bg === "#ffffff" ? "#ffffff" : "#202124")}</div>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1360, height: 700 } });
await p.setContent(`<body style="margin:0;padding:24px;background:#0f1012;display:flex;gap:24px;font:14px system-ui">${side("#ffffff", "#3c4043")}${side("#202124", "#e8eaed")}</body>`);
await p.screenshot({ path: process.argv[2], fullPage: true }); await b.close();
