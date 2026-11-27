import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Plus, Pin, FlaskConical } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { EASE } from "../theme/theme";
import { useAlert } from "../components/Alert";
import Button from "../components/Button";
import Modal from "../components/Modal";
import FieldLabel from "../components/FieldLabel";
import useLongPress from "../hooks/useLongPress";
import { GhostCards, useGhostHold } from "../components/Ghost";
import { bestResultsByTest } from "../components/ResultCard";
import Segmented from "../components/Segmented";
import TestEditModal from "../components/TestEditModal";
import { listNotes, getSubject, updateNote, deleteNote, listResults, setNotePublic, listTestsForSubject, listTextbooks } from "../api/firestore";
import Textbooks from "./Textbooks";
import { testSizeLabel } from "../api/backend";
import { setScreenTitle } from "../nav";
import Switch from "../components/Switch";
import { sfx } from "../sfx";

function ToggleRow({ label, hint, on, onToggle, t, style }) {
  return (
    <button
      type="button"
      onClick={() => { sfx.tap(); onToggle(); }}
      className="press"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        padding: "14px 16px",
        borderRadius: 14,
        border: `1px solid ${t.border}`,
        background: t.raised,
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ color: t.sub, fontSize: 12, marginTop: 3, lineHeight: 1.35 }}>{hint}</div>}
      </div>
      <Switch on={on} />
    </button>
  );
}

function NoteCard({ note, idx, onClick, onLongPress }) {
  const { t } = useTheme();
  const long = useLongPress({ onClick, onLongPress });

  return (
    <div
      {...long}
      className="rowpress"
      style={{
        padding: "18px",
        marginBottom: 12,
        borderRadius: 20,
        background: t.surface,
        border: `1px solid ${t.border}`,
        cursor: "pointer",
        WebkitTouchCallout: "none",
        userSelect: "none",
        animation: `fadeUp 460ms ${EASE} both`,
        animationDelay: `${idx * 60}ms`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {note.pinned && <Pin size={14} color={t.sub} fill={t.sub} />}
            <div style={{ color: t.text, fontSize: 17, fontWeight: 600 }}>{note.title}</div>
          </div>
          <div style={{ color: t.sub, fontSize: 13, marginTop: 3 }}>{note.created_at?.toDate?.().toLocaleDateString("ru-RU") ?? ""}</div>
        </div>
      </div>
    </div>
  );
}

function NoteEditModal({ open, initial, onClose, onSave, onDelete }) {
  const { t } = useTheme();
  const { alert } = useAlert();
  const [title, setTitle] = useState("");
  const [pinned, setPinned] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setPinned(!!initial?.pinned);
      setIsPublic(!!initial?.public);
    }
  }, [open, initial]);

  const submit = async () => {
    if (title.trim() === "") {
      alert("Введи название конспекта.");
      return;
    }
    try {
      await onSave(initial, title.trim(), pinned, isPublic);
    } catch (err) {
      alert("Не удалось сохранить конспект: " + (err?.message ?? ""));
    }
  };

  const confirmDelete = () => {
    if (!initial) return;
    alert(`Удалить конспект «${title}»?`, {
      danger: true,
      confirmLabel: "Удалить",
      onConfirm: async () => {
        try {
          await onDelete(initial.id);
        } catch {
          /* ошибка уже показана в onDelete */
        }
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Редактировать конспект">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <FieldLabel t={t}>Название</FieldLabel>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Как назвать конспект"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "14px 16px",
            borderRadius: 14,
            border: `1px solid ${t.border}`,
            background: t.raised,
            color: t.text,
            fontSize: 15,
            fontFamily: "inherit",
            outline: "none",
            marginBottom: 16,
          }}
        />

        <FieldLabel t={t}>Параметры</FieldLabel>
        <ToggleRow
          t={t}
          label="Закрепить"
          hint="Всегда сверху в списке конспектов"
          on={pinned}
          onToggle={() => setPinned((p) => !p)}
          style={{ marginBottom: 8 }}
        />
        <ToggleRow
          t={t}
          label="В библиотеке"
          hint="Конспект увидят все пользователи"
          on={isPublic}
          onToggle={() => setIsPublic((p) => !p)}
          style={{ marginBottom: 16 }}
        />

        <Button type="submit" variant="primary" disabled={title.trim() === ""}>
          Сохранить
        </Button>
      </form>

      <button
        type="button"
        className="press"
        onClick={confirmDelete}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "16px",
          borderRadius: 999,
          border: "none",
          background: "transparent",
          color: t.danger,
          fontSize: 14,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        Удалить конспект
      </button>
    </Modal>
  );
}

