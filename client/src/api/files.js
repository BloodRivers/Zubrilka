import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

const TEXT_MAX_BYTES = 2 * 1024 * 1024;
const PDF_MAX_BYTES = 40 * 1024 * 1024;
const PDF_MAX_PAGES = 250;

const TEXT_EXT = new Set(["txt", "md", "markdown", "text", "csv", "log"]);

/**
 * @param {File} file
 * @returns {"image"|"pdf"|"text"|null}
 */
export function classifyAttachFile(file) {
  const name = (file.name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  const type = (file.type || "").toLowerCase();

  if (type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext)) {
    return "image";
  }
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (
    type.startsWith("text/")
    || type === "application/json"
    || TEXT_EXT.has(ext)
  ) {
    return "text";
  }
  return null;
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
    const w0 = bmp ? bmp.width : img.width;
    const h0 = bmp ? bmp.height : img.height;
    if (!w0 || !h0) throw new Error("Фото с нулевым размером — не загрузилось");

    const scale = Math.min(1, max / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp || img, 0, 0, w, h);
    if (bmp) bmp.close();
    const out = canvas.toDataURL("image/jpeg", 0.8);
    if (out.length < 5000 || !JPEG_DATA.test(out)) {
      throw new Error("После сжатия фото почти пустое — попробуй другое");
    }
    return out;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
