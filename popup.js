// Helpers to make hover/press shades from a base color
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
// Simple shade: positive % lightens, negative % darkens
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

const ids = ["accent", "userBg", "userText", "submitBg", "submitText"];
const els = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));

function buildVars() {
  const accent = els.accent.value || "#66b5ff";
  const userBg = els.userBg.value || "#003f7a";
  const userText = els.userText.value || "#f5faff";
  const submitBg = els.submitBg.value || "#0169cc";
  const submitText = els.submitText.value || "#ffffff";

  const hover = shade(accent, -8);
  const press = shade(accent, -16);
  const linkHover = shade(accent, -12);
  const mutedHover = shade(accent, -40);
  const mutedPress = shade(accent, -34);
  const selection = accent;

  return {
    "--text-accent": accent,
    "--icon-accent": accent,
    "--link": accent,
    "--link-hover": linkHover,
    "--selection": selection,

    "--interactive-bg-accent-default": accent,
    "--interactive-bg-accent-hover": hover,
    "--interactive-bg-accent-press": press,
    "--interactive-bg-accent-inactive": accent,
    "--interactive-bg-accent-selected": accent,
    "--interactive-bg-accent-muted-hover": mutedHover,
    "--interactive-bg-accent-muted-press": mutedPress,

    "--composer-blue-bg": accent,
    "--composer-blue-hover": hover,
    "--composer-blue-text": shade(accent, 90),

    "--theme-user-msg-bg": userBg,
    "--theme-user-msg-text": userText,

    "--theme-submit-btn-bg": submitBg,
    "--theme-submit-btn-text": submitText,

    "--theme-secondary-btn-bg": mutedHover,
    "--theme-secondary-btn-text": "#ffffff"
  };
}

function load() {
  chrome.storage.sync.get(["themeVars"], ({ themeVars }) => {
    if (!themeVars) return;
    if (themeVars["--interactive-bg-accent-default"]) els.accent.value = themeVars["--interactive-bg-accent-default"];
    if (themeVars["--theme-user-msg-bg"]) els.userBg.value = themeVars["--theme-user-msg-bg"];
    if (themeVars["--theme-user-msg-text"]) els.userText.value = themeVars["--theme-user-msg-text"];
    if (themeVars["--theme-submit-btn-bg"]) els.submitBg.value = themeVars["--theme-submit-btn-bg"];
    if (themeVars["--theme-submit-btn-text"]) els.submitText.value = themeVars["--theme-submit-btn-text"];
  });
}

function save() {
  const themeVars = buildVars();
  chrome.storage.sync.set({ themeVars });
}

function reset() {
  chrome.storage.sync.remove("themeVars");
}

document.getElementById("save").addEventListener("click", save);

document.getElementById("reset").addEventListener("click", () => {
  reset();
});

load(); 