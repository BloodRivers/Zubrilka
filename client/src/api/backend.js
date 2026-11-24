import { getNote } from "./firestore";
import { aiJSON, aiJSONStream, aiText, collapseRepeats, assertVisionWorks } from "./ai";

const SYSTEM_OCR =
  "Ты OCR для рукописных/печатных конспектов. "
  + "Перепиши текст с фото СТРОГО как на изображении. "
  + "Не объясняй, не структурируй, не дополняй знаниями. "
  + "Не повторяй один и тот же абзац. "
  + "Если слово нечитаемо — [неразборчиво]. "
  + "Несколько фото = страницы одного конспекта по порядку. "
  + "Ответ — только транскрипт plain text.";

const OCR_PROMPT =
  "Перепиши весь видимый текст с фото ниже. Без JSON, без комментариев, без повторов.";

const SYSTEM_PROOFREAD =
  "Ты вычитчик распознанного текста. На вход — те же фото и черновой транскрипт OCR. "
  + "Сверь транскрипт с изображением и исправь ошибки распознавания: перепутанные слова, "
  + "испорченные формулы/индексы, потерянные переносы, слипшиеся строки. "
  + "Верни ТОЛЬКО исправленный текст. Ничего не добавляй и не пересказывай — только то, что на фото.";

const NOTE_EXTRAS =
  "Спецблоки пиши цитатой: `> **Определение:** ...`, `> **Важно:** ...`, `> **Пример:** ...`, `> **Запомни:** ...`, `> **Вывод:** ...`. "
  + "Код пиши блоком с тройными обратными кавычками. "
  + "Картинку добавляй не больше 1 на блок строкой `![Подпись](img:запрос)` только когда без неё непонятен конкретный объект или схема; для рассуждений и абстрактных тем картинку не вставляй. "
  + "В запросе пиши точное название того, что должно быть на рисунке, а не название темы урока; реальные URL не выдумывай. "
  + "Например, для исследования функции запрос `график функции`, а не `исследование функции`. ";

const SYSTEM_STRUCTURE =
  "Ты помощник по учёбе. На вход — уже распознанный текст конспекта. "
  + "Не выдумывай факты вне текста. Не повторяй блоки. "
  + "Верни ТОЛЬКО JSON: "
  + '{"subject":"предмет или пусто","title":"короткое название",'
  + '"text":"очищенный текст конспекта без дублей",'
  + '"retelling":"связный пересказ всего конспекта своими словами",'
  + '"summary":[{"title":"тема блока","body":"содержимое блока в Markdown"}]}. '
  + "summary — главное: полный конспект, разбитый на блоки-аккордеоны; блоков минимум 3, для большого конспекта 5–8, "
  + "каждый блок со своим title+body (не сливай весь конспект в один блок). "
  + "Названия title — по смыслу темы, без слов «раздел/подраздел» и без нумерации. "
  + "Вложенные блоки внутри — заголовками '###' (станут вложенными аккордеонами). "
  + "В body — Markdown: маркированные и нумерованные списки, таблицы '| столбец | столбец |' с разделителем '|---|---|' и строками, "
  + "вся математика в LaTeX $...$ инлайн и $$...$$ отдельной строкой. "
  + "Заголовков '##' внутри body быть не должно — только title блока. "
  + "retelling — связный пересказ 1–3 плотных абзаца, без списков и новых фактов. "
  + "summary/retelling только из text. "
  + "ВСЮ математику в text, retelling и summary пиши в LaTeX: инлайн — $...$, отдельная строка — $$...$$; без них математика не отобразится."
  + NOTE_EXTRAS;

