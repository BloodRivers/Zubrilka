// Данные тренажёра ПРЕ-/ПРИ-: node client/test/prepri.test.mjs
// PrePriTrainer вставляет ответ в пропуск и сверяет со строкой ошибок, поэтому формат жёсткий.
import assert from "node:assert/strict";
import { PREPRI_ITEMS, PREPRI_THEORY } from "../src/data/prepri.js";

const byText = new Map();
for (const item of PREPRI_ITEMS) {
  assert.ok(item.text.startsWith("•"), `пропуск не в начале: ${item.text}`);
  assert.ok(["пре", "при"].includes(item.answer), `ответ не пре/при: ${item.text}`);
  assert.ok(item.explanation, `нет разбора: ${item.text}`);
  // Одинаковый кусок слова — это намеренная пара пре-/при-, у неё ровно два ответа.
  const answers = byText.get(item.text) || new Set();
  answers.add(item.answer);
  byText.set(item.text, answers);
}
for (const [text, answers] of byText) {
  assert.ok(answers.size <= 2, `больше двух вариантов на один пропуск: ${text} (${[...answers]})`);
}

const words = PREPRI_ITEMS.map((i) => i.text.replace("•", i.answer));
assert.equal(new Set(words).size, words.length, "есть полные слова-дубликаты");
assert.ok(PREPRI_THEORY.length >= 8, "мало карточек в теории");
console.log(`ok: ${PREPRI_ITEMS.length} слов, ${PREPRI_THEORY.length} карточек теории`);