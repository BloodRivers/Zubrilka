import { consumeAiQuota, fetchAiUsage } from "./firestore";

export const DEFAULT_MODEL = "google/gemini-3.5-flash-lite";

export const MODEL_OPTIONS = [
  { v: "google/gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite" },
];

/** Максимум ИИ-запросов на человека в календарный день. */
export const AI_DAILY_LIMIT = 20;

const KEY_STORE = "zubrilka:polza:key";
const MODEL_STORE = "zubrilka:polza:model";
const LOG_STORE = "zubrilka:polza:logs";
const USAGE_STORE = "zubrilka:ai:usage";
const KEY_EVENT = "zubrilka:polza:keychange";
const LOG_CAP = 40;
const API_BASE = "https://polza.ai/api/v1/chat/completions";
const BALANCE_API = "https://polza.ai/api/v1/balance";
const STORAGE_UPLOAD = "https://polza.ai/api/v1/storage/upload";
const TRANSCRIBE_API = "https://polza.ai/api/v1/audio/transcriptions";
const WHISPER_MODEL = "openai/whisper-1";

function usageDayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function setLocalUsage(day, count) {
  localStorage.setItem(USAGE_STORE, JSON.stringify({ day, count }));
}

export function aiUsedToday() {
  try {
    const u = JSON.parse(localStorage.getItem(USAGE_STORE) || "{}");
    if (u.day !== usageDayKey()) return 0;
    return Number(u.count) || 0;
  } catch {
    return 0;
  }
}

export function aiRemainingToday() {
  return Math.max(0, AI_DAILY_LIMIT - aiUsedToday());
}

/** Подтянуть счётчик с сервера (после логина). */
export async function syncAiUsage() {
  try {
    const { day, count } = await fetchAiUsage();
    setLocalUsage(day, count);
    return count;
  } catch {
    return aiUsedToday();
  }
}

async function reserveAiSlot() {
  if (aiUsedToday() >= AI_DAILY_LIMIT) {
    throw new Error(`Лимит на сегодня: ${AI_DAILY_LIMIT} запросов к ИИ. Завтра снова можно.`);
  }
  try {
    const next = await consumeAiQuota(AI_DAILY_LIMIT);
    setLocalUsage(usageDayKey(), next);
  } catch (err) {
    const msg = err?.message || "";
    if (/лимит/i.test(msg)) throw err;
    const next = aiUsedToday() + 1;
    if (next > AI_DAILY_LIMIT) {
      throw new Error(`Лимит на сегодня: ${AI_DAILY_LIMIT} запросов к ИИ. Завтра снова можно.`);
    }
    setLocalUsage(usageDayKey(), next);
  }
}

export function getApiKey() {
  return localStorage.getItem(KEY_STORE) || "";
}

export function setApiKey(k) {
  if (k) localStorage.setItem(KEY_STORE, k);
  else localStorage.removeItem(KEY_STORE);
  try {
    window.dispatchEvent(new CustomEvent(KEY_EVENT, { detail: getApiKey() }));
  } catch {
    /* ignore */
  }
}

/** Подписка на смену ключа (синк с Firestore / вставка в настройках). */
export function onApiKeyChange(fn) {
  const handler = (e) => fn(e.detail ?? getApiKey());
  window.addEventListener(KEY_EVENT, handler);
  return () => window.removeEventListener(KEY_EVENT, handler);
}

export async function getBalance(explicitKey) {
  const key = (explicitKey ?? getApiKey()).trim();
  if (!key) return null;

  const res = await fetch(BALANCE_API, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const raw = await res.text();
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(data?.message || data?.error?.message || `Polza AI ${res.status}`);
  }
  const amount = data?.amount ?? data?.balance ?? data?.data?.amount;
  if (amount == null || amount === "") throw new Error("Polza не вернул баланс");
  const num = Number(amount);
  if (Number.isNaN(num)) throw new Error("Некорректный баланс от Polza");
  return num;
}

export function getModel() {
  const m = localStorage.getItem(MODEL_STORE) || DEFAULT_MODEL;
  if (!MODEL_OPTIONS.some((o) => o.v === m)) {
    setModel(DEFAULT_MODEL);
    return DEFAULT_MODEL;
  }
  return m;
}

export function setModel(m) {
  if (m) localStorage.setItem(MODEL_STORE, m);
  else localStorage.removeItem(MODEL_STORE);
}

