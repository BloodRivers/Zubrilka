import { synthesizeSpeech, TTS_MODEL, TTS_VOICE } from "./api/ai";
import { getCachedSpeech, cacheSpeech } from "./poemAudioStore";

let generation = 0;
let playing = null;
let stopCurrent = null;

export function stopSpeech() {
  generation += 1;
  if (!playing) return;
  const audio = playing;
  playing = null;
  audio.pause();
  if (stopCurrent) {
    const resolve = stopCurrent;
    stopCurrent = null;
    resolve();
  }
}

async function getSpeech(text) {
  const key = `${TTS_MODEL}|${TTS_VOICE}|${text}`;
  let blob = null;
  try {
    blob = await getCachedSpeech(key);
  } catch {
    /* без кэша просто сгенерируем заново */
  }
  if (!blob) {
    blob = await synthesizeSpeech(text);
    try {
      await cacheSpeech(key, blob);
    } catch {
      /* кэш необязателен */
    }
  }
  return blob;
}

/** Озвучивает по строкам: сгенерированное хранится в IndexedDB и переиспользуется. */
export async function speakRussian(text, rate = 1) {
  const parts = String(text || "")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return;
  const own = generation;
  for (const part of parts) {
    if (own !== generation) return;
    const blob = await getSpeech(part);
    if (own !== generation) return;
    const url = URL.createObjectURL(blob);
    await new Promise((resolve) => {
      const audio = new Audio(url);
      audio.playbackRate = rate;
      playing = audio;
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        if (playing === audio) playing = null;
        if (stopCurrent === done) stopCurrent = null;
        URL.revokeObjectURL(url);
        resolve();
      };
      stopCurrent = done;
      audio.onended = done;
      audio.onerror = done;
      audio.play().catch(done);
    });
  }
}
