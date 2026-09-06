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

export async function updateUserProfile({ name, photo_url, polza_key }) {
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (photo_url !== undefined) patch.photo_url = photo_url;
  if (polza_key !== undefined) patch.polza_key = polza_key || "";
  return setDoc(doc(db, "users", uid()), patch, { merge: true });
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

export async function listSubjects() {
  const q = query(collection(db, "subjects"), where("owner_id", "==", uid()));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createSubject(name, icon) {
  return addDoc(collection(db, "subjects"), { name, icon: icon || "Book", ...meta() });
}

export async function updateSubject(id, { name, icon }) {
  return setDoc(doc(db, "subjects", id), { name, icon }, { merge: true });
}

export async function deleteSubject(id) {
  const subjNotes = await listNotes(id);
  const noteIds = subjNotes.map((n) => n.id);

  const tests = [];
  if (noteIds.length) {
    const ts = query(collection(db, "tests"), where("owner_id", "==", uid()));
    const snap = await getDocs(ts);
    tests.push(
      ...snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((t) => (t.note_ids || []).some((nid) => noteIds.includes(nid)))
    );
  }

  const results = [];
  if (tests.length || noteIds.length) {
    const rs = query(collection(db, "test_results"), where("user_id", "==", uid()));
    const snap = await getDocs(rs);
    const deadTests = new Set([...tests.map((t) => t.id), ...noteIds]);
    results.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => deadTests.has(r.test_id)));
  }

  const batch = writeBatch(db);
  batch.delete(doc(db, "subjects", id));
  subjNotes.forEach((n) => batch.delete(doc(db, "notes", n.id)));
  tests.forEach((t) => batch.delete(doc(db, "tests", t.id)));
  results.forEach((r) => batch.delete(doc(db, "test_results", r.id)));
  return batch.commit();
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

export async function createNote({ subject_id, title, text, topics, plan, retelling, image_ref }) {
  try {
    return await addDoc(collection(db, "notes"), {
      subject_id,
      owner_id: uid(),
      shared_with: [],
      title,
      text,
      topics,
      plan,
      retelling: retelling || "",
      image_ref: image_ref || null,
      pinned: false,
      public: false,
      published_at: null,
      author_name: "",
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
    topics: note.topics || [],
    plan: note.plan || [],
    retelling: note.retelling || "",
    image_ref: note.image_ref || null,
  });
  return ref;
}

export async function updateNote(id, { title, pinned }) {
  const patch = {};
  if (title !== undefined) patch.title = title;
  if (pinned !== undefined) patch.pinned = pinned;
  return setDoc(doc(db, "notes", id), patch, { merge: true });
}

export async function setNotePublic(id, isPublic) {
  const profile = await getUserProfile().catch(() => null);
  const photo = profile?.photo_url || auth.currentUser?.photoURL || "";
  return setDoc(
    doc(db, "notes", id),
    {
      public: Boolean(isPublic),
      published_at: isPublic ? serverTimestamp() : null,
      author_name: isPublic ? profile?.name || "" : "",
      author_photo_url: isPublic ? photo : "",
    },
    { merge: true }
  );
}

export async function deleteNote(id) {
  return deleteDoc(doc(db, "notes", id));
}

export async function saveTest({ note_ids, type, questions, modes, quizlet, match, written, subject_id, title }) {
  return addDoc(collection(db, "tests"), {
    note_ids: note_ids || [],
    owner_id: uid(),
    type: type || "mixed",
    modes: modes || ["single"],
    questions: questions || [],
    quizlet: quizlet || [],
    match: match || [],
    written: written || null,
    subject_id: subject_id || null,
    title: title || "",
    public: false,
    published_at: null,
    author_name: "",
    created_at: serverTimestamp(),
  });
}

export async function setTestPublic(id, isPublic) {
  const profile = await getUserProfile().catch(() => null);
  const photo = profile?.photo_url || auth.currentUser?.photoURL || "";
  return setDoc(
    doc(db, "tests", id),
    {
      public: Boolean(isPublic),
      published_at: isPublic ? serverTimestamp() : null,
      author_name: isPublic ? profile?.name || "" : "",
      author_photo_url: isPublic ? photo : "",
    },
    { merge: true }
  );
}

export async function deleteTest(id) {
  await deleteDoc(doc(db, "tests", id));
  const snap = await getDocs(query(collection(db, "test_results"), where("user_id", "==", uid())));
  const victims = snap.docs.filter((d) => d.data().test_id === id);
  if (!victims.length) return;
  const batch = writeBatch(db);
  victims.forEach((d) => batch.delete(d.ref));
  await batch.commit();
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

/** Копия чужого публичного теста себе в предмет. */
export async function copyTestToSubject(test, subjectId) {
  if (!test?.id) throw new Error("Нет теста");
  if (!subjectId) throw new Error("Выбери предмет");
  return addDoc(collection(db, "tests"), {
    note_ids: [],
    owner_id: uid(),
    type: test.type || "mixed",
    modes: test.modes || ["single"],
    questions: test.questions || [],
    quizlet: test.quizlet || [],
    match: test.match || [],
    written: test.written || null,
    subject_id: subjectId,
    title: test.title || "Тест",
    public: false,
    published_at: null,
    author_name: "",
    copied_from: test.id,
    created_at: serverTimestamp(),
  });
}

export async function listTestsForNotes(ids) {
  const key = [...(ids || [])].sort().join("|");
  const q = query(collection(db, "tests"), where("owner_id", "==", uid()));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => {
      const typeOk = t.type === "choice" || t.type === "mixed" || !t.type;
      return typeOk && [...(t.note_ids || [])].sort().join("|") === key;
    })
    .sort((a, b) => (b.created_at?.toMillis?.() || 0) - (a.created_at?.toMillis?.() || 0));
}

export async function findTestForNotes(ids) {
  const list = await listTestsForNotes(ids);
  return list[0] || null;
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
