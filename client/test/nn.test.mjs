// Данные тренажёра Н/НН: node client/test/nn.test.mjs
import assert from "node:assert/strict";
import { NN_ITEMS, NN_THEORY } from "../src/data/nn.js";

assert.ok(NN_ITEMS.length >= 80, "мало слов в банке");

const fullWords = [];
for (const item of NN_ITEMS) {
  assert.equal((item.text.match(/•/g) || []).length, 1, `нужен ровно один пропуск: ${item.text}`);
  assert.ok(["н", "нн"].includes(item.answer), `ответ не н/нн: ${item.text}`);
  assert.ok(item.explanation, `нет разбора: ${item.text}`);
  const full = item.text.replace("•", item.answer);
  assert.ok(!full.includes("ннн"), `три Н подряд: ${full}`);
  fullWords.push(full);
}

assert.equal(new Set(fullWords).size, fullWords.length, "есть слова-дубликаты");
assert.ok(NN_THEORY.length >= 6, "мало карточек в теории");
for (const card of NN_THEORY) {
  assert.ok(card.title && card.md, "пустая карточка теории");
}

console.log(`ok: ${NN_ITEMS.length} слов, ${NN_THEORY.length} карточек теории`);
