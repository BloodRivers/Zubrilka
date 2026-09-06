import { getNote } from "./firestore";
import { aiJSON, aiText, collapseRepeats, assertVisionWorks } from "./ai";

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

const SYSTEM_STRUCTURE =
  "Ты помощник по учёбе. На вход — уже распознанный текст конспекта. "
  + "Не выдумывай факты вне текста. Не повторяй блоки. "
  + "Верни ТОЛЬКО JSON: "
  + '{"subject":"предмет или пусто","title":"короткое название",'
  + '"text":"очищенный текст конспекта без дублей",'
  + '"retelling":"связный пересказ всего конспекта своими словами",'
  + '"topics":[{"title":"тема","points":["пункт"]}],'
  + '"plan":[{"title":"раздел","items":[{"title":"пункт","items":[{"title":"подпункт"}]}]}]}. '
  + "topics/plan/retelling только из text. "
  + "retelling — краткий, но объёмный: охвати все темы и ключевые идеи, "
  + "без списков и без новых фактов; 1–3 плотных абзаца. "
  + "plan — СЛОЖНЫЙ план повторения с иерархией: "
  + "уровень 0 (разделы) обязателен всегда; "
  + "уровень 1 (пункты) и уровень 2 (подпункты) — по необходимости, могут отсутствовать; "
  + "в JSON пиши только title и items (нумерацию I/1/а рисует интерфейс). "
  + "Делай план содержательным и разветвлённым по материалу конспекта.";

function normalizePlan(plan) {
  if (!Array.isArray(plan)) return [];
  return plan
    .map((node) => {
      if (typeof node === "string") {
        const title = node.trim();
        return title ? { title, items: [] } : null;
      }
      const title = String(node?.title || node?.text || "").trim();
      if (!title) return null;
      const raw = node?.items ?? node?.children;
      const items = Array.isArray(raw)
        ? raw
            .map((child) => {
              if (typeof child === "string") {
                const t = child.trim();
                return t ? { title: t, items: [] } : null;
              }
              const t = String(child?.title || child?.text || "").trim();
              if (!t) return null;
              const leaves = child?.items ?? child?.children;
              return {
                title: t,
                items: Array.isArray(leaves)
                  ? leaves
                      .map((leaf) => {
                        if (typeof leaf === "string") {
                          const lt = leaf.trim();
                          return lt ? { title: lt } : null;
                        }
                        const lt = String(leaf?.title || leaf?.text || "").trim();
                        return lt ? { title: lt } : null;
                      })
                      .filter(Boolean)
                  : [],
              };
            })
            .filter(Boolean)
        : [];
      return { title, items };
    })
    .filter(Boolean);
}

export const ALL_TEST_MODES = ["single", "multi", "quizlet", "match", "written"];
const Q_MAX = 120;
const OPT_MAX = 60;
const SINGLE_TARGET = 10;
const MULTI_TARGET = 5;
const QUIZLET_TARGET = 10;
const MATCH_TARGET = 8;

const SYSTEM_GRADE =
  "Ты строгий, но доброжелательный преподаватель. "
  + "Оцениваешь ТОЛЬКО по конспекту. "
  + 'Верни ТОЛЬКО JSON: {"grade":5,"comment":"что верно и что упущено"}. grade 1–5.';

function buildNoteContext(notes) {
  return notes
    .map((n) => {
      const parts = [];
      if (n.title) parts.push(`# ${n.title}`);
      if (n.retelling?.trim()) parts.push(`Пересказ:\n${n.retelling.trim()}`);
      if (Array.isArray(n.topics) && n.topics.length) {
        parts.push(
          "Темы:\n"
            + n.topics
              .map((tp) => `- ${tp.title}: ${(tp.points || []).join("; ")}`)
              .join("\n")
        );
      }
      if (n.text?.trim()) parts.push(`Текст:\n${n.text.trim()}`);
      return parts.join("\n\n");
    })
    .filter(Boolean)
    .join("\n\n---\n\n")
    .slice(0, 14000);
}