export function listLogs() {
  try {
    return JSON.parse(localStorage.getItem(LOG_STORE) || "[]");
  } catch {
    return [];
  }
}

export function clearLogs() {
  localStorage.removeItem(LOG_STORE);
}

const statusListeners = new Set();
export function onAIStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}
function emitStatus(text) {
  for (const fn of statusListeners) fn(text);
}

function pushLog(entry) {
  const logs = [entry, ...listLogs()].slice(0, LOG_CAP);
  localStorage.setItem(LOG_STORE, JSON.stringify(logs));
}

function assertDataUrl(dataUrl, i) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    throw new Error(`Фото ${i + 1}: битый формат (ожидался data:image/…)`);
  }
  if (dataUrl.length < 2000) {
    throw new Error(`Фото ${i + 1}: почти пустое — не успело загрузиться`);
  }
}

async function dataUrlToBlob(dataUrl) {
  // Без fetch(dataUrl) — в PWA/SW это часто даёт «Failed to fetch»
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Битый data URL фото");
  const header = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1);
  const mime = header.match(/data:(.*?);/)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: mime });
  if (!blob.size) throw new Error("Пустой blob фото");
  return blob;
}

function networkHint(err) {
  const msg = err?.message || String(err || "");
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return "Нет связи с Polza AI (сеть или блокировка). Проверь интернет / VPN и ключ в Настройках.";
  }
  return msg || "Ошибка сети";
}

