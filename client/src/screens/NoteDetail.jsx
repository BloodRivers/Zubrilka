import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { BookmarkPlus, Plus } from "lucide-react";
import { auth } from "../firebase";
import { useTheme } from "../theme/ThemeContext";
import { useAlert } from "../components/Alert";
import Accordion from "../components/Accordion";
import Button from "../components/Button";
import Segmented from "../components/Segmented";
import SharedAuthorBar from "../components/AuthorBar";
import MathText from "../components/MathText";
import SaveToSubjectModal from "../components/SaveToSubjectModal";
import { GhostNote, useGhostHold } from "../components/Ghost";
import { getNote, listSubjects, copyNoteToSubject, listTestsForNotes, listPublicTestsForNote } from "../api/firestore";
import { testSizeLabel } from "../api/backend";

function testHasContent(t) {
  return (t?.questions?.length || 0) > 0
    || (t?.quizlet?.length || 0) > 0
    || (t?.match?.length || 0) > 0
    || Boolean(t?.written?.prompt)
    || (t?.written?.questions?.length || 0) > 0;
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
function toRoman(i) { return ROMAN[i] || String(i + 1); }
function toLetter(i) { return String.fromCharCode(97 + (i % 26)); }

function normalizePlan(plan) {
  if (!Array.isArray(plan) || plan.length === 0) return [];
  return plan.map((node) => {
    if (typeof node === "string") {
      const title = node.trim();
      return title ? { title, summary: "", items: [] } : null;
    }
    const title = String(node?.title || node?.text || "").trim();
    if (!title) return null;
    const summary = String(node?.summary || "").trim();
    const raw = node?.items ?? node?.children;
    const items = Array.isArray(raw)
      ? raw.map((child) => {
          if (typeof child === "string") {
            const t = child.trim();
            return t ? { title: t, summary: "", items: [] } : null;
          }
          const t = String(child?.title || child?.text || "").trim();
          if (!t) return null;
          const leaves = child?.items ?? child?.children;
          return {
            title: t,
            summary: String(child?.summary || "").trim(),
            items: Array.isArray(leaves)
              ? leaves.map((leaf) => {
                  if (typeof leaf === "string") {
                    const lt = leaf.trim();
                    return lt ? { title: lt, summary: "" } : null;
                  }
                  const lt = String(leaf?.title || leaf?.text || "").trim();
                  return lt ? { title: lt, summary: String(leaf?.summary || "").trim() } : null;
                }).filter(Boolean)
              : [],
          };
        }).filter(Boolean)
      : [];
    return { title, summary, items };
  }).filter(Boolean);
}

function PlanMarker({ label, t }) {
  return (
    <div style={{ minWidth: 28, color: t.sub, fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0, marginTop: 1, lineHeight: 1.4 }}>
      {label}
    </div>
  );
}

function PlanRow({ label, title, summary, t, pad = 0, strong = false }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0", paddingLeft: pad }}>
      <PlanMarker label={label} t={t} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <MathText as="div" text={title} style={{ color: t.text, fontSize: strong ? 15 : 14, fontWeight: strong ? 600 : 400, lineHeight: 1.45 }} />
        {summary && (
          <MathText as="div" text={summary} style={{ color: t.sub, fontSize: 13, lineHeight: 1.5, marginTop: 4, whiteSpace: "pre-wrap" }} />
        )}
      </div>
    </div>
  );
}

