import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { app, auth } from "../firebase";
import { saveFcmToken } from "./firestore";

const fgListeners = new Set();
let messaging = null;
let unsubMessage = null;

export function onForegroundUpdateMessage(fn) {
  fgListeners.add(fn);
  return () => fgListeners.delete(fn);
}

async function getMessagingSafe() {
  if (messaging) return messaging;
  const ok = await isSupported().catch(() => false);
  if (!ok) return null;
  messaging = getMessaging(app);
  if (!unsubMessage) {
    unsubMessage = onMessage(messaging, (payload) => {
      for (const fn of fgListeners) {
        try {
          fn(payload);
        } catch {
          /* ignore */
        }
      }
    });
  }
  return messaging;
}

/**
 * Запросить разрешение и сохранить FCM-токен в профиль.
 * @returns {Promise<string|null>}
 */
export async function enablePushNotifications() {
  if (!auth.currentUser) return null;
  const vapid = (import.meta.env.VITE_FIREBASE_VAPID_KEY || "").trim();
  if (!vapid) {
    console.warn("[push] Нет VITE_FIREBASE_VAPID_KEY");
    return null;
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const msg = await getMessagingSafe();
  if (!msg) return null;

  const reg = await navigator.serviceWorker.ready;
  const token = await getToken(msg, { vapidKey: vapid, serviceWorkerRegistration: reg });
  if (!token) return null;

  await saveFcmToken(token);
  return token;
}

/** Тихая попытка обновить токен, если разрешение уже есть. */
export async function syncPushTokenIfGranted() {
  if (!auth.currentUser) return null;
  if (!("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;
  const vapid = (import.meta.env.VITE_FIREBASE_VAPID_KEY || "").trim();
  if (!vapid) return null;

  try {
    const msg = await getMessagingSafe();
    if (!msg) return null;
    const reg = await navigator.serviceWorker.ready;
    const token = await getToken(msg, { vapidKey: vapid, serviceWorkerRegistration: reg });
    if (token) await saveFcmToken(token);
    return token;
  } catch (e) {
    console.warn("[push] sync:", e?.message || e);
    return null;
  }
}