/** Когда полный текст уже есть (PDF/файл) — ИИ не должен его переписывать и обрезать. */
const SYSTEM_STRUCTURE_META =
  "Ты помощник по учёбе. На вход — полный текст конспекта (уже извлечён). "
  + "Не выдумывай факты вне текста. Не сокращай и не переписывай исходник в ответе. "
  + "Верни ТОЛЬКО JSON БЕЗ поля text: "
  + '{"subject":"предмет или пусто","title":"короткое название",'
  + '"retelling":"связный пересказ своими словами",'
  + '"summary":[{"title":"тема блока","body":"содержимое блока в Markdown"}]}. '
  + "summary — главное: полный конспект, разбитый на блоки-аккордеоны; блоков минимум 3, для большого конспекта 5–8, "
  + "каждый блок со своим title+body (не сливай весь конспект в один блок). "
  + "Названия title — по смыслу темы, без слов «раздел/подраздел» и без нумерации. "
  + "Вложенные блоки внутри — заголовками '###' (станут вложенными аккордеонами). "
  + "В body — Markdown: маркированные и нумерованные списки, таблицы '| столбец | столбец |' с разделителем '|---|---|' и строками, "
  + "вся математика в LaTeX $...$ инлайн и $$...$$ отдельной строкой. "
  + "Заголовков '##' внутри body быть не должно — только title блока. "
  + "retelling — 1–3 плотных абзаца по всем темам. "
  + "ВСЮ математику в retelling и summary пиши в LaTeX: инлайн — $...$, отдельная строка — $$...$$; без них математика не отобразится."
  + NOTE_EXTRAS;

const SYSTEM_SUMMARY =
  "Ты составляешь структурированный конспект для чтения. На вход — пересказ и текст исходного конспекта. "
  + "Выдели главное: определения, формулы, даты, связи, выводы. "
  + "Разбей на блоки-аккордеоны (минимум 3, для большого конспекта 5–8), каждый блок — свой аккордеон, не сливай всё в один body. "
  + 'Верни ТОЛЬКО JSON: {"summary":[{"title":"тема блока","body":"содержимое в Markdown"}]}. '
  + "Названия title — по смыслу темы, без слов «раздел/подраздел» и без нумерации. "
  + "В body — маркированные и нумерованные списки, таблицы '| столбец | столбец |' с разделителем '|---|---|' и строками, "
  + "вся математика в LaTeX: инлайн $...$, отдельной строкой $$...$$; вложенные блоки внутри — заголовками '###'. "
  + "Заголовков '##' внутри body быть не должно. "
  + "Только факты из исходника, ничего не выдумывай, не повторяй одинаковые блоки, "
  + "не открывай блок словами 'Основные моменты:' — сразу содержимое."
  + NOTE_EXTRAS;

/** Разделы конспекта: [{title, body}] — содержимое рендерится как Markdown. */
export function normalizeSummary(summary) {
  if (typeof summary === "string" && summary.trim()) {
    return [{ title: "Конспект", body: summary.trim() }];
  }
  if (!Array.isArray(summary)) return [];
  return summary
    .map((s) => ({
      title: String(s?.title || "").trim() || "Раздел",
      body: String(s?.body || s?.text || "").trim(),
    }))
    .filter((s) => s.body);
}

export const ALL_TEST_MODES = ["single", "multi", "quizlet", "match", "written"];
const Q_MAX = 120;
const OPT_MAX = 60;
const OPTS_MIN = 3;
const OPTS_MAX = 6;

export const TEST_SIZES = {
  express: { single: 5, multi: 3, quizlet: 5, match: 4, written: 2, label: "Экспресс", hint: "меньше вопросов — быстрее" },
  standard: { single: 10, multi: 5, quizlet: 10, match: 8, written: 3, label: "Стандарт", hint: "сбалансированный объём" },
  intense: { single: 12, multi: 6, quizlet: 12, match: 10, written: 3, label: "Интенсив", hint: "ближе к максимуму" },
  max: { single: 15, multi: 8, quizlet: 15, match: 12, written: 4, label: "Максимум", hint: "побольше вопросов на повтор" },
};
const DEFAULT_COUNTS = TEST_SIZES.standard;

