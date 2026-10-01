// Рисунки из PDF: node client/test/pdf-images.test.mjs
// getDocument в Node не работает (современный build), поэтому проверяем чистую
// часть: разбор растра XObject и отсев мелких картинок. Сам обход страниц
// проверен вручную на PDF со вшитой картинкой.
import assert from "node:assert/strict";
import { ImageKind } from "pdfjs-dist";
import { imagePixels, worthKeeping } from "../src/api/pdfImages.js";

const W = 4;
const H = 3;
const rgb = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  rgb[i * 3] = (i * 7) % 256;
  rgb[i * 3 + 1] = (i * 13) % 256;
  rgb[i * 3 + 2] = (i * 29) % 256;
}

// Ровно такой объект отдаёт page.objs для картинки из PDF: RGB_24BPP + Uint8Array.
const rgbObj = imagePixels({ width: W, height: H, kind: ImageKind.RGB_24BPP, data: new Uint8Array(rgb) });
assert.ok(rgbObj.pixels, "растр распакован в пиксели");
assert.equal(rgbObj.width, W);
assert.equal(rgbObj.height, H);
assert.equal(rgbObj.pixels.length, W * H * 4, "RGBA, а не RGB — альфа добавлена");
for (let i = 0; i < W * H; i++) {
  assert.deepEqual(
    [rgbObj.pixels[i * 4], rgbObj.pixels[i * 4 + 1], rgbObj.pixels[i * 4 + 2], rgbObj.pixels[i * 4 + 3]],
    [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2], 255],
    `пиксель ${i} не перепутан`
  );
}

// RGBA и готовый bitmap идут насквозь; незнакомые форматы — молча null.
assert.deepEqual(
  [...imagePixels({ width: 1, height: 1, kind: ImageKind.RGBA_32BPP, data: new Uint8Array([9, 8, 7, 6]) }).pixels],
  [9, 8, 7, 6],
  "RGBA проходит насквозь"
);
const bmp = { close() {} };
assert.equal(imagePixels({ width: 2, height: 2, bitmap: bmp }).bitmap, bmp, "bitmap не трогаем");
assert.equal(imagePixels({ width: 4, height: 4, kind: 1, data: new Uint8Array(2) }), null, "маска 1bpp");
assert.equal(imagePixels(null), null);
assert.equal(imagePixels({ width: 0, height: 4, kind: ImageKind.RGB_24BPP, data: new Uint8Array(0) }), null);

// Буллиты и иконки в конспект не идут; скан страницы целиком — тоже.
assert.equal(worthKeeping(8, 8), false, "иконка");
assert.equal(worthKeeping(200, 100), true, "схема");
assert.equal(worthKeeping(1400, 900), true, "фотография в тексте");
assert.equal(worthKeeping(2480, 3508), false, "скан A4@300dpi");
assert.equal(worthKeeping(6000, 3000), false, "не влезает в телефон");

console.log("pdf-images ok");