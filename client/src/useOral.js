import ORAL_TASK_1 from "./data/use/english/oral/task-1.json" with { type: "json" };
import ORAL_TASK_2 from "./data/use/english/oral/task-2.json" with { type: "json" };

export const ORAL_TASKS = [ORAL_TASK_1, ORAL_TASK_2];

export function oralTaskByNumber(n) {
  return ORAL_TASKS.find((task) => task.task === n);
}

export function pickRandomVariant(variants, doneIds) {
  const pool = variants.filter((v) => !doneIds.includes(v.id));
  const list = pool.length ? pool : variants;
  return list[Math.floor(Math.random() * list.length)];
}