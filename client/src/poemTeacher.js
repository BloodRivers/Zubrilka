/** Разбор стиха и локальная проверка прочтения — без ИИ и без сети. */

export function parsePoem(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n+/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((block) => block.length);
}

/** 5 строк → 2 и 3; чётное число делится пополам. */
export function splitIntoChunks(lines) {
  if (!lines.length) return [];
  if (lines.length === 1) return [lines.slice()];
  const first = Math.floor(lines.length / 2);
  return [lines.slice(0, first), lines.slice(first)];
}

/** Начало строки и спойлер с продолжением. */
export function splitRecall(line) {
  const words = String(line || "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    const word = words[0] || "";
    const at = Math.max(1, Math.ceil(word.length / 2));
    return { hint: word.slice(0, at), rest: word.slice(at) };
  }
  const at = Math.ceil(words.length / 2);
  return { hint: words.slice(0, at).join(" "), rest: words.slice(at).join(" ") };
}

export function normalizePoemWords(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .match(/[\p{L}\p{N}]+/gu) || [];
}

/** Сверяем слова по счётчику: повторы в тексте требуют повторов в расшифровке. */
export function compareRecited(expected, heard) {
  const source = normalizePoemWords(expected);
  const counts = new Map();
  for (const word of normalizePoemWords(heard)) counts.set(word, (counts.get(word) || 0) + 1);
  const missing = [];
  for (const word of source) {
    const left = counts.get(word) || 0;
    if (left) counts.set(word, left - 1);
    else missing.push(word);
  }
  const matched = source.length - missing.length;
  return {
    score: source.length ? Math.round((matched / source.length) * 100) : 0,
    matched,
    total: source.length,
    missing,
  };
}
