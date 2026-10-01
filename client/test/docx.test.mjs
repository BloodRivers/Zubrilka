// Проверка распаковки .docx: node client/test/docx.test.mjs
// Собираем настоящий zip (deflate-raw) и смотрим, что extractDocxText вытащил текст.
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { extractDocxText, extractDocxMedia } from "../src/api/docx.js";

function makeZip(files) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const data = Buffer.from(content, "utf8");
    const comp = deflateRawSync(data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBytes.length, 26);
    locals.push(lh, nameBytes, comp);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBytes.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBytes);

    offset += 30 + nameBytes.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, eocd]));
}

const XML = `<?xml version="1.0"?>
<w:document xmlns:w="x"><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Фотосинтез</w:t></w:r></w:p>
<w:p><w:r><w:t>a &amp; b</w:t></w:r><w:r><w:tab/><w:t>x&lt;y</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Клетка 1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>2</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:p><w:r><w:t>Вторая строка конспекта про фотосинтез.</w:t></w:r></w:p>
</w:body></w:document>`;

const bytes = makeZip({
  "[Content_Types].xml": "<Types/>",
  "word/document.xml": XML,
  "word/styles.xml": "<w:styles/>",
});

const file = { name: "urok.docx", size: bytes.length, arrayBuffer: async () => bytes.buffer };
const out = await extractDocxText(file);

assert.match(out, /Фотосинтез/, "заголовок абзаца");
assert.match(out, /a & b/, "xml-энтити &amp; раскрыты");
assert.match(out, /x<y/, "xml-энтити &lt; раскрыты");
assert.match(out, /Клетка 1\t2/, "таблица склеена табуляцией");
assert.match(out, /Вторая строка/, "хвост не потерялся");
assert.ok(!/<w:/.test(out), "теги не остались в тексте");

// Пустой документ и не-zip должны падать с внятной ошибкой, а не молча.
await assert.rejects(
  extractDocxText({ name: "pusto.docx", size: 30, arrayBuffer: async () => makeZip({ "word/document.xml": "<w:body/>" }).buffer }),
  /почти нет текста/,
);
await assert.rejects(
  extractDocxText({ name: "a.doc", size: 30, arrayBuffer: async () => new Uint8Array(30).buffer }),
  /не zip/,
);

// Картинки из word/media достаются байт-в-байт; emf и подпапки игнорируются.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const mediaBytes = makeZip({
  "word/document.xml": XML,
  "word/media/image1.png": PNG,
  "word/media/image2.JPEG": PNG.slice().reverse(),
  "word/media/thumbnail.emf": PNG,
  "word/media/subdir/inner.png": PNG,
});
const media = await extractDocxMedia({
  name: "urok.docx",
  size: mediaBytes.length,
  arrayBuffer: async () => mediaBytes.buffer,
});

assert.deepEqual(media.map((m) => m.name), ["image1.png", "image2.JPEG"], "только картинки из media");
assert.deepEqual([...media[0].bytes], [...PNG], "байты картинки не побиты");
assert.deepEqual([...media[1].bytes], [...PNG.slice().reverse()], "вторая картинка тоже цела");
assert.ok(media.every((m) => m.bytes.length > 0), "пустых картинок нет");

await assert.rejects(
  extractDocxMedia({ name: "a.doc", size: 30, arrayBuffer: async () => new Uint8Array(30).buffer }),
  /не zip/,
);

console.log("docx ok:", JSON.stringify(out));
