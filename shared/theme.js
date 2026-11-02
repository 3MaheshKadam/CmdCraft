/**
 * CmdCraft theming. Load right after the Tailwind CDN script, in <head>.
 *
 * Colours are CSS variables, so one attribute (<html data-theme="light|dark">) restyles the whole UI.
 * Light mode mirrors each Tailwind palette (shade 400 <-> 600, 300 <-> 700, 900 <-> 100...), which keeps
 * every existing class readable without editing it.
 * Preference ("auto" | "light" | "dark") lives in localStorage; "auto" follows the operating system.
 */
(function () {
  const STORAGE_KEY = "cmdcraft_theme";
  const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

  // Tailwind v3 default palettes (dark mode uses them as-is).
  const PALETTES = {
    n: ["250 250 250", "245 245 245", "229 229 229", "212 212 212", "163 163 163", "115 115 115", "82 82 82", "64 64 64", "38 38 38", "23 23 23", "10 10 10"],
    emerald: ["236 253 245", "209 250 229", "167 243 208", "110 231 183", "52 211 153", "16 185 129", "5 150 105", "4 120 87", "6 95 70", "6 78 59", "2 44 34"],
    amber: ["255 251 235", "254 243 199", "253 230 138", "252 211 77", "251 191 36", "245 158 11", "217 119 6", "180 83 9", "146 64 14", "120 53 15", "69 26 3"],
    red: ["254 242 242", "254 226 226", "254 202 202", "252 165 165", "248 113 113", "239 68 68", "220 38 38", "185 28 28", "153 27 27", "127 29 29", "69 10 10"],
    slate: ["248 250 252", "241 245 249", "226 232 240", "203 213 225", "148 163 184", "100 116 139", "71 85 105", "51 65 85", "30 41 59", "15 23 42", "2 6 23"]
  };

  const vars = (reverse) => {
    let css = "";
    Object.entries(PALETTES).forEach(([name, rgb]) => {
      SHADES.forEach((shade, i) => { css += `--${name}-${shade}:${rgb[reverse ? SHADES.length - 1 - i : i]};`; });
    });
    return css;
  };

  const style = document.createElement("style");
  style.id = "theme-vars";
  style.textContent =
    `:root{${vars(false)}--s0:0 0 0;--s1:10 10 10;--s2:5 5 5;--hover:255 255 255;--sb-track:#000000;--sb-thumb:#2a2a2a;--sb-thumb-hover:#444444;}` +
    `html[data-theme="light"]{${vars(true)}--s0:250 250 250;--s1:255 255 255;--s2:244 244 244;--hover:0 0 0;--sb-track:#f4f4f4;--sb-thumb:#c4c4c4;--sb-thumb-hover:#9a9a9a;}`;
  document.head.appendChild(style);

  // Tailwind config: palettes and surfaces read the variables above.
  const scale = (name) => Object.fromEntries(SHADES.map(s => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));
  const surface = (v) => `rgb(var(${v}) / <alpha-value>)`;
  if (window.tailwind) {
    window.tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          colors: {
            neutral: scale("n"),
            gray: scale("n"),
            emerald: scale("emerald"),
            amber: scale("amber"),
            red: scale("red"),
            slate: scale("slate"),
            surface: { 0: surface("--s0"), 1: surface("--s1"), 2: surface("--s2") }
          },
          fontFamily: {
            mono: ['"Fira Code"', "JetBrains Mono", "Menlo", "Consolas", "monospace"],
            sans: ['"Fira Code"', "JetBrains Mono", "Menlo", "Consolas", "monospace"]
          }
        }
      }
    };
  }

  // ---- preference handling ----
  const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  const readPref = () => {
    try { const v = localStorage.getItem(STORAGE_KEY); return v === "light" || v === "dark" ? v : "auto"; } catch (e) { return "auto"; }
  };
  const effective = (pref) => (pref === "auto" ? (media && media.matches ? "light" : "dark") : pref);

  const ICONS = { auto: "fa-solid fa-circle-half-stroke", light: "fa-solid fa-sun", dark: "fa-solid fa-moon" };
  const LABELS = { auto: "Theme: follows your system (click for Light)", light: "Theme: Light (click for Dark)", dark: "Theme: Dark (click for Auto)" };

  function apply() {
    const pref = readPref();
    const theme = effective(pref);
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    const btn = document.getElementById("btn-theme");
    if (btn) {
      btn.title = LABELS[pref];
      const icon = btn.querySelector("i");
      if (icon) icon.className = ICONS[pref];
    }
  }

  const NEXT = { auto: "light", light: "dark", dark: "auto" };
  function cycle() {
    const next = NEXT[readPref()];
    try { if (next === "auto") localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* storage blocked */ }
    apply();
  }

  apply(); // before first paint, so there is no flash of the wrong theme
  if (media) {
    const onChange = () => { if (readPref() === "auto") apply(); };
    if (media.addEventListener) media.addEventListener("change", onChange); else media.addListener(onChange);
  }
  window.addEventListener("storage", e => { if (e.key === STORAGE_KEY) apply(); });
  window.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btn-theme");
    if (btn) btn.addEventListener("click", cycle);
    apply();
  });
  window.CmdTheme = { cycle, apply, preference: readPref };
})();
