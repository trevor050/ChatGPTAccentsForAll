// ===== Color helpers =====
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function rgbToHex({ r, g, b }) {
  return (
    "#" +
    [r, g, b]
      .map(v => Math.max(0, Math.min(255, v)))
      .map(v => v.toString(16).padStart(2, "0"))
      .join("")
  );
}
function shade(hex, pct) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const f = pct / 100;
  return rgbToHex({
    r: Math.round(rgb.r + (255 - rgb.r) * f),
    g: Math.round(rgb.g + (255 - rgb.g) * f),
    b: Math.round(rgb.b + (255 - rgb.b) * f)
  });
}

// Quick color parsers for contrast decisions
function parseColorToRgb(color) {
  if (!color) return null;
  const hexMatch = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})([\da-f]{2})?$/i.exec(color.trim());
  if (hexMatch) {
    return { r: parseInt(hexMatch[1], 16), g: parseInt(hexMatch[2], 16), b: parseInt(hexMatch[3], 16) };
  }
  const mRgb = /rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
  if (mRgb) return { r: +mRgb[1], g: +mRgb[2], b: +mRgb[3] };
  return null;
}

function pickReadableText(surfaceColor) {
  const rgb = parseColorToRgb(surfaceColor);
  if (!rgb) return null;
  const luma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return luma > 180 ? "#0d0d0d" : "#ffffff";
}

// ===== Theme building =====
function buildVarsFromCore(core) {
  const accent = core.accent;
  const userBg = core.userBg;
  const userText = core.userText;
  const submitBg = core.submitBg;
  const submitText = core.submitText;

  const hover = shade(accent, -8);
  const press = shade(accent, -16);
  const mutedHover = shade(accent, -40);
  const mutedPress = shade(accent, -34);

  // We intentionally avoid overriding app text tokens to keep native light/dark.

  const base = {
    "--interactive-bg-accent-default": accent,
    "--interactive-bg-accent-hover": hover,
    "--interactive-bg-accent-press": press,
    "--interactive-bg-accent-inactive": accent,
    "--interactive-bg-accent-selected": accent,
    "--interactive-bg-accent-muted-hover": mutedHover,
    "--interactive-bg-accent-muted-press": mutedPress,

    "--composer-blue-bg": accent,
    "--composer-blue-hover": hover,

    "--theme-user-msg-bg": userBg,
    "--theme-user-msg-text": userText,

    "--theme-submit-btn-bg": submitBg,
    // Intentionally omit submit button text override to avoid global text changes

    "--theme-secondary-btn-bg": mutedHover,
    // Omit secondary btn text override
  };
  return core.extras ? { ...base, ...core.extras } : base;
}

function buildVarsFromInputs() {
  const accent = document.getElementById("accent").value || "#66b5ff";
  const userBg = document.getElementById("userBg").value || "#003f7a";
  const userText = document.getElementById("userText").value || "#f5faff";
  const submitBg = document.getElementById("submitBg").value || "#0169cc";
  const submitText = document.getElementById("submitText").value || "#ffffff";
  const extras = getSurfaceExtrasFromUI();
  return buildVarsFromCore({ accent, userBg, userText, submitBg, submitText, extras });
}

