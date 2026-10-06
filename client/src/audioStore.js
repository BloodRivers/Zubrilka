const DB_NAME = "zubrilka-audio";
const STORE = "recs";
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
  }
  return dbPromise;
}

/** Блоб записывается напрямую — квоты localStorage (5 МБ) тут нет. */
export async function saveAudio(key, blob) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Блоб из IDB; старые записи из localStorage — dataURL-строкой (миграция). */
export async function getAudio(key) {
  const db = await open();
  const val = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const rq = tx.objectStore(STORE).get(key);
    rq.onsuccess = () => resolve(rq.result || null);
    rq.onerror = () => reject(rq.error);
  });
  if (val) return val;
  const ls = localStorage.getItem(key);
  return ls || null;
}