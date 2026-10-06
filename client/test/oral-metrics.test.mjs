import assert from "node:assert";
import { computeMetrics, levDist, tokenize } from "../src/oralMetrics.js";

assert.deepEqual(levDist(["a", "b", "c"], ["a", "b", "c"]), 0);
assert.deepEqual(levDist(["cat"], ["rat"]), 1);
assert.deepEqual(levDist(["a", "b"], ["a"]), 1);
assert.deepEqual(tokenize("The body's cells."), ["the", "body's", "cells"]);

const m = computeMetrics({
  words: [
    { word: "the", start: 0.0, end: 0.2 },
    { word: "body", start: 0.2, end: 0.5 },
    { word: "changes", start: 2.5, end: 3.0 },
  ],
  duration: 3.0,
  sourceText: "The body changes.",
  transcript: "The body",
});
assert.deepEqual(m.maxGap, 2.0);
assert.deepEqual(m.longGaps, 1);
assert.deepEqual(m.wer.toFixed(2), "0.33");
assert.deepEqual(m.wordsPerSec, 1);

const perfect = computeMetrics({
  words: [
    { word: "a", start: 0, end: 0.2 },
    { word: "b", start: 0.2, end: 0.4 },
  ],
  duration: 0.4,
  sourceText: "a b",
  transcript: "a b",
});
assert.deepEqual(perfect.wer, 0);
assert.deepEqual(perfect.longGaps, 0);

console.log("ok: oral metrics");