export default function SubjectHub() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { alert } = useAlert();
  const [notes, setNotes] = useState([]);
  const [tests, setTests] = useState([]);
  const [books, setBooks] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const showGhost = useGhostHold(loading);
  const [subjectName, setSubjectName] = useState("");
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [pickNoteOpen, setPickNoteOpen] = useState(false);
  const [tab, setTab] = useState("notes");
  const location = useLocation();

  const load = async () => {
    setLoading(true);
    const [subj, ns, rs, bs] = await Promise.all([
      getSubject(subjectId).catch(() => null),
      listNotes(subjectId).catch(() => []),
      listResults().catch(() => []),
      listTextbooks(subjectId).catch(() => []),
    ]);
    setSubjectName(subj?.name || "");
    setScreenTitle(subj?.name || "");
    setNotes(ns);
    setBooks(bs);
    const ids = ns.map((n) => n.id);
    const ts = await listTestsForSubject(subjectId, ids).catch(() => []);
    setTests(ts);
    const filtered = rs.filter(
      (r) =>
        r.subject_id === subjectId
        || (r.note_ids || []).some((id) => ids.includes(id))
        || ts.some((t) => t.id === r.test_id)
    );
    setResults(bestResultsByTest(filtered));
    setLoading(false);
  };

  useEffect(() => {
    setTab(location.state?.tab === "tests" ? "tests" : "notes");
    load();
    return () => setScreenTitle(null);
  }, [subjectId]);

  const sorted = [...notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const onSave = async (initial, title, pinned, isPublic) => {
    try {
      await updateNote(initial.id, { title, pinned });
      if (Boolean(initial.public) !== Boolean(isPublic)) {
        await setNotePublic(initial.id, isPublic, subjectName);
      }
      setShowModal(false);
      await load();
    } catch {
      alert("Не удалось сохранить конспект, проверь соединение");
    }
  };

  const onDelete = async (id) => {
    try {
      await deleteNote(id);
      setShowModal(false);
      await load();
    } catch {
      alert("Не удалось удалить конспект, проверь соединение");
    }
  };

  const TABS = [
    { v: "notes", label: "Конспекты", badge: notes.length },
    { v: "tests", label: "Тесты", badge: tests.length },
    { v: "books", label: "Учебники", badge: books.length },
  ];

  return (
    <div>
      <Segmented
        options={TABS}
        value={tab}
        onChange={setTab}
        style={{ marginBottom: 20 }}
      />

      {showGhost ? (
        <GhostCards count={4} />
      ) : tab === "notes" ? (
        <>
          {sorted.map((n, idx) => (
            <NoteCard
              key={n.id}
              note={n}
              idx={idx}
              onClick={() => navigate(`/note/${n.id}`, { state: { subjectName } })}
              onLongPress={() => {
                setEditing(n);
                setShowModal(true);
              }}
            />
          ))}
          <Button variant="dashed" onClick={() => navigate(`/subject/${subjectId}/new`)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Plus size={16} /> Новый конспект
            </span>
          </Button>
        </>
      ) : tab === "books" ? (
        <Textbooks subjectId={subjectId} />
      ) : (
        <>
          {tests.length === 0 ? (
            <EmptyState
              icon={<FlaskConical size={24} />}
              title="Пока пусто"
              sub={notes.length === 0 ? "Сначала добавь конспект — потом сможешь создать тест." : "Создай тест по конспекту или по всему предмету — он появится здесь."}
            />
          ) : (
            tests.map((test, idx) => {
              const best = results.find((r) => r.test_id === test.id);
              return (
                <SavedTestCard
                  key={test.id}
                  test={test}
                  best={best}
                  idx={idx}
                  onLongPress={() => setEditingTest({ test_id: test.id, title: test.title })}
                />
              );
            })
          )}
          {notes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              <Button variant="dashed" onClick={() => setPickNoteOpen(true)}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Plus size={16} /> Новый тест
                </span>
              </Button>
              <Button variant="dashed" onClick={() => navigate(`/subject/${subjectId}/quiz`)}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <FlaskConical size={16} /> Тест по всему предмету
                </span>
              </Button>
            </div>
          )}
        </>
      )}

      <NoteEditModal
        open={showModal}
        initial={editing}
        onClose={() => setShowModal(false)}
        onSave={onSave}
        onDelete={onDelete}
      />
      <TestEditModal
        open={Boolean(editingTest)}
        testId={editingTest?.test_id}
        title={editingTest?.title}
        subjectName={subjectName}
        onClose={() => setEditingTest(null)}
        onChanged={load}
      />
      <PickNoteModal
        open={pickNoteOpen}
        notes={sorted}
        onClose={() => setPickNoteOpen(false)}
        onPick={(note) => {
          setPickNoteOpen(false);
          navigate(`/note/${note.id}/quiz`, { state: { create: true, subjectName } });
        }}
      />
    </div>
  );
}

