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
  "--sidebar-surface",
];

// Cache for currently applied vars to avoid redundant style work
let appliedVars = {};
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

function applyTheme(vars) {
  const root = document.documentElement;
  const next = vars || {};

  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const current = appliedVars;

    for (const key of Object.keys(current)) {
      if (!(key in next)) {
        root.style.removeProperty(key);
        delete appliedVars[key];
      }
    }

    for (const [k, v] of Object.entries(next)) {
      if (v == null) continue;
      if (current[k] !== v) {
        root.style.setProperty(k, v);
        appliedVars[k] = v;
      }
    }
    ensureComposerStyleElement();
  });
}

// === Automatic Theme Switching Logic ===

function getSiteTheme() {
  // ChatGPT uses a 'dark' class on the <html> element for dark mode
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function applyAppropriateTheme() {
  if (typeof chrome.runtime.id === 'undefined') return;
  chrome.storage.sync.get(["activeLightVars", "activeDarkVars", "themeVars"], (result) => {
    if (chrome.runtime.lastError) return;
    
    const { activeLightVars, activeDarkVars, themeVars } = result;
    const siteTheme = getSiteTheme();

    if (siteTheme === 'dark' && activeDarkVars) applyTheme(activeDarkVars);
    else if (siteTheme === 'light' && activeLightVars) applyTheme(activeLightVars);
    else if (themeVars) applyTheme(themeVars);
    else applyTheme({});
  });
}

// Watch for the user toggling light/dark mode on chatgpt.com
const observer = new MutationObserver((mutationsList) => {
  for (const mutation of mutationsList) {
    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
      applyAppropriateTheme();
      break;
    }
  }
});

observer.observe(document.documentElement, { attributes: true });

// Listen for theme changes from the popup
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.themeVars || changes.activeLightVars || changes.activeDarkVars)) {
    applyAppropriateTheme();
  }
});

// Re-apply theme when tab becomes visible, as styles can sometimes be cleared
window.addEventListener("visibilitychange", applyAppropriateTheme);
window.addEventListener("focus", applyAppropriateTheme);
window.addEventListener("pageshow", applyAppropriateTheme);

// Initial load
applyAppropriateTheme();
ensureComposerStyleElement();