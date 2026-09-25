import { callPolza, parseModelJson } from "../lib/polza.js";
import { logUsage } from "../middleware/auth.js";

const SYSTEM = `Ты — помощник для учёбы. Получаешь фотографию конспекта тетради. `
  + `Верни ТОЛЬКО валидный JSON без markdown и пояснений в формате: `
  + `{"subject":"предмет","title":"короткое название","text":"полный распознанный текст конспекта",`
  + `"retelling":"связный пересказ всего конспекта своими словами",`
  + `"topics":[{"title":"тема","points":["ключевой пункт"]}],`
  + `"plan":[{"title":"раздел","items":[{"title":"пункт","items":[{"title":"подпункт"}]}]}]}. `
  + `text — по возможности полная транскрибация, включая формулы (словами) и заголовки. `
  + `retelling — краткий, но объёмный пересказ всех тем без новых фактов, 1–3 абзаца. `
  + `plan — сложный иерархический план: уровень 0 обязателен, уровни 1 и 2 опциональны; `
  + `в JSON только title и items (нумерацию I/1/a рисует UI).`;

export function analyzeRoute() {
  return async (req, res) => {
    const image = req.body?.image;
    if (!image || typeof image !== "string" || !image.startsWith("data:image")) {
      return res.status(400).json({ error: "Поле image (data URL изображения) обязательно" });
    }

    const { content, usage } = await callPolza({
      system: SYSTEM,
      messages: ["Распознай конспект и верни JSON."],
      imageDataUrl: image,
    });

    await logUsage({ uid: req.user.uid, endpoint: "analyze-note", usage });

    let parsed;
    try {
      parsed = parseModelJson(content);
    } catch {
      return res.status(502).json({ error: "Модель вернула невалидный JSON", raw: content });
    }
    res.json({ ...parsed, usage });
  };
}