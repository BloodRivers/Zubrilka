// Нечёткий поиск: подстрока из букв в любом месте, запрос разбивается на слова.
// Чем раньше и плотнее совпадение (начало слова, подряд), тем выше балл.
export function fuzzyScore(text, query) {
  const hay = String(text || "").toLowerCase();
  const tokens = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return 0;
  let total = 0;
  for (const token of tokens) {
    let at = 0;
    let score = 0;
    let i = 0;
    for (const ch of token) {
      const found = hay.indexOf(ch, at);
      if (found === -1) return -1;
      const gap = found - i;
      const wordStart = found === 0 || /[\s\-_—.,:;«»()[\]/]/.test(hay[found - 1]);
      score += 1 + (gap === 0 ? 1.5 : 0) + (wordStart ? 2 : 0) - Math.min(gap * 0.05, 1);
      i = found + 1;
      at = i;
    }
    total += score;
  }
  return total;
}

export function fuzzyMatch(text, query) {
  return fuzzyScore(text, query) >= 0;
}
