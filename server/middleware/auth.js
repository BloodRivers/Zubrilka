import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) {
  const cred = process.env.FIREBASE_SERVICE_ACCOUNT
    ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    : undefined;
  initializeApp(cred ? { credential: cred } : undefined);
}

export const fbdb = getFirestore();

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Нет токена" });
  try {
    req.user = await getAuth().verifyIdToken(token);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Недействительный токен" });
  }
}

export async function logUsage({ uid, endpoint, usage }) {
  const row = {
    uid,
    endpoint,
    prompt_tokens: usage?.prompt_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
    at: new Date().toISOString(),
  };
  console.log("[usage]", JSON.stringify(row));
  try {
    await fbdb.collection("usage_logs").add(row);
  } catch (e) {
    console.error("usage_logs write failed:", e.message);
  }
}