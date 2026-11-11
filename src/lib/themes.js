// The named themes. Curated on 2026-11-11 from the 72 of the 1.x popup (kept in
// themes-original.js for migration): near-duplicates merged, weak ones dropped, a
// few with character added. Every theme's bubble text and send glyph pass the
// contrast safety net on their own (tested), so they render exactly as designed.
//
//   accent      accent colour: links, accent-coloured text and icons
//   bubbleBg    user message bubble background      bubbleText  its text
//   submitBg    send button background              submitText  its icon/label
//   link        optional separate link colour
//   surface     page background the theme was designed on (see theme.js `surfaceSpec`)
//   group       which section of the popup it is listed in (THEME_GROUPS)
//   badge       "plus" / "pro": when ChatGPT added accent colours (August 2025) it kept
//               purple for paid plans (Plus and up) and black for the $200-a-month
//               Pro plan. This extension started as a way to have them free.
export const THEME_GROUPS = [
  { id: "classic", name: "Classic" },
  { id: "dark", name: "Dark" },
  { id: "light", name: "Light" },
  { id: "character", name: "Characters" },
];

export const THEMES = [
  // classic: One accent on ChatGPT's own page.
  { id: "blue", name: "Blue", accent: "#1d74ff", bubbleBg: "#0b3a7a", bubbleText: "#e6f0ff", submitBg: "#0b5fff", submitText: "#ffffff", group: "classic" },
  { id: "sky", name: "Sky", accent: "#0ea5e9", bubbleBg: "#0c4a6e", bubbleText: "#e0f2fe", submitBg: "#0284c7", submitText: "#ffffff", group: "classic" },
  { id: "teal", name: "Teal", accent: "#14b8a6", bubbleBg: "#064e4e", bubbleText: "#ccfbf1", submitBg: "#0d9488", submitText: "#ffffff", group: "classic" },
  { id: "green", name: "Green", accent: "#16a34a", bubbleBg: "#064e3b", bubbleText: "#d1fae5", submitBg: "#0f9d58", submitText: "#ffffff", group: "classic" },
  { id: "lime", name: "Lime", accent: "#84cc16", bubbleBg: "#365314", bubbleText: "#ecfccb", submitBg: "#65a30d", submitText: "#111111", group: "classic" },
  { id: "yellow", name: "Yellow", accent: "#f59e0b", bubbleBg: "#78350f", bubbleText: "#fff7ed", submitBg: "#d97706", submitText: "#0b0b0b", group: "classic" },
  { id: "orange", name: "Orange", accent: "#f97316", bubbleBg: "#7c2d12", bubbleText: "#ffedd5", submitBg: "#ea580c", submitText: "#111111", group: "classic" },
  { id: "crimson", name: "Crimson", accent: "#ef4444", bubbleBg: "#7f1d1d", bubbleText: "#fee2e2", submitBg: "#b91c1c", submitText: "#ffffff", group: "classic" },
  { id: "pink", name: "Pink", accent: "#ec4899", bubbleBg: "#831843", bubbleText: "#fce7f3", submitBg: "#db2777", submitText: "#ffffff", group: "classic" },
  { id: "magenta", name: "Magenta", accent: "#d946ef", bubbleBg: "#581c87", bubbleText: "#f5d0fe", submitBg: "#a21caf", submitText: "#ffffff", group: "classic" },
  { id: "purple_plus", name: "Purple", badge: "plus", accent: "#8b5cf6", bubbleBg: "#3b0764", bubbleText: "#f3e8ff", submitBg: "#7c3aed", submitText: "#ffffff", group: "classic" },
  { id: "black_pro", name: "Black", badge: "pro", accent: "#111213", bubbleBg: "#0b0b0c", bubbleText: "#ededed", submitBg: "#151516", submitText: "#f5f5f5", group: "classic" },
  { id: "slate", name: "Slate", accent: "#64748b", bubbleBg: "#111827", bubbleText: "#e5e7eb", submitBg: "#374151", submitText: "#ffffff", group: "classic" },
  // dark: Darker, moodier pages.
  { id: "midnight", name: "Midnight", accent: "#3b82f6", bubbleBg: "#0b2948", bubbleText: "#dbeafe", submitBg: "#1e3a8a", submitText: "#ffffff", surface: "#0a0f1a", group: "dark" },
  { id: "ocean", name: "Ocean", accent: "#2dd4bf", bubbleBg: "#073642", bubbleText: "#e0fbfc", submitBg: "#0ea5a4", submitText: "#002b36", link: "#38bdf8", surface: "#0b1f26", group: "dark" },
  { id: "forest", name: "Forest", accent: "#22c55e", bubbleBg: "#052e1c", bubbleText: "#d1fae5", submitBg: "#15803d", submitText: "#ffffff", surface: "#0a1a12", group: "dark" },
  { id: "sage", name: "Sage", accent: "#87a96b", bubbleBg: "#2a332a", bubbleText: "#e8f5e8", submitBg: "#5d7c47", submitText: "#ffffff", surface: "#1a1f1a", group: "dark" },
  { id: "mocha", name: "Mocha", accent: "#d6b28d", bubbleBg: "#3b2f2a", bubbleText: "#fff7ed", submitBg: "#7a5c49", submitText: "#ffffff", surface: "#221b18", group: "dark" },
  { id: "autumn", name: "Autumn", accent: "#ff6b35", bubbleBg: "#4d1f00", bubbleText: "#ffe4cc", submitBg: "#cc4400", submitText: "#ffffff", surface: "#2d1200", group: "dark" },
  { id: "ember", name: "Ember", accent: "#dc2626", bubbleBg: "#7f1d1d", bubbleText: "#fecaca", submitBg: "#b91c1c", submitText: "#ffffff", surface: "#1a0606", group: "dark" },
  { id: "cosmos", name: "Cosmos", accent: "#a78bfa", bubbleBg: "#312e81", bubbleText: "#e0e7ff", submitBg: "#6d28d9", submitText: "#ffffff", surface: "#0f1025", group: "dark" },
  { id: "graphite", name: "Graphite", accent: "#6b7280", bubbleBg: "#111827", bubbleText: "#e5e7eb", submitBg: "#475569", submitText: "#ffffff", surface: "#0f172a", group: "dark" },
  { id: "nord", name: "Nord", accent: "#88c0d0", bubbleBg: "#3b4252", bubbleText: "#eceff4", submitBg: "#5e81ac", submitText: "#ffffff", surface: "#2e3440", group: "dark" },
  // light: Soft, light pages.
  { id: "pastel_sky", name: "Pastel Sky", accent: "#7aa7ff", bubbleBg: "#eaf2ff", bubbleText: "#09223a", submitBg: "#3b82f6", submitText: "#ffffff", surface: "#f7faff", group: "light" },
  { id: "lagoon", name: "Lagoon", accent: "#14b8a6", bubbleBg: "#d1faf5", bubbleText: "#003b35", submitBg: "#0d9488", submitText: "#ffffff", surface: "#f5fffd", group: "light" },
  { id: "pastel_mint", name: "Pastel Mint", accent: "#34d399", bubbleBg: "#d9f4e4", bubbleText: "#003716", submitBg: "#0a8f45", submitText: "#ffffff", surface: "#f0fdf4", group: "light" },
  { id: "lemonade", name: "Lemonade", accent: "#facc15", bubbleBg: "#fef9c3", bubbleText: "#3b3000", submitBg: "#eab308", submitText: "#0d0d0d", surface: "#fffef5", group: "light" },
  { id: "sunrise", name: "Sunrise", accent: "#f97316", bubbleBg: "#fed7aa", bubbleText: "#7c2d12", submitBg: "#ea580c", submitText: "#ffffff", surface: "#fffbf5", group: "light" },
  { id: "cotton_candy", name: "Cotton Candy", accent: "#fb61d1", bubbleBg: "#ffe4f0", bubbleText: "#4a1d3d", submitBg: "#db2777", submitText: "#ffffff", surface: "#fff7fb", group: "light" },
  { id: "pastel_lavender", name: "Lavender Milk", accent: "#a78bfa", bubbleBg: "#efe5fe", bubbleText: "#2c184a", submitBg: "#924ff7", submitText: "#ffffff", surface: "#fefbff", group: "light" },
  { id: "cream", name: "Vanilla Cream", accent: "#92400e", bubbleBg: "#fef3c7", bubbleText: "#451a03", submitBg: "#b45309", submitText: "#ffffff", surface: "#fffef0", group: "light" },
  { id: "porcelain", name: "Porcelain", accent: "#64748b", bubbleBg: "#eef2f7", bubbleText: "#1f2937", submitBg: "#475569", submitText: "#ffffff", surface: "#ffffff", group: "light" },
  // character: Themes with a story.
  { id: "synthwave", name: "Synthwave", accent: "#ff0080", bubbleBg: "#1a0033", bubbleText: "#ff66cc", submitBg: "#cc0066", submitText: "#ffffff", link: "#00ffff", surface: "#0a0014", group: "character" },
  { id: "cyberpunk", name: "Cyberpunk", accent: "#00ff41", bubbleBg: "#001a0d", bubbleText: "#00ff41", submitBg: "#00cc33", submitText: "#000000", link: "#00ffff", surface: "#000a04", group: "character" },
  { id: "vaporwave", name: "Vaporwave", accent: "#ff00ff", bubbleBg: "#330066", bubbleText: "#ffccff", submitBg: "#9900cc", submitText: "#ffffff", link: "#00ffff", surface: "#1a0033", group: "character" },
  { id: "miami", name: "Miami", accent: "#22d3ee", bubbleBg: "#3b0d47", bubbleText: "#fdf4ff", submitBg: "#e11d48", submitText: "#ffffff", link: "#22d3ee", surface: "#0d1320", group: "character" },
  { id: "gameboy", name: "Game Boy", accent: "#8bac0f", bubbleBg: "#0f380f", bubbleText: "#9bbc0f", submitBg: "#9bbc0f", submitText: "#0f380f", surface: "#0b2a0b", group: "character" },
  { id: "solar", name: "Solarized", accent: "#b58900", bubbleBg: "#073642", bubbleText: "#eee8d5", submitBg: "#b58900", submitText: "#002b36", link: "#268bd2", surface: "#002b36", group: "character" },
  { id: "console", name: "Retro Console", accent: "#ff6b6b", bubbleBg: "#2d1b69", bubbleText: "#ffeaa7", submitBg: "#fd79a8", submitText: "#2d3436", surface: "#1e1348", group: "character" },
  { id: "amber", name: "Amber CRT", accent: "#ffb000", bubbleBg: "#2a1c00", bubbleText: "#ffcc66", submitBg: "#ffb000", submitText: "#1a1200", surface: "#120c00", group: "character" },
];

