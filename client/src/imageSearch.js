const API = "https://commons.wikimedia.org/w/api.php";

/** Только конкретные, заранее проверенные запросы — модель не придумывает тему картинки. */
export const ALLOWED_IMAGE_QUERIES = [
  "график функции",
  "схема графа",
  "митохондрия схема",
  "строение клетки",
  "парабола график",
  "синус график",
];

export function isAllowedImageQuery(query) {
  const norm = String(query || "").toLowerCase().replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  return ALLOWED_IMAGE_QUERIES.includes(norm);
}

/** Без ключа и без CORS-прокси: Commons отдаёт origin=*. */
export function commonsSearchUrl(query) {
  const u = new URL(API);
  const params = {
    action: "query",
    generator: "search",
    gsrsearch: String(query || "").trim().slice(0, 120),
    gsrnamespace: "6",
    gsrlimit: "3",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "640",
    format: "json",
    origin: "*",
  };
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

function https(value) {
  const s = String(value || "");
  return /^https:\/\//i.test(s) ? s : "";
}

function text(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

/** Первая пригодная картинка из ответа Commons; null — ничего не нашли. */
export function pickCommonsImage(json) {
  const pages = json?.query?.pages;
  if (!pages || typeof pages !== "object") return null;
  const ranked = Object.values(pages).sort((a, b) => (a?.index ?? 99) - (b?.index ?? 99));
  for (const page of ranked) {
    const info = page?.imageinfo?.[0];
    if (!info) continue;
    const src = https(info.thumburl) || https(info.url);
    if (!src) continue;
    const meta = info.extmetadata || {};
    const haystack = `${page.title || ""} ${meta.ImageDescription?.value || ""}`;
    if (/газет|newspaper|journal|magazine|periodical|press|тираж|выпуск/i.test(haystack)) continue;
    return {
      src,
      source: https(info.descriptionurl),
      title: text(String(page.title || "").replace(/^File:/i, "")),
      license: text(meta.LicenseShortName?.value),
      author: text(meta.Artist?.value),
    };
  }
  return null;
}