// ===== Preset themes =====
// Includes built-in: Default, Blue, Green, Yellow, Pink, Orange, Purple (Plus), Black (Pro)
// And extra curated themes.
const PRESETS = [
  // 1) Non-background (accent-only) — keep original list first
  // Required order (matches ChatGPT accent menu)
  { id: "reset", name: "Default", reset: true, badge: null },
  { id: "blue", name: "Blue", accent: "#1d74ff", userBg: "#0b3a7a", userText: "#e6f0ff", submitBg: "#0b5fff", submitText: "#ffffff" },
  { id: "green", name: "Green", accent: "#16a34a", userBg: "#064e3b", userText: "#d1fae5", submitBg: "#0f9d58", submitText: "#ffffff" },
  { id: "yellow", name: "Yellow", accent: "#f59e0b", userBg: "#78350f", userText: "#fff7ed", submitBg: "#d97706", submitText: "#0b0b0b" },
  { id: "pink", name: "Pink", accent: "#ec4899", userBg: "#831843", userText: "#fce7f3", submitBg: "#db2777", submitText: "#ffffff" },
  { id: "orange", name: "Orange", accent: "#f97316", userBg: "#7c2d12", userText: "#ffedd5", submitBg: "#ea580c", submitText: "#111111" },
  { id: "purple_plus", name: "Purple", badge: "plus", accent: "#8b5cf6", userBg: "#3b0764", userText: "#f3e8ff", submitBg: "#7c3aed", submitText: "#ffffff" },
  // Black (no BG) — Pro badge
  { id: "black_pro", name: "Black", badge: "pro", accent: "#111213", userBg: "#0b0b0c", userText: "#ededed", submitBg: "#151516", submitText: "#f5f5f5" },

  // Non-BG curated
  { id: "slate", name: "Slate", accent: "#64748b", userBg: "#111827", userText: "#e5e7eb", submitBg: "#374151", submitText: "#ffffff" },
  { id: "indigo", name: "Indigo", accent: "#6366f1", userBg: "#1e1b4b", userText: "#e0e7ff", submitBg: "#4f46e5", submitText: "#ffffff" },
  { id: "teal", name: "Teal", accent: "#14b8a6", userBg: "#064e4e", userText: "#ccfbf1", submitBg: "#0d9488", submitText: "#ffffff" },
  { id: "emerald", name: "Emerald", accent: "#10b981", userBg: "#064e3b", userText: "#d1fae5", submitBg: "#059669", submitText: "#ffffff" },
  { id: "sky", name: "Sky", accent: "#0ea5e9", userBg: "#0c4a6e", userText: "#e0f2fe", submitBg: "#0284c7", submitText: "#ffffff" },
  { id: "rose", name: "Rose", accent: "#f43f5e", userBg: "#7f1d1d", userText: "#ffe4e6", submitBg: "#e11d48", submitText: "#ffffff" },
  { id: "magenta", name: "Magenta", accent: "#d946ef", userBg: "#581c87", userText: "#f5d0fe", submitBg: "#a21caf", submitText: "#ffffff" },
  { id: "sunset", name: "Sunset", accent: "#fb7185", userBg: "#7c2d12", userText: "#fde2e4", submitBg: "#f97316", submitText: "#111111" },
  { id: "mint", name: "Mint", accent: "#34d399", userBg: "#064e3b", userText: "#d1fae5", submitBg: "#10b981", submitText: "#ffffff" },
  { id: "grape", name: "Grape", accent: "#a78bfa", userBg: "#3b0764", userText: "#f3e8ff", submitBg: "#8b5cf6", submitText: "#ffffff" },
  { id: "copper", name: "Copper", accent: "#f59e0b", userBg: "#3f1d0b", userText: "#ffedd5", submitBg: "#d97706", submitText: "#0b0b0b" },

  // New accent-only curated
  { id: "crimson", name: "Crimson", accent: "#ef4444", userBg: "#7f1d1d", userText: "#fee2e2", submitBg: "#b91c1c", submitText: "#ffffff" },
  { id: "cobalt", name: "Cobalt", accent: "#2563eb", userBg: "#0c3262", userText: "#dbeafe", submitBg: "#1d4ed8", submitText: "#ffffff" },
  { id: "lime", name: "Lime", accent: "#84cc16", userBg: "#365314", userText: "#ecfccb", submitBg: "#65a30d", submitText: "#111111" },
  { id: "saffron", name: "Saffron", accent: "#eab308", userBg: "#4d3b00", userText: "#fff7cc", submitBg: "#ca8a04", submitText: "#111111" },
  { id: "fuchsia", name: "Fuchsia", accent: "#e879f9", userBg: "#701a75", userText: "#fdf4ff", submitBg: "#c026d3", submitText: "#ffffff" },

  // 2) Dark background themes (all BG dark grouped)
  { id: "graphite", name: "Graphite", accent: "#6b7280", userBg: "#111827", userText: "#e5e7eb", submitBg: "#475569", submitText: "#ffffff",
    extras: { "--bg-primary": "#0f172a", "--bg-secondary": "#111827", "--message-surface": "#1f2937d9", "--bg-elevated-secondary": "#111827", "--main-surface-primary": "#0f172a" }, bgTone: "dark" },
  { id: "ocean", name: "Ocean", accent: "#2dd4bf", userBg: "#073642", userText: "#e0fbfc", submitBg: "#0ea5a4", submitText: "#002b36",
    extras: { "--bg-primary": "#0b1f26", "--bg-secondary": "#0f2730", "--message-surface": "rgba(16,49,58,0.85)", "--link": "#38bdf8", "--link-hover": "#7dd3fc", "--bg-elevated-secondary": "#0f2730", "--main-surface-primary": "#0b1f26" }, bgTone: "dark" },
  { id: "solar", name: "Solarized", accent: "#b58900", userBg: "#073642", userText: "#eee8d5", submitBg: "#b58900", submitText: "#002b36",
    extras: { "--bg-primary": "#002b36", "--bg-secondary": "#073642", "--message-surface": "rgba(15,57,68,0.85)", "--link": "#268bd2", "--link-hover": "#409ad9", "--bg-elevated-secondary": "#073642", "--main-surface-primary": "#002b36" }, bgTone: "dark" },
  { id: "mocha", name: "Mocha", accent: "#d6b28d", userBg: "#3b2f2a", userText: "#fff7ed", submitBg: "#7a5c49", submitText: "#ffffff",
    extras: { "--bg-primary": "#221b18", "--bg-secondary": "#2a231f", "--message-surface": "rgba(51,42,38,0.85)", "--bg-elevated-secondary": "#2a231f", "--main-surface-primary": "#221b18" }, bgTone: "dark" },
  { id: "forest", name: "Forest", accent: "#22c55e", userBg: "#052e1c", userText: "#d1fae5", submitBg: "#15803d", submitText: "#ffffff",
    extras: { "--bg-primary": "#0a1a12", "--bg-secondary": "#0f2419", "--message-surface": "rgba(18,48,33,0.85)", "--bg-elevated-secondary": "#0f2419", "--main-surface-primary": "#0a1a12" }, bgTone: "dark" },
  { id: "void", name: "Void", accent: "#9333ea", userBg: "#1e1b4b", userText: "#e0e7ff", submitBg: "#7c3aed", submitText: "#ffffff",
    extras: { "--bg-primary": "#0f0f23", "--bg-secondary": "#1a1a3a", "--message-surface": "rgba(30,30,66,0.85)", "--bg-elevated-secondary": "#151534", "--main-surface-primary": "#0f0f23" }, bgTone: "dark" },
  { id: "arctic", name: "Arctic", accent: "#0284c7", userBg: "#0c4a6e", userText: "#e0f2fe", submitBg: "#0369a1", submitText: "#ffffff",
    extras: { "--bg-primary": "#0a1929", "--bg-secondary": "#0f1e33", "--message-surface": "rgba(20,35,59,0.8)", "--bg-elevated-secondary": "#10243d", "--main-surface-primary": "#0a1929" }, bgTone: "dark" },
  { id: "ember", name: "Ember", accent: "#dc2626", userBg: "#7f1d1d", userText: "#fecaca", submitBg: "#b91c1c", submitText: "#ffffff",
    extras: { "--bg-primary": "#1a0606", "--bg-secondary": "#2a0a0a", "--message-surface": "rgba(59,15,15,0.8)", "--bg-elevated-secondary": "#2a0a0a", "--main-surface-primary": "#1a0606" }, bgTone: "dark" },
  { id: "neon", name: "Neon", accent: "#06ffa5", userBg: "#064e3b", userText: "#ccfbf1", submitBg: "#00d084", submitText: "#000000",
    extras: { "--bg-primary": "#051f1a", "--bg-secondary": "#082f24", "--message-surface": "rgba(10,61,48,0.85)", "--bg-elevated-secondary": "#0d3b2f", "--main-surface-primary": "#051f1a" }, bgTone: "dark" },
  { id: "miami", name: "Miami", accent: "#22d3ee", userBg: "#3b0d47", userText: "#fdf4ff", submitBg: "#e11d48", submitText: "#ffffff",
    extras: { "--bg-primary": "#0d1320", "--bg-secondary": "#131a2a", "--message-surface": "#1b2033cc", "--link": "#22d3ee", "--link-hover": "#67e8f9" }, bgTone: "dark" },
  { id: "black_bg", name: "Obsidian", accent: "#111213", userBg: "#0b0b0c", userText: "#ededed", submitBg: "#151516", submitText: "#f5f5f5",
    extras: { "--bg-primary": "#0f0f10", "--bg-secondary": "#141416", "--bg-tertiary": "#18181b", "--message-surface": "rgba(35,35,38,0.85)", "--main-surface-primary": "#0f0f10", "--bg-elevated-secondary": "#141416" }, bgTone: "dark" },
  { id: "midnight", name: "Midnight", accent: "#3b82f6", userBg: "#0b2948", userText: "#dbeafe", submitBg: "#1e3a8a", submitText: "#ffffff",
    extras: { "--bg-primary": "#0a0f1a", "--bg-secondary": "#0e1624", "--message-surface": "rgba(18,27,43,0.85)", "--bg-elevated-secondary": "#0e1624", "--main-surface-primary": "#0a0f1a" }, bgTone: "dark" },
  { id: "carbon", name: "Carbon", accent: "#9ca3af", userBg: "#1f2937", userText: "#e5e7eb", submitBg: "#374151", submitText: "#ffffff",
    extras: { "--bg-primary": "#0d0d0d", "--bg-secondary": "#141416", "--message-surface": "rgba(34,34,38,0.85)", "--bg-elevated-secondary": "#141416", "--main-surface-primary": "#0d0d0d" }, bgTone: "dark" },
  { id: "aurora", name: "Aurora", accent: "#86efac", userBg: "#064e3b", userText: "#d1fae5", submitBg: "#059669", submitText: "#ffffff",
    extras: { "--bg-primary": "#081a18", "--bg-secondary": "#0c231f", "--message-surface": "rgba(10,58,46,0.80)", "--bg-elevated-secondary": "#0c231f", "--main-surface-primary": "#081a18" }, bgTone: "dark" },
  { id: "cosmos", name: "Cosmos", accent: "#a78bfa", userBg: "#312e81", userText: "#e0e7ff", submitBg: "#6d28d9", submitText: "#ffffff",
    extras: { "--bg-primary": "#0f1025", "--bg-secondary": "#17183a", "--message-surface": "rgba(32,33,70,0.85)", "--bg-elevated-secondary": "#17183a", "--main-surface-primary": "#0f1025" }, bgTone: "dark" },
  { id: "nightowl", name: "Night Owl", accent: "#22d3ee", userBg: "#0e7490", userText: "#cffafe", submitBg: "#155e75", submitText: "#ffffff",
    extras: { "--bg-primary": "#0b1214", "--bg-secondary": "#0f1a1d", "--message-surface": "rgba(19,38,43,0.80)", "--bg-elevated-secondary": "#0f1a1d", "--main-surface-primary": "#0b1214" }, bgTone: "dark" },
  // Extra dark BG additions
  { id: "synthwave", name: "Synthwave", accent: "#ff0080", userBg: "#1a0033", userText: "#ff66cc", submitBg: "#cc0066", submitText: "#ffffff",
    extras: { "--bg-primary": "#0a0014", "--bg-secondary": "#1a0033", "--message-surface": "rgba(26,0,51,0.85)", "--link": "#00ffff", "--link-hover": "#ff0080", "--bg-elevated-secondary": "#1a0033", "--main-surface-primary": "#0a0014" }, bgTone: "dark" },
  { id: "cyberpunk", name: "Cyberpunk", accent: "#00ff41", userBg: "#001a0d", userText: "#00ff41", submitBg: "#00cc33", submitText: "#000000",
    extras: { "--bg-primary": "#000a04", "--bg-secondary": "#001a0d", "--message-surface": "rgba(0,26,13,0.85)", "--link": "#00ffff", "--link-hover": "#00ff41", "--bg-elevated-secondary": "#001a0d", "--main-surface-primary": "#000a04" }, bgTone: "dark" },
  { id: "vaporwave", name: "Vaporwave", accent: "#ff00ff", userBg: "#330066", userText: "#ffccff", submitBg: "#9900cc", submitText: "#ffffff",
    extras: { "--bg-primary": "#1a0033", "--bg-secondary": "#330066", "--message-surface": "rgba(51,0,102,0.80)", "--link": "#00ffff", "--link-hover": "#ff00ff", "--bg-elevated-secondary": "#330066", "--main-surface-primary": "#1a0033" }, bgTone: "dark" },
  { id: "redwood", name: "Redwood", accent: "#8b4513", userBg: "#2f1b14", userText: "#f4e4c7", submitBg: "#654321", submitText: "#ffffff",
    extras: { "--bg-primary": "#1a0f0a", "--bg-secondary": "#2f1b14", "--message-surface": "rgba(47,27,20,0.85)", "--bg-elevated-secondary": "#2f1b14", "--main-surface-primary": "#1a0f0a" }, bgTone: "dark" },
  { id: "sage", name: "Sage", accent: "#87a96b", userBg: "#2a332a", userText: "#e8f5e8", submitBg: "#5d7c47", submitText: "#ffffff",
    extras: { "--bg-primary": "#1a1f1a", "--bg-secondary": "#2a332a", "--message-surface": "rgba(42,51,42,0.85)", "--bg-elevated-secondary": "#2a332a", "--main-surface-primary": "#1a1f1a" }, bgTone: "dark" },
  { id: "desert", name: "Desert", accent: "#cd853f", userBg: "#3d2914", userText: "#f5deb3", submitBg: "#a0651a", submitText: "#ffffff",
    extras: { "--bg-primary": "#2d1f0a", "--bg-secondary": "#3d2914", "--message-surface": "rgba(61,41,20,0.85)", "--bg-elevated-secondary": "#3d2914", "--main-surface-primary": "#2d1f0a" }, bgTone: "dark" },
  { id: "corporate", name: "Corporate", accent: "#4a90e2", userBg: "#1a2332", userText: "#e6f2ff", submitBg: "#2c5aa0", submitText: "#ffffff",
    extras: { "--bg-primary": "#0f1419", "--bg-secondary": "#1a2332", "--message-surface": "rgba(26,35,50,0.85)", "--bg-elevated-secondary": "#1a2332", "--main-surface-primary": "#0f1419" }, bgTone: "dark" },
  { id: "executive", name: "Executive", accent: "#5a6c7d", userBg: "#2c3540", userText: "#e8eaed", submitBg: "#3e4a59", submitText: "#ffffff",
    extras: { "--bg-primary": "#1c2128", "--bg-secondary": "#2c3540", "--message-surface": "rgba(44,53,64,0.85)", "--bg-elevated-secondary": "#2c3540", "--main-surface-primary": "#1c2128" }, bgTone: "dark" },
  { id: "autumn", name: "Autumn", accent: "#ff6b35", userBg: "#4d1f00", userText: "#ffe4cc", submitBg: "#cc4400", submitText: "#ffffff",
    extras: { "--bg-primary": "#2d1200", "--bg-secondary": "#4d1f00", "--message-surface": "rgba(77,31,0,0.85)", "--bg-elevated-secondary": "#4d1f00", "--main-surface-primary": "#2d1200" }, bgTone: "dark" },
  { id: "winter", name: "Winter", accent: "#87ceeb", userBg: "#1a2f3d", userText: "#e6f4ff", submitBg: "#4682b4", submitText: "#ffffff",
    extras: { "--bg-primary": "#0f1b23", "--bg-secondary": "#1a2f3d", "--message-surface": "rgba(26,47,61,0.85)", "--bg-elevated-secondary": "#1a2f3d", "--main-surface-primary": "#0f1b23" }, bgTone: "dark" },
  { id: "gameboy", name: "Game Boy", accent: "#8bac0f", userBg: "#306230", userText: "#8bac0f", submitBg: "#9bbc0f", submitText: "#0f380f",
    extras: { "--bg-primary": "#0f380f", "--bg-secondary": "#306230", "--message-surface": "rgba(48,98,48,0.85)", "--bg-elevated-secondary": "#306230", "--main-surface-primary": "#0f380f" }, bgTone: "dark" },
  { id: "console", name: "Retro Console", accent: "#ff6b6b", userBg: "#2d1b69", userText: "#ffeaa7", submitBg: "#fd79a8", submitText: "#2d3436",
    extras: { "--bg-primary": "#1e1348", "--bg-secondary": "#2d1b69", "--message-surface": "rgba(45,27,105,0.85)", "--bg-elevated-secondary": "#2d1b69", "--main-surface-primary": "#1e1348" }, bgTone: "dark" },
  { id: "mono_blue", name: "Mono Blue", accent: "#3498db", userBg: "#1a2832", userText: "#e8f4fd", submitBg: "#2980b9", submitText: "#ffffff",
    extras: { "--bg-primary": "#0f1419", "--bg-secondary": "#1a2832", "--message-surface": "rgba(26,40,50,0.85)", "--bg-elevated-secondary": "#1a2832", "--main-surface-primary": "#0f1419" }, bgTone: "dark" },
  { id: "mono_red", name: "Mono Red", accent: "#e74c3c", userBg: "#3d1a1a", userText: "#ffe6e6", submitBg: "#c0392b", submitText: "#ffffff",
    extras: { "--bg-primary": "#2d1010", "--bg-secondary": "#3d1a1a", "--message-surface": "rgba(61,26,26,0.85)", "--bg-elevated-secondary": "#3d1a1a", "--main-surface-primary": "#2d1010" }, bgTone: "dark" },
  { id: "material_indigo", name: "Material Deep", accent: "#3f51b5", userBg: "#1a1f2e", userText: "#e8eaf6", submitBg: "#303f9f", submitText: "#ffffff",
    extras: { "--bg-primary": "#121218", "--bg-secondary": "#1a1f2e", "--message-surface": "rgba(26,31,46,0.85)", "--bg-elevated-secondary": "#1a1f2e", "--main-surface-primary": "#121218" }, bgTone: "dark" },
  { id: "material_teal", name: "Material Teal", accent: "#009688", userBg: "#1a2e2a", userText: "#e0f2f1", submitBg: "#00695c", submitText: "#ffffff",
    extras: { "--bg-primary": "#0f1a18", "--bg-secondary": "#1a2e2a", "--message-surface": "rgba(26,46,42,0.85)", "--bg-elevated-secondary": "#1a2e2a", "--main-surface-primary": "#0f1a18" }, bgTone: "dark" },

  // 3) Light background themes (all BG light grouped)
  { id: "pastel_sky", name: "Pastel Sky", accent: "#7aa7ff", userBg: "#eaf2ff", userText: "#09223a", submitBg: "#3b82f6", submitText: "#ffffff",
    extras: { "--bg-primary": "#f7faff", "--bg-secondary": "#eef4ff", "--bg-tertiary": "#e6f1ff", "--message-surface": "rgba(233,240,255,.60)", "--main-surface-primary": "#f7faff" }, bgTone: "light" },
  { id: "pastel_mint", name: "Pastel Mint", accent: "#34d399", userBg: "#d9f4e4", userText: "#003716", submitBg: "#04b84c", submitText: "#ffffff",
    extras: { "--bg-primary": "#f0fdf4", "--bg-secondary": "#e6fbed", "--bg-tertiary": "#dcf8e6", "--message-surface": "rgba(235,250,243,.70)", "--main-surface-primary": "#f0fdf4" }, bgTone: "light" },
  { id: "pastel_peach", name: "Pastel Peach", accent: "#fb923c", userBg: "#ffe7d9", userText: "#4a2206", submitBg: "#fb6a22", submitText: "#ffffff",
    extras: { "--bg-primary": "#fffaf7", "--bg-secondary": "#fff4ed", "--bg-tertiary": "#ffece0", "--message-surface": "rgba(255,245,236,.80)", "--main-surface-primary": "#fffaf7" }, bgTone: "light" },
  { id: "pastel_lavender", name: "Lavender Milk", accent: "#a78bfa", userBg: "#efe5fe", userText: "#2c184a", submitBg: "#924ff7", submitText: "#ffffff",
    extras: { "--bg-primary": "#fefbff", "--bg-secondary": "#f9f5ff", "--bg-tertiary": "#f3edff", "--message-surface": "rgba(245,240,255,.75)", "--main-surface-primary": "#fefbff" }, bgTone: "light" },
  { id: "pastel_rose", name: "Soft Rose", accent: "#f472b6", userBg: "#ffe8f3", userText: "#4d1f34", submitBg: "#ff66ad", submitText: "#ffffff",
    extras: { "--bg-primary": "#fffafc", "--bg-secondary": "#fff2f7", "--bg-tertiary": "#ffe9f1", "--message-surface": "rgba(255,236,246,.80)", "--main-surface-primary": "#fffafc" }, bgTone: "light" },
  { id: "pastel_sand", name: "Warm Sand", accent: "#d6b28d", userBg: "#fff6e0", userText: "#4a3200", submitBg: "#d3995c", submitText: "#ffffff",
    extras: { "--bg-primary": "#fffcf7", "--bg-secondary": "#fff8f0", "--bg-tertiary": "#fff2e6", "--message-surface": "rgba(246,241,231,.75)", "--main-surface-primary": "#fffcf7" }, bgTone: "light" },
  { id: "porcelain", name: "Porcelain", accent: "#64748b", userBg: "#eef2f7", userText: "#1f2937", submitBg: "#475569", submitText: "#ffffff",
    extras: { "--bg-primary": "#ffffff", "--bg-secondary": "#f6f7fb", "--bg-tertiary": "#eef1f6", "--message-surface": "rgba(240,244,251,.65)", "--main-surface-primary": "#ffffff" }, bgTone: "light" },
  { id: "frost", name: "Frost", accent: "#38bdf8", userBg: "#e0f2fe", userText: "#082f49", submitBg: "#0ea5e9", submitText: "#ffffff",
    extras: { "--bg-primary": "#f8fcff", "--bg-secondary": "#eef8ff", "--bg-tertiary": "#e6f3ff", "--message-surface": "rgba(228,242,255,.65)", "--main-surface-primary": "#f8fcff" }, bgTone: "light" },
  { id: "lemonade", name: "Lemonade", accent: "#facc15", userBg: "#fef9c3", userText: "#3b3000", submitBg: "#eab308", submitText: "#0d0d0d",
    extras: { "--bg-primary": "#fffef5", "--bg-secondary": "#fffbe6", "--bg-tertiary": "#fff7cc", "--message-surface": "rgba(255,247,204,.55)", "--main-surface-primary": "#fffef5" }, bgTone: "light" },
  { id: "cotton_candy", name: "Cotton Candy", accent: "#fb61d1", userBg: "#ffe4f0", userText: "#4a1d3d", submitBg: "#ec4899", submitText: "#ffffff",
    extras: { "--bg-primary": "#fff7fb", "--bg-secondary": "#ffeff7", "--bg-tertiary": "#ffe4f4", "--message-surface": "rgba(255,231,246,.70)", "--main-surface-primary": "#fff7fb" }, bgTone: "light" },
  { id: "lagoon", name: "Lagoon", accent: "#14b8a6", userBg: "#d1faf5", userText: "#003b35", submitBg: "#0d9488", submitText: "#ffffff",
    extras: { "--bg-primary": "#f5fffd", "--bg-secondary": "#e9fffb", "--bg-tertiary": "#ddfff8", "--message-surface": "rgba(221,255,248,.60)", "--main-surface-primary": "#f5fffd" }, bgTone: "light" },
  { id: "spring", name: "Spring Bloom", accent: "#22c55e", userBg: "#dcfce7", userText: "#14532d", submitBg: "#16a34a", submitText: "#ffffff",
    extras: { "--bg-primary": "#f0fdf4", "--bg-secondary": "#dcfce7", "--bg-tertiary": "#bbf7d0", "--message-surface": "rgba(220,252,231,.65)", "--main-surface-primary": "#f0fdf4" }, bgTone: "light" },
  { id: "cloud", name: "Cloud Nine", accent: "#6b7280", userBg: "#f3f4f6", userText: "#1f2937", submitBg: "#4b5563", submitText: "#ffffff",
    extras: { "--bg-primary": "#fefefe", "--bg-secondary": "#f3f4f6", "--bg-tertiary": "#e5e7eb", "--message-surface": "rgba(243,244,246,.60)", "--main-surface-primary": "#fefefe" }, bgTone: "light" },
  { id: "sunrise", name: "Sunrise", accent: "#f97316", userBg: "#fed7aa", userText: "#7c2d12", submitBg: "#ea580c", submitText: "#ffffff",
    extras: { "--bg-primary": "#fffbf5", "--bg-secondary": "#fed7aa", "--bg-tertiary": "#fdba74", "--message-surface": "rgba(254,215,170,.70)", "--main-surface-primary": "#fffbf5" }, bgTone: "light" },
  { id: "lavender_light", name: "Lavender Fields", accent: "#8b5cf6", userBg: "#ede9fe", userText: "#581c87", submitBg: "#7c3aed", submitText: "#ffffff",
    extras: { "--bg-primary": "#faf8ff", "--bg-secondary": "#ede9fe", "--bg-tertiary": "#ddd6fe", "--message-surface": "rgba(237,233,254,.65)", "--main-surface-primary": "#faf8ff" }, bgTone: "light" },
  { id: "forest_light", name: "Forest Mist", accent: "#059669", userBg: "#d1fae5", userText: "#064e3b", submitBg: "#047857", submitText: "#ffffff",
    extras: { "--bg-primary": "#f0fdf9", "--bg-secondary": "#d1fae5", "--bg-tertiary": "#a7f3d0", "--message-surface": "rgba(209,250,229,.65)", "--main-surface-primary": "#f0fdf9" }, bgTone: "light" },
  { id: "cream", name: "Vanilla Cream", accent: "#92400e", userBg: "#fef3c7", userText: "#451a03", submitBg: "#b45309", submitText: "#ffffff",
    extras: { "--bg-primary": "#fffef0", "--bg-secondary": "#fef3c7", "--bg-tertiary": "#fde68a", "--message-surface": "rgba(254,243,199,.65)", "--main-surface-primary": "#fffef0" }, bgTone: "light" }
];

