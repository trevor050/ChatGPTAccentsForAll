// List of CSS variable keys we control
const THEME_KEYS = [
  "--text-accent",
  "--icon-accent",
  "--link",
  "--link-hover",
  "--selection",
  "--theme-user-selection-bg",
  // Ensure main text tokens are always controllable
  "--text-primary",
  "--text-secondary",
  "--interactive-bg-accent-default",
  "--interactive-bg-accent-hover",
  "--interactive-bg-accent-press",
  "--interactive-bg-accent-inactive",
  "--interactive-bg-accent-selected",
  "--interactive-bg-accent-muted-hover",
  "--interactive-bg-accent-muted-press",
  "--composer-blue-bg",
  "--composer-blue-hover",
  "--composer-blue-text",
  "--theme-user-msg-bg",
  "--theme-user-msg-text",
  "--theme-submit-btn-bg",
  "--theme-submit-btn-text",
  "--theme-secondary-btn-bg",
  "--theme-secondary-btn-text",
  // Surfaces / backgrounds (optional)
  "--bg-primary",
  "--bg-secondary",
  "--bg-tertiary",
  "--bg-elevated-primary",
  "--bg-elevated-secondary",
  "--message-surface",
  "--main-surface-background",
  "--main-surface-primary",
  "--composer-surface",
  "--sidebar-surface"
];

// Cache for currently applied vars to avoid redundant style work
let appliedVars = {};
let cachedThemeVars = null; // last value from storage
let rafPending = false;

// Ensure we have a stylesheet that can force composer background/text
const COMPOSER_STYLE_ID = "a4a-composer-override";
function ensureComposerStyleElement() {
  if (document.getElementById(COMPOSER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = COMPOSER_STYLE_ID;
  style.textContent = `
    /* Force the chat bar (composer container) background using our vars */
    form[data-type="unified-composer"] .bg-token-bg-primary {
      background: var(--composer-surface, var(--bg-primary, var(--main-surface-primary))) !important;
    }
  `;
  document.documentElement.appendChild(style);
}

function parseColorToRgb(color) {
  if (!color) return null;
  // #rrggbb or #rrggbbaa
  const hex = color.trim();
  const m6 = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})([\da-f]{2})?$/i.exec(hex);
  if (m6) {
    return {
      r: parseInt(m6[1], 16),
      g: parseInt(m6[2], 16),
      b: parseInt(m6[3], 16)
    };
  }
  // rgb/rgba
  const mRgb = /rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
  if (mRgb) {
    return { r: +mRgb[1], g: +mRgb[2], b: +mRgb[3] };
  }
  return null;
}

function pickReadableText(surfaceColor) {
  const rgb = parseColorToRgb(surfaceColor);
  if (!rgb) return null;
  // Perceived luminance
  const luma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return luma > 180 ? "#0d0d0d" : "#ffffff";
}

function applyTheme(vars) {
  const root = document.documentElement;
  const next = vars || {};

  // Coalesce multiple calls into one animation frame to minimize layout thrash
  if (rafPending) {
    // Update cache and bail; the scheduled frame will pick it up
    cachedThemeVars = next;
    return;
  }
  cachedThemeVars = next;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const current = appliedVars;

    // Remove vars that are no longer present
    for (const key of Object.keys(current)) {
      if (!(key in cachedThemeVars)) {
        root.style.removeProperty(key);
        delete appliedVars[key];
      }
    }

    // Apply only changed values
    for (const [k, v] of Object.entries(cachedThemeVars)) {
      if (v == null) continue;
      if (current[k] !== v) {
        root.style.setProperty(k, v);
        appliedVars[k] = v;
      }
    }

    // Keep a style tag around to enforce composer background/text
    ensureComposerStyleElement();

    // Determine effective page surface to derive readable text, even if no explicit surface provided
    let surface = cachedThemeVars["--composer-surface"] || cachedThemeVars["--bg-primary"] || cachedThemeVars["--main-surface-primary"];    
    if (!surface) {
      // Try computed background color from document body or root
      const bodyBg = getComputedStyle(document.body || document.documentElement).backgroundColor;
      surface = bodyBg || "#101010";
    }

    // Ensure core background tokens exist for consistency across the app
    const rgb = parseColorToRgb(surface);
    const messageSurface = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)` : surface;
    const ensureVar = (key, value) => {
      if (!(key in cachedThemeVars)) {
        root.style.setProperty(key, value);
        appliedVars[key] = value;
      }
    };
    ensureVar("--bg-primary", surface);
    ensureVar("--bg-secondary", surface);
    ensureVar("--bg-tertiary", surface);
    ensureVar("--bg-elevated-primary", surface);
    ensureVar("--bg-elevated-secondary", surface);
    ensureVar("--main-surface-primary", surface);
    ensureVar("--main-surface-background", surface);
    ensureVar("--composer-surface", surface);
    ensureVar("--message-surface", messageSurface);
  });
}

// Initial load on page start
chrome.storage.sync.get(["themeVars"], ({ themeVars }) => {
  cachedThemeVars = themeVars || {};
  applyTheme(cachedThemeVars);
  ensureComposerStyleElement();
});

// Live update on changes from popup
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !("themeVars" in changes)) return;
  cachedThemeVars = changes.themeVars.newValue || {};
  applyTheme(cachedThemeVars);
});

// Re-apply on SPA navigations or tab focus
const reapply = () => applyTheme(cachedThemeVars);
window.addEventListener("visibilitychange", reapply);
window.addEventListener("focus", reapply);
window.addEventListener("pageshow", reapply); 