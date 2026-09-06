import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { BookmarkPlus } from "lucide-react";
import { auth } from "../firebase";
import { useTheme } from "../theme/ThemeContext";
import { useAlert } from "../components/Alert";
import Accordion from "../components/Accordion";
import Button from "../components/Button";
import Segmented from "../components/Segmented";
import SaveToSubjectModal from "../components/SaveToSubjectModal";
import { GhostNote, useGhostHold } from "../components/Ghost";
import { getNote, listSubjects, copyNoteToSubject, listTestsForNotes, listPublicTestsForNote } from "../api/firestore";

function testHasContent(t) {
  return (t?.questions?.length || 0) > 0
    || (t?.quizlet?.length || 0) > 0
    || (t?.match?.length || 0) > 0
    || Boolean(t?.written?.prompt);
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
function toRoman(i) { return ROMAN[i] || String(i + 1); }
function toLetter(i) { return String.fromCharCode(97 + (i % 26)); }

function normalizePlan(plan) {
  if (!Array.isArray(plan) || plan.length === 0) return [];
  return plan.map((node) => {
    if (typeof node === "string") {
      const title = node.trim();
      return title ? { title, items: [] } : null;
    }
    const title = String(node?.title || node?.text || "").trim();
    if (!title) return null;
    const raw = node?.items ?? node?.children;
    const items = Array.isArray(raw)
      ? raw.map((child) => {
          if (typeof child === "string") {
            const t = child.trim();
            return t ? { title: t, items: [] } : null;
          }
          const t = String(child?.title || child?.text || "").trim();
          if (!t) return null;
          const leaves = child?.items ?? child?.children;
          return {
            title: t,
            items: Array.isArray(leaves)
              ? leaves.map((leaf) => {
                  if (typeof leaf === "string") {
                    const lt = leaf.trim();
                    return lt ? { title: lt } : null;
                  }
                  const lt = String(leaf?.title || leaf?.text || "").trim();
                  return lt ? { title: lt } : null;
                }).filter(Boolean)
              : [],
          };
        }).filter(Boolean)
      : [];
    return { title, items };
  }).filter(Boolean);
}

function PlanMarker({ label, t }) {
  return (
    <div style={{ minWidth: 28, color: t.sub, fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0, marginTop: 1, lineHeight: 1.4 }}>
      {label}
    </div>
  );
}

function PlanRow({ label, title, t, pad = 0, strong = false }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0", paddingLeft: pad }}>
      <PlanMarker label={label} t={t} />
      <div style={{ color: t.text, fontSize: strong ? 15 : 14, fontWeight: strong ? 600 : 400, lineHeight: 1.45 }}>{title}</div>
    </div>
  );
}

