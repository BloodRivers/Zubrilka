import { callPolza, parseModelJson } from "../lib/polza.js";
import { logUsage, fbdb } from "../middleware/auth.js";

async function loadNotes(uid, ids) {
  if (!ids || !ids.length) return null;
  const snap = await fbdb.collection("notes").where("__name__", "in", ids.slice(0, 10)).get();
  return snap.docs
    .filter((d) => {
      const o = d.data().owner_id;
      const shared = Array.isArray(d.data().shared_with) ? d.data().shared_with : [];
      return o === uid || shared.includes(uid) || d.data().public === true;
    })
    .map((d) => ({ id: d.id, ...d.data() }));
}

const SYSTEM = `Ты генерируешь материалы для повторения по конспекту. `
  + `Верни ТОЛЬКО валидный JSON. Стиль: много коротких единиц. `
  + `Вопрос ≤120 символов, вариант ≤60. `
  + `Формат: {"questions":[{"kind":"single|multi","q":"...","options":["а","б","в","г"],"correct":0,"topic":"...","explain":"..."}],`
  + `"quizlet":[{"term":"...","definition":"...","topic":"..."}],"written":{"prompt":"..."}}. `
  + `single: correct — число 0..3; multi: correct — массив из 2–3 индексов. `
  + `Не копируй фразы конспекта, не делай «Вспомни пункт».`;

export function testRoute() {
  return async (req, res) => {
    const { note_ids, type, modes } = req.body || {};
    const selected = Array.isArray(modes) && modes.length
      ? modes
      : type === "quizlet"
        ? ["quizlet"]
        : ["single"];

    let text;
    if (note_ids && note_ids.length) {
      const notes = await loadNotes(req.user.uid, note_ids);
      text = notes.map((n) => n.text || JSON.stringify(n.topics || [])).join("\n\n");
    } else if (req.body.text) {
      text = req.body.text;
    }
    if (!text) return res.status(400).json({ error: "Укажите note_ids или text" });

    const { content, usage } = await callPolza({
      system: SYSTEM,
      messages: [{ role: "user", content: `Режимы: ${selected.join(", ")}.\n\nКонспект:\n${text.slice(0, 12000)}` }],
    });

    await logUsage({ uid: req.user.uid, endpoint: "generate-test", usage });
    res.json({ ...parseModelJson(content), modes: selected, type: "mixed", usage });
  };
}