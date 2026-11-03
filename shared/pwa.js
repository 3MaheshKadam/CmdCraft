/**
 * Registers the service worker (offline support) and shows an "Install app" button where the browser offers one.
 * Safe to include on every page: it does nothing when service workers are unavailable.
 */
(function () {
  const here = document.currentScript && document.currentScript.src ? document.currentScript.src : null;
  if (!("serviceWorker" in navigator) || !here || !/^https?:$/.test(location.protocol)) return;
  const root = new URL("../", here);                     // shared/pwa.js -> site root
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL("sw.js", root).href, { scope: root.pathname }).catch(() => { /* private mode or blocked */ });
  });
  let deferred = null;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); deferred = e;
    const note = document.getElementById("install-note"); if (!note) return;
    note.classList.remove("hidden"); note.textContent = "";
    const b = document.createElement("button");
    b.className = "px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:border-emerald-400";
    b.innerHTML = '<i class="fa-solid fa-download mr-1"></i>Install CmdCraft as an app (works offline)';
    b.addEventListener("click", () => { if (deferred) { deferred.prompt(); deferred = null; note.classList.add("hidden"); } });
    note.appendChild(b);
  });
})();