function renderPresets() {
  const grid = document.getElementById("themeGrid");
  grid.innerHTML = "";
  for (const preset of PRESETS) {
    const card = document.createElement("button");
    card.className = "theme-card";
    card.setAttribute("type", "button");
    card.dataset.id = preset.id;

    const row = document.createElement("div");
    row.className = "theme-row";

    const title = document.createElement("div");
    title.className = "theme-title";

    const titleDot = document.createElement("div");
    titleDot.className = "dot";
    titleDot.style.background = preset.reset ? "#bdbdbd" : preset.accent;

    const titleText = document.createElement("span");
    titleText.textContent = preset.name;

    title.appendChild(titleDot);
    title.appendChild(titleText);

    if (preset.badge) {
      const badge = document.createElement("span");
      badge.className = `badge ${preset.badge}`;
      badge.textContent = preset.badge === "plus" ? "Plus" : "Pro";
      title.appendChild(badge);
    }

    // Background-changing indicator with human text + visual tone
    if (preset.extras && (preset.extras["--bg-primary"] || preset.extras["--main-surface-primary"] || preset.extras["--main-surface-background"] || preset.extras["--sidebar-surface"])) {
      const base = preset.extras["--bg-primary"] || preset.extras["--main-surface-primary"] || "#111213";
      const rgb = parseColorToRgb(base);
      const luma = rgb ? (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) : 0;
      const isLight = luma > 180;
      const bgBadge = document.createElement("span");
      bgBadge.className = isLight ? "badge bg-light" : "badge bg-dark";
      bgBadge.textContent = isLight ? "Background: Light" : "Background: Dark";
      title.appendChild(bgBadge);
    }

    const swatches = document.createElement("div");
    swatches.className = "swatches";

    // For BG themes, show the bg color as the middle swatch; otherwise show user bubble
    const hasBg = preset.extras && (preset.extras["--bg-primary"] || preset.extras["--main-surface-primary"]);
    const s1 = document.createElement("div"); s1.className = "pill"; s1.style.background = preset.reset ? "linear-gradient(90deg,#c8c8c8,#e0e0e0)" : preset.accent; swatches.appendChild(s1);
    const s2 = document.createElement("div"); s2.className = "pill"; s2.style.background = preset.reset ? "linear-gradient(90deg,#c8c8c8,#e0e0e0)" : (hasBg ? (preset.extras["--bg-primary"] || preset.extras["--main-surface-primary"]) : preset.userBg); swatches.appendChild(s2);
    const s3 = document.createElement("div"); s3.className = "pill"; s3.style.background = preset.reset ? "linear-gradient(90deg,#c8c8c8,#e0e0e0)" : preset.submitBg; swatches.appendChild(s3);

    const ring = document.createElement("div");
    ring.className = "selected-ring";

    row.appendChild(title);

    card.appendChild(ring);
    card.appendChild(row);
    card.appendChild(swatches);

    card.addEventListener("click", () => {
      if (preset.reset) {
        chrome.storage.sync.remove("themeVars");
      } else {
        const themeVars = buildVarsFromCore(preset);
        chrome.storage.sync.set({ themeVars });
      }
    });

    grid.appendChild(card);
  }

  // initial selection state
  syncSelectedFromStorage();
}

