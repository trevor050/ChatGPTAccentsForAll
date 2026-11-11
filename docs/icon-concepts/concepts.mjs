// Icon concept explorations for the toolbar/store icon. Each concept returns an SVG for a
// given pixel size; 16 and 32 are drawn on their own pixel grid rather than scaled down.
// Delete this folder (and docs/icon-concepts.png) before merging.

import { readFileSync } from "node:fs";
import path from "node:path";

const ASSETS = path.resolve(import.meta.dirname, "../../assets/icon");

export const HUES = {
  indigo: { hi: "#a9aeff", mid: "#8288ff", lo: "#5f63e6" },
  blue: { hi: "#b5d0ff", mid: "#5b95ff", lo: "#2f68e0" },
  rose: { hi: "#ffc2d6", mid: "#f4709b", lo: "#cc4473" },
  amber: { hi: "#ffdca0", mid: "#f3a93a", lo: "#c97c12" },
  mint: { hi: "#b6f0dc", mid: "#3fcf9d", lo: "#14996c" },
};

const GROUND = "#1a1b1f";
const EDGE = "rgba(255,255,255,0.10)";

const svg = (size, body, vb = size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${vb} ${vb}">${body}</svg>`;

// Rounded square tile used by the "ground" concepts. Chrome wants 96/128 of art for squares.
const tile = (size) => {
  if (size === 16) return `<rect x="0.5" y="0.5" width="15" height="15" rx="4" fill="${GROUND}" stroke="${EDGE}"/>`;
  if (size === 32) return `<rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="${GROUND}" stroke="${EDGE}"/>`;
  if (size === 48) return `<rect x="4.5" y="4.5" width="39" height="39" rx="10" fill="${GROUND}" stroke="${EDGE}"/>`;
  return `<rect x="16.5" y="16.5" width="95" height="95" rx="24" fill="${GROUND}" stroke="${EDGE}"/>`;
};

// Speech bubble: rounded rect body + a short tail at bottom-left, as one path.
const bubblePath = (x, y, w, h, r, tail) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
  `H${x + tail * 1.6}L${x} ${y + h + tail}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;

export const CONCEPTS = [
  {
    id: 1,
    name: "Selected bubble",
    note: "Chat bubble in the accent, wrapped in the popup's selection ring.",
    draw: (s, c) => {
      if (s === 16)
        return svg(16, `<path d="${bubblePath(3, 3, 10, 8, 3, 2.5)}" fill="${c.mid}"/>` +
          `<path d="${bubblePath(1, 1, 14, 12, 5, 3)}" fill="none" stroke="${c.mid}" stroke-opacity=".45" stroke-width="1"/>`);
      if (s === 32)
        return svg(32, `<path d="${bubblePath(7, 7, 18, 14, 6, 4)}" fill="${c.mid}"/>` +
          `<path d="${bubblePath(3, 3, 26, 22, 9, 5)}" fill="none" stroke="${c.mid}" stroke-opacity=".45" stroke-width="2"/>`);
      return svg(s, `<path d="${bubblePath(34, 34, 60, 46, 18, 12)}" fill="${c.mid}"/>` +
        `<path d="${bubblePath(18, 18, 92, 78, 30, 16)}" fill="none" stroke="${c.mid}" stroke-opacity=".45" stroke-width="5"/>`, 128);
    },
  },
  {
    id: 2,
    name: "Theme card",
    note: "A tiny version of a popup theme card: dot plus three pills in one hue.",
    draw: (s, c) => {
      if (s === 16)
        return svg(16, tile(16) + `<circle cx="5" cy="5.5" r="1.5" fill="${c.mid}"/>` +
          `<rect x="3" y="9" width="10" height="3" rx="1.5" fill="${c.mid}"/>`);
      if (s === 32)
        return svg(32, tile(32) + `<circle cx="9" cy="10" r="2.5" fill="${c.mid}"/>` +
          `<rect x="6" y="17" width="6" height="5" rx="2.5" fill="${c.hi}"/><rect x="13" y="17" width="6" height="5" rx="2.5" fill="${c.lo}"/><rect x="20" y="17" width="6" height="5" rx="2.5" fill="${c.mid}"/>`);
      return svg(s, tile(128) + `<circle cx="38" cy="44" r="7" fill="${c.mid}"/>` +
        `<rect x="54" y="39" width="38" height="10" rx="5" fill="#ffffff" fill-opacity=".85"/>` +
        `<rect x="29" y="68" width="20" height="14" rx="7" fill="${c.hi}"/><rect x="54" y="68" width="20" height="14" rx="7" fill="${c.lo}"/><rect x="79" y="68" width="20" height="14" rx="7" fill="${c.mid}"/>`, 128);
    },
  },
  {
    id: 3,
    name: "Swatch bubble",
    note: "Your message bubble (tail right) made of a theme card's three swatches, light to deep. Renders the shipped assets/icon/*.svg.",
    draw: (s, c) => {
      const file = s === 16 ? "icon-16.svg" : s === 32 ? "icon-32.svg" : "icon.svg";
      return readFileSync(path.join(ASSETS, file), "utf8")
        .replace(/\bwidth="\d+"/, `width="${s}"`).replace(/\bheight="\d+"/, `height="${s}"`)
        .replaceAll("#a9aeff", c.hi).replaceAll("#8288ff", c.mid).replaceAll("#5f63e6", c.lo).replaceAll("#7479f2", c.mid);
    },
  },
  {
    id: 4,
    name: "Glow dot",
    note: "The theme dot alone on the dark popup ground, with a soft halo.",
    draw: (s, c) => {
      const g = `<radialGradient id="h"><stop offset="0" stop-color="${c.mid}" stop-opacity=".55"/><stop offset="1" stop-color="${c.mid}" stop-opacity="0"/></radialGradient>`;
      if (s === 16) return svg(16, tile(16) + `<circle cx="8" cy="8" r="3.5" fill="${c.mid}"/>`);
      if (s === 32) return svg(32, `<defs>${g}</defs>` + tile(32) + `<circle cx="16" cy="16" r="12" fill="url(#h)"/><circle cx="16" cy="16" r="6" fill="${c.mid}"/>`);
      return svg(s, `<defs>${g}</defs>` + tile(128) + `<circle cx="64" cy="64" r="42" fill="url(#h)"/><circle cx="64" cy="64" r="20" fill="${c.mid}"/><circle cx="58" cy="58" r="7" fill="#fff" fill-opacity=".25"/>`, 128);
    },
  },
  {
    id: 5,
    name: "Send pill",
    note: "A composer pill whose send circle carries the accent: the thing it recolors.",
    draw: (s, c) => {
      if (s === 16)
        return svg(16, `<rect x="0.5" y="4.5" width="15" height="7" rx="3.5" fill="${GROUND}" stroke="${EDGE}"/><circle cx="12" cy="8" r="2.5" fill="${c.mid}"/>`);
      if (s === 32)
        return svg(32, `<rect x="1.5" y="8.5" width="29" height="15" rx="7.5" fill="${GROUND}" stroke="${EDGE}"/><rect x="6" y="15" width="10" height="2" rx="1" fill="#fff" fill-opacity=".35"/><circle cx="23" cy="16" r="5" fill="${c.mid}"/>`);
      return svg(s, `<rect x="10" y="36" width="108" height="56" rx="28" fill="${GROUND}" stroke="${EDGE}" stroke-width="2"/><rect x="30" y="60" width="34" height="8" rx="4" fill="#fff" fill-opacity=".3"/><circle cx="90" cy="64" r="18" fill="${c.mid}"/>`, 128);
    },
  },
  {
    id: 6,
    name: "Your turn",
    note: "Two bubbles; only yours (right) takes the accent, like the recolored user message.",
    draw: (s, c) => {
      if (s === 16)
        return svg(16, `<rect x="0" y="1" width="9" height="6" rx="3" fill="#8a8d96"/><rect x="5" y="9" width="11" height="6" rx="3" fill="${c.mid}"/>`);
      if (s === 32)
        return svg(32, `<rect x="1" y="3" width="18" height="11" rx="5.5" fill="#8a8d96"/><rect x="10" y="18" width="21" height="11" rx="5.5" fill="${c.mid}"/>`);
      return svg(s, `<rect x="12" y="22" width="68" height="38" rx="19" fill="#8a8d96" fill-opacity=".9"/><rect x="44" y="70" width="72" height="38" rx="19" fill="${c.mid}"/>`, 128);
    },
  },
  {
    id: 7,
    name: "Accent mark",
    note: "Literal pun: an acute accent (´) in the hue, sitting on a quiet chat bubble.",
    draw: (s, c) => {
      if (s === 16)
        return svg(16, `<path d="${bubblePath(1, 6, 14, 7, 3, 2.5)}" fill="#8a8d96"/><path d="M8 4.5L12 0.5" stroke="${c.mid}" stroke-width="2.6" stroke-linecap="round"/>`);
      if (s === 32)
        return svg(32, `<path d="${bubblePath(3, 12, 26, 13, 6, 4)}" fill="#8a8d96"/><path d="M16 8.5L22.5 2.5" stroke="${c.mid}" stroke-width="4.5" stroke-linecap="round"/>`);
      return svg(s, `<path d="${bubblePath(14, 52, 100, 50, 22, 14)}" fill="#8a8d96" fill-opacity=".9"/><path d="M62 38L88 14" stroke="${c.mid}" stroke-width="16" stroke-linecap="round"/>`, 128);
    },
  },
  {
    id: 8,
    name: "Tinted bubble",
    note: "One solid bubble in the accent with a soft inner glow, on the popup's dark tile.",
    draw: (s, c) => {
      const g = `<linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.hi}"/><stop offset="1" stop-color="${c.mid}"/></linearGradient>`;
      if (s === 16) return svg(16, tile(16) + `<path d="${bubblePath(3, 3.5, 10, 7, 3, 2.5)}" fill="${c.mid}"/>`);
      if (s === 32) return svg(32, `<defs>${g}</defs>` + tile(32) + `<path d="${bubblePath(7, 8, 18, 13, 5.5, 4)}" fill="url(#t)"/>`);
      return svg(s, `<defs>${g}</defs>` + tile(128) + `<path d="${bubblePath(36, 38, 56, 42, 15, 12)}" fill="url(#t)"/>`, 128);
    },
  },
];
