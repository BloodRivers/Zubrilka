const BADGES = {
  "Важно": ["dangerTint", "danger"],
  "Опасно": ["dangerTint", "danger"],
  "Совет": ["successTint", "success"],
  "Готово": ["successTint", "success"],
  "Ответ": ["successTint", "success"],
  "Определение": ["raised", "text"],
  "Пример": ["raised", "text"],
  "Запомни": ["raised", "text"],
  "Вывод": ["raised", "text"],
  "Вопрос": ["raised", "text"],
};

/** Бейдж всегда идёт последним, даже если модель поставила его в начале. */
export function badgesLast(nodes) {
  return [...nodes.filter((n) => n.type !== "badge"), ...nodes.filter((n) => n.type === "badge")];
}

/** Только известные бейджи; остальное остаётся обычным текстом. */
export function badgeTheme(label) {
  const key = String(label || "").trim().replace(/:$/, "").replace(/^./, (c) => c.toUpperCase());
  return BADGES[key] || null;
}
