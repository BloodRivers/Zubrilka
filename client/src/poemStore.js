/** Сохранённые стихи живут только на устройстве — тексты не уходят в облако. */
const KEY = "zubrilka:poems";

export function listPoems() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function savePoem({ id, title, text }) {
  const list = listPoems();
  const existing = list.find((p) => p.id === id);
  const poem = {
    id: id || (globalThis.crypto?.randomUUID?.() || String(Date.now())),
    title: String(title || "").trim() || "Без названия",
    text: String(text || ""),
    createdAt: existing?.createdAt || Date.now(),
    lastAt: Date.now(),
  };
  write(existing ? list.map((p) => (p.id === id ? poem : p)) : [poem, ...list]);
  return poem;
}

export function deletePoem(id) {
  write(listPoems().filter((p) => p.id !== id));
}
