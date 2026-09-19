// Runs before first paint (blocking script in <head>) so the saved theme is applied
// without a flash. Same-origin external file, so it satisfies `script-src 'self'`.
// Reads the same key/version as src/lib/storage/settings.ts (a test keeps them in sync).
(function () {
  var theme = null;
  try {
    var raw = window.localStorage.getItem("dna-encoder:settings");
    if (raw && raw.length < 10000) {
      var envelope = JSON.parse(raw);
      var saved = envelope && envelope.version === 1 && envelope.data && envelope.data.theme;
      if (saved === "light" || saved === "dark") theme = saved;
    }
  } catch (_) {
    // Blocked or corrupted storage: fall back to the OS preference below.
  }
  if (!theme) {
    theme =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  }
  document.documentElement.setAttribute("data-theme", theme);
})();
