import { getNote } from "./firestore";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SAMPLE = {
  subject: "Твой предмет",
  title: "Конспект",
  text:
    "Законы Ньютона: первый закон — инерция,\nвторой — F = ma,\nтретий — действие и противодействие.\n" +
    "Импульс: p = mv, закон сохранения в замкнутой системе.\n" +
    "Энергия: кинетическая E = mv²/2, потенциальная, закон сохранения энергии.",
  retelling:
    "Классическая механика опирается на три закона Ньютона: инерцию, связь силы с ускорением и равенство действия и противодействия. "
    + "Импульс тела равен произведению массы на скорость и сохраняется в замкнутой системе. "
    + "Энергия бывает кинетической и потенциальной; в сумме она также сохраняется, что связывает движение с работой сил.",
  topics: [
    {
      title: "Законы Ньютона",
      points: ["Первый закон: инерция", "Второй закон: F = ma", "Третий закон: действие и противодействие"],
    },
    {
      title: "Импульс",
      points: ["p = mv", "Закон сохранения импульса в замкнутой системе"],
    },
    {
      title: "Энергия",
      points: ["Кинетическая энергия: E = mv²/2", "Потенциальная энергия", "Закон сохранения энергии"],
    },
  ],
  plan: [
    {
      title: "Законы Ньютона",
      items: [
        {
          title: "Три закона",
          items: [{ title: "Инерция" }, { title: "F = ma" }, { title: "Действие и противодействие" }],
        },
        { title: "Применить к типовым задачам" },
      ],
    },
    {
      title: "Импульс и энергия",
      items: [
        { title: "Закон сохранения импульса" },
        { title: "Энергия", items: [{ title: "Кинетическая" }, { title: "Потенциальная" }] },
      ],
    },
  ],
};

export function checklistQuiz(note) {
  const topics = note?.topics || [];
  const questions = [];
  for (const topic of topics) {
    const points = (topic?.points || []).map((p) => String(p).trim()).filter(Boolean);
    if (points.length < 2) continue;
    const correct = points[0];
    const distractors = points.slice(1, 4);
    while (distractors.length < 3) {
      distractors.push(`Вне темы «${topic.title}»`);
    }
    questions.push({
      kind: "single",
      q: `Что верно про «${topic.title}»?`,
      options: [correct, ...distractors.slice(0, 3)],
      correct: 0,
      topic: topic.title,
      explain: correct,
    });
    if (points.length >= 3) {
      questions.push({
        kind: "multi",
        q: `Что относится к «${topic.title}»?`,
        options: [points[0], points[1], "Случайный факт", points[2] || "Другое"],
        correct: [0, 1],
        topic: topic.title,
        explain: `${points[0]}; ${points[1]}`,
      });
    }
  }
  return questions.slice(0, 15);
}

function mockQuizlet(note) {
  const cards = [];
  for (const topic of note?.topics || []) {
    for (const p of topic.points || []) {
      cards.push({ term: String(p).slice(0, 60), definition: `Тема: ${topic.title}`, topic: topic.title });
    }
  }
  return cards.slice(0, 10);
}

function mockMatch(note) {
  return mockQuizlet(note).slice(0, 8).map((c) => ({
    left: c.term,
    right: c.definition,
    topic: c.topic,
  }));
}

export async function mockAnalyzeNote() {
  await sleep(900);
  return { ...SAMPLE, title: `Конспект ${new Date().toLocaleDateString("ru-RU")}` };
}

export async function mockGenerateTest(noteIds, modesOrType) {
  await sleep(700);
  const modes = Array.isArray(modesOrType)
    ? modesOrType
    : modesOrType?.modes || ["single"];
  const selected = [...new Set(modes)].filter((m) =>
    ["single", "multi", "quizlet", "match", "written"].includes(m)
  );
  const notes = [];
  for (const id of noteIds || []) notes.push(await getNote(id));
  const baseNotes = notes.filter(Boolean).length ? notes.filter(Boolean) : [SAMPLE];
  const allQ = baseNotes.flatMap(checklistQuiz);
  const questions = [];
  if (selected.includes("single") || selected.includes("multi")) {
    for (const q of allQ) {
      if (q.kind === "multi" && !selected.includes("multi")) continue;
      if (q.kind === "single" && !selected.includes("single")) {
        if (selected.includes("multi")) questions.push({ ...q, kind: "multi", correct: [0, 1] });
        continue;
      }
      questions.push(q);
    }
  }
  return {
    type: "mixed",
    modes: selected,
    questions,
    quizlet: selected.includes("quizlet") ? baseNotes.flatMap(mockQuizlet).slice(0, 10) : [],
    match: selected.includes("match") ? baseNotes.flatMap(mockMatch).slice(0, 8) : [],
    written: selected.includes("written")
      ? { prompt: "Кратко своими словами изложи главные идеи конспекта." }
      : null,
  };
}

export async function mockGradeWritten(noteText, answer) {
  await sleep(600);
  const words = (s) => s.toLowerCase().match(/[а-яёa-z0-9]+/gi) || [];
  const noteWords = new Set(words(noteText || ""));
  const ans = [...new Set(words(answer || ""))];
  if (!ans.length) return { grade: 2, comment: "В ответе пусто — повтори конспект и напиши своими словами." };
  const hit = ans.filter((w) => noteWords.has(w)).length / ans.length;
  const grade = hit > 0.75 ? 5 : hit > 0.55 ? 4 : hit > 0.35 ? 3 : 2;
  const comments = {
    5: "Отлично, все ключевые понятия на месте и употреблены верно.",
    4: "Хорошо. Есть неточности или пропущены отдельные определения.",
    3: "Основа понятна, но ключевые моменты упущены. Сверься с конспектом.",
    2: "Слабо. Перечитай конспект и попробуй снова по плану изучения.",
  };
  return { grade, comment: comments[grade] };
}