function StudyPlan({ plan, t }) {
  const sections = normalizePlan(plan);
  if (!sections.length) {
    return <div style={{ color: t.sub, fontSize: 14, padding: "12px 0" }}>Плана пока нет.</div>;
  }
  return (
    <div>
      {sections.map((section, i) => (
        <div key={i} style={{ marginBottom: section.items?.length ? 6 : 0 }}>
          <PlanRow label={`${toRoman(i)}.`} title={section.title} t={t} strong />
          {(section.items || []).map((item, j) => (
            <div key={j}>
              <PlanRow label={`${j + 1}.`} title={item.title} t={t} pad={18} />
              {(item.items || []).map((leaf, k) => (
                <PlanRow key={k} label={`${toLetter(k)}.`} title={leaf.title} t={t} pad={40} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function NoteDetail() {
  const { noteId } = useParams();
  const { t } = useTheme();
  const { alert } = useAlert();
  const navigate = useNavigate();
  const location = useLocation();
  const [note, setNote] = useState(null);
  const [openTopic, setOpenTopic] = useState(null);
  const [tab, setTab] = useState("retelling");
  const [saveOpen, setSaveOpen] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [saving, setSaving] = useState(false);
  /** @type {null | { kind: "own" } | { kind: "public", testId: string }} */
  const [quizAction, setQuizAction] = useState(null);
  const showGhost = useGhostHold(!note);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const n = await getNote(noteId);
        if (cancelled) return;
        if (!n) {
          setNote({ id: noteId, missing: true });
          return;
        }
        setNote(n);
        const foreign = Boolean(n.owner_id && n.owner_id !== auth.currentUser?.uid);
        if (foreign) {
          const pubs = (await listPublicTestsForNote(noteId).catch(() => []))
            .filter(testHasContent);
          setQuizAction(pubs[0] ? { kind: "public", testId: pubs[0].id } : null);
        } else {
          const own = (await listTestsForNotes([noteId]).catch(() => []))
            .filter(testHasContent);
          setQuizAction(own.length ? { kind: "own" } : null);
        }
      } catch {
        if (!cancelled) setNote({ id: noteId, missing: true });
      }
    })();
    return () => { cancelled = true; };
  }, [noteId]);

  const isForeign = Boolean(
    note && !note.missing && note.owner_id && note.owner_id !== auth.currentUser?.uid
  );

  const tabs = useMemo(() => {
    if (!note || note.missing) return [];
    const list = [];
    if (note.retelling?.trim()) list.push({ v: "retelling", label: "Пересказ" });
    if (normalizePlan(note.plan).length) list.push({ v: "plan", label: "План" });
    if ((note.topics || []).length) list.push({ v: "topics", label: "Темы" });
    if (note.text?.trim()) list.push({ v: "text", label: "Текст" });
    return list;
  }, [note]);

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((x) => x.v === tab)) setTab(tabs[0].v);
  }, [tabs, tab]);

  const openSave = async () => {
    try {
      const list = await listSubjects();
      setSubjects(list);
      setSaveOpen(true);
    } catch (e) {
      alert(e?.message || "Не удалось загрузить предметы");
    }
  };

  const pickSubject = async (subject) => {
    if (saving || !note) return;
    setSaving(true);
    try {
      const ref = await copyNoteToSubject(note, subject.id);
      setSaveOpen(false);
      navigate(`/note/${ref.id}`, { state: { subjectName: subject.name } });
      alert(`Конспект сохранён в «${subject.name}».`, { title: "Готово" });
    } catch (e) {
      alert(e?.message || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  if (showGhost) return <GhostNote />;

  if (note.missing) {
    return (
      <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.5, paddingTop: 24 }}>
        Конспект не найден или недоступен.
      </div>
    );
  }

  return (
    <div>
      <div style={{ color: t.sub, fontSize: 13, marginBottom: 2 }}>
        {[location.state?.subjectName, note.author_name, note.created_at?.toDate?.().toLocaleDateString("ru-RU")].filter(Boolean).join(" · ")}
      </div>
      <div style={{ color: t.text, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 16 }}>{note.title}</div>

      {tabs.length > 0 && (
        <Segmented
          options={tabs}
          value={tab}
          onChange={setTab}
          style={{ marginBottom: 18 }}
          labelStyle={{ fontSize: 13 }}
        />
      )}

      {tab === "retelling" && note.retelling?.trim() && (
        <div style={{ color: t.text, fontSize: 15, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
          {note.retelling.trim()}
        </div>
      )}

      {tab === "plan" && <StudyPlan plan={note.plan} t={t} />}

      {tab === "topics" && (
        (note.topics || []).length === 0 ? (
          <div style={{ color: t.sub, fontSize: 14 }}>Тем пока нет.</div>
        ) : (
          (note.topics || []).map((topic, i) => (
            <Accordion key={i} title={topic.title} open={openTopic === i} onToggle={() => setOpenTopic(openTopic === i ? null : i)}>
              {(topic.points || []).map((p, j) => (
                <div key={j} style={{ color: t.sub, fontSize: 14, padding: "5px 0", paddingLeft: 4 }}>— {p}</div>
              ))}
            </Accordion>
          ))
        )
      )}

      {tab === "text" && note.text?.trim() && (
        <div style={{ color: t.text, fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
          {note.text.trim()}
        </div>
      )}

      {tabs.length === 0 && (
        <div style={{ color: t.sub, fontSize: 14, padding: "8px 0" }}>В этом конспекте пока нет содержимого.</div>
      )}

      <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 10 }}>
        {isForeign && (
          <Button variant="dashed" onClick={openSave} disabled={saving}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <BookmarkPlus size={16} />
              {saving ? "Сохраняю…" : "Сохранить к себе"}
            </span>
          </Button>
        )}
        {quizAction && (
          <Button
            onClick={() => {
              if (quizAction.kind === "public") {
                navigate(`/test/${quizAction.testId}/quiz/full`, {
                  state: { from: location.state?.from || `/note/${noteId}` },
                });
              } else {
                navigate(`/note/${noteId}/quiz`, {
                  state: { subjectName: location.state?.subjectName },
                });
              }
            }}
          >
            Начать тест
          </Button>
        )}
      </div>

      <SaveToSubjectModal
        open={saveOpen}
        onClose={() => !saving && setSaveOpen(false)}
        onPick={pickSubject}
        subjects={subjects}
        busy={saving}
        hint="Конспект появится в выбранном предмете — только у тебя."
      />
    </div>
  );
}
