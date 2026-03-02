(() => {
  "use strict";

  const api = globalThis.browser ?? globalThis.chrome;
  const $ = (id) => document.getElementById(id);

  const el = {
    mode: $("mode"),
    strength: $("strength"),
    autofix: $("autofix"),
    skipdark: $("skipdark"),
    reset: $("reset")
  };

  const defaults = {
    pdEnabled: true,
    pdStrength: 0.92,
    pdAutoFixText: true,
    pdSkipNativeDark: true,
    pdMode: "softblue"
  };

  function storageGet(keys) {
    try {
      const res = api.storage.local.get(keys);
      if (res && typeof res.then === "function") return res;
      return new Promise((resolve) => api.storage.local.get(keys, resolve));
    } catch {
      return Promise.resolve({});
    }
  }

  function storageSet(obj) {
    try {
      const res = api.storage.local.set(obj);
      if (res && typeof res.then === "function") return res;
      return new Promise((resolve) => api.storage.local.set(obj, resolve));
    } catch {
      return Promise.resolve();
    }
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  async function load() {
    const s = await storageGet(["pdMode","pdStrength","pdAutoFixText","pdSkipNativeDark"]);
    el.mode.value = s.pdMode ?? defaults.pdMode;
    el.autofix.checked = s.pdAutoFixText ?? defaults.pdAutoFixText;
    el.skipdark.checked = s.pdSkipNativeDark ?? defaults.pdSkipNativeDark;

    const v = s.pdStrength ?? defaults.pdStrength;
    el.strength.value = String(clamp(parseFloat(v), 0.6, 1.0));
  }

  async function bind() {
    el.mode.addEventListener("change", () => storageSet({ pdMode: el.mode.value }));
    el.autofix.addEventListener("change", () => storageSet({ pdAutoFixText: !!el.autofix.checked }));
    el.skipdark.addEventListener("change", () => storageSet({ pdSkipNativeDark: !!el.skipdark.checked }));
    el.strength.addEventListener("input", () => {
      const v = clamp(parseFloat(el.strength.value || defaults.pdStrength), 0.6, 1.0);
      storageSet({ pdStrength: v });
    });

    el.reset.addEventListener("click", async () => {
      await storageSet(defaults);
      await load();
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await load();
    await bind();
  });
})();