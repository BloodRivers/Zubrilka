// Ссылка на страницу учебника: node client/test/textbook-page.test.mjs
import assert from "node:assert/strict";
import {
  parseTextbookPages,
  textbookLink,
  textbookPage,
} from "../src/textbookPage.js";

assert.equal(textbookPage(null, 300), 1);
assert.equal(textbookPage("12", 300), 12);
assert.equal(textbookPage("12.9", 300), 12);
assert.equal(textbookPage("-5", 300), 1);
assert.equal(textbookPage("abc", 300), 1);
assert.equal(textbookPage("999", 300), 300);
assert.equal(textbookPage("999", 0), 999); // PDF ещё грузится — страницу пока не знаем

assert.deepEqual(parseTextbookPages("1-4,7,9,11-20").pages, [
  1, 2, 3, 4, 7, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
]);
assert.deepEqual(parseTextbookPages(" 7 , 3-4 , 7 ").pages, [3, 4, 7]);
assert.equal(parseTextbookPages("3–4").pages.length, 2);
assert.equal(parseTextbookPages("").error !== null, true);
assert.equal(parseTextbookPages("1,,2").error !== null, true);
assert.equal(parseTextbookPages("абракадабра").error !== null, true);
assert.equal(parseTextbookPages("5-3").error !== null, true);
assert.equal(parseTextbookPages("0").error !== null, true);
assert.equal(parseTextbookPages("25", 20).error !== null, true);
assert.equal(parseTextbookPages("1-1000").error !== null, true);

assert.equal(
  textbookLink({ id: "abc", title: "Математика [10]" }, 7),
  "[Математика 10, с. 7](/textbook/abc?page=7)"
);

console.log("ok: textbook page");
