import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { BookmarkPlus, Plus, Sparkles } from "lucide-react";
import { auth } from "../firebase";
import { useTheme } from "../theme/ThemeContext";
import { useAlert } from "../components/Alert";
import Accordion from "../components/Accordion";
import Button from "../components/Button";
import Segmented from "../components/Segmented";
import SharedAuthorBar from "../components/AuthorBar";
import MathText from "../components/MathText";
import MarkdownText from "../components/MarkdownText";
import SaveToSubjectModal from "../components/SaveToSubjectModal";
import { GhostNote, useGhostHold } from "../components/Ghost";
import { getNote, listSubjects, copyNoteToSubject, listTestsForNotes, listPublicTestsForNote, updateNoteSummary } from "../api/firestore";
import { testSizeLabel, generateSummary, normalizeSummary } from "../api/backend";

function testHasContent(t) {
  return (t?.questions?.length || 0) > 0
    || (t?.quizlet?.length || 0) > 0
    || (t?.match?.length || 0) > 0
    || Boolean(t?.written?.prompt)
    || (t?.written?.questions?.length || 0) > 0;
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
function toRoman(i) { return ROMAN[i] || String(i + 1); }

/** Убрать из заголовка назойливые «Раздел/Подраздел/Глава…» и их нумерацию. */
function cleanTitle(raw) {
  const t = String(raw || "").trim().replace(/^(Подраздел|Раздел|Глава|Параграф|Часть|Тема)\s*(\d+|[IVXLC]+)?\s*[.:–—-]?\s*/i, "").trim();
  return t || String(raw || "").trim();
}

function fallbackTitle(body) {
  const first = String(body || "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !/^[#|]/.test(l) && l.length > 2);
  return first ? first.slice(0, 48) : "";
}

/** Привести summary в один Markdown, где разделы — заголовки '##', подразделы — '###'. */
function summaryToText(summary) {
  if (typeof summary === "string" && summary.trim()) return summary.trim();
  if (Array.isArray(summary)) {
    return summary
      .map((s) => {
        const body = String(s?.body || s?.text || "").trim();
        if (!body) return "";
        const title = String(s?.title || "").trim() || fallbackTitle(body);
        return `## ${title}\n\n${body}`;
      })
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }
  return "";
}

/** Разбить Markdown на дерево аккордеонов: ## → разделы, ### → вложенные подразделы. */
function sectionsFromMarkdown(text) {
  const root = [];
  const body = [];
  let l1 = null;
  let l2 = null;
  const pushBody = () => {
    const target = l2 || l1;
    if (target && body.length) {
      const t = body.join("\n").trim();
      if (t) target.body = target.body ? `${target.body}\n\n${t}` : t;
    }
    body.length = 0;
  };
  for (const line of String(text).replace(/\r/g, "").split("\n")) {
    if (/^#{4,}\s+/.test(line)) {
      body.push(line.trim().replace(/^#+\s+/, ""));
      continue;
    }
    const sub = /^###\s+(.*)$/.exec(line);
    if (sub && l1) {
      const raw = cleanTitle(sub[1]);
      if (raw) {
        pushBody();
        const node = { title: raw, body: "", items: [] };
        l2 = node;
        l1.items.push(node);
        continue;
      }
    }
    const sec = /^(#|##)\s+(.*)$/.exec(line);
    if (sec) {
      const raw = cleanTitle(sec[2]);
      if (raw) {
        pushBody();
        const node = { title: raw, body: "", items: [] };
        l1 = node;
        l2 = null;
        root.push(node);
        continue;
      }
    }
    body.push(line);
  }
  pushBody();
  return root;
}

function SummaryTree({ nodes, t }) {
  const [open, setOpen] = useState({});
  return (
    <div>
      {nodes.map((node, i) => (
        <Accordion
          key={i}
          title={node.title}
          open={!!open[i]}
          onToggle={() => setOpen({ ...open, [i]: !open[i] })}
        >
          {node.body && <MarkdownText text={node.body} t={t} />}
          {node.items.length > 0 && (
            <div style={{ paddingTop: node.body ? 4 : 0 }}>
              <SummaryTree nodes={node.items} t={t} />
            </div>
          )}
        </Accordion>
      ))}
    </div>
  );
}

function SummaryView({ summary, t }) {
  const sections = useMemo(() => sectionsFromMarkdown(summaryToText(summary)), [summary]);
  const [open, setOpen] = useState(null);
  if (!sections.length) return null;
  return (
    <div>
      {sections.map((s, i) => (
        <Accordion
          key={i}
          title={`${toRoman(i)}. ${s.title}`}
          open={open === i}
          onToggle={() => setOpen(open === i ? null : i)}
        >
          {s.body && <MarkdownText text={s.body} t={t} />}
          {s.items.length > 0 && (
            <div style={{ paddingTop: s.body ? 4 : 0 }}>
              <SummaryTree nodes={s.items} t={t} />
            </div>
          )}
        </Accordion>
      ))}
      <div style={{ color: t.sub, fontSize: 13, marginTop: 14 }}>
        Конспект собран моделью по тексту. Если раздел кажется неполным — открой «Текст» и сравни с оригиналом.
      </div>
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
  const [tab, setTab] = useState("summary");
  const [saveOpen, setSaveOpen] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [tests, setTests] = useState([]);
  const [genBusy, setGenBusy] = useState(false);
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
    const hasContent = note.text?.trim() || note.retelling?.trim();
    if (hasContent || normalizeSummary(note.summary).length) list.push({ v: "summary", label: "Конспект" });
    if (note.retelling?.trim()) list.push({ v: "retelling", label: "Пересказ" });
    if (note.text?.trim()) list.push({ v: "text", label: "Текст" });
    list.push({ v: "tests", label: "Тесты", badge: tests.length });
    return list;
  }, [note, tests]);

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((x) => x.v === tab)) setTab(tabs[0].v);
  }, [tabs, tab]);

  const makeSummary = async () => {
    if (!note || genBusy) return;
    setGenBusy(true);
    try {
      const summary = await generateSummary(note);
      setNote({ ...note, summary });
      if (!isForeign) {
        await updateNoteSummary(note.id, summary).catch((e) => console.warn("[nodedetail] save summary:", e));
      }
    } catch (e) {
      alert(e?.message || "Не удалось сгенерировать конспект");
    } finally {
      setGenBusy(false);
    }
  };

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

  const hasSummary = normalizeSummary(note.summary).length;

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

      {tab === "retelling" && note.retelling?.trim() && (
        <div>
          <MathText
            text={note.retelling.trim()}
            style={{ color: t.text, fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}
          />
          <div style={{ color: t.sub, fontSize: 13, marginTop: 16 }}>
            Пересказ собран моделью по тексту конспекта.
          </div>
        </div>
      )}

      {tab === "summary" && (
        <div>
          {hasSummary ? (
            <SummaryView summary={note.summary} t={t} />
          ) : genBusy ? (
            <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.5, padding: "8px 0" }}>
              Собираю конспект: разделы, таблицы, формулы…
            </div>
          ) : (
            <div>
              <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.5, marginBottom: 12, padding: "4px 0" }}>
                Конспект ещё не собран. Модель разобьёт текст на разделы с определениями, формулами и таблицами.
              </div>
              <Button variant="dashed" onClick={makeSummary} disabled={genBusy}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={16} /> Сгенерировать конспект
                </span>
              </Button>
            </div>
          )}
        </div>
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