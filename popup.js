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
// Includes built-in: Default, Blue, Green, Yellow, Pink, Orange, Purple (Plus), Black (Pro)
// And extra curated themes.
const PRESETS = [
  { id: "reset", name: "Default", reset: true, badge: null },
  { id: "blue", name: "Blue", accent: "#1d74ff", userBg: "#0b3a7a", userText: "#e6f0ff", submitBg: "#0b5fff", submitText: "#ffffff" },
  { id: "green", name: "Green", accent: "#16a34a", userBg: "#064e3b", userText: "#d1fae5", submitBg: "#0f9d58", submitText: "#ffffff" },
  { id: "yellow", name: "Yellow", accent: "#f59e0b", userBg: "#78350f", userText: "#fff7ed", submitBg: "#d97706", submitText: "#0b0b0b" },
  { id: "pink", name: "Pink", accent: "#ec4899", userBg: "#831843", userText: "#fce7f3", submitBg: "#db2777", submitText: "#ffffff" },
  { id: "orange", name: "Orange", accent: "#f97316", userBg: "#7c2d12", userText: "#ffedd5", submitBg: "#ea580c", submitText: "#111111" },
  { id: "purple_plus", name: "Purple", badge: "plus", accent: "#8b5cf6", userBg: "#3b0764", userText: "#f3e8ff", submitBg: "#7c3aed", submitText: "#ffffff" },
  { id: "black_pro", name: "Black", badge: "pro", accent: "#111213", userBg: "#0b0b0c", userText: "#ededed", submitBg: "#151516", submitText: "#f5f5f5" },

  // Additional curated sets
  { id: "emerald", name: "Emerald", accent: "#10b981", userBg: "#064e3b", userText: "#d1fae5", submitBg: "#059669", submitText: "#ffffff" },
  { id: "sky", name: "Sky", accent: "#0ea5e9", userBg: "#0c4a6e", userText: "#e0f2fe", submitBg: "#0284c7", submitText: "#ffffff" },
  { id: "rose", name: "Rose", accent: "#f43f5e", userBg: "#7f1d1d", userText: "#ffe4e6", submitBg: "#e11d48", submitText: "#ffffff" },
  { id: "slate", name: "Slate", accent: "#64748b", userBg: "#111827", userText: "#e5e7eb", submitBg: "#374151", submitText: "#ffffff" },
  { id: "indigo", name: "Indigo", accent: "#6366f1", userBg: "#1e1b4b", userText: "#e0e7ff", submitBg: "#4f46e5", submitText: "#ffffff" },
  { id: "teal", name: "Teal", accent: "#14b8a6", userBg: "#064e4e", userText: "#ccfbf1", submitBg: "#0d9488", submitText: "#ffffff" },
  { id: "magenta", name: "Magenta", accent: "#d946ef", userBg: "#581c87", userText: "#f5d0fe", submitBg: "#a21caf", submitText: "#ffffff" },
  { id: "sunset", name: "Sunset", accent: "#fb7185", userBg: "#7c2d12", userText: "#fde2e4", submitBg: "#f97316", submitText: "#111111" }
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

    const swatches = document.createElement("div");
    swatches.className = "swatches";

    const s1 = document.createElement("div"); s1.className = "pill"; s1.style.background = preset.reset ? "linear-gradient(90deg,#c8c8c8,#e0e0e0)" : preset.accent; swatches.appendChild(s1);
    const s2 = document.createElement("div"); s2.className = "pill"; s2.style.background = preset.reset ? "linear-gradient(90deg,#c8c8c8,#e0e0e0)" : preset.userBg; swatches.appendChild(s2);
    const s3 = document.createElement("div"); s3.className = "pill"; s3.style.background = preset.reset ? "linear-gradient(90deg,#c8c8c8,#e0e0e0)" : preset.submitBg; swatches.appendChild(s3);

    const ring = document.createElement("div");
    ring.className = "selected-ring";
    ring.style.display = "none";

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

    // Determine which preset matches storage
    let selectedId = "reset";
    if (themeVars && themeVars["--interactive-bg-accent-default"]) {
      const accent = themeVars["--interactive-bg-accent-default"]; 
      const userBg = themeVars["--theme-user-msg-bg"]; 
      const submitBg = themeVars["--theme-submit-btn-bg"]; 
      const match = PRESETS.find(p => !p.reset && p.accent === accent && p.userBg === userBg && p.submitBg === submitBg);
      if (match) selectedId = match.id; else selectedId = "custom"; // custom selection
    }

    for (const card of cards) {
      const ring = card.querySelector(".selected-ring");
      if (!ring) continue;
      ring.style.display = (card.dataset.id === selectedId) ? "block" : "none";
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