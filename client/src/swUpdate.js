/** Обновление PWA / service worker без переустановки. */

let refreshing = false;
let registration = null;
const updateListeners = new Set();

function reloadOnce() {
  if (refreshing) return;
  refreshing = true;
  window.location.reload();
}

function emitUpdateAvailable(available) {
  for (const fn of updateListeners) {
    try {
      fn(available);
    } catch {
      /* ignore */
    }
  }
}

function wireRegistration(reg) {
  registration = reg;
  navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);

  const onWaiting = () => {
    if (reg.waiting && navigator.serviceWorker.controller) {
      emitUpdateAvailable(true);
    }
  };

  onWaiting();
  reg.addEventListener("updatefound", () => {
    const sw = reg.installing;
    if (!sw) return;
    sw.addEventListener("statechange", () => {
      if (sw.state === "installed") onWaiting();
    });
  });

  let lastPoke = 0;
  const poke = () => {
    const now = Date.now();
    if (now - lastPoke < 60_000) return; // ponytail: throttle focus-spam, updates need not be instant
    lastPoke = now;
    reg.update?.().catch(() => {});
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") poke();
  });
  window.addEventListener("focus", poke);
  poke();
}

/** Подписка на появление waiting SW (есть обновление). */
export function onAppUpdateAvailable(fn) {
  updateListeners.add(fn);
  if (registration?.waiting && navigator.serviceWorker.controller) fn(true);
  return () => updateListeners.delete(fn);
}

/** Применить обновление: активировать новый SW и перезагрузить. */
export async function applyAppUpdate() {
  const reg = registration || (await navigator.serviceWorker.getRegistration());
  if (reg?.waiting) {
    reg.waiting.postMessage({ type: "SKIP_WAITING" });
    setTimeout(reloadOnce, 900);
    return;
  }
  await checkForAppUpdate();
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      wireRegistration(reg);
      // Первый визит — сразу активируем SW
      if (reg.waiting && !navigator.serviceWorker.controller) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    }).catch(() => {});
  });
}

/**
 * Принудительно проверить обновление и перезагрузить.
 * Для Android PWA, где нет pull-to-refresh.
 */
export async function checkForAppUpdate() {
  if (!("serviceWorker" in navigator)) {
    window.location.reload();
    return { updated: false, reloaded: true };
  }

  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    window.location.reload();
    return { updated: false, reloaded: true };
  }

  try {
    await reg.update();
  } catch {
    /* сеть */
  }

  if (reg.waiting) {
    reg.waiting.postMessage({ type: "SKIP_WAITING" });
    setTimeout(reloadOnce, 800);
    return { updated: true, reloaded: false };
  }

  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
  return { updated: false, reloaded: true };
}