function syncSelectedFromStorage() {
  chrome.storage.sync.get(["themeVars"], ({ themeVars }) => {
    const grid = document.getElementById("themeGrid");
    const cards = Array.from(grid.querySelectorAll(".theme-card"));

    // Determine which preset matches storage; prefer extras matches to avoid Obsidian->Black confusion
    let selectedId = "reset";
    if (themeVars && themeVars["--interactive-bg-accent-default"]) {
      const accent = themeVars["--interactive-bg-accent-default"]; 
      const userBg = themeVars["--theme-user-msg-bg"]; 
      const submitBg = themeVars["--theme-submit-btn-bg"]; 
      const candidates = PRESETS.filter(p => !p.reset && p.accent === accent && p.userBg === userBg && p.submitBg === submitBg);
      let best = null; let bestScore = -1;
      for (const p of candidates) {
        let score = 0; let mismatch = false;
        if (p.extras) {
          for (const [k,v] of Object.entries(p.extras)) {
            if (themeVars[k] === v) score++; else { mismatch = true; break; }
          }
        }
        if (!mismatch && score >= bestScore) { best = p; bestScore = score; }
      }
      const match = best || candidates[0];
      if (match) selectedId = match.id; else selectedId = "custom";
    }

    for (const card of cards) {
      if (card.dataset.id === selectedId) card.classList.add("selected");
      else card.classList.remove("selected");
    }
  });
}