export function testSizeLabel(test) {
  if (!test) return "";
  const matchSize = TEST_SIZES[test.size];
  if (matchSize) return matchSize.label;
  const got = {
    single: (test.questions || []).filter((q) => q.kind === "single").length,
    multi: (test.questions || []).filter((q) => q.kind === "multi").length,
    quizlet: (test.quizlet || []).length,
    match: (test.match || []).length,
  };
  for (const key of Object.keys(TEST_SIZES)) {
    const c = TEST_SIZES[key];
    if (c.single === got.single && c.multi === got.multi && c.quizlet === got.quizlet && c.match === got.match) return c.label;
  }
  return "";
}

const SYSTEM_GRADE =
  "Ты строгий, но доброжелательный преподаватель, проверяешь контрольную. "
  + "Ученику задано несколько вопросов, на каждый он написал ответ. Оцениваешь ТОЛЬКО его ответы по конспекту. "
  + "Не пересказывай конспект, не оценивай оформление и длину ответов — только содержательность. "
  + "Верни ТОЛЬКО JSON: {\"results\":[{\"s\":[\"ok\"],\"w\":[\"\"],\"grade\":5,\"comment\":\"что верно и что упущено\"}]}. "
  + "results — массив РОВНО из N элементов в том же порядке, N = число вопросов; ни одного лишнего элемента. "
  + 'Для вопроса i: s — массив ровно из Ni статусов, где Ni = число слов в ЕГО ответе, в том же порядке: '
  + '"ok" — слово верное, "part" — верное, но неполное или неточное, "bad" — неверное, искажённое или лишнее. '
  + 'w — такой же массив из Ni коротких причин (по ученику кликают на слово и читают объяснение): '
  + 'для "ok" — пустая строка "", для "part"/"bad" — 3–8 слов, например "не та эпоха", "нет единиц измерения". '
  + "Пиши вопросы по очереди, без преамбулы: ученик читает свой ответ слово за словом.";

function buildNoteContext(notes) {
  return notes
    .map((n) => {
      const parts = [];
      if (n.title) parts.push(`# ${n.title}`);
      if (n.retelling?.trim()) parts.push(`Пересказ:\n${n.retelling.trim()}`);
      if (n.text?.trim()) parts.push(`Текст:\n${n.text.trim()}`);
      return parts.join("\n\n");
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}

function buildTestSystem(modes, counts = DEFAULT_COUNTS) {
  const wantSingle = modes.includes("single");
  const wantMulti = modes.includes("multi");
  const wantQuizlet = modes.includes("quizlet");
  const wantMatch = modes.includes("match");
  const wantWritten = modes.includes("written");

  const parts = [];
  if (wantSingle || wantMulti) {
    parts.push(
      '"questions":[{"kind":"single|multi","q":"короткий вопрос",'
      + '"options":["а","б","в","г","д"],"correct":0,"topic":"тема","explain":"почему"}]'
    );
  }
  if (wantQuizlet) parts.push('"quizlet":[{"term":"термин","definition":"краткое определение","topic":"тема"}]');
  if (wantMatch) {
    parts.push(
      '"match":[{"left":"короткая левая часть","right":"связанная правая часть","topic":"тема"}]'
    );
  }
  if (wantWritten) parts.push('"written":[{"prompt":"задание-вопрос по конспекту"}]');
  const schema = "{" + parts.join(",") + "}";

  return (
    "Ты составляешь материалы для повторения СТРОГО по конспекту. "
    + "Верни ТОЛЬКО JSON без markdown. "
    + "Стиль: МНОГО коротких единиц, не длинные формулировки. "
    + `Вопрос ≤${Q_MAX} символов, вариант ответа ≤${OPT_MAX} символов. `
    + "Запрещено: «Вспомни пункт», Да/Нет, копипаст фраз конспекта, факты вне текста. "
    + (wantSingle
      ? `single: ровно ${counts.single} вопросов, kind="single", ${OPTS_MIN}–${OPTS_MAX} вариантов, correct — ЧИСЛО 0..${OPTS_MAX - 1} (один верный). `
      : "")
    + (wantMulti
      ? `multi: ровно ${counts.multi} вопросов, kind="multi", ${OPTS_MIN}–${OPTS_MAX} вариантов, correct — МАССИВ из 2–3 индексов 0..${OPTS_MAX - 1} (не все варианты). `
      : "")
    + (wantQuizlet
      ? `quizlet: ровно ${counts.quizlet} карточек термин↔краткое определение. `
      : "")
    + (wantMatch
      ? `match: ровно ${counts.match} пар для сопоставления. left и right — любые связанные фрагменты из конспекта (понятие↔смысл, причина↔следствие, дата↔событие, формула↔название и т.п.); тип пар выбирай по материалу. Пары уникальны, без дублей left/right. `
      : "")
    + (wantWritten
      ? `written: ровно ${counts.written} заданий-вопросов по конспекту. Ответ ученика — МАКСИМУМ 4 СЛОВА, поэтому спрашивай только про конкретные факты/термины/формулы/даты («Кто автор?», «Какая формула?», «Чем различаются X и Y?»), НЕ «объясни почему», «перечисли», «сравни», «охарактеризуй». Формулы и математику пиши в $...$ — это обычный текст внутри строки JSON. `
      : "")
    + `Формат: ${schema}`
  );
}

function parseCorrectIndex(raw, options) {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw < options.length) {
    return raw;
  }
  const s = String(raw ?? "").trim();
  const asNum = Number(s);
  if (Number.isInteger(asNum) && asNum >= 0 && asNum < options.length) return asNum;
  const letter = s.toUpperCase();
  const letterMap = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, А: 0, Б: 1, В: 2, Г: 3, Д: 4, Е: 5 };
  if (letterMap[letter] != null && letterMap[letter] < options.length) return letterMap[letter];
  const byText = options.findIndex((o) => String(o).trim() === s);
  return byText >= 0 ? byText : -1;
}

