import assert from "node:assert/strict";
import { EXPRESSIVE_MEANS_THEORY } from "../src/data/expressiveMeans.js";

const md = EXPRESSIVE_MEANS_THEORY.map((card) => card.md).join("\n");
const terms = [
  "Метафора", "Перифраза (перифраз)", "Оксюморон", "Эпитет", "Гипербола",
  "Литота", "Олицетворение", "Сравнение", "Метонимия", "Синекдоха",
  "Градация", "Инверсия", "Парцелляция", "Эпифора", "Синтаксический параллелизм",
  "Риторическое обращение", "Аллитерация", "Анафора", "Антитеза",
  "Ряды однородных членов предложения", "Ирония", "Лексический повтор",
];

for (const term of terms) assert.ok(md.includes(`**${term}**`), `нет термина: ${term}`);
assert.ok(md.includes("| Троп / фигура речи | Определение | Пример |"));
assert.equal(EXPRESSIVE_MEANS_THEORY.length, 2);
assert.equal(EXPRESSIVE_MEANS_THEORY.at(-1).tone, "danger");
assert.ok(md.includes("только один троп"));
assert.ok(md.includes("только одна фигура"));
console.log(`ok: ${terms.length} терминов, ${EXPRESSIVE_MEANS_THEORY.length} карточки теории`);