// react to changes from other popup actions
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.themeVars) {
    syncSelectedFromStorage();
  }
});

// ===== Advanced controls =====
function loadAdvanced() {
  chrome.storage.sync.get(["themeVars"], ({ themeVars }) => {
    if (!themeVars) return;
    const get = (k, fallback) => themeVars[k] || fallback;
    const accent = get("--interactive-bg-accent-default", "#66b5ff");
    const userBg = get("--theme-user-msg-bg", "#003f7a");
    const userText = get("--theme-user-msg-text", "#f5faff");
    const submitBg = get("--theme-submit-btn-bg", "#0169cc");
    const submitText = get("--theme-submit-btn-text", "#ffffff");
    document.getElementById("accent").value = accent;
    document.getElementById("userBg").value = userBg;
    document.getElementById("userText").value = userText;
    document.getElementById("submitBg").value = submitBg;
    document.getElementById("submitText").value = submitText;

    // hex mirrors if present
    const setHex = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setHex("accentHex", accent);
    setHex("userBgHex", userBg);
    setHex("userTextHex", userText);
    setHex("submitBgHex", submitBg);
    setHex("submitTextHex", submitText);

    // surface mode detection
    const base = themeVars["--bg-primary"] || themeVars["--main-surface-primary"] || null;
    if (base) {
      const r = document.getElementById("surface-custom"); if (r) r.checked = true;
      const sc = document.getElementById("surfaceColor"); const sch = document.getElementById("surfaceColorHex");
      if (sc) sc.value = base; if (sch) sch.value = base;
    } else {
      const r = document.getElementById("surface-default"); if (r) r.checked = true;
    }
    if (typeof ensureCustomSurfaceVisibility === "function") ensureCustomSurfaceVisibility();
    if (typeof updatePreview === "function") updatePreview();
  });
}

