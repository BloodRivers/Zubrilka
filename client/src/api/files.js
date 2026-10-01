import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { extractDocxMedia } from "./docx";
import { pdfImagesFrom } from "./pdfImages";

export { extractDocxText } from "./docx";

GlobalWorkerOptions.workerSrc = pdfWorker;

const TEXT_MAX_BYTES = 2 * 1024 * 1024;
const PDF_MAX_BYTES = 40 * 1024 * 1024;
const PDF_MAX_PAGES = 250;

const TEXT_EXT = new Set(["txt", "md", "markdown", "text", "csv", "log"]);
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * @param {File} file
 * @returns {"image"|"pdf"|"text"|"docx"|"doc"|null}
 */
export function classifyAttachFile(file) {
  const name = (file.name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  const type = (file.type || "").toLowerCase();

  if (type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext)) {
    return "image";
  }
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (ext === "docx" || type === DOCX_MIME) return "docx";
  if (ext === "doc" || type === "application/msword") return "doc";
  if (
    type.startsWith("text/")
    || type === "application/json"
    || TEXT_EXT.has(ext)
  ) {
    return "text";
  }
  return null;
}

/** Старый бинарный Word — не zip, читать нечем. */
export async function extractLegacyDoc() {
  throw new Error("Формат .doc не поддерживается — в Word: «Сохранить как» → .docx");
}

function readAsText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result || ""));
    r.onerror = () => rej(new Error("Не удалось прочитать текстовый файл"));
    r.readAsText(file);
  });
}

function readAsArrayBuffer(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Не удалось прочитать PDF"));
    r.readAsArrayBuffer(file);
  });
}

/** Собрать текст страницы с переносами строк (Y + hasEOL). */
function pageItemsToText(items) {
  if (!Array.isArray(items) || !items.length) return "";
  let out = "";
  let lastY = null;
  for (const it of items) {
    if (!it || typeof it.str !== "string") continue;
    const y = Array.isArray(it.transform) ? Number(it.transform[5]) : null;
    if (lastY != null && y != null && Math.abs(lastY - y) > 2.5) {
      if (!out.endsWith("\n")) out += "\n";
    }
    out += it.str;
    if (it.hasEOL) out += "\n";
    if (y != null) lastY = y;
  }
  return out
    .replace(/\u00ad/g, "")
    .replace(/-\n(?=\S)/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Извлечь текст из PDF (без OCR сканов — только текстовый слой). */
export async function extractPdfText(file) {
  if (file.size > PDF_MAX_BYTES) {
    throw new Error("PDF слишком большой (макс. 40 МБ)");
  }
  const data = await readAsArrayBuffer(file);
  const pdf = await getDocument({
    data: new Uint8Array(data),
    disableFontFace: true,
    useSystemFonts: true,
  }).promise;

  const pages = Math.min(pdf.numPages, PDF_MAX_PAGES);
  const parts = [];
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent({
      includeMarkedContent: false,
      disableCombineTextItems: false,
    });
    const pageText = pageItemsToText(content.items);
    if (pageText) parts.push(pageText);
  }

  let text = parts.join("\n\n").trim();
  if (!text || text.length < 20) {
    throw new Error(
      "В PDF нет текстового слоя (похоже на скан). Сфотографируй страницы или вставь текст вручную."
    );
  }
  if (pdf.numPages > PDF_MAX_PAGES) {
    text += `\n\n[…обрезано: взяты первые ${PDF_MAX_PAGES} из ${pdf.numPages} стр.]`;
  }
  return text;
}

/** Прочитать .txt / .md / .csv и т.п. */
export async function extractTextFile(file) {
  if (file.size > TEXT_MAX_BYTES) {
    throw new Error("Текстовый файл слишком большой (макс. 2 МБ)");
  }
  const text = (await readAsText(file)).trim();
  if (!text) throw new Error(`Файл «${file.name}» пустой`);
  return text;
}

const JPEG_DATA = /^data:image\/jpeg;base64,/;

/** Сжать уже декодированную картинку (ImageBitmap, <img> или canvas) в JPEG data URL. */
export async function scaledImageDataUrl(src, max) {
  const w0 = src.width;
  const h0 = src.height;
  if (!w0 || !h0) throw new Error("Картинка с нулевым размером — не загрузилась");

  const scale = Math.min(1, max / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  const out = canvas.toDataURL("image/jpeg", 0.8);
  if (out.length < 5000 || !JPEG_DATA.test(out)) {
    throw new Error("После сжатия картинка почти пустая — пропускаю её");
  }
  return out;
}

/**
 * Сжать фото в data URL (JPEG ~0.8) с ограничением по большей стороне.
 * Не читает файл целиком в строку: сразу декод по блобу — на телефонах
 * полный base64 + двойной декод ронял вкладку на больших снимках с камеры.
 */
export async function downscaleImageFile(file, max) {
  let bmp = null;
  let img = null;
  let url = null;
  try {
    if (typeof createImageBitmap === "function") {
      bmp = await createImageBitmap(file);
    }
  } catch {
    bmp = null;
  }
  if (!bmp) {
    url = URL.createObjectURL(file);
    try {
      img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error("Не удалось декодировать фото (нужен JPG/PNG, не HEIC)"));
        i.src = url;
      });
    } catch (err) {
      URL.revokeObjectURL(url);
      throw err;
    }
  }

  try {
    return await scaledImageDataUrl(bmp || img, max);
  } finally {
    if (bmp) bmp.close();
    if (url) URL.revokeObjectURL(url);
  }
}

