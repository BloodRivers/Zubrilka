/**
 * После деплоя hosting: обновить app/release и разослать FCM.
 *
 * Нужен service account:
 *   Firebase Console → Project settings → Service accounts → Generate new private key
 *   Сохранить как serviceAccount.json в корне (в .gitignore)
 *
 *   npm i firebase-admin
 *   node scripts/notify-update.mjs
 *   node scripts/notify-update.mjs "Текст пуша"
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const saPath = resolve(root, "serviceAccount.json");
if (!existsSync(saPath)) {
  console.error(
    "Нет serviceAccount.json в корне проекта.\n"
    + "Firebase Console → Project settings → Service accounts → Generate new private key."
  );
  process.exit(1);
}

const sa = JSON.parse(readFileSync(saPath, "utf8"));
if (!getApps().length) {
  initializeApp({ credential: cert(sa) });
}

const db = getFirestore();
const messaging = getMessaging();

const messageText = process.argv[2] || "Вышла новая версия Забубрилки";
const version = new Date().toISOString();

await db.doc("app/release").set(
  {
    version,
    message: messageText,
    updated_at: FieldValue.serverTimestamp(),
  },
  { merge: true }
);
console.log("app/release →", version);

const users = await db.collection("users").where("push_enabled", "==", true).get();
const tokens = [];
users.forEach((d) => {
  const t = d.data()?.fcm_token;
  if (typeof t === "string" && t.length > 20) tokens.push(t);
});

if (!tokens.length) {
  console.log("Нет FCM-токенов — пуш не отправлен (баннер по app/release всё равно сработает).");
  process.exit(0);
}

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const HOST = "https://zubrilka-b2c47.web.app";
const ICON = `${HOST}/icon-192.png`;
const BADGE = `${HOST}/icon-192.png`;

let ok = 0;
let fail = 0;
for (const batch of chunk(tokens, 400)) {
  const res = await messaging.sendEachForMulticast({
    tokens: batch,
    notification: {
      title: "Забубрилка",
      body: messageText,
      image: ICON,
    },
    data: {
      type: "app_update",
      version,
      title: "Забубрилка",
      body: messageText,
    },
    webpush: {
      fcmOptions: { link: HOST + "/" },
      notification: {
        title: "Забубрилка",
        body: messageText,
        icon: ICON,
        badge: BADGE,
        image: ICON,
      },
    },
  });
  ok += res.successCount;
  fail += res.failureCount;
}

console.log(`FCM: ok=${ok}, fail=${fail}, tokens=${tokens.length}`);
