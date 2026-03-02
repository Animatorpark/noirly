(async function () {
  "use strict";

  const api = globalThis.browser ?? globalThis.chrome;
  const ROOT = document.documentElement;
  const host = location.hostname;

  function storageGet(keys) {
    try {
      const res = api.storage.local.get(keys);
      if (res && typeof res.then === "function") return res;
      return new Promise((resolve) => api.storage.local.get(keys, resolve));
    } catch {
      return Promise.resolve({});
    }
  }

  // Safe-mode list (can extend later)
const AUTO_SAFE_MODE =
  // WhatsApp
  host === "web.whatsapp.com" || host.endsWith(".whatsapp.com") ||

  // YouTube
  host === "www.youtube.com" || host === "m.youtube.com" || host === "studio.youtube.com" ||
  host === "music.youtube.com" || host.endsWith(".youtube.com") ||
  host === "www.youtube-nocookie.com" || host.endsWith("youtube-nocookie.com") ||

  // Discord
  host === "discord.com" || host === "www.discord.com" ||
  host === "canary.discord.com" || host === "ptb.discord.com";

  if (AUTO_SAFE_MODE) ROOT.setAttribute("data-pd-safemode", "1");
  else ROOT.removeAttribute("data-pd-safemode");

    // cPanel (hostname + common port)
  host.includes("cpanel") ||
  location.port === "2083" ||   // secure cPanel port
  location.pathname.includes("/cpanel");

  // ---------- color utils ----------
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function parseRGBA(str) {
    const m = String(str).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
    if (!m) return null;
    return {
      r: clamp(parseFloat(m[1]), 0, 255),
      g: clamp(parseFloat(m[2]), 0, 255),
      b: clamp(parseFloat(m[3]), 0, 255),
      a: m[4] === undefined ? 1 : clamp(parseFloat(m[4]), 0, 1),
    };
  }

  function srgbToLin(c) {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function luminance(rgb) {
    const R = srgbToLin(rgb.r);
    const G = srgbToLin(rgb.g);
    const B = srgbToLin(rgb.b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }

  function contrastRatio(l1, l2) {
    const L1 = Math.max(l1, l2);
    const L2 = Math.min(l1, l2);
    return (L1 + 0.05) / (L2 + 0.05);
  }

  function getSolidBackgroundLuminance(el) {
    let p = el;
    for (let i = 0; i < 10 && p; i++) {
      const bg = parseRGBA(getComputedStyle(p).backgroundColor);
      if (bg && bg.a > 0.15) return luminance(bg);
      p = p.parentElement;
    }
    return 1.0;
  }

  function getTextLuminance(el) {
    const col = parseRGBA(getComputedStyle(el).color);
    return col ? luminance(col) : 0;
  }

  function applyTheme(enabled, strength, mode) {
    // mode is always set (even if disabled) so popup changes instantly
    ROOT.setAttribute("data-pd-mode", mode || "softblue");

    if (enabled) {
      ROOT.setAttribute("data-premium-dark", "1");
      ROOT.style.setProperty("--pd-strength", String(strength ?? 0.92));
    } else {
      ROOT.removeAttribute("data-premium-dark");
      ROOT.style.removeProperty("--pd-strength");
    }
  }

  // ---------- Auto text fixer ----------
  let fixerTimer = null;
  let moFix = null;
  const FLAG = "data-pd-fix";

function isLikelyTextElement(el) {
  if (!el || el.nodeType !== 1) return false;

  const tag = el.tagName.toLowerCase();

  // Never touch code / editors
  if (["pre", "code", "kbd", "samp"].includes(tag)) return false;
  if (el.closest("pre, code, kbd, samp")) return false;
  if (el.closest(".CodeMirror, .monaco-editor, .ace_editor, .hljs")) return false;

  if (["img", "video", "canvas", "svg", "path", "picture", "iframe"].includes(tag)) return false;
  if (["input", "textarea", "select", "option"].includes(tag)) return false;
  if (tag === "script" || tag === "style") return false;

  const text = (el.innerText || "").trim();
  return text.length > 0;
}

  function shouldSkipBySize(cs) {
    const fs = parseFloat(cs.fontSize || "0");
    return fs > 0 && fs < 10.5;
  }

  function fixBatch(rootNode) {
    const scope = rootNode && rootNode.querySelectorAll ? rootNode : document;
    const nodes = scope.querySelectorAll
      ? scope.querySelectorAll("p, span, div, li, a, label, small, strong, em, h1, h2, h3, h4, h5, h6, button")
      : [];

    for (const el of nodes) {
      if (!isLikelyTextElement(el)) continue;

      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
      if (shouldSkipBySize(cs)) continue;

      const col = parseRGBA(cs.color);
      if (!col) continue;

      const textLum = luminance(col);
      if (textLum >= 0.45) continue;

      let bgLum = null;
      let p = el;
      for (let i = 0; i < 7 && p; i++) {
        const bg = parseRGBA(getComputedStyle(p).backgroundColor);
        if (bg && bg.a > 0.15) { bgLum = luminance(bg); break; }
        p = p.parentElement;
      }
      if (bgLum === null) bgLum = 0.07;
      if (bgLum > 0.40) continue;

      const tag = el.tagName.toLowerCase();
      let target = "rgba(255,255,255,0.92)";
      if (tag === "small") target = "rgba(255,255,255,0.70)";
      if (tag === "a") target = "var(--pd-link)";
      if (tag.startsWith("h")) target = "rgba(255,255,255,0.96)";

      el.style.setProperty("color", target, "important");
      el.setAttribute(FLAG, "1");
    }
  }

  function clearFixes() {
    const fixed = document.querySelectorAll(`[${FLAG}="1"]`);
    for (const el of fixed) {
      el.style.removeProperty("color");
      el.removeAttribute(FLAG);
    }
  }

  function startTextFixer() {
    if (fixerTimer) return;
    fixBatch(document);

    moFix = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          for (const n of m.addedNodes) {
            if (n && n.nodeType === 1) fixBatch(n);
          }
        }
      }
    });

    moFix.observe(document.documentElement, { childList: true, subtree: true });
    fixerTimer = setInterval(() => fixBatch(document), 2200);
  }

  function stopTextFixer() {
    if (moFix) { try { moFix.disconnect(); } catch {} }
    moFix = null;

    if (fixerTimer) clearInterval(fixerTimer);
    fixerTimer = null;

    clearFixes();
  }

  // Detect native dark WITHOUT extension
  function detectNativeDarkWithoutExtension() {
    if (!document.body) return false;

    const had = ROOT.hasAttribute("data-premium-dark");
    const prevStrength = ROOT.style.getPropertyValue("--pd-strength");

    if (had) ROOT.removeAttribute("data-premium-dark");
    ROOT.style.removeProperty("--pd-strength");

    // Force recalc
    // eslint-disable-next-line no-unused-expressions
    document.body.offsetHeight;

    let result = false;
    try {
      const cs = getComputedStyle(ROOT);
      if ((cs.colorScheme || "").includes("dark")) result = true;
      else {
        const body = document.body;
        const bgLum = getSolidBackgroundLuminance(body);

        let textEl = body.querySelector("h1,h2,h3,p,span,a,li,label,button,div");
        if (!textEl) textEl = body;

        const textLum = getTextLuminance(textEl);
        const ratio = contrastRatio(textLum, bgLum);

        if (bgLum <= 0.28 && textLum >= 0.55 && ratio >= 3.6) result = true;
      }
    } catch {
      result = false;
    }

    if (had) ROOT.setAttribute("data-premium-dark", "1");
    if (prevStrength) ROOT.style.setProperty("--pd-strength", prevStrength);

    return result;
  }

  // Settings + recompute
  const defaults = {
    pdEnabled: true,
    pdStrength: 0.92,
    pdAutoFixText: true,
    pdSkipNativeDark: true,
    pdMode: "softblue"
  };

  let lastUrl = location.href;
  let scheduled = false;

  async function recomputeAndApply() {
    if (!document.body) return;

    const s = await storageGet(["pdEnabled", "pdStrength", "pdAutoFixText", "pdSkipNativeDark", "pdMode"]);

        // HARD DISABLE on cPanel (prevents blur/fog in editor)
    const IS_CPANEL =
      location.port === "2083" ||
      host.includes("cpanel") ||
      location.pathname.includes("/cpanel") ||
      location.pathname.includes("/frontend/jupiter/");

    if (IS_CPANEL) {
      // ensure theme is OFF
      ROOT.setAttribute("data-pd-mode", (s?.pdMode ?? "softblue")); // keep mode value harmless
      ROOT.removeAttribute("data-premium-dark");
      ROOT.style.removeProperty("--pd-strength");
      stopTextFixer();
      return; // do not run native-dark detection or painting
    }

    const pdEnabled = s.pdEnabled ?? defaults.pdEnabled;
    const pdStrength = s.pdStrength ?? defaults.pdStrength;
    const pdAutoFixText = s.pdAutoFixText ?? defaults.pdAutoFixText;
    const pdSkipNativeDark = s.pdSkipNativeDark ?? defaults.pdSkipNativeDark;
    const pdMode = s.pdMode ?? defaults.pdMode;

    let nativeDark = false;
    if (pdSkipNativeDark) {
      nativeDark = detectNativeDarkWithoutExtension();
      if (nativeDark) ROOT.setAttribute("data-pd-native-dark", "1");
      else ROOT.removeAttribute("data-pd-native-dark");
    } else {
      ROOT.removeAttribute("data-pd-native-dark");
    }

    const shouldEnable = pdEnabled && !(pdSkipNativeDark && nativeDark);

    applyTheme(shouldEnable, pdStrength, pdMode);

    if (shouldEnable && pdAutoFixText) startTextFixer();
    else stopTextFixer();
  }

  function scheduleRecompute() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      recomputeAndApply();
    });
  }

  function init() {
    scheduleRecompute();
    setTimeout(scheduleRecompute, 250);
    setTimeout(scheduleRecompute, 900);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  try {
    api.storage.onChanged.addListener(() => scheduleRecompute());
  } catch {}

  const moApp = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      scheduleRecompute();
      return;
    }
    scheduleRecompute();
  });

  moApp.observe(document.documentElement, { childList: true, subtree: true });
})();