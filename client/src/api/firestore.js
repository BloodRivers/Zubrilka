import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  deleteDoc,
  doc,
  getCountFromServer,
  serverTimestamp,
  orderBy,
  writeBatch,
  runTransaction,
} from "firebase/firestore";
import { db, auth } from "../firebase";

const uid = () => {
  const u = auth.currentUser?.uid;
  if (!u) throw new Error("Не авторизован: войди в аккаунт");
  return u;
};

function usageDayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function createUserProfile({ name, email, photo_url }) {
  return setDoc(doc(db, "users", uid()), {
    name: name || "",
    email: email || "",
    photo_url: photo_url || null,
    created_at: serverTimestamp(),
  });
}

export async function getUserProfile() {
  const snap = await getDoc(doc(db, "users", uid()));
  return snap.exists() ? snap.data() : null;
}

export async function updateUserProfile({ name, photo_url, polza_key, fcm_token, push_enabled }) {
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (photo_url !== undefined) patch.photo_url = photo_url;
  if (polza_key !== undefined) patch.polza_key = polza_key || "";
  if (fcm_token !== undefined) patch.fcm_token = fcm_token || null;
  if (push_enabled !== undefined) patch.push_enabled = Boolean(push_enabled);
  return setDoc(doc(db, "users", uid()), patch, { merge: true });
}

