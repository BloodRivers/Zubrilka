import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Plus, Pin, X, FlaskConical, BookOpen } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { useAlert } from "../components/Alert";
import Button from "../components/Button";
import { GhostCards, useGhostHold } from "../components/Ghost";
import Accordion from "../components/Accordion";
import ResultCard, { bestResultsByTest } from "../components/ResultCard";
import Segmented from "../components/Segmented";
import TestEditModal from "../components/TestEditModal";
import { listNotes, getSubject, updateNote, deleteNote, listResults, setNotePublic } from "../api/firestore";
import { setScreenTitle } from "../nav";
import Switch from "../components/Switch";

function FieldLabel({ children, t }) {
  return (
    <div style={{ color: t.sub, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 8px 2px" }}>
      {children}
    </div>
  );
}

function ToggleRow({ label, hint, on, onToggle, t, style }) {
  return (
    <button
      type="button"
      onClick={onToggle}
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
  const timer = useRef(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const handlePointerDown = () => {
    if (!onLongPress) return;
    fired.current = false;
    clear();
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, 450);
  };

  const handleClick = (e) => {
    if (fired.current) {
      e.preventDefault();
      e.stopPropagation();
      fired.current = false;
      return;
    }
    onClick?.();
  };

  return (
    <div
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => fired.current && e.preventDefault()}
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
        animation: `fadeUp 460ms cubic-bezier(0.16,1,0.3,1) both`,
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
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setPinned(!!initial?.pinned);
      setIsPublic(!!initial?.public);
      setLeaving(false);
    }
  }, [open, initial]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const requestClose = () => {
    if (leaving) return;
    setLeaving(true);
    timer.current = setTimeout(() => {
      setLeaving(false);
      onClose();
    }, 220);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = async () => {
    if (leaving) return;
    if (title.trim() === "") {
      alert("Введи название конспекта.");
      return;
    }
    setLeaving(true);
    try {
      await onSave(initial, title.trim(), pinned, isPublic);
    } catch (err) {
      alert("Не удалось сохранить конспект: " + (err?.message ?? ""));
    } finally {
      setLeaving(false);
    }
  };

  const confirmDelete = () => {
    if (!initial || leaving) return;
    alert(`Удалить конспект «${title}»?`, {
      danger: true,
      confirmLabel: "Удалить",
      onConfirm: async () => {
        setLeaving(true);
        try {
          await onDelete(initial.id);
        } finally {
          setLeaving(false);
        }
      },
    });
  };

  if (!open && !leaving) return null;

  return createPortal(
    <div
      onClick={requestClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 32px",
        zIndex: 200,
        animation: `${leaving ? "backdropOut" : "backdropIn"} 220ms ease-out forwards`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 320,
          background: t.surface,
          borderRadius: 22,
          padding: "22px 20px 20px 20px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
          animation: `${leaving ? "modalOut" : "modalIn"} 220ms cubic-bezier(0.16,1,0.3,1) forwards`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>Редактировать конспект</div>
          <button
            type="button"
            className="press"
            onClick={requestClose}
            aria-label="Закрыть"
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: "none",
              background: t.raised,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={15} color={t.sub} />
          </button>
        </div>

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

          <Button type="submit" variant="primary" disabled={title.trim() === "" || leaving}>
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
            color: "#E5484D",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Удалить конспект
        </button>
      </div>
    </div>,
    document.body
  );
}

export default function SubjectHub() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { t } = useTheme();
  const { alert } = useAlert();
  const [notes, setNotes] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const showGhost = useGhostHold(loading);
  const [subjectName, setSubjectName] = useState("");
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [pickNoteOpen, setPickNoteOpen] = useState(false);
  const [tab, setTab] = useState("notes");
  const [openTopic, setOpenTopic] = useState(null);
  const location = useLocation();

  const load = async () => {
    setLoading(true);
    const [subj, ns, rs] = await Promise.all([
      getSubject(subjectId).catch(() => null),
      listNotes(subjectId).catch(() => []),
      listResults().catch(() => []),
    ]);
    setSubjectName(subj?.name || "");
    setScreenTitle(subj?.name || "");
    setNotes(ns);
    const ids = new Set(ns.map((n) => n.id));
    const filtered = rs.filter(
      (r) =>
        r.subject_id === subjectId
        || (r.note_ids || []).some((id) => ids.has(id))
    );
    setResults(bestResultsByTest(filtered));
    setLoading(false);
  };

  useEffect(() => {
    setTab(location.state?.tab === "tests" ? "tests" : "notes");
    setOpenTopic(null);
    load();
    return () => setScreenTitle(null);
  }, [subjectId]);

  const sorted = [...notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const topics = (() => {
    const m = new Map();
    for (const n of notes) {
      for (const tp of n.topics || []) {
        if (!m.has(tp.title)) m.set(tp.title, { title: tp.title, points: [] });
        for (const p of tp.points || []) {
          if (!m.get(tp.title).points.includes(p)) m.get(tp.title).points.push(p);
        }
      }
    }
    return [...m.values()];
  })();

  const onSave = async (initial, title, pinned, isPublic) => {
    try {
      await updateNote(initial.id, { title, pinned });
      if (Boolean(initial.public) !== Boolean(isPublic)) {
        await setNotePublic(initial.id, isPublic);
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
    { v: "topics", label: "Темы", badge: topics.length },
    { v: "tests", label: "Тесты", badge: results.length },
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
      ) : tab === "topics" ? (
        topics.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={24} />}
            title="Пока пусто"
            sub="Темы из конспектов этого предмета появятся здесь."
          />
        ) : (
          topics.map((topic, i) => (
            <Accordion
              key={topic.title}
              title={topic.title}
              open={openTopic === i}
              onToggle={() => setOpenTopic(openTopic === i ? null : i)}
            >
              {(topic.points || []).map((p, j) => (
                <div key={j} style={{ color: t.sub, fontSize: 14, padding: "5px 0", paddingLeft: 4 }}>
                  — {p}
                </div>
              ))}
            </Accordion>
          ))
        )
      ) : (
        <>
          {notes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
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
          {results.length === 0 ? (
            <EmptyState
              icon={<FlaskConical size={24} />}
              title="Пока пусто"
              sub={notes.length === 0 ? "Сначала добавь конспект — потом сможешь создать тест." : "Создай тест по конспекту или по всему предмету — результаты появятся здесь."}
            />
          ) : (
            results.map((r, idx) => (
              <ResultCard
                key={r.test_id || r.id}
                result={r}
                idx={idx}
                onLongPress={(res) => setEditingTest(res)}
              />
            ))
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
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const requestClose = () => {
    if (leaving) return;
    setLeaving(true);
    timer.current = setTimeout(() => {
      setLeaving(false);
      onClose();
    }, 220);
  };

  useEffect(() => {
    if (!open) return undefined;
    setLeaving(false);
    const onKey = (e) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open && !leaving) return null;

  return createPortal(
    <div
      onClick={requestClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 28px",
        zIndex: 200,
        animation: `${leaving ? "backdropOut" : "backdropIn"} 220ms ease-out forwards`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 340,
          maxHeight: "70dvh",
          overflow: "auto",
          background: t.surface,
          borderRadius: 22,
          padding: "20px 18px 16px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
          animation: `${leaving ? "modalOut" : "modalIn"} 220ms cubic-bezier(0.16,1,0.3,1) forwards`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>Конспект для теста</div>
          <button
            type="button"
            className="press"
            onClick={requestClose}
            aria-label="Закрыть"
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: "none",
              background: t.raised,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={15} color={t.sub} />
          </button>
        </div>
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
      </div>
    </div>,
    document.body
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