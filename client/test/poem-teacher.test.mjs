// Учитель стихов: node client/test/poem-teacher.test.mjs
import assert from "node:assert/strict";
import {
  parsePoem,
  splitIntoChunks,
  splitRecall,
  normalizePoemWords,
  compareRecited,
} from "../src/poemTeacher.js";

assert.deepEqual(parsePoem(""),
  []);
assert.deepEqual(parsePoem("Первая\nвторая\n\nТретья\n\n\nЧетвёртая"), [
  ["Первая", "вторая"],
  ["Третья"],
  ["Четвёртая"],
]);

assert.deepEqual(splitIntoChunks(["1", "2", "3", "4"]), [["1", "2"], ["3", "4"]]);
assert.deepEqual(splitIntoChunks(["1", "2", "3", "4", "5"]), [["1", "2"], ["3", "4", "5"]]);
assert.deepEqual(splitIntoChunks(["1"]), [["1"]]);
assert.deepEqual(splitIntoChunks([]), []);

assert.deepEqual(splitRecall("Я вас любил"), { hint: "Я вас", rest: "любил" });
assert.deepEqual(splitRecall("Любил"), { hint: "Люб", rest: "ил" });

assert.deepEqual(normalizePoemWords("Ёлка, ёлка!"), ["елка", "елка"]);
assert.deepEqual(compareRecited("Я вас любил", "я вас любил"), {
  score: 100, matched: 3, total: 3, missing: [],
});
assert.equal(compareRecited("Я вас любил", "я вас").score, 67);
assert.deepEqual(compareRecited("любил любил", "любил").missing, ["любил"]);
assert.equal(compareRecited("", "").score, 0);

console.log("poem-teacher: ok");
