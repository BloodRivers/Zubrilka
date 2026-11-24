// Подготовка импорта: проверяем выгрузку и перевязываем внутренние ссылки.

export function validateImport(data) {
  if (!data || typeof data !== "object") throw new Error("Файл пуст или не похож на выгрузку");
  for (const key of ["subjects", "notes", "tests", "results"]) {
    if (!Array.isArray(data[key])) throw new Error("Это не выгрузка Зубрилки");
  }
  if (!data.subjects.length && !data.notes.length && !data.tests.length) {
    throw new Error("В выгрузке нет предметов, конспектов и тестов");
  }
  return data;
}

export function remapDoc(old, ids) {
  const doc = { ...old };
  delete doc.id;
  delete doc.owner_id;
  delete doc.user_id;
  delete doc.public;
  delete doc.published_at;
  delete doc.author_name;
  delete doc.author_uid;
  delete doc.author_photo_url;
  delete doc.subject_name;
  if (doc.subject_id && ids.subjects?.has(doc.subject_id)) doc.subject_id = ids.subjects.get(doc.subject_id);
  if (Array.isArray(doc.note_ids)) doc.note_ids = doc.note_ids.map((id) => ids.notes?.get(id) || id);
  if (doc.test_id && ids.tests?.has(doc.test_id)) doc.test_id = ids.tests.get(doc.test_id);
  return doc;
}
