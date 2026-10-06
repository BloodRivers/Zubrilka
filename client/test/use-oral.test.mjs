// Задания устной части ЕГЭ по английскому: node client/test/use-oral.test.mjs
import assert from "node:assert/strict";
import { ORAL_TASKS, oralTaskByNumber, pickRandomVariant } from "../src/useOral.js";

assert.equal(ORAL_TASKS.length, 2, "пока что 1-е и 2-е задания");

for (const task of ORAL_TASKS) {
  assert.ok(task.title && task.sub && task.formulation, `задание ${task.task}: нет title/sub/formulation`);
  assert.ok(Array.isArray(task.phases) && task.phases.length >= 2, `задание ${task.task}: мало фаз`);
  for (const p of task.phases) {
    assert.ok(p.seconds > 0, `задание ${task.task}: фаза «${p.label}» без секунд`);
  }
  assert.ok(task.max > 0, `задание ${task.task}: нет max`);
  assert.ok(Array.isArray(task.criteria) && task.criteria.length, `задание ${task.task}: нет criteria`);
  const sumMax = task.criteria.reduce((s, c) => s + (c.max || 0), 0);
  assert.equal(sumMax, task.max, `задание ${task.task}: max != сумма критериев`);
  for (const c of task.criteria) {
    assert.ok(Array.isArray(c.levels) && c.levels.length >= 2, `задание ${task.task}: критерий без уровней`);
  }
  assert.ok(task.variants.length >= 1, `задание ${task.task}: нет вариантов`);
  const ids = new Set();
  for (const v of task.variants) {
    assert.ok(v.id && v.title && v.content, `задание ${task.task}: битый вариант`);
    assert.ok(!ids.has(v.id), `задание ${task.task}: повтор id ${v.id}`);
    ids.add(v.id);
  }
}

const t1 = oralTaskByNumber(1);
const t2 = oralTaskByNumber(2);
assert.equal(t1.task, 1);
assert.deepEqual(t1.phases.map((p) => p.seconds), [90, 90], "1-е задание: 2 фазы по 90 сек");
assert.equal(t1.phases[0].mic, false);
assert.equal(t1.phases[1].mic, true, "второй таймер с микрофоном");
for (const v of t1.variants) assert.ok(v.content.text, "1-е задание: у варианта нужен текст");

assert.equal(t2.task, 2);
assert.deepEqual(t2.phases.map((p) => p.seconds), [90, 90], "2-е задание: подготовка + 1,5 мин ответа");
assert.equal(t2.phases[0].mic, false);
assert.equal(t2.phases[1].mic, true, "ответ с микрофоном");
assert.equal(t2.max, 4, "2-е задание: макс 4 балла");
for (const v of t2.variants) {
  assert.ok(v.content.ad, "2-е задание: у варианта нужна реклама");
  assert.equal(v.content.questions.length, 4, "2-е задание: 4 пункта для вопросов");
}

// «Случайное задание» не повторяет пройденное, а после полного круга сбрасывается
assert.equal(pickRandomVariant([{ id: "a" }, { id: "b" }], ["a"]).id, "b");
assert.ok(["a", "b"].includes(pickRandomVariant([{ id: "a" }, { id: "b" }], ["a", "b"]).id), "после круга снова все в пуле");
assert.equal(pickRandomVariant([], []), undefined);

console.log(`ok: ${ORAL_TASKS.length} задания, ${t1.variants.length + t2.variants.length} вариантов`);