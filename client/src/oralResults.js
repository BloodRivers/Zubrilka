import { auth } from "./firebase";
import {
  saveOralResult as saveRemote,
  listOralResults as listRemote,
  loadOralDone as loadDoneRemote,
  markOralDone as markDoneRemote,
} from "./api/firestore";

const KEY = "zubrilka:oral-results";
const doneKey = (task) => `use-oral-${task}-done`;

const loadMap = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
};

export async function saveOralResult(rec) {
  if (auth.currentUser) return saveRemote(rec);
  const map = loadMap();
  map[`${rec.task}:${rec.variant_id}`] = {
    task: Number(rec.task),
    variant_id: rec.variant_id,
    score: Number(rec.score) || 0,
    max: Number(rec.max) || 0,
    created_at: Date.now(),
  };
  localStorage.setItem(KEY, JSON.stringify(map));
}

export async function listOralResults() {
  if (auth.currentUser) return listRemote();
  return Object.values(loadMap());
}

export async function loadOralDone(task) {
  if (auth.currentUser) return loadDoneRemote(task);
  try {
    return JSON.parse(localStorage.getItem(doneKey(task)) || "[]");
  } catch {
    return [];
  }
}

export async function markOralDone(task, ids) {
  if (auth.currentUser) return markDoneRemote(task, ids);
  localStorage.setItem(doneKey(task), JSON.stringify([...ids]));
}

/** Отметить один вариант пройденным (добавить в done_ids). */
export async function addOralDone(task, variantId) {
  const ids = await loadOralDone(task);
  if (ids.includes(variantId)) return;
  return markOralDone(task, [...ids, variantId]);
}