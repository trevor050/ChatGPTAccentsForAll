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

// ===== Theme building =====
function buildVarsFromCore(core) {
  const accent = core.accent;
  const userBg = core.userBg;
  const userText = core.userText;
  const submitBg = core.submitBg;
  const submitText = core.submitText;

  const hover = shade(accent, -8);
  const press = shade(accent, -16);
  const linkHover = shade(accent, -12);
  const mutedHover = shade(accent, -40);
  const mutedPress = shade(accent, -34);

  return {
    "--text-accent": accent,
    "--icon-accent": accent,
    "--link": accent,
    "--link-hover": linkHover,
    "--selection": accent,

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

function buildVarsFromInputs() {
  const accent = document.getElementById("accent").value || "#66b5ff";
  const userBg = document.getElementById("userBg").value || "#003f7a";
  const userText = document.getElementById("userText").value || "#f5faff";
  const submitBg = document.getElementById("submitBg").value || "#0169cc";
  const submitText = document.getElementById("submitText").value || "#ffffff";
  return buildVarsFromCore({ accent, userBg, userText, submitBg, submitText });
}

// ===== Preset themes =====
const PRESETS = [
  { id: "reset", name: "Reset (Site)", reset: true },
  { id: "emerald", name: "Emerald", accent: "#10b981", userBg: "#064e3b", userText: "#d1fae5", submitBg: "#059669", submitText: "#ffffff" },
  { id: "sky", name: "Sky", accent: "#0ea5e9", userBg: "#0c4a6e", userText: "#e0f2fe", submitBg: "#0284c7", submitText: "#ffffff" },
  { id: "violet", name: "Violet", accent: "#8b5cf6", userBg: "#3b0764", userText: "#f3e8ff", submitBg: "#7c3aed", submitText: "#ffffff" },
  { id: "amber", name: "Amber", accent: "#f59e0b", userBg: "#78350f", userText: "#fff7ed", submitBg: "#d97706", submitText: "#0b0b0b" },
  { id: "rose", name: "Rose", accent: "#f43f5e", userBg: "#7f1d1d", userText: "#ffe4e6", submitBg: "#e11d48", submitText: "#ffffff" },
  { id: "slate", name: "Slate", accent: "#64748b", userBg: "#111827", userText: "#e5e7eb", submitBg: "#374151", submitText: "#ffffff" },
  { id: "cyan", name: "Cyan", accent: "#06b6d4", userBg: "#134e4a", userText: "#cffafe", submitBg: "#0891b2", submitText: "#ffffff" },
  { id: "lime", name: "Lime", accent: "#84cc16", userBg: "#1a2e05", userText: "#ecfccb", submitBg: "#65a30d", submitText: "#111111" },
  { id: "indigo", name: "Indigo", accent: "#6366f1", userBg: "#1e1b4b", userText: "#e0e7ff", submitBg: "#4f46e5", submitText: "#ffffff" },
  { id: "mono", name: "Mono", accent: "#7a7a7a", userBg: "#1a1a1a", userText: "#f2f2f2", submitBg: "#2a2a2a", submitText: "#ffffff" }
];

function renderPresets() {
  const grid = document.getElementById("themeGrid");
  grid.innerHTML = "";
  for (const preset of PRESETS) {
    const card = document.createElement("button");
    card.className = "theme-card";
    card.setAttribute("type", "button");
    card.dataset.id = preset.id;

    const title = document.createElement("div");
    title.className = "theme-title";
    title.textContent = preset.name;

    const swatches = document.createElement("div");
    swatches.className = "swatches";

    if (preset.reset) {
      const pill = document.createElement("div");
      pill.className = "pill";
      pill.style.background = "linear-gradient(90deg, #bbb, #ddd)";
      swatches.appendChild(pill);
    } else {
      const dot = document.createElement("div");
      dot.className = "dot";
      dot.style.background = preset.accent;

      const userPill = document.createElement("div");
      userPill.className = "pill";
      userPill.style.background = preset.userBg;

      const submitPill = document.createElement("div");
      submitPill.className = "pill";
      submitPill.style.background = preset.submitBg;

      swatches.appendChild(dot);
      swatches.appendChild(userPill);
      swatches.appendChild(submitPill);
    }

    card.appendChild(title);
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
}

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

  if (which === "basic") {
    basic.classList.add("active");
    advanced.classList.remove("active");
    segBasic.classList.add("active"); segBasic.setAttribute("aria-selected", "true");
    segAdvanced.classList.remove("active"); segAdvanced.setAttribute("aria-selected", "false");
  } else {
    advanced.classList.add("active");
    basic.classList.remove("active");
    segAdvanced.classList.add("active"); segAdvanced.setAttribute("aria-selected", "true");
    segBasic.classList.remove("active"); segBasic.setAttribute("aria-selected", "false");
  }
}

document.getElementById("seg-basic").addEventListener("click", () => setSection("basic"));
document.getElementById("seg-advanced").addEventListener("click", () => setSection("advanced"));

document.getElementById("save").addEventListener("click", saveAdvanced);
document.getElementById("reset").addEventListener("click", resetSite);

renderPresets();
loadAdvanced(); 