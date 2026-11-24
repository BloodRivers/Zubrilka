// Бейджи конспекта: node client/test/badges.test.mjs
import assert from "node:assert/strict";
import { badgeTheme, badgesLast } from "../src/badges.js";

assert.deepEqual(badgeTheme("важно"), ["dangerTint", "danger"]);
assert.deepEqual(badgeTheme("Совет:"), ["successTint", "success"]);
assert.deepEqual(badgeTheme("Определение"), ["raised", "text"]);
assert.equal(badgeTheme("Исследование функции"), null);
assert.deepEqual(
  badgesLast([{ type: "badge", label: "Важно" }, { type: "text", value: " Текст" }]).map((n) => n.type),
  ["text", "badge"],
);

console.log("ok: badges");
