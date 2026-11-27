/** Номер страницы из ?page=: мусор и выход за пределы книги не ломают ридер. */
export function textbookPage(raw, total) {
  const n = Number(raw);
  const page = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  return total > 0 ? Math.min(page, total) : page;
}

/** Готовая markdown-ссылка на страницу учебника для конспекта. */
export function textbookLink(book, page) {
  const label = String(book?.title || "Учебник").replaceAll("[", "").replaceAll("]", "");
  return `[${label}, с. ${page}](/textbook/${book.id}?page=${page})`;
}

const MAX_PAGES = 500;

/**
 * Разбор ввода вроде "1-4,7,9,11-20". Возвращает отсортированные страницы
 * или ошибку, которую показываем пользователю прямо под полем.
 */
export function parseTextbookPages(raw, max = 0) {
  const parts = String(raw ?? "").split(",");
  if (!parts.some((p) => p.trim())) {
    return { pages: [], error: "Введи страницы, например: 1-4,7,9,11-20" };
  }
  const pages = new Set();
  for (const part of parts) {
    const s = part.trim();
    if (!s) return { pages: [], error: "Пустой интервал между запятыми. Пример: 1-4,7" };
    const range = /^(\d+)\s*[-–—]\s*(\d+)$/.exec(s);
    const single = /^\d+$/.test(s) ? Number(s) : null;
    let from;
    let to;
    if (range) {
      from = Number(range[1]);
      to = Number(range[2]);
    } else if (single !== null) {
      from = to = single;
    } else {
      return { pages: [], error: `Невалидное значение «${s}». Пример: 1-4,7,9` };
    }
    if (from < 1) return { pages: [], error: "Страницы нумеруются с 1" };
    if (to < from) return { pages: [], error: `В «${s}» конец раньше начала` };
    if (max > 0 && to > max) {
      return { pages: [], error: `В PDF ${max} стр., а запрошена ${to}` };
    }
    if (to - from + 1 > MAX_PAGES || pages.size + to - from + 1 > MAX_PAGES) {
      return { pages: [], error: `До ${MAX_PAGES} страниц за раз` };
    }
    for (let p = from; p <= to; p++) pages.add(p);
  }
  return { pages: [...pages].sort((a, b) => a - b), error: null };
}