function PickNoteModal({ open, notes, onClose, onPick }) {
  const { t } = useTheme();

  return (
    <Modal open={open} onClose={onClose} title="Конспект для теста" maxWidth={340} maxHeight="70dvh" pad="20px 18px 16px">
      <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.4, marginBottom: 14 }}>
        Выбери конспект — потом типы заданий и генерация.
      </div>
      {notes.map((n) => (
        <button
          key={n.id}
          type="button"
          className="rowpress"
          onClick={() => onPick(n)}
          style={{
            width: "100%",
            display: "block",
            textAlign: "left",
            padding: "14px 16px",
            marginBottom: 8,
            borderRadius: 14,
            border: `1px solid ${t.border}`,
            background: t.raised,
            color: t.text,
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          {n.title || "Конспект"}
        </button>
      ))}
    </Modal>
  );
}

function EmptyState({ icon, title, sub }) {
  const { t } = useTheme();
  return (
    <div style={{ paddingTop: 40, textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          margin: "0 auto 16px",
          background: t.raised,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div style={{ color: t.text, fontWeight: 600, fontSize: 15 }}>{title}</div>
      <div style={{ color: t.sub, fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>{sub}</div>
    </div>
  );
}

function SavedTestCard({ test, best, idx, onLongPress }) {
  const { t } = useTheme();
  const navigate = useNavigate();
  const long = useLongPress({
    onClick: () => navigate(`/test/${test.id}/quiz/run`),
    onLongPress,
  });

  const modes = Array.isArray(test.modes) ? test.modes : [];
  const sizeLabel = testSizeLabel(test);
  const parts = [];
  if (test.questions?.length) parts.push(`${test.questions.length} вопр.`);
  if (test.quizlet?.length) parts.push(`${test.quizlet.length} карт.`);
  if (test.match?.length) parts.push(`${test.match.length} пар`);
  if (test.written?.prompt || test.written?.questions?.length) parts.push("письм.");
  if (!parts.length && modes.length) parts.push(modes.join(" · "));
  const subtitle = sizeLabel || parts.join(" · ") || "Тест сохранен";

  return (
    <button
      type="button"
      className="rowpress"
      {...long}
      style={{
        width: "100%",
        display: "block",
        textAlign: "left",
        padding: "18px",
        marginBottom: 12,
        borderRadius: 20,
        border: `1px solid ${t.border}`,
        background: t.surface,
        color: t.text,
        fontFamily: "inherit",
        cursor: "pointer",
        WebkitTouchCallout: "none",
        userSelect: "none",
        animation: `fadeUp 460ms ${EASE} both`,
        animationDelay: `${idx * 60}ms`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, color: t.text, fontSize: 17, fontWeight: 600 }}>
        {test.title || "Тест"}
      </div>
      <div style={{ color: t.sub, fontSize: 13, marginTop: 3 }}>
        {subtitle}
        {best && ` · лучший результат ${best.score ?? 0}/${best.total ?? 0}`}
      </div>
    </button>
  );
}