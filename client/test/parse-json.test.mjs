// Разбор JSON-ответа модели: node client/test/parse-json.test.mjs
// Копия parseJSON из client/src/api/ai.js — важно поведение, а не экспорт.
import assert from "node:assert/strict";

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
      else if (ch === "\n" || ch === "\r") out += "n";
      else if (ch === "\t") out += "t";
      else out += `\\${ch}`;
      continue;
    }
    if (ch === "\\") { escaped = true; out += ch; continue; }
    if (ch === "\n") { out += "\\n"; continue; }
    if (ch === "\r") continue;
    if (ch === "\t") { out += "\\t"; continue; }
    if (ch === '"') inString = false;
    out += ch;
  }
  return out;
}

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
    if (ch === '"') { inString = true; continue; }
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
  throw new Error("Модель вернула невалидный JSON — попробуй ещё раз");
}

const summary = [
  { title: "Население", body: "### Плотность\n- $270$ чел/км$^2$.\n- Доля городских: более $84\\%$." },
  { title: "Экономика", body: "- ВВП $\\$4,26$ трлн.\n- Рост $0,8\\%$." },
];
const retelling = "ВВП около $\\$4,26$ трлн, рост $0,8\\%$, безработица $4,9\\%$.";

const GOOD = JSON.stringify({ subject: "География", title: "Великобритания", retelling, summary });

// Модель пишет LaTeX-escape «\%» вместо валидного JSON-экрана «\\%» и сырые
// переводы строк вместо «\n» — ровно то, что было в ответе Polza.
const BROKEN = GOOD.replace(/\\\\([%$&#_])/g, "\\$1").replace(/\\n/g, "\n");
assert.throws(() => JSON.parse(BROKEN), null, "фикстура действительно невалидна");

const fixed = parseJSON(BROKEN);
assert.equal(fixed.title, "Великобритания", "заголовок на месте");
assert.ok(fixed.retelling.includes("\\%") && fixed.retelling.includes("\\$"), "LaTeX-escape сохранены как текст");
assert.equal(fixed.summary.length, 2, "конспект на месте");
assert.equal(fixed.summary[0].title, "Население", "блоки не потеряны");
assert.ok(fixed.summary[1].body.includes("\\$4,26"), "тело блока не побито");
assert.ok(fixed.summary[0].body.includes("84\\%"), "процент внутри блока цел");
assert.ok(fixed.summary[0].body.includes("\n"), "переносы строк восстановлены");

// Валидный ответ обязан пройти БЕЗ починки и не измениться.
assert.deepEqual(parseJSON(GOOD), JSON.parse(GOOD), "валидный JSON не трогаем");
assert.equal(repairJSONStringEscapes(GOOD), GOOD, "repair идемпотентен на валидном JSON");

// Обёртка и fence продолжают работать.
assert.equal(parseJSON("Вот JSON:\n```json\n" + GOOD + "\n```").title, "Великобритания");

// 5. Никаких вложенных фрагментов: битое без починки — ошибка, а не первый блок.
const NOT_JSON = '{"title": "Великобритания", "summary": [{"title": "X", "body": "y"}], "слом';
assert.throws(() => parseJSON(NOT_JSON), /невалидный JSON/, "не отдаём вложенный блок");
assert.throws(() => parseJSON("[1,2,3]"), /невалидный JSON/, "массив — не наш контракт");

console.log("parse-json ok");
