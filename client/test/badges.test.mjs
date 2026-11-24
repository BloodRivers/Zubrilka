// Бейджи конспекта: node client/test/badges.test.mjs
import assert from "node:assert/strict";
import { badgeTheme } from "../src/badges.js";

assert.deepEqual(badgeTheme("важно"), ["dangerTint", "danger"]);
assert.deepEqual(badgeTheme("Совет:"), ["successTint", "success"]);
assert.deepEqual(badgeTheme("Определение"), ["raised", "text"]);
assert.equal(badgeTheme("Исследование функции"), null);

console.log("ok: badges");
