// Подбор картинки для конспекта: node client/test/image-search.test.mjs
import assert from "node:assert/strict";
import { commonsSearchUrl, isAllowedImageQuery, pickCommonsImage } from "../src/imageSearch.js";

assert.equal(isAllowedImageQuery("График функции"), true);
assert.equal(isAllowedImageQuery("схема графа."), true);
assert.equal(isAllowedImageQuery("исследование функции"), false);

const url = new URL(commonsSearchUrl("схема графа"));
assert.equal(url.origin, "https://commons.wikimedia.org");
assert.equal(url.searchParams.get("gsrnamespace"), "6");
assert.equal(url.searchParams.get("origin"), "*");
assert.equal(url.searchParams.get("gsrsearch"), "схема графа");

const image = pickCommonsImage({
  query: { pages: {
    42: { index: 2, title: "File:Other.svg", imageinfo: [{ thumburl: "https://thumb.wikimedia.org/other.png" }] },
    7: { index: 1, title: "File:Directed.svg", imageinfo: [{
      thumburl: "https://thumb.wikimedia.org/wikipedia/commons/a/a2/Directed.svg/640px-Directed.svg.png",
      descriptionurl: "https://commons.wikimedia.org/wiki/File:Directed.svg",
      extmetadata: {
        LicenseShortName: { value: "CC0" },
        Artist: { value: "<a href=\"//commons.wikimedia.org/wiki/User:Frap\">Frap</a>" },
      },
    }] },
  } },
});
assert.equal(image.src.includes("Directed.svg"), true);
assert.equal(image.title, "Directed.svg");
assert.equal(image.license, "CC0");
assert.equal(image.author, "Frap");

assert.equal(pickCommonsImage({}), null);
assert.equal(pickCommonsImage({ query: { pages: { 1: { imageinfo: [{ thumburl: "http://bad.example/x.png" }] } } } }), null);
assert.equal(pickCommonsImage({ query: { pages: { 1: {
  title: "File:Газета.jpg",
  imageinfo: [{
    thumburl: "https://thumb.wikimedia.org/newspaper.png",
    extmetadata: { ImageDescription: { value: "Старая газета" } },
  }],
} } } }), null);

console.log("ok: commons image search");
