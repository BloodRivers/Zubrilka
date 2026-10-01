// .docx — это zip с word/document.xml. Распаковка есть в браузере нативно
// (DecompressionStream), поэтому своя библиотека на ~1 МБ не нужна.

const EOCD = 0x06054b50;
const CEN = 0x02014b50;
const LOC = 0x04034b50;

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("Браузер не умеет распаковывать .docx — открой в Chrome/Edge/Safari 16.4+ или сохрани как .txt/.pdf");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Оглавление zip: все записи с их смещениями в данных. */
function centralEntries(bytes) {
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (u32(bytes, i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Файл не zip — .docx не читается");

  const count = u16(bytes, eocd + 10);
  let p = u32(bytes, eocd + 16);
  if (p === 0xffffffff) throw new Error("Слишком большой .docx (zip64) — не поддерживается");

  const dec = new TextDecoder();
  const out = [];
  for (let n = 0; n < count; n++) {
    if (u32(bytes, p) !== CEN) throw new Error("Повреждён .docx");
    const nameLen = u16(bytes, p + 28);
    out.push({
      name: dec.decode(bytes.subarray(p + 46, p + 46 + nameLen)),
      method: u16(bytes, p + 10),
      csize: u32(bytes, p + 20),
      locOff: u32(bytes, p + 42),
    });
    p += 46 + nameLen + u16(bytes, p + 30) + u16(bytes, p + 32);
  }
  return out;
}

/** Прочитать данные записи по её локальному заголовку. */
async function readEntry(bytes, e) {
  if (u32(bytes, e.locOff) !== LOC) throw new Error("Повреждён .docx");
  const start = e.locOff + 30 + u16(bytes, e.locOff + 26) + u16(bytes, e.locOff + 28);
  const raw = bytes.subarray(start, start + e.csize);
  if (e.method === 0) return raw;
  if (e.method !== 8) throw new Error("Непонятное сжатие в .docx");
  return inflateRaw(raw);
}

/** Достать один файл из zip по имени. */
async function unzipEntry(bytes, name) {
  const e = centralEntries(bytes).find((x) => x.name === name);
  if (!e) throw new Error(`В .docx нет ${name}`);
  return readEntry(bytes, e);
}

// ponytail: только основной текст — без стилей, колонтитулов, сносок и картинок.
// Таблицы склеиваются табуляцией; на конспект этого хватает.
function docxXmlToText(xml) {
  const P = "\uE001"; // конец абзаца или строки таблицы
  const CELL = "\uE000"; // конец абзаца ВНУТРИ ячейки таблицы — это граница ячейки
  return xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, P)
    .replace(/<\/w:p>(?=<\/w:tc>)/g, CELL)
    .replace(/<\/w:p>/g, P)
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<\/w:tr>/g, P)
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&") // строго последним: &amp;lt; не должен стать «<»
    .replace(/\u00a0/g, " ")
    .replace(new RegExp(`[ \\t]*${CELL}[ \\t]*`, "g"), "\t")
    .replace(new RegExp(P, "g"), "\n\n")
    .replace(/ {2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Текст из .docx (Word 2007+). Старый бинарный .doc — не сюда, его нет в zip. */
export async function extractDocxText(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error("Word-файл слишком большой (макс. 20 МБ)");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const xml = new TextDecoder().decode(await unzipEntry(bytes, "word/document.xml"));
  const text = docxXmlToText(xml);
  if (text.length < 20) {
    throw new Error(`В «${file.name}» почти нет текста — похоже на пустой документ`);
  }
  return text;
}

const MEDIA_RE = /^word\/media\/([^/]+)$/;
const PIC_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i;

/**
 * Картинки из word/media — то, чего нет в тексте (схемы, графики, формулы).
 * Сырые байты: сжатие в JPEG и фильтры мелких картинок делает вызывающий.
 */
export async function extractDocxMedia(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const out = [];
  for (const e of centralEntries(bytes)) {
    const m = MEDIA_RE.exec(e.name);
    if (!m || !PIC_EXT.test(m[1])) continue;
    try {
      const data = await readEntry(bytes, e);
      if (data.length > 8 * 1024 * 1024) continue;
      out.push({ name: m[1], bytes: data });
    } catch {
      /* битая картинка — молча пропускаем, текст важнее */
    }
  }
  return out;
}
