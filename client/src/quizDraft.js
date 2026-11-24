// Черновик теста живёт только в этой вкладке и только до завершения теста.

const PREFIX = "zubrilka:quizdraft:";
const keyOf = (testId, mode) => `${PREFIX}${testId}:${mode || "full"}`;

export function writeDraft(testId, mode, snapshot) {
  if (!testId || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(keyOf(testId, mode), JSON.stringify(snapshot));
  } catch {
    // Переполнение sessionStorage не должно ломать тест.
  }
}

export function readDraft(testId, mode) {
  if (!testId || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(keyOf(testId, mode));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && Array.isArray(data.answers) ? data : null;
  } catch {
    return null;
  }
}

export function clearDraft(testId, mode) {
  if (!testId || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(keyOf(testId, mode));
  } catch {
    // Игнорируем недоступный sessionStorage.
  }
}
