import { callPolza } from "../lib/polza.js";
import { logUsage } from "../middleware/auth.js";

const SYSTEM = `По результатам теста определи слабые темы ученика. `
  + `Верни ТОЛЬКО валидный JSON: {"weak_topics":["тема","тема"],"summary":"одно-два предложения что повторять"}.`;

export function analyzeResultsRoute() {
  return async (req, res, next) => {
    try {
      const answers = req.body?.answers;
      if (!Array.isArray(answers) || !answers.length) return res.status(400).json({ error: "answers обязателен" });

      const { content, usage } = await callPolza({
        system: SYSTEM,
        messages: [{ role: "user", content: `Ответы ученика:\n${JSON.stringify(answers)}` }],
        maxTokens: 500,
      });

      await logUsage({ uid: req.user.uid, endpoint: "analyze-results", usage });
      res.json({ ...JSON.parse(content.replace(/^```(json)?\s*|\s*```$/g, "").trim()), usage });
    } catch (e) {
      next(e);
    }
  };
}
