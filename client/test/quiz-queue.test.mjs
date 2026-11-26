import assert from "node:assert/strict";
import { repeatWrong } from "../src/utils/quizQueue.js";

for (const size of [0, 1, 8, 20]) {
  const queue = Array.from({ length: size }, (_, i) => `w${i}`);
  const wrong = "wrong";
  repeatWrong(queue, wrong);
  assert.equal(queue.length, size + 2);
  assert.equal(queue.filter((x) => x === wrong).length, 2);
  assert.ok(queue.indexOf(wrong) <= 8);
}
console.log("quiz queue ok");
