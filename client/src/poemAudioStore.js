/** Кэш озвученных строк: один раз сгенерировал, дальше играем с диска. */
const DB_NAME = "zubrilka-poem-tts";
const STORE = "audio";
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

export async function getCachedSpeech(key) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    rq.onsuccess = () => resolve(rq.result || null);
    rq.onerror = () => reject(rq.error);
  });
}

export async function cacheSpeech(key, blob) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