function InteractivePlan({ plan, t }) {
  const sections = normalizePlan(plan);
  const [open, setOpen] = useState(null);
  if (!sections.length) {
    return <div style={{ color: t.sub, fontSize: 14, padding: "12px 0" }}>Плана пока нет.</div>;
  }
  return (
    <div>
      {sections.map((section, i) => (
        <Accordion
          key={i}
          title={`${toRoman(i)}. ${section.title}`}
          open={open === i}
          onToggle={() => setOpen(open === i ? null : i)}
        >
          {section.summary && (
            <MathText
              text={section.summary}
              style={{ color: t.sub, fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", marginBottom: 10 }}
            />
          )}
          {(section.items || []).map((item, j) => (
            <div key={j}>
              <PlanRow label={`${j + 1}.`} title={item.title} summary={item.summary} t={t} pad={18} />
              {(item.items || []).map((leaf, k) => (
                <PlanRow key={k} label={`${toLetter(k)}.`} title={leaf.title} summary={leaf.summary} t={t} pad={40} />
              ))}
            </div>
          ))}
        </Accordion>
      ))}
    </div>
  );
}

function AuthorBar({ note, t, navigate }) {
  return (
    <SharedAuthorBar
      name={note.author_name}
      photoUrl={note.author_photo_url}
      uid={note.author_uid}
      label="автор конспекта"
      from={`/note/${note.id}`}
      t={t}
      navigate={navigate}
    />
  );
}

export default function NoteDetail() {
  const { noteId } = useParams();
  const { t } = useTheme();
  const { alert } = useAlert();
  const navigate = useNavigate();
  const location = useLocation();
  const [note, setNote] = useState(null);
  const [tab, setTab] = useState("plan");
  const [saveOpen, setSaveOpen] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [tests, setTests] = useState([]);
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
          setTests(pubs);
        } else {
          const own = (await listTestsForNotes([noteId]).catch(() => []))
            .filter(testHasContent);
          setTests(own);
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
  const isGuest = !!auth.currentUser?.isAnonymous;

  const tabs = useMemo(() => {
    if (!note || note.missing) return [];
    const list = [];
    if (normalizePlan(note.plan).length || note.retelling?.trim()) list.push({ v: "plan", label: "План" });
    if (note.text?.trim()) list.push({ v: "text", label: "Текст" });
    list.push({ v: "tests", label: "Тесты", badge: tests.length });
    return list;
  }, [note, tests]);

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

  const hasPlan = normalizePlan(note.plan).length;
  const retellingOnly = !hasPlan && note.retelling?.trim();

  return (
    <div>
      {!isForeign && (
        <div style={{ color: t.sub, fontSize: 13, marginBottom: 2 }}>
          {[location.state?.subjectName, note.created_at?.toDate?.().toLocaleDateString("ru-RU")].filter(Boolean).join(" · ")}
        </div>
      )}
      {isForeign && (
        <AuthorBar note={note} t={t} navigate={navigate} />
      )}
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

      {tab === "plan" && (
        <>
          {retellingOnly && (
            <div style={{ color: t.text, fontSize: 15, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {note.retelling.trim()}
            </div>
          )}
          {hasPlan ? <InteractivePlan plan={note.plan} t={t} /> : !retellingOnly && (
            <div style={{ color: t.sub, fontSize: 14 }}>Плана пока нет.</div>
          )}
        </>
      )}

      {tab === "text" && note.text?.trim() && (
        <MathText
          text={note.text.trim()}
          style={{ color: t.text, fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}
        />
      )}

      {tab === "tests" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tests.length === 0 && (
            <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.5, padding: "4px 0 14px" }}>
              Тестов по этому конспекту пока нет.
            </div>
          )}
          {tests.map((test) => {
            const sizeLabel = testSizeLabel(test);
            const parts = [];
            if (test.questions?.length) parts.push(`${test.questions.length} вопр.`);
            if (test.quizlet?.length) parts.push(`${test.quizlet.length} карт.`);
            if (test.match?.length) parts.push(`${test.match.length} пар`);
            if (test.written?.prompt || test.written?.questions?.length) parts.push("письм.");
            return (
              <button
                key={test.id}
                type="button"
                className="rowpress"
                onClick={() => navigate(`/test/${test.id}/quiz/full`, { state: { from: `/note/${noteId}` } })}
                style={{
                  width: "100%",
                  display: "block",
                  textAlign: "left",
                  padding: "13px 15px",
                  borderRadius: 14,
                  border: `1px solid ${t.border}`,
                  background: t.surface,
                  color: t.text,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 600 }}>{test.title || "Тест"}</div>
                {sizeLabel ? <div style={{ color: t.sub, fontSize: 12, marginTop: 5 }}>{sizeLabel}</div> : parts.length > 0 && <div style={{ color: t.sub, fontSize: 12, marginTop: 5 }}>{parts.join(" · ")}</div>}
              </button>
            );
          })}
          {!isGuest && !isForeign && (
            <Button
              variant="dashed"
              onClick={() => navigate(`/note/${noteId}/quiz`, { state: { create: true, subjectName: location.state?.subjectName } })}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Plus size={16} /> Новый тест
              </span>
            </Button>
          )}
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