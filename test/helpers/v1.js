// What the published 1.1.0 popup wrote to chrome.storage.sync. `v1-presets.json` is its
// PRESETS table, copied verbatim from popup.js on `main` (including the Default "reset" entry),
// and buildV1Vars() is its buildVarsFromCore().
import presets from "../fixtures/v1-presets.json" with { type: "json" };

export const V1_PRESETS = presets;

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
};
const rgbToHex = ({ r, g, b }) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, v))).map((v) => v.toString(16).padStart(2, "0")).join("");
const shade = (hex, pct) => {
  const rgb = hexToRgb(hex);
  const f = pct / 100;
  return rgbToHex({ r: Math.round(rgb.r + (255 - rgb.r) * f), g: Math.round(rgb.g + (255 - rgb.g) * f), b: Math.round(rgb.b + (255 - rgb.b) * f) });
};

/** The 1.1.0 `themeVars` for a preset or for Advanced-tab inputs ({ accent, userBg, userText, submitBg, extras }). */
export function buildV1Vars(core) {
  const hover = shade(core.accent, -8), press = shade(core.accent, -16);
  const mutedHover = shade(core.accent, -40), mutedPress = shade(core.accent, -34);
  const base = {
    "--interactive-bg-accent-default": core.accent,
    "--interactive-bg-accent-hover": hover,
    "--interactive-bg-accent-press": press,
    "--interactive-bg-accent-inactive": core.accent,
    "--interactive-bg-accent-selected": core.accent,
    "--interactive-bg-accent-muted-hover": mutedHover,
    "--interactive-bg-accent-muted-press": mutedPress,
    "--composer-blue-bg": core.accent,
    "--composer-blue-hover": hover,
    "--theme-user-msg-bg": core.userBg,
    "--theme-user-msg-text": core.userText,
    "--theme-submit-btn-bg": core.submitBg,
    "--theme-secondary-btn-bg": mutedHover,
  };
  return core.extras ? { ...base, ...core.extras } : base;
}

/** The 1.1.0 Advanced "Surfaces" choices. */
export const V1_SURFACES = {
  dark: { "--bg-primary": "#0f0f10", "--bg-secondary": "#141416", "--bg-tertiary": "#18181b", "--message-surface": "rgba(35,35,38,0.85)", "--main-surface-primary": "#0f0f10", "--bg-elevated-secondary": "#141416" },
  light: { "--bg-primary": "#ffffff", "--bg-secondary": "#f3f3f3", "--bg-tertiary": "#ececec", "--message-surface": "rgba(233,233,233,0.50)", "--main-surface-primary": "#ffffff", "--bg-elevated-secondary": "#f3f3f3" },
  custom: (base) => ({ "--bg-primary": base, "--bg-secondary": base, "--bg-tertiary": base, "--message-surface": "rgba(1,2,3,0.85)", "--main-surface-primary": base, "--bg-elevated-secondary": base }),
};
