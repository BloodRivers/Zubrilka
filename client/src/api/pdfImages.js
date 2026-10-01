// Рисунки из PDF: pdf.js декодирует картинку сам, остаётся достать растр из
// page.objs по оператору paintImageXObject. Без canvas — его рисует files.js.
import { getDocument, OPS, ImageKind } from "pdfjs-dist";

const MIN_IMAGE_PX = 5000; // мельче — это буллиты, иконки и линейки
const MAX_IMAGE_PX = 2_500_000; // крупнее — обычно скан страницы, а не рисунок
const MAX_RAW = 24; // больше нам не нужно: дальше всё равно отсечёт лимит

// ponytail: отсев по площади, а не по положению на странице (для этого нужен
// разбор CTM). Схему шире ~1600px пропустим — если понадобится, смотрим
// трансформацию оператора перед paintImageXObject.
export function worthKeeping(w, h) {
  const px = w * h;
  return px >= MIN_IMAGE_PX && px <= MAX_IMAGE_PX;
}

/** Пиксели XObject в RGBA. null — если формат нам не по зубам. */
export function imagePixels(obj) {
  if (!obj || !obj.width || !obj.height) return null;
  const w = obj.width;
  const h = obj.height;
  if (obj.bitmap) return { bitmap: obj.bitmap, width: w, height: h };

  const { data, kind } = obj;
  if (!data) return null;
  const px = new Uint8ClampedArray(w * h * 4);
  if (kind === ImageKind.RGBA_32BPP) {
    px.set(data.subarray(0, px.length));
  } else if (kind === ImageKind.RGB_24BPP) {
    for (let d = 0, s = 0; d < px.length; d += 4, s += 3) {
      px[d] = data[s];
      px[d + 1] = data[s + 1];
      px[d + 2] = data[s + 2];
      px[d + 3] = 255;
    }
  } else {
    // ponytail: однобитовые маски и CMYK пропускаем — на схемах их почти нет.
    return null;
  }
  return { pixels: px, width: w, height: h };
}

/**
 * Рисунки документа по порядку страниц: [{name, bitmap?, pixels?, width, height}].
 * @param {Uint8Array} bytes содержимое PDF
 */
export async function pdfImagesFrom(bytes) {
  const pdf = await getDocument({ data: bytes, disableFontFace: true, useSystemFonts: true }).promise;
  const seen = new Set();
  const out = [];
  for (let i = 1; i <= pdf.numPages && out.length < MAX_RAW; i++) {
    const page = await pdf.getPage(i);
    const list = await page.getOperatorList();
    for (let k = 0; k < list.fnArray.length && out.length < MAX_RAW; k++) {
      if (list.fnArray[k] !== OPS.paintImageXObject) continue;
      const name = list.argsArray[k]?.[0];
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const px = imagePixels(page.objs.get(name));
      if (!px || !worthKeeping(px.width, px.height)) continue;
      out.push({ name: `стр. ${i}`, ...px });
    }
    page.cleanup();
  }
  return out;
}