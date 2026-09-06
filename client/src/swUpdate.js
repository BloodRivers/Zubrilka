/** Обновление PWA / service worker без переустановки. */

let refreshing = false;

function reloadOnce() {
  if (refreshing) return;
  refreshing = true;
  window.location.reload();
}

function wireRegistration(reg) {
  navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);

  const askWaiting = () => {
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
  };

  askWaiting();
  reg.addEventListener("updatefound", () => {
    const sw = reg.installing;
    if (!sw) return;
    sw.addEventListener("statechange", () => {
      if (sw.state === "installed" && navigator.serviceWorker.controller) {
        askWaiting();
      }
    });
  });

  const poke = () => {
    reg.update?.().catch(() => {});
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") poke();
  });
  window.addEventListener("focus", poke);

  // Периодически на открытом приложении
  setInterval(poke, 60_000);
  poke();
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(wireRegistration).catch(() => {});
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
    // controllerchange сделает reload; запасной таймер
    setTimeout(reloadOnce, 800);
    return { updated: true, reloaded: false };
  }

  // Нет нового SW — всё равно жёстко перезагружаем страницу
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
  return { updated: false, reloaded: true };
}
