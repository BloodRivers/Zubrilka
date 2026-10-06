/**
 * Предгенерация озвучки интервьюера (задание 3, устная часть) через Polza TTS.
 *
 *   POLZA_API_KEY=... node scripts/tts-task3.mjs
 *   POLZA_API_KEY=... node scripts/tts-task3.mjs --force   # перезаписать всё
 *
 * Модель по умолчанию — google/gemini-3.8-flash-lite-tts (если её нет в каталоге,
 * поставь другую: openai/gpt-4o-mini-tts, openai/tts-1-hd, elevenlabs/...):
 *   POLZA_TTS_MODEL=openai/gpt-4o-mini-tts node scripts/tts-task3.mjs
 *
 * Файлы ложатся в client/public/oral/task_3_audio/<variantId>/*.mp3 — деплоится
 * статикой Firebase Hosting и играется в приложении без расхода токенов.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const key = process.env.POLZA_API_KEY;
if (!key) {
  console.error("Нужен POLZA_API_KEY (Polza: https://polza.ai/dashboard)");
  process.exit(1);
}
const model = process.env.POLZA_TTS_MODEL || "google/gemini-3.8-flash-lite-tts";
const voice = process.env.POLZA_TTS_VOICE || "alloy";
const force = process.argv.includes("--force");

const task = JSON.parse(
  readFileSync(join(root, "client/src/data/use/english/oral/task-3.json"), "utf8")
);
const outRoot = join(root, "client/public/oral/task_3_audio");

const phrases = [];
for (const v of task.variants) {
  const dir = join(outRoot, v.id);
  phrases.push({ dir, name: "intro.mp3", text: task.introStart + v.theme + task.introEnd });
  v.questions.forEach((q, i) => phrases.push({ dir, name: `${i}.mp3`, text: q }));
  phrases.push({ dir, name: "finisher.mp3", text: task.finisher });
}

let ok = 0;
let skipped = 0;
for (const p of phrases) {
  const file = join(p.dir, p.name);
  if (!force) {
    try {
      readFileSync(file);
      skipped += 1;
      console.log("skip", p.name, "— уже есть (--force перезапишет)");
      continue;
    } catch {}
  }
  const res = await fetch("https://polza.ai/api/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: p.text, voice, response_format: "mp3" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("FAIL", p.name, "→", res.status, data?.error?.message || "");
    process.exitCode = 1;
    continue;
  }
  mkdirSync(p.dir, { recursive: true });
  writeFileSync(file, Buffer.from(data.audio, "base64"));
  ok += 1;
  console.log(
    "ok", file, `${data.duration ?? "?"}s`, data?.usage ? `~${data.usage.cost}₽ lang` : ""
  );
}

console.log(`\n${model} → ${ok} сгенерировано, ${skipped} пропущено, осталось на диске.`);