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

/** Только известные бейджи; остальное остаётся обычным текстом. */
export function badgeTheme(label) {
  const key = String(label || "").trim().replace(/:$/, "").replace(/^./, (c) => c.toUpperCase());
  return BADGES[key] || null;
}
