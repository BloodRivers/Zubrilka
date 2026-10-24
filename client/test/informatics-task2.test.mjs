// Задание 2 ЕГЭ по информатике: проверка банка перебором.
// node client/test/informatics-task2.test.mjs
import assert from "node:assert/strict";
import { INF_TASK2 } from "../src/data/informatics-task2.js";

const AND = "\u2227", OR = "\u2228", NOT = "\u00AC", IMP = "\u2192", EQV = "\u2261", XOR = "\u2295";
const OPS = [AND, OR, NOT, IMP, EQV, XOR];

function tokenize(src) {
  const toks = [];
  let i = 0;
  const map = { [AND]: "AND", [OR]: "OR", [NOT]: "NOT", [IMP]: "IMP", [EQV]: "EQV", [XOR]: "XOR" };
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "(" || c === ")") { toks.push(c); i++; continue; }
    if (/[a-z]/.test(c)) { toks.push(c); i++; continue; }
    if (src.slice(i, i + 2) === "->") { toks.push("IMP"); i += 2; continue; }
    if (!map[c]) throw new Error(`неизвестный символ ${c} в ${src}`);
    toks.push(map[c]);
    i++;
  }
  return toks;
}

function parse(src) {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const eat = (t) => (toks[pos] === t ? (pos++, true) : false);
  const eqv = () => { const l = imp(); if (peek() === "EQV") { pos++; const r = eqv(); return (v) => l(v) === r(v); } return l; };
  const imp = () => { const l = or(); if (peek() === "IMP") { pos++; const r = imp(); return (v) => !l(v) || r(v); } return l; };
  const or = () => { let l = and(); while (peek() === "OR") { pos++; const r = and(); const a = l; l = (v) => a(v) || r(v); } return l; };
  const and = () => { let l = not(); while (peek() === "AND") { pos++; const r = not(); const a = l; l = (v) => a(v) && r(v); } return l; };
  const not = () => (eat("NOT") ? ((f) => (v) => !f(v))(not()) : atom());
  const atom = () => {
    if (eat("(")) {
      const e = eqv();
      assert.ok(eat(")"), `нет ) в ${src}`);
      return e;
    }
    const t = toks[pos++];
    assert.match(t || "", /^[a-z]$/, `ожидалась переменная в ${src}`);
    return (v) => !!v[t];
  };
  const f = eqv();
  assert.equal(pos, toks.length, `лишние символы в ${src}`);
  return (v) => !!f(v);
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  return arr.flatMap((v, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [v, ...p]));
}

function solve(item) {
  const fns = item.formulas.map(parse);
  const vars = [...new Set(item.formulas.join(" ").match(/[a-z]/g))].sort();
  assert.equal(vars.length, item.cols, `столбцов ${item.cols}, переменных ${vars.length} (id ${item.id})`);

  const rows = item.rows;
  const fCount = rows[0].length - item.cols;
  assert.ok(fCount === 0 || fCount === fns.length, `колонок F ${fCount}, функций ${fns.length} (id ${item.id})`);
  const labels = item.labels || [];

  const found = [];
  for (const perm of permutations(vars)) {
    if (labels.some((l, i) => l && perm[i] !== l)) continue;
    const options = [];
    let okAll = true;
    for (const row of rows) {
      const matches = [];
      for (let mask = 0; mask < 1 << vars.length; mask++) {
        const vals = {};
        let good = true;
        for (let i = 0; i < vars.length; i++) {
          vals[perm[i]] = (mask >> (vars.length - 1 - i)) & 1;
          const cell = row[i];
          if ((cell === "0" || cell === "1") && Number(cell) !== vals[perm[i]]) { good = false; break; }
        }
        if (!good) continue;
        if (fCount === 0) {
          if (fns.length !== 1 || fns[0](vals) !== false) continue;
        } else {
          for (let k = 0; k < fns.length; k++) {
            const cell = row[item.cols + k];
            if ((cell === "0" || cell === "1") && fns[k](vals) !== (cell === "1")) { good = false; break; }
          }
        }
        if (good) matches.push(vals);
      }
      if (!matches.length) { okAll = false; break; }
      options.push(matches);
    }
    if (!okAll) continue;
    // Строки фрагмента не повторяются: на каждую строку нужен свой набор.
    const pick = (i, used) => {
      if (i === options.length) return true;
      for (const vals of options[i]) {
        const key = vars.map((v) => vals[v]).join("");
        if (used.has(key)) continue;
        used.add(key);
        if (pick(i + 1, used)) return true;
        used.delete(key);
      }
      return false;
    };
    if (pick(0, new Set())) found.push(perm.join(""));
  }
  return found;
}

assert.equal(INF_TASK2.length, 78, "в банке должно быть 78 заданий");
assert.equal(new Set(INF_TASK2.map((x) => x.id)).size, 78, "повторяются id");

for (const item of INF_TASK2) {
  assert.match(item.answer, /^[a-z]{3,5}$/, `плохой ответ ${item.answer} (id ${item.id})`);
  assert.equal(item.answer.length, item.cols, `длина ответа не равна числу столбцов (id ${item.id})`);
  assert.equal([...item.answer].sort().join(""), [...new Set(item.answer)].sort().join(""), `буква повторяется в ответе (id ${item.id})`);
  for (const f of item.formulas) {
    assert.ok(OPS.some((o) => f.includes(o)), `в формуле нет операций (id ${item.id})`);
    assert.doesNotMatch(f, /[А-Яа-яЁё]/, `кириллица в формуле (id ${item.id})`);
  }
  for (const row of item.rows) {
    assert.equal(row.length, item.rows[0].length, `разная длина строк (id ${item.id})`);
    for (const cell of row) assert.ok(cell === "" || cell === "?" || cell === "0" || cell === "1", `плохая клетка «${cell}» (id ${item.id})`);
  }
  (item.labels || []).forEach((l, i) => {
    if (l) assert.equal(l, item.answer[i], `подпись столбца ${i} не совпадает с ответом (id ${item.id})`);
  });
  const solutions = solve(item);
  assert.deepEqual(solutions, [item.answer], `решение не единственное или неверное (id ${item.id}): ${solutions.join(", ") || "нет"}`);
}

console.log(`ok: ${INF_TASK2.length} заданий, у всех ответ подтверждён перебором`);
