(() => {
  "use strict";

  const api = globalThis.browser ?? globalThis.chrome;

  const $ = (id) => document.getElementById(id);

  const el = {
    toggle: $("toggle"),
    mode: $("mode"),
    autofix: $("autofix"),
    skipdark: $("skipdark"),
    strength: $("strength"),
    openOptions: $("openOptions"),
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

  async function loadUI() {
    const s = await storageGet(["pdEnabled", "pdStrength", "pdAutoFixText", "pdSkipNativeDark", "pdMode"]);
    el.toggle.checked = (s.pdEnabled ?? defaults.pdEnabled);
    el.autofix.checked = (s.pdAutoFixText ?? defaults.pdAutoFixText);
    el.skipdark.checked = (s.pdSkipNativeDark ?? defaults.pdSkipNativeDark);
    el.mode.value = (s.pdMode ?? defaults.pdMode);

    const val = s.pdStrength ?? defaults.pdStrength;
    el.strength.value = String(clamp(parseFloat(val), 0.6, 1.0));
  }

  async function bind() {
    el.toggle.addEventListener("change", async () => {
      await storageSet({ pdEnabled: !!el.toggle.checked });
    });

    el.autofix.addEventListener("change", async () => {
      await storageSet({ pdAutoFixText: !!el.autofix.checked });
    });

    el.skipdark.addEventListener("change", async () => {
      await storageSet({ pdSkipNativeDark: !!el.skipdark.checked });
    });

    el.mode.addEventListener("change", async () => {
      await storageSet({ pdMode: el.mode.value });
    });

    el.strength.addEventListener("input", async () => {
      const v = clamp(parseFloat(el.strength.value || defaults.pdStrength), 0.6, 1.0);
      await storageSet({ pdStrength: v });
    });

    el.openOptions.addEventListener("click", async () => {
      if (api.runtime?.openOptionsPage) api.runtime.openOptionsPage();
    });

    el.reset.addEventListener("click", async () => {
      await storageSet(defaults);
      await loadUI();
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await loadUI();
    await bind();
  });
})();