/** Сначала Storage URL; при сбое сети — data URL inline. */
async function uploadToStorage(dataUrl, key, index, total) {
  assertDataUrl(dataUrl, index);
  emitStatus(total > 1 ? `Загружаю фото ${index + 1}/${total}…` : "Загружаю фото…");

  try {
    const blob = await dataUrlToBlob(dataUrl);
    const form = new FormData();
    form.append("file", blob, `note-${index + 1}.jpg`);
    form.append("storagePolicy", "TEMP_UPLOAD");

    const res = await fetch(STORAGE_UPLOAD, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Загрузка фото в Polza: ${res.status}${t ? ` — ${t.slice(0, 200)}` : ""}`);
    }
    const json = await res.json();
    const url = json?.url;
    if (!url) throw new Error("Polza не вернул URL загруженного фото");

    console.info("[ai] storage ok", index + 1, { bytes: blob.size, url: String(url).slice(0, 100) });
    return url;
  } catch (err) {
    console.warn("[ai] storage fallback → data URL", index + 1, err?.message);
    emitStatus("Storage недоступен — отправляю фото напрямую…");
    // Vision принимает data:image/…; лимит размера — поэтому фото уже сжаты
    return dataUrl;
  }
}

function providerFor(model) {
  if (model.startsWith("openai/")) return { only: ["OpenAI"], allow_fallbacks: false };
  if (model.startsWith("anthropic/")) return { only: ["Anthropic"], allow_fallbacks: false };
  return null;
}

export function collapseRepeats(text) {
  if (!text) return "";
  const lines = String(text).replace(/\r/g, "").split("\n");
  const out = [];
  let prev = null;
  let streak = 0;
  for (const line of lines) {
    const t = line.trimEnd();
    if (t === prev) {
      streak += 1;
      if (streak >= 2) continue;
    } else {
      prev = t;
      streak = 0;
    }
    out.push(line);
  }
  const paras = out.join("\n").split(/\n{2,}/);
  const pout = [];
  let pprev = null;
  for (const p of paras) {
    const key = p.trim();
    if (!key || key === pprev) continue;
    pprev = key;
    pout.push(key);
  }
  return pout.join("\n\n").trim();
}

function looksLoopy(text) {
  const t = String(text || "");
  if (t.length < 200) return false;
  const chunk = t.slice(0, 80).trim();
  if (chunk.length < 20) return false;
  let hits = 0;
  let idx = 0;
  while ((idx = t.indexOf(chunk, idx)) !== -1) {
    hits += 1;
    idx += chunk.length;
    if (hits >= 4) return true;
  }
  return false;
}

function buildUserContent(prompt, imageUrls) {
  if (!imageUrls.length) return prompt;
  // docs Polza: text → image_url
  const content = [{ type: "text", text: prompt }];
  for (const url of imageUrls) {
    content.push({ type: "image_url", image_url: { url, detail: "high" } });
  }
  return content;
}

function imageTokensFromUsage(usage) {
  const d = usage?.prompt_tokens_details || usage?.promptTokensDetails || {};
  return d.image_tokens ?? d.image ?? usage?.image_tokens ?? usage?.imageTokens ?? null;
}

/** Polza отдаёт то snake_case, то camelCase — берём оба. */
function finishReasonOf(data) {
  const choice = data?.choices?.[0];
  return choice?.finish_reason ?? choice?.finishReason ?? null;
}

async function postChat(bodyObj) {
  let res;
  try {
    res = await fetch(API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify(bodyObj),
    });
  } catch (err) {
    throw new Error(networkHint(err));
  }
  const raw = await res.text();
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }
  return { res, raw, data };
}

async function callPolza({
  system,
  prompt,
  imageDataUrl,
  maxTokens,
  name = "ai",
  jsonMode = false,
}) {
  const KEY = getApiKey();
  const MODEL = getModel();
  if (!KEY) throw new Error("Нет ключа Polza AI — вставь его в Настройках → Модель ИИ");

  await reserveAiSlot();

  const localImgs = Array.isArray(imageDataUrl) ? imageDataUrl : imageDataUrl ? [imageDataUrl] : [];
  const imageUrls = [];
  for (let i = 0; i < localImgs.length; i++) {
    imageUrls.push(await uploadToStorage(localImgs[i], KEY, i, localImgs.length));
  }

  const baseBody = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: buildUserContent(prompt, imageUrls) },
    ],
    // max_tokens не задаём — свой потолок генерации знает модель. undefined
    // выкидывается из JSON сам, лимита от клиента не остаётся.
    max_tokens: maxTokens,
    temperature: 0.3,
    presence_penalty: 0.4,
  };
  if (MODEL.startsWith("openai/")) {
    baseBody.frequency_penalty = 0.5;
    baseBody.presence_penalty = 0.2;
  }
  if (jsonMode) baseBody.response_format = { type: "json_object" };

  const pin = providerFor(MODEL);
  const attempts = pin
    ? [{ ...baseBody, provider: pin }, baseBody]
    : [baseBody];

  emitStatus(imageUrls.length ? "Читаю фото…" : "Жду ответ модели…");
  let lastErr = null;

  for (let a = 0; a < attempts.length; a++) {
    for (const tryN of [1, 2, 3]) {
      const { res, raw, data } = await postChat(attempts[a]);
      if (!res.ok) {
        const msg = data?.error?.message || data?.message || `Polza AI ${res.status}`;
        lastErr = new Error(msg);
        // неверный pin провайдера → следующий attempt без pin
        if (a === 0 && pin && (res.status === 400 || res.status === 404 || /provider|available|endpoint/i.test(msg))) {
          console.warn("[ai] provider pin failed:", msg);
          emitStatus("Провайдер недоступен — другой маршрут…");
          break;
        }
        if (![429, 500, 502, 503].includes(res.status)) throw lastErr;
        emitStatus(`Polza перегружен — попытка ${tryN}/3…`);
        await new Promise((r) => setTimeout(r, tryN * 1000));
        continue;
      }

      try {
        if (!data) throw new Error("Пустой/битый ответ Polza");
        const usage = data.usage || {};
        const promptTokens = usage.prompt_tokens ?? usage.promptTokens ?? 0;
        const imageTokens = imageTokensFromUsage(usage);
        console.info("[ai]", name, MODEL, "ok", {
          imgs: imageUrls.length,
          provider: data.provider,
          pinned: Boolean(attempts[a].provider),
          prompt_tokens: promptTokens,
          image_tokens: imageTokens,
          finish: finishReasonOf(data),
          cost_rub: usage.cost_rub ?? usage.cost,
          preview: raw.slice(0, 280),
        });

        if (imageUrls.length) {
          const noVision =
            (imageTokens != null && Number(imageTokens) === 0)
            || (imageTokens == null && promptTokens > 0 && promptTokens < 900);
          if (noVision) {
            throw new Error(
              `Модель не получила изображение (provider=${data.provider || "?"}, `
              + `prompt_tokens=${promptTokens}, image_tokens=${imageTokens})`
            );
          }
        }

        // Обрыв по потолку модели раньше проходил молча: JSON закрывался,
        // а retelling/summary оставались пустыми. Повтор не поможет — режем один раз.
        if (finishReasonOf(data) === "length") {
          const e = new Error(
            "Ответ модели оборвался по лимиту генерации — попробуй файл поменьше или разбей его на части"
          );
          e.noRetry = true;
          throw e;
        }

        let innerText = data?.choices?.[0]?.message?.content ?? "";
        if (!String(innerText).trim()) throw new Error("Модель вернула пустой ответ");
        // Схлопывание строк ломает JSON (режет абзацы по \n\n) — только для plain text.
        if (!jsonMode) innerText = collapseRepeats(innerText);
        if (looksLoopy(innerText)) throw new Error("Модель зациклилась на повторах");

        pushLog({
          ts: Date.now(),
          name,
          model: MODEL,
          ok: true,
          imgs: imageUrls.length,
          provider: data.provider,
          prompt_tokens: promptTokens,
          image_tokens: imageTokens,
          out: String(innerText).slice(0, 1500),
        });
        // JSON разбираем тут, а не в aiJSON: битый JSON тогда попадает в
        // уже оплаченный retry выше, а не вылетает ошибкой на первый ответ.
        if (jsonMode) return { json: parseJSON(innerText), usage, model: MODEL, provider: data.provider };
        return { text: innerText, usage, model: MODEL, provider: data.provider };
      } catch (e) {
        if (e?.noRetry) throw e;
        lastErr = e;
        emitStatus(`Сбой ответа — попытка ${tryN}/3…`);
        await new Promise((r) => setTimeout(r, tryN * 800));
      }
    }
  }

  pushLog({ ts: Date.now(), name, model: MODEL, ok: false, out: lastErr?.message });
  throw lastErr || new Error("Не удалось вызвать Polza");
}

export async function aiText(opts) {
  const { text } = await callPolza({ ...opts, jsonMode: false });
  return text;
}

export async function aiJSON(opts) {
  const { json } = await callPolza({ ...opts, jsonMode: true });
  return json;
}

/**
 * Стримит JSON-ответ: onDelta получает накопленный текст на каждом чанке.
 * Для сбора слово-за-словом нужен живой поток — иначе пользователь видит только «Проверяю…».
 * Без retry: стрим уже начат, повтор молча сожжёт ещё один слот квоты.
 */
export async function aiJSONStream({ system, prompt, onDelta, maxTokens, name = "ai-stream" }) {
  const KEY = getApiKey();
  const MODEL = getModel();
  if (!KEY) throw new Error("Нет ключа Polza AI — вставь его в Настройках → Модель ИИ");
  await reserveAiSlot();
  emitStatus("Жду ответ модели…");

  let res;
  try {
    res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
        stream: true,
        response_format: { type: "json_object" },
      }),
    });
  } catch (err) {
    throw new Error(networkHint(err));
  }

  if (!res.ok || !res.body) {
    const raw = await res.text().catch(() => "");
    let msg = `Polza AI ${res.status}`;
    try {
      const d = JSON.parse(raw);
      msg = d?.error?.message || d?.message || msg;
    } catch {}
    pushLog({ ts: Date.now(), name, model: MODEL, ok: false, out: msg });
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const chunk = line.slice(5).trim();
        if (!chunk || chunk === "[DONE]") continue;
        let piece = "";
        try {
          piece = JSON.parse(chunk)?.choices?.[0]?.delta?.content ?? "";
        } catch {
          continue; // обрывок недопарсенного SSE-кадра — дождёмся следующего
        }
        if (!piece) continue;
        full += piece;
        onDelta?.(full);
      }
    }
  } catch (err) {
    // Стрим пошёл и упал — переспрашивать нельзя, ученик уже видит половину разбора.
    // А если не пришло ничего — обычный aiJSON повторит 3 раза сам (callPolza умеет retry).
    if (full) throw new Error(networkHint(err));
    return aiJSON({ system, prompt, maxTokens, name });
  }

  pushLog({ ts: Date.now(), name, model: MODEL, ok: true, out: full.slice(0, 1500) });
  return parseJSON(full);
}

/** Транскрипция аудиозаписи через Whisper (Polza, OpenAI-совместимый endpoint). */
export async function transcribeRecording(dataUrl) {
  const key = getApiKey();
  if (!key) throw new Error("Нет ключа Polza AI — вставь его в Настройках → Модель ИИ");
  await reserveAiSlot();
  emitStatus("Расшифровываю запись…");

  let res;
  try {
    res = await fetch(TRANSCRIBE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: WHISPER_MODEL,
        file: dataUrl,
        language: "en",
        prompt: "Transcribe the words exactly as spoken, without correcting grammar or word forms.",
        response_format: "verbose_json",
        timestamp_granularities: ["word"],
      }),
    });
  } catch (err) {
    throw new Error(networkHint(err));
  }
  const raw = await res.text();
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `Polza Whisper ${res.status}`;
    pushLog({ ts: Date.now(), name: "whisper", model: WHISPER_MODEL, ok: false, out: msg });
    throw new Error(msg);
  }
  const text = String(data?.text || "").trim();
  if (!text) {
    pushLog({ ts: Date.now(), name: "whisper", model: WHISPER_MODEL, ok: false, out: "пустая расшифровка" });
    throw new Error("Whisper вернул пустую расшифровку");
  }
  const words = Array.isArray(data?.words) ? data.words : [];
  const duration = Number(data?.duration) || 0;
  pushLog({ ts: Date.now(), name: "whisper", model: WHISPER_MODEL, ok: true, out: `${text.slice(0, 1500)} (words=${words.length}, ${duration}s)` });
  return { text, words, duration };
}

/** Жёсткая проверка: модель обязана подтвердить, что видит фото. */
export async function assertVisionWorks(imageDataUrl) {
  emitStatus("Проверяю, видит ли модель фото…");
  const reply = await aiText({
    name: "vision-probe",
    system:
      "Ты проверяешь видимость изображения. "
      + "Если видишь фото — одна строка: SEEN: <2-8 слов прямо с фото>. "
      + "Если фото нет — ровно: NO_IMAGE. Ничего больше.",
    prompt: "Видишь изображение? SEEN: … или NO_IMAGE.",
    imageDataUrl: Array.isArray(imageDataUrl) ? imageDataUrl.slice(0, 1) : imageDataUrl,
    maxTokens: 60,
  });
  const t = String(reply).trim();
  console.info("[ai] vision-probe:", t);
  if (/NO_IMAGE/i.test(t) || !/SEEN\s*:/i.test(t)) {
    throw new Error(
      "Модель не видит фото. Polza не прокидывает картинку в vision. "
      + "В консоли смотри [ai] vision-probe и provider/image_tokens."
    );
  }
  return t;
}

/**
 * JSON не допускает `\` перед обычным символом, а модель пишет LaTeX прямо в
 * строках ответа: `80\%`, `$\$4,26$`, `\&`. Плюс сырые переводы строк там, где
 * просили `\n`. Из-за одного такого символа падал весь ответ — и пересказ, и
 * конспект пропадали молча. Лечим только недопустимые escape'ы; валидный JSON
 * функция не трогает (её вызывают только после неудачного JSON.parse).
 */
function repairJSONStringEscapes(json) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }
    if (escaped) {
      escaped = false;
      if ('"\\/bfnrtu'.includes(ch)) out += ch;
      else if (ch === "\n" || ch === "\r") out += "n"; // перенос строки LaTeX
      else if (ch === "\t") out += "t";
      else out += `\\${ch}`; // \% \$ \& → \% \$ \&
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      out += ch;
      continue;
    }
    if (ch === "\n") { out += "\\n"; continue; }
    if (ch === "\r") continue;
    if (ch === "\t") { out += "\\t"; continue; }
    if (ch === '"') inString = false;
    out += ch;
  }
  return out;
}

/** Текст от `индекса` до первой парной `}` — внешний объект, не вложенный. */
function outermostObject(clean, index) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = index; i < clean.length; i++) {
    const ch = clean[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}" && --depth === 0) return clean.slice(index, i + 1);
  }
  return null;
}

function parseJSON(raw) {
  const clean = String(raw).trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!clean) throw new Error("AI вернул пустой ответ");

  // Только внешний объект и никогда вложенный блок. Раньше при битом верхнем
  // JSON парсер откатывался на первый вложившийся объект — и structureNote
  // молча получал {title, body} вместо пересказа с конспектом: вкладка
  // «Пересказ» исчезала, «Конспект» оставался пустым.
  const start = clean.indexOf("{");
  const candidates = [clean, start < 0 ? null : outermostObject(clean, start)];
  for (const base of candidates) {
    if (!base) continue;
    for (const candidate of [base, repairJSONStringEscapes(base)]) {
      let val;
      try {
        val = JSON.parse(candidate);
      } catch {
        continue;
      }
      if (val && typeof val === "object" && !Array.isArray(val)) return val;
    }
  }
  throw new Error(
    "Модель вернула невалидный JSON — попробуй ещё раз"
    + `\nОтвет начинается так: ${clean.slice(0, 200)}`
  );
}
