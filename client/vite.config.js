import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function writeFirebaseSwConfig(mode) {
  const env = loadEnv(mode, __dirname, "");
  const cfg = {
    apiKey: env.VITE_FIREBASE_API_KEY || "",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: env.VITE_FIREBASE_APP_ID || "",
  };
  const out = path.resolve(__dirname, "public/firebase-sw-config.js");
  fs.writeFileSync(out, `self.__FIREBASE_CONFIG__=${JSON.stringify(cfg)};\n`);
}

function firebaseSwConfigPlugin() {
  return {
    name: "firebase-sw-config",
    configResolved(config) {
      writeFirebaseSwConfig(config.mode);
    },
  };
}

export default defineConfig({
  plugins: [react(), firebaseSwConfigPlugin()],
});