/** Сохранить FCM-токен текущего пользователя. */
export async function saveFcmToken(token) {
  if (!token) return;
  return setDoc(
    doc(db, "users", uid()),
    {
      fcm_token: token,
      push_enabled: true,
      fcm_updated_at: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Текущий дневной счётчик ИИ-запросов пользователя. */
export async function fetchAiUsage() {
  const day = usageDayKey();
  const snap = await getDoc(doc(db, "users", uid()));
  const usage = snap.data()?.ai_usage || {};
  const count = usage.day === day ? Number(usage.count) || 0 : 0;
  return { day, count };
}

/**
 * Резервирует 1 ИИ-запрос на сегодня (транзакция).
 * @param {number} limit
 * @returns {Promise<number>} новое значение count
 */
export async function consumeAiQuota(limit = 20) {
  const ref = doc(db, "users", uid());
  const day = usageDayKey();
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const usage = data.ai_usage || {};
    const count = usage.day === day ? Number(usage.count) || 0 : 0;
    if (count >= limit) {
      throw new Error(`Лимит на сегодня: ${limit} запросов к ИИ. Завтра снова можно.`);
    }
    const next = count + 1;
    tx.set(ref, { ai_usage: { day, count: next } }, { merge: true });
    return next;
  });
}

const meta = () => ({
  owner_id: uid(),
  shared_with: [],
  created_at: serverTimestamp(),
});

const at = (c) =>
  query(collection(db, c), where(c === "test_results" ? "user_id" : "owner_id", "==", uid()));

async function ownResultsRefsForTests(testIds) {
  if (!testIds.length) return [];
  const ids = new Set(testIds);
  const snap = await getDocs(query(collection(db, "test_results"), where("user_id", "==", uid())));
  return snap.docs.filter((d) => ids.has(d.data().test_id)).map((d) => d.ref);
}

async function batchDelete(refs) {
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

export async function listSubjects() {
  const q = query(collection(db, "subjects"), where("owner_id", "==", uid()));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createSubject(name, icon, color) {
  return addDoc(collection(db, "subjects"), { name, icon: icon || "Book", color: color || null, ...meta() });
}

export async function updateSubject(id, { name, icon, color }) {
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (icon !== undefined) patch.icon = icon;
  if (color !== undefined) patch.color = color;
  return setDoc(doc(db, "subjects", id), patch, { merge: true });
}

export async function deleteSubject(id) {
  const subjNotes = await listNotes(id);
  const noteSet = new Set(subjNotes.map((n) => n.id));

  const ts = await getDocs(query(collection(db, "tests"), where("owner_id", "==", uid())));
  const tests = ts.docs.filter((d) => {
    const t = d.data();
    // ponytail: A test spanning notes in two subjects dies with either subject — acceptable.
    return t.subject_id === id || (t.note_ids || []).some((nid) => noteSet.has(nid));
  });

  const resultRefs = await ownResultsRefsForTests(tests.map((d) => d.id));

  const batch = writeBatch(db);
  batch.delete(doc(db, "subjects", id));
  subjNotes.forEach((n) => batch.delete(doc(db, "notes", n.id)));
  tests.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  await batchDelete(resultRefs);
}

export async function getSubject(id) {
  const snap = await getDoc(doc(db, "subjects", id));
  return snap.exists() ? { id, ...snap.data() } : null;
}

export async function listNotes(subjectId) {
  const q = query(
    collection(db, "notes"),
    where("subject_id", "==", subjectId),
    where("owner_id", "==", uid())
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function countNotes(subjectId) {
  const q = query(
    collection(db, "notes"),
    where("subject_id", "==", subjectId),
    where("owner_id", "==", uid())
  );
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function getNote(id) {
  const snap = await getDoc(doc(db, "notes", id));
  return snap.exists() ? { id, ...snap.data() } : null;
}

export async function createNote({ subject_id, title, text, plan, retelling, summary, image_ref, images }) {
  if (!subject_id) throw new Error("Не указан предмет");
  if (!title?.trim()) throw new Error("Не указано название конспекта");
  if (!text?.trim()) throw new Error("Нет текста конспекта");

  title = title.trim();
  text = text.trim();

  if (plan === null) {
    plan = [];
  } else if (!Array.isArray(plan) || !plan.length) {
    const sections = text.split(/\n{2,}/).filter((s) => s.trim());
    plan = sections.slice(0, 5).map((s) => ({
      title: s.split("\n")[0].replace(/^[\s\d.▪•-]+/, "").trim().slice(0, 100) || "Раздел",
      summary: "",
      items: [],
    }));
  }

  try {
    return await addDoc(collection(db, "notes"), {
      subject_id,
      owner_id: uid(),
      shared_with: [],
      title,
      text,
      plan,
      retelling: retelling || "",
      summary: summary || "",
      image_ref: image_ref || null,
      images: images || [],
      pinned: false,
      public: false,
      published_at: null,
      author_name: "",
      author_uid: "",
      author_photo_url: "",
      subject_name: "",
      created_at: serverTimestamp(),
    });
  } catch (err) {
    const msg = err?.message || "";
    if (/failed to fetch|network/i.test(msg)) {
      throw new Error("Нет связи с Firebase. Проверь интернет и войди снова.");
    }
    throw err;
  }
}

/** Копия чужого публичного конспекта себе в предмет. */
export async function copyNoteToSubject(note, subjectId) {
  if (!note?.id) throw new Error("Нет конспекта");
  if (!subjectId) throw new Error("Выбери предмет");
  const ref = await createNote({
    subject_id: subjectId,
    title: note.title || "Конспект",
    text: note.text || "",
    plan: Array.isArray(note.plan) && note.plan.length ? note.plan : null,
    retelling: note.retelling || "",
    summary: note.summary || null,
    image_ref: note.image_ref || null,
    images: note.images || [],
  });
  return ref;
}

export async function updateNote(id, { title, pinned }) {
  const patch = {};
  if (title !== undefined) patch.title = title;
  if (pinned !== undefined) patch.pinned = pinned;
  return setDoc(doc(db, "notes", id), patch, { merge: true });
}

/** Сохранить сгенерированный конспект вкладки «Конспект». */
export async function updateNoteSummary(id, summary) {
  return setDoc(doc(db, "notes", id), { summary: normalizeSummaryForStore(summary) }, { merge: true });
}

function normalizeSummaryForStore(summary) {
  if (Array.isArray(summary)) return summary;
  if (typeof summary === "string" && summary.trim()) return [{ title: "Конспект", body: summary.trim() }];
  return [];
}

export async function setNotePublic(id, isPublic, subjectName) {
  const profile = await getUserProfile().catch(() => null);
  const photo = profile?.photo_url || auth.currentUser?.photoURL || "";
  const patch = {
    public: Boolean(isPublic),
    published_at: isPublic ? serverTimestamp() : null,
    author_name: isPublic ? profile?.name || "" : "",
    author_uid: isPublic ? uid() : "",
    author_photo_url: isPublic ? photo : "",
  };
  if (subjectName !== undefined) patch.subject_name = isPublic ? subjectName : "";
  return setDoc(doc(db, "notes", id), patch, { merge: true });
}

export async function deleteNote(id) {
  const ts = await getDocs(query(collection(db, "tests"), where("owner_id", "==", uid())));
  const tests = ts.docs.filter((d) => (d.data().note_ids || []).includes(id));
  const resultRefs = await ownResultsRefsForTests(tests.map((d) => d.id));

  const batch = writeBatch(db);
  batch.delete(doc(db, "notes", id));
  tests.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  await batchDelete(resultRefs);
}

export async function saveTest({ note_ids, type, questions, modes, quizlet, match, written, subject_id, title, size }) {
  return addDoc(collection(db, "tests"), {
    note_ids: note_ids || [],
    owner_id: uid(),
    type: type || "mixed",
    mode: "mixed",
    modes: modes || ["single"],
    size: size || null,
    questions: questions || [],
    quizlet: quizlet || [],
    match: match || [],
    written: written || null,
    subject_id: subject_id || null,
    title: title || "",
    public: false,
    published_at: null,
    author_name: "",
    author_uid: "",
    author_photo_url: "",
    subject_name: "",
    created_at: serverTimestamp(),
  });
}

export async function setTestPublic(id, isPublic, subjectName) {
  const profile = await getUserProfile().catch(() => null);
  const photo = profile?.photo_url || auth.currentUser?.photoURL || "";
  const patch = {
    public: Boolean(isPublic),
    published_at: isPublic ? serverTimestamp() : null,
    author_name: isPublic ? profile?.name || "" : "",
    author_uid: isPublic ? uid() : "",
    author_photo_url: isPublic ? photo : "",
  };
  if (subjectName !== undefined) patch.subject_name = isPublic ? subjectName : "";
  return setDoc(doc(db, "tests", id), patch, { merge: true });
}

export async function updateTest(id, { title, public: isPublic }) {
  const patch = {};
  if (title !== undefined) patch.title = title;
  if (isPublic !== undefined) patch.public = Boolean(isPublic);
  return setDoc(doc(db, "tests", id), patch, { merge: true });
}

export async function deleteTest(id) {
  await deleteDoc(doc(db, "tests", id));
  await batchDelete(await ownResultsRefsForTests([id]));
}

export async function saveTestResult({
  user_id,
  test_id,
  score,
  total,
  weak_topics,
  detail,
  note_ids,
  title,
  subject_id,
  quizlet_score,
  quizlet_total,
  match_score,
  match_total,
  written_grade,
  written_comment,
}) {
  return addDoc(collection(db, "test_results"), {
    user_id,
    test_id,
    score,
    total,
    weak_topics,
    detail,
    note_ids: note_ids || [],
    title: title || "",
    subject_id: subject_id || null,
    quizlet_score: quizlet_score ?? null,
    quizlet_total: quizlet_total ?? null,
    match_score: match_score ?? null,
    match_total: match_total ?? null,
    written_grade: written_grade ?? null,
    written_comment: written_comment || "",
    created_at: serverTimestamp(),
  });
}

export async function listResults() {
  try {
    const q = query(
      collection(db, "test_results"),
      where("user_id", "==", uid()),
      orderBy("created_at", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    // Пока нет composite-индекса — сортируем на клиенте
    const q = query(collection(db, "test_results"), where("user_id", "==", uid()));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.created_at?.toMillis?.() || 0) - (a.created_at?.toMillis?.() || 0));
  }
}

export async function getTest(id) {
  const snap = await getDoc(doc(db, "tests", id));
  return snap.exists() ? { id, ...snap.data() } : null;
}

function mapTestDocs(snap) {
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.created_at?.toMillis?.() || 0) - (a.created_at?.toMillis?.() || 0));
}

function testTypeOk(t) {
  return t.type === "choice" || t.type === "mixed" || !t.type;
}

/** Все тесты текущего пользователя. */
/** Результат устного задания ЕГЭ (last write wins per task+variant). */
export async function saveOralResult({ task, variant_id, score, max }) {
  const u = uid();
  return setDoc(doc(db, "oral_results", `${u}_${task}_${variant_id}`), {
    user_id: u,
    task: Number(task),
    variant_id,
    score: Number(score) || 0,
    max: Number(max) || 0,
    created_at: serverTimestamp(),
  });
}

export async function listOralResults() {
  const q = query(collection(db, "oral_results"), where("user_id", "==", uid()));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Прогресс устных заданий: список пройденных id вариантов на (пользователь, задание). */
export async function loadOralDone(task) {
  const u = uid();
  const snap = await getDoc(doc(db, "oral_progress", `${u}_${task}`));
  return Array.isArray(snap.data()?.done_ids) ? snap.data().done_ids : [];
}

export async function markOralDone(task, ids) {
  const u = uid();
  return setDoc(doc(db, "oral_progress", `${u}_${task}`), {
    user_id: u,
    task: Number(task),
    done_ids: [...ids],
    updated_at: serverTimestamp(),
  });
}

export async function listOwnedTests() {
  const q = query(collection(db, "tests"), where("owner_id", "==", uid()));
  const snap = await getDocs(q);
  return mapTestDocs(snap).filter(testTypeOk);
}

/**
 * Тесты по набору конспектов.
 * Один id — любой тест, где этот конспект в note_ids.
 * Несколько — точное совпадение набора (тест «по всему предмету» на момент создания).
 */
export async function listTestsForNotes(ids) {
  const list = [...(ids || [])].filter(Boolean);
  if (!list.length) return [];
  const all = await listOwnedTests();
  if (list.length === 1) {
    const id = list[0];
    return all.filter((t) => (t.note_ids || []).includes(id));
  }
  const key = [...list].sort().join("|");
  return all.filter((t) => [...(t.note_ids || [])].sort().join("|") === key);
}

/** Тесты предмета: по subject_id или по конспектам предмета. */
export async function listTestsForSubject(subjectId, noteIds = []) {
  if (!subjectId) return [];
  const idSet = new Set(noteIds || []);
  const all = await listOwnedTests();
  return all.filter((t) => {
    if (t.subject_id === subjectId) return true;
    return (t.note_ids || []).some((id) => idSet.has(id));
  });
}

export async function findTestForNotes(ids) {
  const list = await listTestsForNotes(ids);
  return list[0] || null;
}

/** Копия чужого публичного теста себе в предмет. */
export async function copyTestToSubject(test, subjectId) {
  if (!test?.id) throw new Error("Нет теста");
  if (!subjectId) throw new Error("Выбери предмет");
  return addDoc(collection(db, "tests"), {
    note_ids: [],
    owner_id: uid(),
    type: test.type || "mixed",
    modes: test.modes || ["single"],
    size: test.size || null,
    questions: test.questions || [],
    quizlet: test.quizlet || [],
    match: test.match || [],
    written: test.written || null,
    subject_id: subjectId,
    title: test.title || "Тест",
    public: false,
    published_at: null,
    author_name: "",
    author_uid: "",
    author_photo_url: "",
    subject_name: "",
    copied_from: test.id,
    created_at: serverTimestamp(),
  });
}

export async function listPublicNotes() {
  const q = query(collection(db, "notes"), where("public", "==", true));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.published_at?.toMillis?.() || 0) - (a.published_at?.toMillis?.() || 0));
}

export async function listPublicTests() {
  const q = query(collection(db, "tests"), where("public", "==", true));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.published_at?.toMillis?.() || 0) - (a.published_at?.toMillis?.() || 0));
}

/** Публичные тесты, связанные с конспектом (note_ids содержит id). */
export async function listPublicTestsForNote(noteId) {
  if (!noteId) return [];
  const all = await listPublicTests();
  return all.filter((t) => (t.note_ids || []).includes(noteId));
}

export async function listAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getUserProfileById(userId) {
  const snap = await getDoc(doc(db, "users", userId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function countPublishedContent() {
  const myUid = uid();
  const [notesSnap, testsSnap] = await Promise.all([
    getDocs(query(collection(db, "notes"), where("owner_id", "==", myUid), where("public", "==", true))),
    getDocs(query(collection(db, "tests"), where("owner_id", "==", myUid), where("public", "==", true))),
  ]);
  return { notes: notesSnap.size, tests: testsSnap.size };
}

export async function listPublicNotesByUser(userId) {
  const q = query(collection(db, "notes"), where("owner_id", "==", userId), where("public", "==", true));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.published_at?.toMillis?.() || 0) - (a.published_at?.toMillis?.() || 0));
}

export async function listPublicTestsByUser(userId) {
  const q = query(collection(db, "tests"), where("owner_id", "==", userId), where("public", "==", true));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.published_at?.toMillis?.() || 0) - (a.published_at?.toMillis?.() || 0));
}