function parseCorrectMulti(raw, options) {
  const arr = Array.isArray(raw) ? raw : typeof raw === "number" ? [raw] : [];
  const idxs = [...new Set(arr.map((x) => parseCorrectIndex(x, options)).filter((i) => i >= 0))].sort((a, b) => a - b);
  return idxs.length >= 2 && idxs.length < options.length ? idxs : null;
}

function clip(s, max) {
  const t = String(s || "").trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function shuffleWithCorrect(options, correct) {
  const opts = [...options];
  const isMulti = Array.isArray(correct);
  const answers = isMulti ? correct.map((i) => opts[i]) : [opts[correct]];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  if (isMulti) {
    return { options: opts, correct: answers.map((a) => opts.indexOf(a)).sort((a, b) => a - b) };
  }
  return { options: opts, correct: opts.indexOf(answers[0]) };
}

export function normalizeQuestions(payload, modes = null, counts = DEFAULT_COUNTS) {
  const list = Array.isArray(payload) ? payload : payload?.questions;
  if (!Array.isArray(list)) return [];
  const allowSingle = !modes || modes.includes("single");
  const allowMulti = !modes || modes.includes("multi");

  const cleaned = [];
  for (const raw of list) {
    let kind = String(raw?.kind || "single").toLowerCase() === "multi" ? "multi" : "single";
    if (kind === "single" && !allowSingle && allowMulti) kind = "multi";
    if (kind === "multi" && !allowMulti && allowSingle) kind = "single";
    if (kind === "single" && !allowSingle) continue;
    if (kind === "multi" && !allowMulti) continue;

    const q = clip(raw?.q || raw?.question || "", Q_MAX);
    let options = Array.isArray(raw?.options)
      ? raw.options.map((o) => clip(o, OPT_MAX)).filter(Boolean)
      : [];
    if (options.length > OPTS_MAX) options = options.slice(0, OPTS_MAX);
    if (!q || options.length < OPTS_MIN) continue;

    if (/^вспомни пункт/i.test(q)) continue;
    const unique = new Set(options.map((o) => o.toLowerCase()));
    if (unique.size < 3) continue;

    let correct;
    if (kind === "multi") {
      correct = parseCorrectMulti(raw?.correct, options);
      if (!correct) continue;
    } else {
      correct = parseCorrectIndex(raw?.correct, options);
      if (correct < 0) continue;
    }

    const shuffled = shuffleWithCorrect(options, correct);
    cleaned.push({
      kind,
      q,
      options: shuffled.options,
      correct: shuffled.correct,
      topic: String(raw?.topic || "Общее").trim() || "Общее",
      explain: clip(raw?.explain || "", 160),
    });
  }

  const singles = cleaned.filter((q) => q.kind === "single").slice(0, counts.single);
  const multis = cleaned.filter((q) => q.kind === "multi").slice(0, counts.multi);
  const out = [];
  let si = 0;
  let mi = 0;
  while (si < singles.length || mi < multis.length) {
    if (si < singles.length) out.push(singles[si++]);
    if (si < singles.length) out.push(singles[si++]);
    if (mi < multis.length) out.push(multis[mi++]);
  }
  return out;
}

export function normalizeQuizlet(payload, counts = DEFAULT_COUNTS) {
  const list = Array.isArray(payload) ? payload : payload?.quizlet;
  if (!Array.isArray(list)) return [];
  return list
    .map((c) => ({
      term: clip(c?.term || c?.front || "", 80),
      definition: clip(c?.definition || c?.back || c?.def || "", 140),
      topic: String(c?.topic || "Общее").trim() || "Общее",
    }))
    .filter((c) => c.term && c.definition)
    .slice(0, counts.quizlet);
}

export function normalizeMatch(payload, counts = DEFAULT_COUNTS) {
  const list = Array.isArray(payload) ? payload : payload?.match;
  if (!Array.isArray(list)) return [];
  const seenL = new Set();
  const seenR = new Set();
  const out = [];
  for (const raw of list) {
    const left = clip(raw?.left || raw?.term || raw?.a || "", 60);
    const right = clip(raw?.right || raw?.definition || raw?.b || raw?.translation || "", 100);
    if (!left || !right) continue;
    const lk = left.toLowerCase();
    const rk = right.toLowerCase();
    if (seenL.has(lk) || seenR.has(rk)) continue;
    seenL.add(lk);
    seenR.add(rk);
    out.push({
      left,
      right,
      topic: String(raw?.topic || "Общее").trim() || "Общее",
    });
    if (out.length >= counts.match) break;
  }
  return out;
}

export function normalizeWritten(payload, count = 3) {
  const w = payload?.written;
  if (!w) return null;
  const list = Array.isArray(w) ? w : Array.isArray(w?.questions) ? w.questions : [w];
  const out = [];
  for (const x of list) {
    const prompt = clip(typeof x === "string" ? x : x?.prompt || "", 260);
    if (prompt) {
      out.push({ prompt });
      if (out.length >= count) break;
    }
  }
  return out.length ? { questions: out } : null;
}

export function writtenQuestionsOf(written) {
  if (!written) return [];
  if (Array.isArray(written?.questions) && written.questions.length) return written.questions;
  if (written?.prompt) return [{ prompt: written.prompt }];
  return [];
}

export function normalizeTestPayload(raw, modes, counts = DEFAULT_COUNTS) {
  const m = (modes || ALL_TEST_MODES).filter((x) => ALL_TEST_MODES.includes(x));
  return {
    type: "mixed",
    modes: m,
    questions: m.some((x) => x === "single" || x === "multi") ? normalizeQuestions(raw, m, counts) : [],
    quizlet: m.includes("quizlet") ? normalizeQuizlet(raw, counts) : [],
    match: m.includes("match") ? normalizeMatch(raw, counts) : [],
    written: m.includes("written") ? normalizeWritten(raw, counts.written) : null,
  };
}

async function ocrFromPhotos(imageDataUrl) {
  await assertVisionWorks(imageDataUrl);

  const raw = await aiText({
    name: "ocr-note",
    system: SYSTEM_OCR,
    prompt: OCR_PROMPT,
    imageDataUrl,
  });
  const draft = collapseRepeats(raw);
  if (draft.length < 30) {
    throw new Error("Не удалось прочитать текст с фото — сделай кадр чётче или вставь текст вручную");
  }

  // Второй проход: вычитка — модель сверяет транскрипт с фото и правит ошибки OCR.
  try {
    const fixed = await aiText({
      name: "ocr-proofread",
      system: SYSTEM_PROOFREAD,
      prompt: `Черновой транскрипт:\n\n${draft}`,
      imageDataUrl,
    });
    const corrected = collapseRepeats(fixed);
    return corrected.length >= 30 ? corrected : draft;
  } catch {
    return draft;
  }
}

/**
 * Структурировать уже готовый текст конспекта (фото/PDF/txt/ручной ввод).
 * @param {string} transcript
 * @param {{ keepSourceText?: boolean }} [opts]
 *   keepSourceText — сохранить полный исходник в note.text (для PDF/файлов),
 *   ИИ заполняет только title/plan/retelling.
 */
export async function structureNote(transcript, opts = {}) {
  const keepSourceText = Boolean(opts.keepSourceText);
  const text = collapseRepeats(String(transcript || "").trim());
  if (text.length < 20) {
    throw new Error("Слишком мало текста для анализа — добавь файл, фото или вставь текст");
  }

  // PDF/длинный текст: полный текст в JSON не просим — экономим вывод.
  // Вход и выход не режем: потолок генерации — лимит самой модели.
  const big = keepSourceText || text.length > 10000;
  const structured = await aiJSON({
    name: "structure-note",
    system: big ? SYSTEM_STRUCTURE_META : SYSTEM_STRUCTURE,
    prompt: `Собери JSON по этому транскрипту. Не добавляй ничего от себя.\n\n${text}`,
  });

  if (big) {
    structured.text = text;
  } else {
    const modelText = collapseRepeats(structured.text || "");
    // если модель заметно укоротила — оставляем исходник
    structured.text = modelText && modelText.length >= text.length * 0.85 ? modelText : text;
  }
  if (!structured.title) structured.title = "Конспект";
  structured.retelling = String(structured.retelling || "").trim();
  structured.summary = normalizeSummary(structured.summary);
  structured.plan = null;
  return structured;
}

/** Собрать читаемый конспект для вкладки «Конспект»: разделы-аккордеоны с таблицами и формулами. */
export async function generateSummary(note) {
  const source = buildNoteContext([note]);
  if (!source.trim()) throw new Error("Нет материала для конспекта");
  const raw = await aiJSON({
    name: "generate-summary",
    system: SYSTEM_SUMMARY,
    prompt: `Исходный материал:\n\n${source}`,
  });
  const summary = normalizeSummary(raw?.summary);
  if (!summary.length) throw new Error("Модель не вернула конспект — попробуй ещё раз");
  return summary;
}


async function analyzeFromPhotos(imageDataUrl) {
  const text = await ocrFromPhotos(imageDataUrl);
  return structureNote(text);
}

export const analyzeNote = analyzeFromPhotos;
/** Только OCR с фото (без структурирования) — для сборки с PDF/текстом. */
export const ocrNotePhotos = ocrFromPhotos;


export async function generateTest(noteIds, modesOrType) {
  const modes = Array.isArray(modesOrType)
    ? modesOrType
    : typeof modesOrType === "object" && modesOrType?.modes
      ? modesOrType.modes
      : ["single"];
  const size = typeof modesOrType === "object" && modesOrType?.size;
  const counts = Object.prototype.hasOwnProperty.call(TEST_SIZES, size)
    ? TEST_SIZES[size]
    : DEFAULT_COUNTS;
  const selected = [...new Set(modes)].filter((m) => ALL_TEST_MODES.includes(m));
  if (!selected.length) throw new Error("Выбери хотя бы один тип заданий");

  const notes = (await Promise.all((noteIds || []).map((id) => getNote(id).catch(() => null)))).filter(Boolean);
  const text = buildNoteContext(notes);
  if (!text.trim()) throw new Error("Нет конспекта для теста");

  const raw = await aiJSON({
    name: "generate-test",
    system: buildTestSystem(selected, counts),
    prompt: `Собери JSON только по материалу ниже. Режимы: ${selected.join(", ")}.\n\nКонспект:\n${text}`,
  });

  const normalized = normalizeTestPayload(raw, selected, counts);
  const hasChoice = normalized.questions.length > 0;
  const hasQuizlet = normalized.quizlet.length > 0;
  const hasMatch = (normalized.match?.length || 0) > 0;
  const hasWritten = Boolean(normalized.written);
  if (selected.includes("single") || selected.includes("multi")) {
    const floor = Math.max(3, Math.ceil(counts.single * 0.6));
    if (normalized.questions.length < floor) {
      throw new Error("Модель вернула слишком мало нормальных вопросов — попробуй ещё раз");
    }
  }
  if (selected.includes("quizlet") && !hasQuizlet) {
    throw new Error("Модель не вернула карточки квизлета — попробуй ещё раз");
  }
  if (selected.includes("match") && normalized.match.length < 2) {
    throw new Error("Модель вернула слишком мало пар для сопоставления — попробуй ещё раз");
  }
  if (selected.includes("written") && !hasWritten) {
    throw new Error("Модель не вернула письменное задание — попробуй ещё раз");
  }
  if (!hasChoice && !hasQuizlet && !hasMatch && !hasWritten) {
    throw new Error("Пустой тест — попробуй ещё раз");
  }
  return normalized;
}

/**
 * Разбор ПРИЁМОГО (обрезанного на полуслове) JSON пачки проверок.
 * Отдаём только те задания, чей объект уже закрылся — ученик видит разбор
 * задания сразу, не дожидаясь остальных.
 */
export function parseWrittenBatch(text) {
  const s = String(text || "");
  const key = s.indexOf('"results"');
  if (key < 0) return [];
  const out = [];
  let i = s.indexOf("[", key);
  if (i < 0) return out;
  i++;
  while (i < s.length) {
    if (s[i] === "]") break;
    if (s[i] !== "{") { i++; continue; }
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) { end = j + 1; break; }
    }
    if (end < 0) break; // объект ещё дописывается
    try {
      const o = JSON.parse(s.slice(i, end));
      out.push({
        marks: (Array.isArray(o.s) ? o.s : []).filter((v) => v === "ok" || v === "part" || v === "bad"),
        whys: Array.isArray(o.w) ? o.w.map(String) : [],
        grade: Number(o.grade) || 0,
        comment: String(o.comment || "").trim(),
      });
    } catch {
      // мусорный элемент — пропускаем, следующий разберём
    }
    i = end;
  }
  return out;
}

/** Одна проверка на всю пачку вопросов: 1 слот квоты вместо N. */
export function gradeWritten(noteText, questions, answers, onDelta) {
  const list = (questions || []).map((q, i) => {
    const words = writtenWords(answers[i]);
    return `Задание ${i + 1} (слов в ответе: ${words.length}). Вопрос: ${String(q || "").slice(0, 400)}\nОтвет: ${words.join(" ")}`;
  });
  return aiJSONStream({
    name: "grade-written",
    system: SYSTEM_GRADE,
    prompt: `${list.join("\n\n")}\n\nКонспект:\n${noteText}`,
    onDelta,
  });
}

function writtenWords(answer) {
  return String(answer || "").trim().split(/\s+/).filter(Boolean);
}
