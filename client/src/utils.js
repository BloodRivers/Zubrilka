import katex from "katex";
import "katex/dist/katex.min.css";

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const NON_MATH = /[«»“”‘’–—…]/g;

export function katexHtml(tex, displayMode) {
  return katex.renderToString(String(tex || "").replace(NON_MATH, " "), {
    displayMode,
    throwOnError: false,
    strict: false,
    output: "html",
  });
}

export function plural(n, [one, few, many]) {
  const s = n % 100;
  if (s >= 11 && s <= 14) return many;
  const d = s % 10;
  if (d === 1) return one;
  if (d >= 2 && d <= 4) return few;
  return many;
}