function saveAdvanced() {
  const themeVars = buildVarsFromInputs();
  chrome.storage.sync.set({ themeVars });
}

function resetSite() { chrome.storage.sync.remove("themeVars"); }

// ===== Segmented control =====
function setSection(which) {
  const basic = document.getElementById("basic");
  const advanced = document.getElementById("advanced");
  const segBasic = document.getElementById("seg-basic");
  const segAdvanced = document.getElementById("seg-advanced");
  const segment = document.getElementById("segment");
  const stack = document.getElementById("stack");

  if (which === "basic") {
    basic.classList.add("active");
    advanced.classList.remove("active");
    segBasic.classList.add("active"); segBasic.setAttribute("aria-selected", "true");
    segAdvanced.classList.remove("active"); segAdvanced.setAttribute("aria-selected", "false");
    segment.dataset.active = "basic";
  } else {
    advanced.classList.add("active");
    basic.classList.remove("active");
    segAdvanced.classList.add("active"); segAdvanced.setAttribute("aria-selected", "true");
    segBasic.classList.remove("active"); segBasic.setAttribute("aria-selected", "false");
    segment.dataset.active = "advanced";
  }

  // Smoothly resize container to fit active section
  requestAnimationFrame(updateStackHeight);
}

document.getElementById("seg-basic").addEventListener("click", () => setSection("basic"));
document.getElementById("seg-advanced").addEventListener("click", () => setSection("advanced"));

