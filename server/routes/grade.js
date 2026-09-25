import { callPolza, parseModelJson } from "../lib/polza.js";
import { logUsage } from "../middleware/auth.js";

const SYSTEM = `Ты строгий, но доброжелательный преподаватель. `
  + `Оцениваешь письменный ответ ученика по конспекту. `
  + `Верни ТОЛЬКО валидный JSON: {"grade":5,"comment":"развёрнутый комментарий, что верно, что упущено"}. grade — число от 1 до 5.`;

export function gradeRoute() {
  return async (req, res) => {
    const { note_text, answer } = req.body || {};
    if (!note_text || !answer) return res.status(400).json({ error: "note_text и answer обязательны" });

    const { content, usage } = await callPolza({
      system: SYSTEM,
      messages: [{ role: "user", content: `Конспект:\n${note_text.slice(0, 12000)}\n\nОтвет ученика:\n${answer}` }],
    });

    await logUsage({ uid: req.user.uid, endpoint: "grade-written", usage });
    res.json({ ...parseModelJson(content), usage });
  };
}