// The named themes from the original popup (1.x), with their original colours.
// Each one is a complete look: every role is chosen independently. `surface` is the
// page background the theme was designed on (see theme.js `surfaceSpec` for how that
// maps onto light and dark mode); `link` is an optional separate link colour.
//
//   accent      accent colour: links, accent-coloured text and icons
//   bubbleBg    user message bubble background      bubbleText  its text
//   submitBg    send button background              submitText  its icon/label
export const THEMES = [
  { id: "blue", name: "Blue", accent: "#1d74ff", bubbleBg: "#0b3a7a", bubbleText: "#e6f0ff", submitBg: "#0b5fff", submitText: "#ffffff" },
  { id: "green", name: "Green", accent: "#16a34a", bubbleBg: "#064e3b", bubbleText: "#d1fae5", submitBg: "#0f9d58", submitText: "#ffffff" },
  { id: "yellow", name: "Yellow", accent: "#f59e0b", bubbleBg: "#78350f", bubbleText: "#fff7ed", submitBg: "#d97706", submitText: "#0b0b0b" },
  { id: "pink", name: "Pink", accent: "#ec4899", bubbleBg: "#831843", bubbleText: "#fce7f3", submitBg: "#db2777", submitText: "#ffffff" },
  { id: "orange", name: "Orange", accent: "#f97316", bubbleBg: "#7c2d12", bubbleText: "#ffedd5", submitBg: "#ea580c", submitText: "#111111" },
  { id: "purple_plus", name: "Purple", badge: "plus", accent: "#8b5cf6", bubbleBg: "#3b0764", bubbleText: "#f3e8ff", submitBg: "#7c3aed", submitText: "#ffffff" },
  { id: "black_pro", name: "Black", badge: "pro", accent: "#111213", bubbleBg: "#0b0b0c", bubbleText: "#ededed", submitBg: "#151516", submitText: "#f5f5f5" },
  { id: "slate", name: "Slate", accent: "#64748b", bubbleBg: "#111827", bubbleText: "#e5e7eb", submitBg: "#374151", submitText: "#ffffff" },
  { id: "indigo", name: "Indigo", accent: "#6366f1", bubbleBg: "#1e1b4b", bubbleText: "#e0e7ff", submitBg: "#4f46e5", submitText: "#ffffff" },
  { id: "teal", name: "Teal", accent: "#14b8a6", bubbleBg: "#064e4e", bubbleText: "#ccfbf1", submitBg: "#0d9488", submitText: "#ffffff" },
  { id: "emerald", name: "Emerald", accent: "#10b981", bubbleBg: "#064e3b", bubbleText: "#d1fae5", submitBg: "#059669", submitText: "#ffffff" },
  { id: "sky", name: "Sky", accent: "#0ea5e9", bubbleBg: "#0c4a6e", bubbleText: "#e0f2fe", submitBg: "#0284c7", submitText: "#ffffff" },
  { id: "rose", name: "Rose", accent: "#f43f5e", bubbleBg: "#7f1d1d", bubbleText: "#ffe4e6", submitBg: "#e11d48", submitText: "#ffffff" },
  { id: "magenta", name: "Magenta", accent: "#d946ef", bubbleBg: "#581c87", bubbleText: "#f5d0fe", submitBg: "#a21caf", submitText: "#ffffff" },
  { id: "sunset", name: "Sunset", accent: "#fb7185", bubbleBg: "#7c2d12", bubbleText: "#fde2e4", submitBg: "#f97316", submitText: "#111111" },
  { id: "mint", name: "Mint", accent: "#34d399", bubbleBg: "#064e3b", bubbleText: "#d1fae5", submitBg: "#10b981", submitText: "#ffffff" },
  { id: "grape", name: "Grape", accent: "#a78bfa", bubbleBg: "#3b0764", bubbleText: "#f3e8ff", submitBg: "#8b5cf6", submitText: "#ffffff" },
  { id: "copper", name: "Copper", accent: "#f59e0b", bubbleBg: "#3f1d0b", bubbleText: "#ffedd5", submitBg: "#d97706", submitText: "#0b0b0b" },
  { id: "crimson", name: "Crimson", accent: "#ef4444", bubbleBg: "#7f1d1d", bubbleText: "#fee2e2", submitBg: "#b91c1c", submitText: "#ffffff" },
  { id: "cobalt", name: "Cobalt", accent: "#2563eb", bubbleBg: "#0c3262", bubbleText: "#dbeafe", submitBg: "#1d4ed8", submitText: "#ffffff" },
  { id: "lime", name: "Lime", accent: "#84cc16", bubbleBg: "#365314", bubbleText: "#ecfccb", submitBg: "#65a30d", submitText: "#111111" },
  { id: "saffron", name: "Saffron", accent: "#eab308", bubbleBg: "#4d3b00", bubbleText: "#fff7cc", submitBg: "#ca8a04", submitText: "#111111" },
  { id: "fuchsia", name: "Fuchsia", accent: "#e879f9", bubbleBg: "#701a75", bubbleText: "#fdf4ff", submitBg: "#c026d3", submitText: "#ffffff" },
  { id: "graphite", name: "Graphite", accent: "#6b7280", bubbleBg: "#111827", bubbleText: "#e5e7eb", submitBg: "#475569", submitText: "#ffffff", surface: "#0f172a" },
  { id: "ocean", name: "Ocean", accent: "#2dd4bf", bubbleBg: "#073642", bubbleText: "#e0fbfc", submitBg: "#0ea5a4", submitText: "#002b36", link: "#38bdf8", surface: "#0b1f26" },
  { id: "solar", name: "Solarized", accent: "#b58900", bubbleBg: "#073642", bubbleText: "#eee8d5", submitBg: "#b58900", submitText: "#002b36", link: "#268bd2", surface: "#002b36" },
  { id: "mocha", name: "Mocha", accent: "#d6b28d", bubbleBg: "#3b2f2a", bubbleText: "#fff7ed", submitBg: "#7a5c49", submitText: "#ffffff", surface: "#221b18" },
  { id: "forest", name: "Forest", accent: "#22c55e", bubbleBg: "#052e1c", bubbleText: "#d1fae5", submitBg: "#15803d", submitText: "#ffffff", surface: "#0a1a12" },
  { id: "void", name: "Void", accent: "#9333ea", bubbleBg: "#1e1b4b", bubbleText: "#e0e7ff", submitBg: "#7c3aed", submitText: "#ffffff", surface: "#0f0f23" },
  { id: "arctic", name: "Arctic", accent: "#0284c7", bubbleBg: "#0c4a6e", bubbleText: "#e0f2fe", submitBg: "#0369a1", submitText: "#ffffff", surface: "#0a1929" },
  { id: "ember", name: "Ember", accent: "#dc2626", bubbleBg: "#7f1d1d", bubbleText: "#fecaca", submitBg: "#b91c1c", submitText: "#ffffff", surface: "#1a0606" },
  { id: "neon", name: "Neon", accent: "#06ffa5", bubbleBg: "#064e3b", bubbleText: "#ccfbf1", submitBg: "#00d084", submitText: "#000000", surface: "#051f1a" },
  { id: "miami", name: "Miami", accent: "#22d3ee", bubbleBg: "#3b0d47", bubbleText: "#fdf4ff", submitBg: "#e11d48", submitText: "#ffffff", link: "#22d3ee", surface: "#0d1320" },
  { id: "black_bg", name: "Obsidian", accent: "#111213", bubbleBg: "#0b0b0c", bubbleText: "#ededed", submitBg: "#151516", submitText: "#f5f5f5", surface: "#0f0f10" },
  { id: "midnight", name: "Midnight", accent: "#3b82f6", bubbleBg: "#0b2948", bubbleText: "#dbeafe", submitBg: "#1e3a8a", submitText: "#ffffff", surface: "#0a0f1a" },
  { id: "carbon", name: "Carbon", accent: "#9ca3af", bubbleBg: "#1f2937", bubbleText: "#e5e7eb", submitBg: "#374151", submitText: "#ffffff", surface: "#0d0d0d" },
  { id: "aurora", name: "Aurora", accent: "#86efac", bubbleBg: "#064e3b", bubbleText: "#d1fae5", submitBg: "#059669", submitText: "#ffffff", surface: "#081a18" },
  { id: "cosmos", name: "Cosmos", accent: "#a78bfa", bubbleBg: "#312e81", bubbleText: "#e0e7ff", submitBg: "#6d28d9", submitText: "#ffffff", surface: "#0f1025" },
  { id: "nightowl", name: "Night Owl", accent: "#22d3ee", bubbleBg: "#0e7490", bubbleText: "#cffafe", submitBg: "#155e75", submitText: "#ffffff", surface: "#0b1214" },
  { id: "synthwave", name: "Synthwave", accent: "#ff0080", bubbleBg: "#1a0033", bubbleText: "#ff66cc", submitBg: "#cc0066", submitText: "#ffffff", link: "#00ffff", surface: "#0a0014" },
  { id: "cyberpunk", name: "Cyberpunk", accent: "#00ff41", bubbleBg: "#001a0d", bubbleText: "#00ff41", submitBg: "#00cc33", submitText: "#000000", link: "#00ffff", surface: "#000a04" },
  { id: "vaporwave", name: "Vaporwave", accent: "#ff00ff", bubbleBg: "#330066", bubbleText: "#ffccff", submitBg: "#9900cc", submitText: "#ffffff", link: "#00ffff", surface: "#1a0033" },
  { id: "redwood", name: "Redwood", accent: "#8b4513", bubbleBg: "#2f1b14", bubbleText: "#f4e4c7", submitBg: "#654321", submitText: "#ffffff", surface: "#1a0f0a" },
  { id: "sage", name: "Sage", accent: "#87a96b", bubbleBg: "#2a332a", bubbleText: "#e8f5e8", submitBg: "#5d7c47", submitText: "#ffffff", surface: "#1a1f1a" },
  { id: "desert", name: "Desert", accent: "#cd853f", bubbleBg: "#3d2914", bubbleText: "#f5deb3", submitBg: "#a0651a", submitText: "#ffffff", surface: "#2d1f0a" },
  { id: "corporate", name: "Corporate", accent: "#4a90e2", bubbleBg: "#1a2332", bubbleText: "#e6f2ff", submitBg: "#2c5aa0", submitText: "#ffffff", surface: "#0f1419" },
  { id: "executive", name: "Executive", accent: "#5a6c7d", bubbleBg: "#2c3540", bubbleText: "#e8eaed", submitBg: "#3e4a59", submitText: "#ffffff", surface: "#1c2128" },
  { id: "autumn", name: "Autumn", accent: "#ff6b35", bubbleBg: "#4d1f00", bubbleText: "#ffe4cc", submitBg: "#cc4400", submitText: "#ffffff", surface: "#2d1200" },
  { id: "winter", name: "Winter", accent: "#87ceeb", bubbleBg: "#1a2f3d", bubbleText: "#e6f4ff", submitBg: "#4682b4", submitText: "#ffffff", surface: "#0f1b23" },
  { id: "gameboy", name: "Game Boy", accent: "#8bac0f", bubbleBg: "#306230", bubbleText: "#8bac0f", submitBg: "#9bbc0f", submitText: "#0f380f", surface: "#0f380f" },
  { id: "console", name: "Retro Console", accent: "#ff6b6b", bubbleBg: "#2d1b69", bubbleText: "#ffeaa7", submitBg: "#fd79a8", submitText: "#2d3436", surface: "#1e1348" },
  { id: "mono_blue", name: "Mono Blue", accent: "#3498db", bubbleBg: "#1a2832", bubbleText: "#e8f4fd", submitBg: "#2980b9", submitText: "#ffffff", surface: "#0f1419" },
  { id: "mono_red", name: "Mono Red", accent: "#e74c3c", bubbleBg: "#3d1a1a", bubbleText: "#ffe6e6", submitBg: "#c0392b", submitText: "#ffffff", surface: "#2d1010" },
  { id: "material_indigo", name: "Material Deep", accent: "#3f51b5", bubbleBg: "#1a1f2e", bubbleText: "#e8eaf6", submitBg: "#303f9f", submitText: "#ffffff", surface: "#121218" },
  { id: "material_teal", name: "Material Teal", accent: "#009688", bubbleBg: "#1a2e2a", bubbleText: "#e0f2f1", submitBg: "#00695c", submitText: "#ffffff", surface: "#0f1a18" },
  { id: "pastel_sky", name: "Pastel Sky", accent: "#7aa7ff", bubbleBg: "#eaf2ff", bubbleText: "#09223a", submitBg: "#3b82f6", submitText: "#ffffff", surface: "#f7faff" },
  { id: "pastel_mint", name: "Pastel Mint", accent: "#34d399", bubbleBg: "#d9f4e4", bubbleText: "#003716", submitBg: "#04b84c", submitText: "#ffffff", surface: "#f0fdf4" },
  { id: "pastel_peach", name: "Pastel Peach", accent: "#fb923c", bubbleBg: "#ffe7d9", bubbleText: "#4a2206", submitBg: "#fb6a22", submitText: "#ffffff", surface: "#fffaf7" },
  { id: "pastel_lavender", name: "Lavender Milk", accent: "#a78bfa", bubbleBg: "#efe5fe", bubbleText: "#2c184a", submitBg: "#924ff7", submitText: "#ffffff", surface: "#fefbff" },
  { id: "pastel_rose", name: "Soft Rose", accent: "#f472b6", bubbleBg: "#ffe8f3", bubbleText: "#4d1f34", submitBg: "#ff66ad", submitText: "#ffffff", surface: "#fffafc" },
  { id: "pastel_sand", name: "Warm Sand", accent: "#d6b28d", bubbleBg: "#fff6e0", bubbleText: "#4a3200", submitBg: "#d3995c", submitText: "#ffffff", surface: "#fffcf7" },
  { id: "porcelain", name: "Porcelain", accent: "#64748b", bubbleBg: "#eef2f7", bubbleText: "#1f2937", submitBg: "#475569", submitText: "#ffffff", surface: "#ffffff" },
  { id: "frost", name: "Frost", accent: "#38bdf8", bubbleBg: "#e0f2fe", bubbleText: "#082f49", submitBg: "#0ea5e9", submitText: "#ffffff", surface: "#f8fcff" },
  { id: "lemonade", name: "Lemonade", accent: "#facc15", bubbleBg: "#fef9c3", bubbleText: "#3b3000", submitBg: "#eab308", submitText: "#0d0d0d", surface: "#fffef5" },
  { id: "cotton_candy", name: "Cotton Candy", accent: "#fb61d1", bubbleBg: "#ffe4f0", bubbleText: "#4a1d3d", submitBg: "#ec4899", submitText: "#ffffff", surface: "#fff7fb" },
  { id: "lagoon", name: "Lagoon", accent: "#14b8a6", bubbleBg: "#d1faf5", bubbleText: "#003b35", submitBg: "#0d9488", submitText: "#ffffff", surface: "#f5fffd" },
  { id: "spring", name: "Spring Bloom", accent: "#22c55e", bubbleBg: "#dcfce7", bubbleText: "#14532d", submitBg: "#16a34a", submitText: "#ffffff", surface: "#f0fdf4" },
  { id: "cloud", name: "Cloud Nine", accent: "#6b7280", bubbleBg: "#f3f4f6", bubbleText: "#1f2937", submitBg: "#4b5563", submitText: "#ffffff", surface: "#fefefe" },
  { id: "sunrise", name: "Sunrise", accent: "#f97316", bubbleBg: "#fed7aa", bubbleText: "#7c2d12", submitBg: "#ea580c", submitText: "#ffffff", surface: "#fffbf5" },
  { id: "lavender_light", name: "Lavender Fields", accent: "#8b5cf6", bubbleBg: "#ede9fe", bubbleText: "#581c87", submitBg: "#7c3aed", submitText: "#ffffff", surface: "#faf8ff" },
  { id: "forest_light", name: "Forest Mist", accent: "#059669", bubbleBg: "#d1fae5", bubbleText: "#064e3b", submitBg: "#047857", submitText: "#ffffff", surface: "#f0fdf9" },
  { id: "cream", name: "Vanilla Cream", accent: "#92400e", bubbleBg: "#fef3c7", bubbleText: "#451a03", submitBg: "#b45309", submitText: "#ffffff", surface: "#fffef0" },
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
