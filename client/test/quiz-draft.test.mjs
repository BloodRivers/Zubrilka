// Черновик теста: node client/test/quiz-draft.test.mjs
import assert from "node:assert/strict";
import { clearDraft, readDraft, writeDraft } from "../src/quizDraft.js";

const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
};

assert.equal(readDraft("t1", "full"), null);
writeDraft("t1", "full", { answers: [{ correct: true }], qIndex: 1 });
assert.equal(readDraft("t1", "full").qIndex, 1);
assert.equal(readDraft("t1", "weak"), null);
assert.equal(readDraft("t2", "full"), null);

store.set("zubrilka:quizdraft:t1:full", "{broken");
assert.equal(readDraft("t1", "full"), null);
clearDraft("t1", "full");
assert.equal(readDraft("t1", "full"), null);

console.log("ok: quiz draft");
