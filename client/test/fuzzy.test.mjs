// Нечёткий поиск в Библиотеке: node client/test/fuzzy.test.mjs
import assert from "node:assert/strict";
import { fuzzyScore, fuzzyMatch } from "../src/fuzzy.js";

// Пустой запрос пропускает всё
assert.equal(fuzzyScore("Алгебра 10 класс", ""), 0);
assert.ok(fuzzyMatch("Алгебра 10 класс", ""));

// Буквы могут стоять не подряд, но в правильном порядке
assert.ok(fuzzyMatch("Алгебра 10 класс", "гб10"));
assert.ok(fuzzyMatch("Алгебра 10 класс", "лге"));

// Запрос из нескольких слов: каждое слово ищется отдельно
assert.ok(fuzzyMatch("Алгебра 10 класс", "алг класс"));
assert.equal(fuzzyScore("Математика", "физра"), -1);
assert.equal(fuzzyScore("Математика", "матем скам"), -1);

// Совпадение в начале слова и вплотную ценнее случайного разброса
assert.ok(fuzzyScore("Алгебра", "алг") > fuzzyScore("Геометрия и алгебра", "алг"));
assert.ok(fuzzyScore("Тест по алгебре", "тест") > fuzzyScore("Интересный тест", "тест"));

console.log("ok: fuzzy search");