// ponytail: картинки из файла храним в конспекте как data URL, поэтому лимит
// 6 шт. и ~300 КБ суммарно (документ Firestore — 1 МБ). Если понадобится больше —
// Cloud Storage со ссылками, а не base64 внутри note.
const MAX_NOTE_IMAGES = 6;
const MAX_NOTE_IMAGE_CHARS = 300_000;

/** Обрезать список картинок до того, что влезет в документ конспекта. */
export function capNoteImages(list, budget = MAX_NOTE_IMAGE_CHARS) {
  const max = Math.min(budget, MAX_NOTE_IMAGE_CHARS);
  const out = [];
  let chars = 0;
  for (const im of list || []) {
    if (out.length >= MAX_NOTE_IMAGES || chars >= max) break;
    if (!im?.src) continue;
    chars += im.src.length;
    out.push(im);
  }
  return out;
}

const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};
const picMime = (name) => MIME[(name.split(".").pop() || "").toLowerCase()] || "";

/** Растр в canvas: то, что потом можно жать в JPEG. */
function rasterToCanvas({ bitmap, pixels, width, height }) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (bitmap) {
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
  } else {
    ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
  }
  return canvas;
}

/** Картинки вложения для конспекта: [{name, src}], с учётом лимитов. */
export async function extractAttachImages(file, kind, maxSide = 900) {
  let raw = [];
  try {
    if (kind === "docx") {
      raw = await extractDocxMedia(file);
    } else if (kind === "pdf") {
      raw = file.size > PDF_MAX_BYTES ? [] : await pdfImagesFrom(new Uint8Array(await readAsArrayBuffer(file)));
    }
  } catch (e) {
    console.warn("[files] images:", file?.name, e);
    return [];
  }

  const out = [];
  for (const item of raw) {
    if (out.length >= MAX_NOTE_IMAGES) break;
    try {
      const src = item.bytes
        ? await downscaleImageFile(new Blob([item.bytes], { type: picMime(item.name) }), maxSide)
        : await scaledImageDataUrl(rasterToCanvas(item), maxSide);
      out.push({ name: item.name || "", src });
    } catch {
      /* мелкая или битая — в конспект не тащим */
    }
  }
  return capNoteImages(out);
}