function buildTestSystem(modes) {
  const wantSingle = modes.includes("single");
  const wantMulti = modes.includes("multi");
  const wantQuizlet = modes.includes("quizlet");
  const wantMatch = modes.includes("match");
  const wantWritten = modes.includes("written");

  const parts = [];
  if (wantSingle || wantMulti) {
    parts.push(
      '"questions":[{"kind":"single|multi","q":"короткий вопрос",'
      + '"options":["а","б","в","г"],"correct":0,"topic":"тема","explain":"почему"}]'
    );
  }
  if (wantQuizlet) parts.push('"quizlet":[{"term":"термин","definition":"краткое определение","topic":"тема"}]');
  if (wantMatch) {
    parts.push(
      '"match":[{"left":"короткая левая часть","right":"связанная правая часть","topic":"тема"}]'
    );
  }
  if (wantWritten) parts.push('"written":{"prompt":"задание написать своими словами"}');
  const schema = "{" + parts.join(",") + "}";

  return (
    "Ты составляешь материалы для повторения СТРОГО по конспекту. "
    + "Верни ТОЛЬКО JSON без markdown. "
    + "Стиль: МНОГО коротких единиц, не длинные формулировки. "
    + `Вопрос ≤${Q_MAX} символов, вариант ответа ≤${OPT_MAX} символов. `
    + "Запрещено: «Вспомни пункт», Да/Нет, копипаст фраз конспекта, факты вне текста. "
    + (wantSingle
      ? `single: ровно ${SINGLE_TARGET} вопросов, kind="single", correct — ЧИСЛО 0..3 (один верный). `
      : "")
    + (wantMulti
      ? `multi: ровно ${MULTI_TARGET} вопросов, kind="multi", correct — МАССИВ из 2–3 индексов 0..3. `
      : "")
    + (wantQuizlet
      ? `quizlet: ровно ${QUIZLET_TARGET} карточек термин↔краткое определение. `
      : "")
    + (wantMatch
      ? `match: ровно ${MATCH_TARGET} пар для сопоставления. left и right — любые связанные фрагменты из конспекта (понятие↔смысл, причина↔следствие, дата↔событие, формула↔название и т.п.); тип пар выбирай по материалу. Пары уникальны, без дублей left/right. `
      : "")
    + (wantWritten
      ? "written: одно короткое задание написать ответ своими словами по конспекту. "
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
  const letterMap = { A: 0, B: 1, C: 2, D: 3, А: 0, Б: 1, В: 2, Г: 3 };
  if (letterMap[letter] != null && letterMap[letter] < options.length) return letterMap[letter];
  const byText = options.findIndex((o) => String(o).trim() === s);
  return byText >= 0 ? byText : -1;
}

function parseCorrectMulti(raw, options) {
  const arr = Array.isArray(raw) ? raw : typeof raw === "number" ? [raw] : [];
  const idxs = [...new Set(arr.map((x) => parseCorrectIndex(x, options)).filter((i) => i >= 0))].sort((a, b) => a - b);
  return idxs.length >= 2 ? idxs : null;
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

export function normalizeQuestions(payload, modes = null) {
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
    if (options.length > 4) options = options.slice(0, 4);
    if (!q || options.length < 2) continue;
    while (options.length < 4) options.push(`Вариант ${options.length + 1}`);

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

  const singles = cleaned.filter((q) => q.kind === "single").slice(0, SINGLE_TARGET);
  const multis = cleaned.filter((q) => q.kind === "multi").slice(0, MULTI_TARGET);
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

export function normalizeQuizlet(payload) {
  const list = Array.isArray(payload) ? payload : payload?.quizlet;
  if (!Array.isArray(list)) return [];
  return list
    .map((c) => ({
      term: clip(c?.term || c?.front || "", 80),
      definition: clip(c?.definition || c?.back || c?.def || "", 140),
      topic: String(c?.topic || "Общее").trim() || "Общее",
    }))
    .filter((c) => c.term && c.definition)
    .slice(0, QUIZLET_TARGET);
}

export function normalizeMatch(payload) {
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
    if (out.length >= MATCH_TARGET) break;
  }
  return out;
}

export function normalizeWritten(payload) {
  const w = payload?.written;
  if (!w) return null;
  const prompt = clip(typeof w === "string" ? w : w.prompt || "", 200);
  return prompt ? { prompt } : null;
}

export function normalizeTestPayload(raw, modes) {
  const m = (modes || ALL_TEST_MODES).filter((x) => ALL_TEST_MODES.includes(x));
  return {
    type: "mixed",
    modes: m,
    questions: m.some((x) => x === "single" || x === "multi") ? normalizeQuestions(raw, m) : [],
    quizlet: m.includes("quizlet") ? normalizeQuizlet(raw) : [],
    match: m.includes("match") ? normalizeMatch(raw) : [],
    written: m.includes("written") ? normalizeWritten(raw) : null,
  };
}

async function analyzeFromPhotos(imageDataUrl) {
  await assertVisionWorks(imageDataUrl);

  const raw = await aiText({
    name: "ocr-note",
    system: SYSTEM_OCR,
    prompt: OCR_PROMPT,
    imageDataUrl,
    maxTokens: 2500,
  });
  const text = collapseRepeats(raw);
  if (text.length < 30) {
    throw new Error("Не удалось прочитать текст с фото — сделай кадр чётче или вставь текст вручную");
  }

  const structured = await aiJSON({
    name: "structure-note",
    system: SYSTEM_STRUCTURE,
    prompt: `Собери JSON по этому транскрипту. Не добавляй ничего от себя.\n\n${text.slice(0, 12000)}`,
    maxTokens: 3000,
  });

  structured.text = collapseRepeats(structured.text || text);
  if (!structured.title) structured.title = "Конспект";
  structured.retelling = String(structured.retelling || "").trim();
  if (!Array.isArray(structured.topics)) structured.topics = [];
  structured.plan = normalizePlan(structured.plan);
  return structured;
}

export const analyzeNote = analyzeFromPhotos;

export async function generateTest(noteIds, modesOrType) {
  const modes = Array.isArray(modesOrType)
    ? modesOrType
    : typeof modesOrType === "object" && modesOrType?.modes
      ? modesOrType.modes
      : ["single"];
  const selected = [...new Set(modes)].filter((m) => ALL_TEST_MODES.includes(m));
  if (!selected.length) throw new Error("Выбери хотя бы один тип заданий");

  const notes = (await Promise.all((noteIds || []).map((id) => getNote(id).catch(() => null)))).filter(Boolean);
  const text = buildNoteContext(notes);
  if (!text.trim()) throw new Error("Нет конспекта для теста");

  const raw = await aiJSON({
    name: "generate-test",
    system: buildTestSystem(selected),
    prompt: `Собери JSON только по материалу ниже. Режимы: ${selected.join(", ")}.\n\nКонспект:\n${text}`,
    maxTokens: 5000,
  });

  const normalized = normalizeTestPayload(raw, selected);
  const hasChoice = normalized.questions.length > 0;
  const hasQuizlet = normalized.quizlet.length > 0;
  const hasMatch = (normalized.match?.length || 0) > 0;
  const hasWritten = Boolean(normalized.written);
  if (selected.includes("single") || selected.includes("multi")) {
    if (normalized.questions.length < 4) {
      throw new Error("Модель вернула слишком мало нормальных вопросов — попробуй ещё раз");
    }
  }
  if (selected.includes("quizlet") && !hasQuizlet) {
    throw new Error("Модель не вернула карточки квизлета — попробуй ещё раз");
  }
  if (selected.includes("match") && normalized.match.length < 4) {
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

export const gradeWritten = (noteText, answer) =>
  aiJSON({
    name: "grade-written",
    system: SYSTEM_GRADE,
    prompt: `Конспект:\n${String(noteText).slice(0, 12000)}\n\nОтвет ученика:\n${answer}`,
    maxTokens: 800,
  });