document.getElementById("save").addEventListener("click", saveAdvanced);
document.getElementById("reset").addEventListener("click", resetSite);

renderPresets();
loadAdvanced(); 
// After initial content render, compute container height
requestAnimationFrame(updateStackHeight);

// ===== Advanced toggles for sidebar/top bar =====
// Background overrides removed for now (simplified UI)

// ===== Layout helpers =====
function updateStackHeight() {
  const stack = document.getElementById("stack");
  if (!stack) return;
  const active = stack.querySelector(".section.active");
  if (!active) return;
  // Prefer measuring inner content to avoid absolute layout quirks
  const content = active.firstElementChild || active;
  // Use scrollHeight for robust height when dynamic lists expand
  const height = content.scrollHeight || active.scrollHeight || content.getBoundingClientRect().height || 0;
  if (height) stack.style.height = `${Math.ceil(height)}px`;
}

window.addEventListener("resize", () => requestAnimationFrame(updateStackHeight));

// ===== Advanced UX: live preview, hex sync, surfaces, import/export/random =====
const VALID_HEX_RE = /^#([0-9a-fA-F]{6})$/;

function getSelectedSurfaceMode() {
  const input = document.querySelector('input[name="surfaceMode"]:checked');
  return input ? input.value : "default";
}

function getSurfaceExtrasByMode(mode) {
  if (mode === "dark") {
    return { "--bg-primary": "#0f0f10", "--bg-secondary": "#141416", "--bg-tertiary": "#18181b", "--message-surface": "rgba(35,35,38,0.85)", "--main-surface-primary": "#0f0f10", "--bg-elevated-secondary": "#141416" };
  }
  if (mode === "light") {
    return { "--bg-primary": "#ffffff", "--bg-secondary": "#f3f3f3", "--bg-tertiary": "#ececec", "--message-surface": "rgba(233,233,233,0.50)", "--main-surface-primary": "#ffffff", "--bg-elevated-secondary": "#f3f3f3" };
  }
  if (mode === "custom") {
    const base = document.getElementById("surfaceColor").value || "#0f0f10";
    const rgb = parseColorToRgb(base) || { r: 16, g: 16, b: 16 };
    const message = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`;
    return { "--bg-primary": base, "--bg-secondary": base, "--bg-tertiary": base, "--message-surface": message, "--main-surface-primary": base, "--bg-elevated-secondary": base };
  }
  return null; // default
}

function getSurfaceExtrasFromUI() {
  const mode = getSelectedSurfaceMode();
  return getSurfaceExtrasByMode(mode) || undefined;
}

function applyVarsToElement(vars, el) {
  if (!el || !vars) return;
  for (const [k, v] of Object.entries(vars)) {
    if (v == null) continue;
    el.style.setProperty(k, v);
  }
}

function updatePreview() {
  const preview = document.getElementById("preview");
  if (!preview) return;
  const vars = buildVarsFromInputs();
  // apply a subset to the preview container
  applyVarsToElement(vars, preview);
  // ensure preview text tokens are present for readability
  const surface = vars["--bg-primary"] || vars["--main-surface-primary"] || "#101010";
  const txt = pickReadableText(surface) || "#ffffff";
  preview.style.setProperty("--text-primary", txt);
  const secondary = txt === "#ffffff" ? "rgba(255,255,255,0.85)" : "rgba(13,13,13,0.80)";
  preview.style.setProperty("--text-secondary", secondary);
  // keep container height smooth
  requestAnimationFrame(updateStackHeight);
}

function ensureCustomSurfaceVisibility() {
  const row = document.getElementById("customSurfaceRow");
  if (!row) return;
  const show = getSelectedSurfaceMode() === "custom";
  row.classList.toggle("hidden", !show);
  requestAnimationFrame(updateStackHeight);
}

function syncColorPair(colorId, hexId) {
  const color = document.getElementById(colorId);
  const hex = document.getElementById(hexId);
  if (!color || !hex) return;
  const normalize = (val) => {
    if (!val) return null;
    let v = val.trim();
    if (!v.startsWith("#")) v = "#" + v;
    if (/^#([0-9a-fA-F]{3})$/.test(v)) {
      // expand shorthand #abc -> #aabbcc
      v = "#" + v.slice(1).split("").map(c => c + c).join("");
    }
    return VALID_HEX_RE.test(v) ? v.toLowerCase() : null;
  };
  color.addEventListener("input", () => { hex.value = color.value; updatePreview(); });
  hex.addEventListener("input", () => {
    const v = normalize(hex.value);
    if (v) { color.value = v; hex.value = v; updatePreview(); }
  });
}

function wireAdvancedUI() {
  // Hex sync pairs
  syncColorPair("accent", "accentHex");
  syncColorPair("userBg", "userBgHex");
  syncColorPair("userText", "userTextHex");
  syncColorPair("submitBg", "submitBgHex");
  syncColorPair("submitText", "submitTextHex");
  syncColorPair("surfaceColor", "surfaceColorHex");

  // Surface radios
  const radios = Array.from(document.querySelectorAll('input[name="surfaceMode"]'));
  for (const r of radios) r.addEventListener("change", () => { ensureCustomSurfaceVisibility(); updatePreview(); });

  // Actions
  const randBtn = document.getElementById("random");
  if (randBtn) randBtn.addEventListener("click", surpriseMe);

  // Preview on input changes
  ["accent", "userBg", "userText", "submitBg", "submitText", "surfaceColor"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updatePreview);
  });

  // Tiny label below preview to hint about background type when custom is active
  const preview = document.getElementById("preview");
  if (preview) {
    const note = document.createElement("div");
    note.style.cssText = "margin-top:6px;font-size:11px;opacity:.7";
    const refresh = () => {
      const mode = getSelectedSurfaceMode();
      if (mode === "default") { note.textContent = "Using site default background"; }
      else if (mode === "dark") { note.textContent = "Using built-in dark background"; }
      else if (mode === "light") { note.textContent = "Using built-in light background"; }
      else {
        const base = document.getElementById("surfaceColor")?.value || "#000";
        const rgb = parseColorToRgb(base);
        const luma = rgb ? (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) : 0;
        note.textContent = luma > 180 ? "Custom background: Light" : "Custom background: Dark";
      }
    };
    preview.parentElement.appendChild(note);
    ["change","input"].forEach(evt => document.getElementById("surfaceColor")?.addEventListener(evt, () => { refresh(); }));
    Array.from(document.querySelectorAll('input[name="surfaceMode"]')).forEach(r => r.addEventListener("change", refresh));
    refresh();
  }

  ensureCustomSurfaceVisibility();
  updatePreview();

  // Saved themes wiring
  const saveThemeBtn = document.getElementById("saveThemeBtn");
  const saveName = document.getElementById("saveName");
  if (saveThemeBtn && saveName) {
    saveThemeBtn.addEventListener("click", () => saveCurrentThemeByName(saveName.value));
  }
  // Import/Export removed for shipping v1
  renderSavedThemes();
}

function surpriseMe() {
  // choose a random preset (excluding reset)
  const candidates = PRESETS.filter(p => !p.reset);
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  if (!pick) return;
  const set = (id, val) => { const el = document.getElementById(id); const hx = document.getElementById(id+"Hex"); if (el) el.value = val; if (hx) hx.value = val; };
  if (pick.accent) set("accent", pick.accent);
  if (pick.userBg) set("userBg", pick.userBg);
  if (pick.userText) set("userText", pick.userText);
  if (pick.submitBg) set("submitBg", pick.submitBg);
  if (pick.submitText) set("submitText", pick.submitText);
  // surfaces
  const hasExtras = pick.extras && (pick.extras["--bg-primary"] || pick.extras["--main-surface-primary"]);
  const mode = hasExtras ? "custom" : "default";
  const radio = document.getElementById(`surface-${mode}`);
  if (radio) radio.checked = true;
  ensureCustomSurfaceVisibility();
  const base = hasExtras ? (pick.extras["--bg-primary"] || pick.extras["--main-surface-primary"]) : null;
  if (base) { const sc = document.getElementById("surfaceColor"); const sch = document.getElementById("surfaceColorHex"); if (sc) sc.value = base; if (sch) sch.value = base; }
  updatePreview();
}

// Import/Export removed

// ===== Saved themes (library) =====
const SAVED_KEY = "savedThemes";

function sanitizeFileBase(name) {
  return String(name || "theme").replace(/[^a-z0-9-_\.]+/gi, "_").slice(0, 60);
}

function loadSavedThemes(callback) {
  chrome.storage.sync.get([SAVED_KEY], (data) => {
    const list = Array.isArray(data[SAVED_KEY]) ? data[SAVED_KEY] : [];
    callback(list);
  });
}

function saveSavedThemes(list, callback) {
  chrome.storage.sync.set({ [SAVED_KEY]: list }, () => { if (callback) callback(); });
}

function generateId() {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function saveCurrentThemeByName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const vars = buildVarsFromInputs();
  loadSavedThemes((list) => {
    // If same name exists, append (2), (3), ...
    let finalName = trimmed;
    const existingNames = new Set(list.map(t => t.name));
    if (existingNames.has(finalName)) {
      let idx = 2;
      while (existingNames.has(`${trimmed} (${idx})`)) idx++;
      finalName = `${trimmed} (${idx})`;
    }
    const entry = { id: generateId(), name: finalName, vars };
    const next = [...list, entry];
    saveSavedThemes(next, () => renderSavedThemes());
  });
}

function saveThemeVarsToLibrary(vars, desiredName) {
  const baseName = String(desiredName || "Imported Theme").trim() || "Imported Theme";
  loadSavedThemes((list) => {
    const names = new Set(list.map(t => t.name));
    let final = baseName;
    if (names.has(final)) {
      let i = 2; while (names.has(`${baseName} (${i})`)) i++; final = `${baseName} (${i})`;
    }
    const next = [...list, { id: generateId(), name: final, vars }];
    saveSavedThemes(next, () => { renderSavedThemes(); requestAnimationFrame(updateStackHeight); });
  });
}

function renderSavedThemes() {
  const container = document.getElementById("savedList");
  if (!container) return;
  container.innerHTML = "";
  loadSavedThemes((list) => {
    if (!list.length) {
      const empty = document.createElement("div");
      empty.style.opacity = ".7";
      empty.style.fontSize = "12px";
      empty.textContent = "No saved themes yet";
      container.appendChild(empty);
      return;
    }
    for (const item of list) {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1fr auto auto auto";
      row.style.gap = "8px";
      row.style.alignItems = "center";

      const name = document.createElement("div");
      name.textContent = item.name;
      name.style.fontWeight = "600";
      name.style.fontSize = "12.5px";
      name.style.overflow = "hidden";
      name.style.textOverflow = "ellipsis";
      name.style.whiteSpace = "nowrap";

      const applyBtn = document.createElement("button");
      applyBtn.className = "btn";
      applyBtn.textContent = "Apply";
      applyBtn.addEventListener("click", () => {
        const vars = item.vars || {};
        const themeVars = buildVarsFromCore({
          accent: vars["--interactive-bg-accent-default"] || "#66b5ff",
          userBg: vars["--theme-user-msg-bg"] || "#003f7a",
          userText: vars["--theme-user-msg-text"] || "#f5faff",
          submitBg: vars["--theme-submit-btn-bg"] || "#0169cc",
          submitText: vars["--theme-submit-btn-text"] || "#ffffff",
          extras: (() => {
            const keys = ["--bg-primary","--bg-secondary","--bg-tertiary","--message-surface","--main-surface-primary","--bg-elevated-secondary","--link","--link-hover"]; const out = {}; let any = false;
            for (const k of keys) { if (vars[k] != null) { out[k] = vars[k]; any = true; } }
            return any ? out : undefined;
          })()
        });
        chrome.storage.sync.set({ themeVars });
      });

      const delBtn = document.createElement("button");
      delBtn.className = "btn";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => deleteSavedTheme(item.id));

      row.appendChild(name);
      row.appendChild(applyBtn);
      row.appendChild(delBtn);
      container.appendChild(row);
    }
    requestAnimationFrame(updateStackHeight);
  });
}

// Export helpers removed

function deleteSavedTheme(id) {
  loadSavedThemes((list) => {
    const next = list.filter(t => t.id !== id);
    saveSavedThemes(next, () => renderSavedThemes());
  });
}

// Library import/export removed

// Wire once DOM is ready
document.addEventListener("DOMContentLoaded", wireAdvancedUI);