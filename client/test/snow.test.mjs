// Снег скрыт на страницах конспектов, тестов, тренажёров и теории ЕГЭ: node client/test/snow.test.mjs
import assert from "node:assert/strict";
import { showSnowOn } from "../src/snow.js";

const hidden = [
  "/note/abc",
  "/note/abc/quiz",
  "/subject/math/new",
  "/subject/math/quiz",
  "/test/123/quiz/learn",
  "/results",
  "/trainer/russian",
  "/trainer/russian/1",
  "/use/english",
  "/use/english/oral/spelling",
];
const shown = ["/", "/settings", "/account", "/leaderboard", "/library", "/subject/math", "/changelog"];

for (const path of hidden) assert.equal(showSnowOn(path), false, `снег показан на ${path}`);
for (const path of shown) assert.equal(showSnowOn(path), true, `снег скрыт на ${path}`);
console.log("ok: snow routes");