export async function listAllResults() {
  const snap = await getDocs(collection(db, "test_results"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function exportUserData() {
  const subjects = await listSubjects();
  const notes = [];
  for (const s of subjects) notes.push(...(await listNotes(s.id)));
  const at = (c) =>
    query(collection(db, c), where(c === "test_results" ? "user_id" : "owner_id", "==", uid()));
  const ts = await getDocs(at("tests"));
  const rs = await getDocs(at("test_results"));
  return {
    profile: await getUserProfile(),
    subjects,
    notes,
    tests: ts.docs.map((d) => ({ id: d.id, ...d.data() })),
    results: rs.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

export async function deleteAllUserData() {
  const subjects = await listSubjects();
  const notes = [];
  for (const s of subjects) notes.push(...(await listNotes(s.id)));
  const ts = await getDocs(at("tests"));
  const tests = ts.docs.map((d) => ({ id: d.id, ...d.data() }));
  const rs = await getDocs(at("test_results"));
  const results = rs.docs.map((d) => ({ id: d.id, ...d.data() }));
  const batch = writeBatch(db);
  batch.delete(doc(db, "users", uid()));
  subjects.forEach((s) => batch.delete(doc(db, "subjects", s.id)));
  notes.forEach((n) => batch.delete(doc(db, "notes", n.id)));
  tests.forEach((t) => batch.delete(doc(db, "tests", t.id)));
  results.forEach((r) => batch.delete(doc(db, "test_results", r.id)));
  return batch.commit();
}