/** "Default" in the grid means ChatGPT's own colours (extension off). */
export const DEFAULT_THEME = { id: "default", name: "Default" };

export const THEME_IDS = new Set(THEMES.map((t) => t.id));
export const themeById = (id) => THEMES.find((t) => t.id === id) || null;

/** The stored shape of a theme's colours: what settings and saved themes hold. */
export function themeLook(theme) {
  return {
    light: theme.accent,
    dark: null,
    roles: {
      bubbleBg: theme.bubbleBg,
      bubbleText: theme.bubbleText,
      submitBg: theme.submitBg,
      submitText: theme.submitText,
      link: theme.link ?? null,
    },
    surface: theme.surface ? { kind: "custom", color: theme.surface } : { kind: "default", color: null },
  };
}

const sameHex = (a, b) => (a ?? null) === (b ?? null);

/** True when two looks have identical colours (ids, names and timestamps ignored). */
export function sameLook(a, b) {
  if (!a || !b) return false;
  const ra = a.roles || {}, rb = b.roles || {};
  const sa = a.surface || { kind: "default" }, sb = b.surface || { kind: "default" };
  return (
    sameHex(a.light, b.light) && sameHex(a.dark, b.dark) &&
    ["bubbleBg", "bubbleText", "submitBg", "submitText", "link"].every((k) => sameHex(ra[k], rb[k])) &&
    sa.kind === sb.kind && (sa.kind !== "custom" || sameHex(sa.color, sb.color))
  );
}

/** The named theme whose colours these are, if any. */
export function findTheme(look) {
  return THEMES.find((t) => sameLook(themeLook(t), look)) || null;
}

/** Is a theme's page background light or dark? Same luma cut-off as the 1.x badge. */
export function backgroundTone(theme) {
  if (!theme.surface) return null;
  const n = parseInt(theme.surface.slice(1), 16);
  const luma = 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return luma > 180 ? "light" : "dark";
}
