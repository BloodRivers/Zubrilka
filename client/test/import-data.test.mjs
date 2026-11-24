// Импорт выгрузки: node client/test/import-data.test.mjs
import assert from "node:assert/strict";
import { remapDoc, validateImport } from "../src/importData.js";

assert.throws(() => validateImport(null), /выгрузку/);
assert.throws(() => validateImport({ subjects: [] }), /не выгрузка/);
assert.throws(() => validateImport({ subjects: [], notes: [], tests: [], results: [] }), /нет предметов/);
assert.equal(validateImport({ subjects: [{}], notes: [], tests: [], results: [] }).subjects.length, 1);

const ids = {
  subjects: new Map([["s1", "s2"]]),
  notes: new Map([["n1", "n2"]]),
  tests: new Map([["t1", "t2"]]),
};
const note = remapDoc(
  { id: "n1", owner_id: "old", title: "Конспект", subject_id: "s1", public: true },
  ids
);
assert.deepEqual(note, { title: "Конспект", subject_id: "s2" });

const test = remapDoc(
  { id: "t1", note_ids: ["n1", "foreign"], subject_id: "s1", owner_id: "old", title: "Тест" },
  ids
);
assert.deepEqual(test, { note_ids: ["n2", "foreign"], subject_id: "s2", title: "Тест" });

const result = remapDoc({ id: "r1", user_id: "old", test_id: "t1", score: 4, total: 5 }, ids);
assert.deepEqual(result, { test_id: "t2", score: 4, total: 5 });

console.log("ok: import data");
