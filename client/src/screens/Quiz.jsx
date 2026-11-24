import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Check, X, Minus, BookmarkPlus } from "lucide-react";
import { auth } from "../firebase";
import { useTheme } from "../theme/ThemeContext";
import { EASE } from "../theme/theme";
import { useAlert } from "../components/Alert";
import ProgressBar from "../components/ProgressBar";
import AuthorBar from "../components/AuthorBar";
import MathText from "../components/MathText";
import { GhostQuiz, useGhostHold } from "../components/Ghost";
import Button from "../components/Button";
import SaveToSubjectModal from "../components/SaveToSubjectModal";
import {
  getNote, getTest, listNotes, getSubject, listResults, saveTest, saveTestResult, listTestsForNotes,
  listSubjects, copyTestToSubject,
} from "../api/firestore";
import { generateTest, normalizeTestPayload, gradeWritten, parseWrittenBatch, TEST_SIZES, writtenQuestionsOf } from "../api/backend";
import { onAIStatus, aiUsedToday, AI_DAILY_LIMIT } from "../api/ai";
import MarkedAnswer from "../components/MarkedAnswer";
import { sfx } from "../sfx";
import { setQuizActive } from "../nav";
import { clearDraft, readDraft, writeDraft } from "../quizDraft";

const GEN_PHRASES = ["Формулирую вопросы…", "Подбираю короткие варианты…", "Собираю квизлет…"];
const MODE_OPTS = [
  { id: "single", label: "Один верный ответ", hint: "Как обычный тест: тапнул — и сразу дальше" },
  { id: "multi", label: "Несколько верных", hint: "Отмечаешь все подходящие, потом «Ответить»" },
  { id: "quizlet", label: "Квизлет", hint: "Карточки термин ↔ определение" },
  { id: "match", label: "Сопоставь", hint: "Две колонки: найди связанные пары из конспекта" },
  { id: "written", label: "Письменный ответ", hint: "Короткий ответ, проверяет ИИ на глазах" },
];

const MATCH_ROUND = 4;

function SizeSlider({ options, value, onChange, t }) {
  const trackRef = useRef(null);
  const initIdx = Math.max(0, options.findIndex((o) => o.id === value));
  const [live, setLive] = useState(false);
  const [idx, setIdxState] = useState(initIdx);
  const idxRef = useRef(initIdx);

  const count = options.length;
  const active = options[idx] || options[0];
  const pct = (count > 1 ? idx / (count - 1) : 0) * 100;
  const stream = idx === count - 1;

  const setIdx = (v) => {
    idxRef.current = v;
    setIdxState(v);
  };

  const posFromEvent = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return Math.round(frac * (count - 1));
  };

  const down = (e) => {
    e.preventDefault();
    setLive(true);
    trackRef.current.setPointerCapture(e.pointerId);
    setIdx(posFromEvent(e));
  };
  const move = (e) => {
    if (!live) return;
    setIdx(posFromEvent(e));
  };
  const up = () => {
    if (!live) return;
    setLive(false);
    onChange(options[idxRef.current].id);
  };

  const glide = live ? "none" : `left 220ms ${EASE}, width 220ms ${EASE}`;

  return (
    <div style={{ margin: "14px 0 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          ref={trackRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          style={{ position: "relative", flex: 1, height: 40, cursor: "pointer", touchAction: "none" }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: 16,
              transform: "translateY(-50%)",
              borderRadius: 999,
              background: t.raised,
              border: `1px solid ${t.border}`,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              width: `${pct}%`,
              height: 16,
              transform: "translateY(-50%)",
              borderRadius: 999,
              background: t.invBg,
              overflow: "hidden",
              transition: live ? "none" : `width 220ms ${EASE}`,
            }}
          >
            {stream && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.95), transparent)",
                  animation: "stream 1.6s linear infinite",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: `${pct}%`,
              width: 28,
              height: 28,
              transform: "translate(-50%, -50%)",
              borderRadius: 999,
              background: "#fff",
              boxShadow: "0 3px 12px rgba(0,0,0,0.25)",
              border: `1px solid ${t.border}`,
              transition: live ? "none" : `left 220ms ${EASE}`,
              pointerEvents: "none",
            }}
          />
        </div>
        <div
          key={active.id}
          className="swap"
          style={{
            width: 118,
            flexShrink: 0,
            fontSize: 14,
            fontWeight: 700,
            textAlign: "center",
            color: stream ? "#3B82F6" : t.text,
            whiteSpace: "nowrap",
            transition: "color 200ms ease",
          }}
        >
          {active.label}
        </div>
      </div>
      <div key={`hint-${active.id}`} className="swap" style={{ color: t.sub, fontSize: 12.5, marginTop: 10 }}>
        {active.hint}
      </div>
    </div>
  );
}

function shuffleList(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sameSet(a, b) {
  const aa = [...(a || [])].map(Number).sort((x, y) => x - y);
  const bb = [...(b || [])].map(Number).sort((x, y) => x - y);
  return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
}

function loadTestBundle(test) {
  const modes = Array.isArray(test?.modes) && test.modes.length
    ? test.modes
    : ["single"];
  return normalizeTestPayload(
    {
      questions: test?.questions || [],
      quizlet: test?.quizlet || [],
      match: test?.match || [],
      written: test?.written || null,
    },
    modes
  );
}

function testHasContent(bundle) {
  return (bundle.questions?.length || 0) > 0
    || (bundle.quizlet?.length || 0) > 0
    || (bundle.match?.length || 0) > 0
    || writtenQuestionsOf(bundle.written).length > 0;
}

export default function Quiz() {
  const { noteId, testId, mode, subjectId } = useParams();
  const { t } = useTheme();
  const { alert } = useAlert();
  const navigate = useNavigate();
  const location = useLocation();

  const [bundle, setBundle] = useState(null);
  const [section, setSection] = useState("choice");
  const [qIndex, setQIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [multiPick, setMultiPick] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [quizKnown, setQuizKnown] = useState([]);
  const [writtenAnswers, setWrittenAnswers] = useState([]);
  const [writtenResult, setWrittenResult] = useState(null);
  const [writtenMarks, setWrittenMarks] = useState([]);
  const [grading, setGrading] = useState(false);
  const [loading, setLoading] = useState(true);
  const showGhost = useGhostHold(loading);
  const [phase, setPhase] = useState("ready");
  const [modes, setModes] = useState(["single"]);
  const [size, setSize] = useState("standard");
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState(null);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [sourceTest, setSourceTest] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [existingTests, setExistingTests] = useState([]);
  const [matchRound, setMatchRound] = useState(0);
  const [matchLeftSel, setMatchLeftSel] = useState(null);
  const [matchRightSel, setMatchRightSel] = useState(null);
  const [matchDone, setMatchDone] = useState([]);
  const [matchTainted, setMatchTainted] = useState([]);
  const [matchWrong, setMatchWrong] = useState(null);
  const [matchRightOrder, setMatchRightOrder] = useState([]);
  const [flash, setFlash] = useState([]);
  const [resumed, setResumed] = useState(false);
  const forceCreate = Boolean(location.state?.create);

  const testIdRef = useRef(null);
  const noteIdsRef = useRef([]);
  const titleRef = useRef("");
  const subjectIdRef = useRef(subjectId || null);
  const noteTextRef = useRef("");
  const pendingRef = useRef(null);
  const bundleRef = useRef(null);
  const answersRef = useRef([]);
  const quizKnownRef = useRef([]);
  const marksRef = useRef([]);
  const matchOkRef = useRef([]);

  useEffect(() => onAIStatus(setStatus), []);
  useEffect(() => {
    if (!generating) return undefined;
    const iv = setInterval(() => setPhraseIdx((i) => i + 1), 1500);
    return () => clearInterval(iv);
  }, [generating]);

  useEffect(() => {
    const active = phase === "ready" && Boolean(bundle);
    setQuizActive(active);
    return () => setQuizActive(false);
  }, [phase, bundle]);

  const startBundle = (b, opts = {}) => {
    let next = b;
    noteIdsRef.current = opts.noteIds || noteIdsRef.current;
    if (opts.testId) testIdRef.current = opts.testId;
    if (opts.title) titleRef.current = opts.title;
    if (opts.subjectId) subjectIdRef.current = opts.subjectId;
    if (opts.noteText) noteTextRef.current = opts.noteText;

    let qs = next.questions || [];
    if (opts.weakTopics?.length) {
      const weak = new Set(opts.weakTopics);
      qs = qs.filter((q) => weak.has(q.topic));
      next = { ...next, questions: qs };
    }
    setBundle(next);
    bundleRef.current = next;
    if (!opts.draft) setResumed(false);

    if (qs.length) setSection("choice");
    else if (next.quizlet?.length) setSection("quizlet");
    else if (next.match?.length) setSection("match");
    else if (next.written) enterWritten();
    else {
      setPhase("new-test");
      return;
    }
    setQIndex(0);
    setQuizIdx(0);
    setPicked(null);
    setMultiPick([]);
    setFlash([]);
    setAnswers([]);
    answersRef.current = [];
    setFlipped(false);
    setQuizKnown([]);
    quizKnownRef.current = [];
    setWrittenAnswers([]);
    setWrittenResult(null);
    setMatchRound(0);
    setMatchLeftSel(null);
    setMatchRightSel(null);
    setMatchDone([]);
    setMatchTainted([]);
    setMatchWrong(null);
    matchOkRef.current = [];
    if (next.match?.length) {
      const first = next.match.slice(0, MATCH_ROUND);
      setMatchRightOrder(shuffleList(first.map((_, i) => i)));
    } else {
      setMatchRightOrder([]);
    }
    if (opts.draft) {
      const d = opts.draft;
      setSection(d.section || section);
      setQIndex(Math.min(d.qIndex || 0, Math.max(0, (next.questions || []).length - 1)));
      setQuizIdx(Math.min(d.quizIdx || 0, Math.max(0, (next.quizlet || []).length - 1)));
      answersRef.current = Array.isArray(d.answers) ? d.answers : [];
      setAnswers(answersRef.current);
      quizKnownRef.current = Array.isArray(d.quizKnown) ? d.quizKnown : [];
      setQuizKnown(quizKnownRef.current);
      setWrittenAnswers(Array.isArray(d.writtenAnswers) ? d.writtenAnswers : []);
      setWrittenResult(d.writtenResult || null);
      const marks = Array.isArray(d.writtenMarks) ? d.writtenMarks : [];
      marksRef.current = marks;
      setWrittenMarks(marks);
      matchOkRef.current = Array.isArray(d.matchOk) ? d.matchOk : [];
      setMatchRound(d.matchRound || 0);
      setMatchDone(Array.isArray(d.matchDone) ? d.matchDone : []);
      setMatchTainted(Array.isArray(d.matchTainted) ? d.matchTainted : []);
      setMatchWrong(d.matchWrong ?? null);
      if (Array.isArray(d.matchRightOrder) && d.matchRightOrder.length) setMatchRightOrder(d.matchRightOrder);
      setPicked(null);
      setMultiPick([]);
      setResumed(true);
    }
    setPhase("ready");
  };

  useEffect(() => {
    (async () => {
      try {
        if (testId) {
          const test = await getTest(testId);
          setSourceTest(test || null);
          const results = await listResults().catch(() => []);
          const latest = results.find((r) => r.test_id === testId);
          const b = loadTestBundle(test);
          if (!testHasContent(b)) {
            const ids = test?.note_ids || [];
            if (ids.length) {
              const notes = (await Promise.all(ids.map((id) => getNote(id).catch(() => null)))).filter(Boolean);
              pendingRef.current = {
                ids,
                notes,
                label: test?.title || notes[0]?.title || "Конспект",
                subjectId: test?.subject_id || notes[0]?.subject_id || null,
              };
              subjectIdRef.current = pendingRef.current.subjectId;
              setPhase("new-test");
            }
            return;
          }
          startBundle(b, {
            testId,
            noteIds: test?.note_ids || [],
            title: test?.title || "",
            subjectId: test?.subject_id || null,
            weakTopics: mode === "weak" ? latest?.weak_topics || null : null,
            draft: readDraft(testId, mode),
          });
          if (writtenQuestionsOf(b.written).length) {
            const noteIds = test?.note_ids || [];
            const notes = (await Promise.all(noteIds.map((id) => getNote(id).catch(() => null)))).filter(Boolean);
            noteTextRef.current = notes.map((n) => n.text || n.retelling || "").join("\n\n");
          }
        } else if (subjectId) {
          const [subject, subjNotes] = await Promise.all([getSubject(subjectId), listNotes(subjectId)]);
          const ids = subjNotes.map((n) => n.id);
          titleRef.current = subject?.name || "Конспект";
          subjectIdRef.current = subjectId;
          noteTextRef.current = subjNotes.map((n) => n.text || n.retelling || "").join("\n\n");
          if (!ids.length) return;
          pendingRef.current = { ids, notes: subjNotes, label: subject?.name || "Конспект", subjectId };
          const list = (await listTestsForNotes(ids).catch(() => []))
            .filter((t) => testHasContent(loadTestBundle(t)));
          setExistingTests(list);
          setPhase(list.length ? "pick-test" : "new-test");
        } else {
          const note = await getNote(noteId);
          titleRef.current = note?.title || "";
          subjectIdRef.current = note?.subject_id || null;
          noteTextRef.current = note?.text || note?.retelling || "";
          pendingRef.current = {
            ids: [noteId],
            notes: [note],
            label: note?.title || "Конспект",
            subjectId: note?.subject_id || null,
          };
          if (forceCreate) {
            setExistingTests([]);
            setPhase("new-test");
          } else {
            const list = (await listTestsForNotes([noteId]).catch(() => []))
              .filter((t) => testHasContent(loadTestBundle(t)));
            setExistingTests(list);
            setPhase(list.length ? "pick-test" : "no-test");
          }
        }
      } catch (e) {
        console.error("[quiz] load:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [noteId, testId, mode, subjectId, forceCreate]);

  useEffect(() => {
    if (!testId || phase !== "ready" || !bundle) return;
    writeDraft(testId, mode, {
      section,
      qIndex,
      quizIdx,
      quizKnown,
      writtenAnswers,
      writtenResult,
      writtenMarks,
      matchRound,
      matchDone,
      matchTainted,
      matchWrong,
      matchOk: matchOkRef.current,
      matchRightOrder,
      answers: answersRef.current,
    });
  }, [
    testId, mode, phase, bundle, section, qIndex, quizIdx, quizKnown,
    writtenAnswers, writtenResult, writtenMarks, matchRound, matchDone,
    matchTainted, matchWrong, matchRightOrder, answers,
  ]);

  const restartQuiz = () => {
    if (!testIdRef.current || !bundleRef.current) return;
    clearDraft(testIdRef.current, mode);
    startBundle(bundleRef.current, {
      testId: testIdRef.current,
      noteIds: noteIdsRef.current,
      title: titleRef.current,
      subjectId: subjectIdRef.current,
    });
  };

  const toggleMode = (id) => {
    setModes((prev) => {
      if (prev.includes(id)) return prev.length === 1 ? prev : prev.filter((m) => m !== id);
      return [...prev, id];
    });
  };

  const generate = async () => {
    if (generating) return;
    const pending = pendingRef.current;
    if (!pending?.ids?.length) { navigate("/"); return; }
    if (!modes.length) { alert("Выбери хотя бы один тип заданий"); return; }
    setGenerating(true);
    noteTextRef.current = (pending.notes || []).map((n) => n.text || n.retelling || "").join("\n\n");
    try {
      const gen = await generateTest(pending.ids, { modes, size });
      const b = normalizeTestPayload(gen, modes);
      if (!testHasContent(b)) throw new Error("Пустой тест");
      const saved = await saveTest({
        note_ids: pending.ids,
        type: "mixed",
        size,
        modes: b.modes,
        questions: b.questions,
        quizlet: b.quizlet,
        match: b.match,
        written: b.written,
        subject_id: pending.subjectId || subjectIdRef.current,
        title: pending.label,
      });
      if (!saved?.id) throw new Error("Не удалось сохранить тест");
      noteTextRef.current = (pending.notes || []).map((n) => n.text || n.retelling || "").join("\n\n");
      startBundle(b, {
        testId: saved.id,
        noteIds: pending.ids,
        title: pending.label,
        subjectId: pending.subjectId || subjectIdRef.current,
        noteText: noteTextRef.current,
      });
    } catch (err) {
      console.error("[quiz] generate:", err);
      alert(err?.message || "Не удалось сгенерировать тест");
    } finally {
      setGenerating(false);
    }
  };

  const finish = async (answersSnapshot, quizKnownSnapshot, writtenSnap, matchOkSnapshot) => {
    const qs = bundle?.questions || [];
    const choiceScore = answersSnapshot.filter((a) => a.correct).length;
    const choiceTotal = qs.length;
    const weak = [...new Set(answersSnapshot.filter((a) => !a.correct).map((a) => a.topic).filter(Boolean))];
    const matchPairs = bundle?.match || [];
    const matchOk = matchOkSnapshot || matchOkRef.current || [];
    const detail = {
      choice: answersSnapshot,
      quizlet: (bundle?.quizlet || []).map((c, i) => ({
        term: c.term, definition: c.definition, topic: c.topic, known: Boolean(quizKnownSnapshot[i]),
      })),
      match: matchPairs.map((p, i) => ({
        left: p.left,
        right: p.right,
        topic: p.topic,
        ok: matchOk.includes(i),
      })),
      written: writtenSnap,
    };
    const quizlet_total = bundle?.quizlet?.length || 0;
    const quizlet_score = quizKnownSnapshot.filter(Boolean).length;
    const match_total = matchPairs.length;
    const match_score = matchOk.filter((i) => i >= 0 && i < match_total).length;

    // Главный счёт: choice → quizlet → match → письменный
    let score = 0;
    let total = 0;
    if (choiceTotal > 0) {
      score = choiceScore;
      total = choiceTotal;
    } else if (quizlet_total > 0) {
      score = quizlet_score;
      total = quizlet_total;
    } else if (match_total > 0) {
      score = match_score;
      total = match_total;
    } else if (writtenSnap?.grade != null) {
      score = Number(writtenSnap.grade) || 0;
      total = 5;
    }

    if (!testIdRef.current) {
      alert("Тест не сохранён — результат не запишется.");
    } else {
      try {
        await saveTestResult({
          user_id: auth.currentUser?.uid,
          test_id: testIdRef.current,
          score,
          total,
          weak_topics: weak,
          detail,
          note_ids: noteIdsRef.current,
          title: titleRef.current,
          subject_id: subjectIdRef.current,
          quizlet_score: quizlet_total ? quizlet_score : null,
          quizlet_total: quizlet_total || null,
          match_score: match_total ? match_score : null,
          match_total: match_total || null,
          written_grade: writtenSnap?.grade ?? null,
          written_comment: writtenSnap?.comment || "",
        });
      } catch (err) {
        console.error("[quiz] save result:", err);
        alert("Не удалось сохранить результат: " + (err?.message || "ошибка"));
      }
    }

    if (testIdRef.current) clearDraft(testIdRef.current, mode);
    setQuizActive(false);
    navigate("/results", {
      state: {
        score,
        total,
        weak,
        detail,
        quizlet_score,
        quizlet_total,
        match_score,
        match_total,
        written: writtenSnap,
        subjectId: subjectIdRef.current,
        testId: testIdRef.current,
        title: titleRef.current,
        from: location.state?.from || (noteId ? `/note/${noteId}` : undefined),
      },
    });
  };

  const beginMatchRound = (roundIdx, pairs) => {
    const slice = pairs.slice(roundIdx * MATCH_ROUND, roundIdx * MATCH_ROUND + MATCH_ROUND);
    setMatchRound(roundIdx);
    setMatchDone([]);
    setMatchLeftSel(null);
    setMatchRightSel(null);
    setMatchWrong(null);
    setMatchRightOrder(shuffleList(slice.map((_, i) => i)));
  };

  function enterWritten() {
    setSection("written");
  }

  const goAfterQuizlet = (quizKnownSnapshot) => {
    if (bundle?.match?.length) {
      matchOkRef.current = [];
      setMatchTainted([]);
      beginMatchRound(0, bundle.match);
      setSection("match");
      return;
    }
    if (bundle?.written) {
      enterWritten();
      return;
    }
    finish(answersRef.current, quizKnownSnapshot, writtenResult);
  };

  const goAfterMatch = () => {
    if (bundle?.written) {
      enterWritten();
      return;
    }
    finish(answersRef.current, quizKnownRef.current, writtenResult, matchOkRef.current);
  };

  const advanceAfterChoice = (nextAnswers) => {
    if (qIndex + 1 < (bundle?.questions || []).length) {
      setQIndex(qIndex + 1);
      setPicked(null);
      setMultiPick([]);
      return;
    }
    if (bundle?.quizlet?.length) { setSection("quizlet"); setQuizIdx(0); setFlipped(false); return; }
    if (bundle?.match?.length) {
      matchOkRef.current = [];
      setMatchTainted([]);
      beginMatchRound(0, bundle.match);
      setSection("match");
      return;
    }
    if (bundle?.written) { enterWritten(); return; }
    finish(nextAnswers, quizKnownRef.current, writtenResult);
  };

  const pickSingle = (i) => {
    if (picked !== null) return;
    const q = bundle.questions[qIndex];
    setPicked(i);
    const correct = Number(q.correct) === i;
    if (correct) { setFlash([i]); sfx.correct(); } else sfx.wrong();
    const next = [...answersRef.current, {
      kind: "single", picked: [i], topic: q.topic, correct,
      explain: q.explain || "", q: q.q, options: q.options, correctIdx: q.correct,
    }];
    answersRef.current = next;
    setAnswers(next);
    if (!correct) return;
    setTimeout(() => setFlash([]), 420);
    setTimeout(() => advanceAfterChoice(next), q.explain?.trim() ? 1400 : 900);
  };

  const submitMulti = () => {
    if (picked !== null || multiPick.length === 0) return;
    const q = bundle.questions[qIndex];
    const correct = sameSet(multiPick, q.correct);
    setPicked(multiPick[0]);
    const correctSet = Array.isArray(q.correct) ? q.correct.map(Number) : [Number(q.correct)];
    if (correct) { setFlash(correctSet); sfx.correct(); } else sfx.wrong();
    const next = [...answersRef.current, {
      kind: "multi", picked: [...multiPick].sort((a, b) => a - b), topic: q.topic, correct,
      explain: q.explain || "", q: q.q, options: q.options, correctIdx: q.correct,
    }];
    answersRef.current = next;
    setAnswers(next);
    if (!correct) return;
    setTimeout(() => setFlash([]), 420);
    setTimeout(() => advanceAfterChoice(next), q.explain?.trim() ? 1400 : 900);
  };

  const markQuizlet = (known) => {
    const next = [...quizKnownRef.current, known];
    quizKnownRef.current = next;
    setQuizKnown(next);
    if (quizIdx + 1 < bundle.quizlet.length) {
      setQuizIdx(quizIdx + 1);
      setFlipped(false);
      return;
    }
    goAfterQuizlet(next);
  };

  const tryMatch = (side, localIdx) => {
    if (matchWrong) return;
    const pairs = bundle?.match || [];
    const slice = pairs.slice(matchRound * MATCH_ROUND, matchRound * MATCH_ROUND + MATCH_ROUND);
    const pairId = side === "left" ? localIdx : matchRightOrder[localIdx];
    if (matchDone.includes(pairId)) return;

    if (side === "left") {
      if (matchLeftSel === pairId) {
        setMatchLeftSel(null);
        return;
      }
      setMatchLeftSel(pairId);
      if (matchRightSel == null) return;
      resolveMatch(pairId, matchRightSel, slice);
      return;
    }

    if (matchRightSel === pairId) {
      setMatchRightSel(null);
      return;
    }
    setMatchRightSel(pairId);
    if (matchLeftSel == null) return;
    resolveMatch(matchLeftSel, pairId, slice);
  };

  const resolveMatch = (leftId, rightId, slice) => {
    if (leftId === rightId) {
      sfx.match();
      const globalId = matchRound * MATCH_ROUND + leftId;
      const clean = !matchTainted.includes(globalId);
      if (clean) matchOkRef.current = [...matchOkRef.current, globalId];
      const nextDone = [...matchDone, leftId];
      setMatchDone(nextDone);
      setMatchLeftSel(null);
      setMatchRightSel(null);
      if (nextDone.length >= slice.length) {
        const nextRound = matchRound + 1;
        const pairs = bundle.match || [];
        if (nextRound * MATCH_ROUND < pairs.length) {
          setTimeout(() => beginMatchRound(nextRound, pairs), 420);
        } else {
          setTimeout(() => goAfterMatch(), 420);
        }
      }
      return;
    }

    const globalLeft = matchRound * MATCH_ROUND + leftId;
    const globalRight = matchRound * MATCH_ROUND + rightId;
    sfx.wrong();
    setMatchTainted((prev) => [...new Set([...prev, globalLeft, globalRight])]);
    setMatchWrong({ left: leftId, right: rightId });
    setTimeout(() => {
      setMatchWrong(null);
      setMatchLeftSel(null);
      setMatchRightSel(null);
    }, 480);
  };

  const submitWritten = async () => {
    if (grading) return;
    const questions = writtenQuestionsOf(bundle.written);
    if (!questions.length) { finish(answersRef.current, quizKnownRef.current, null, matchOkRef.current); return; }
    if (questions.some((_, i) => !(writtenAnswers[i] || "").trim())) {
      alert("Заполни все письменные ответы или пропусти задание");
      return;
    }
    setGrading(true);
    setWrittenMarks([]);
    marksRef.current = [];
    try {
      const answers = questions.map((_, i) => (writtenAnswers[i] || "").trim());
      // Один запрос на всю пачку: 1 слот квоты вместо N, разбор всё равно стримится по заданиям.
      await gradeWritten(noteTextRef.current || titleRef.current, questions.map((q) => q.prompt), answers, (partial) => {
        marksRef.current = parseWrittenBatch(partial);
        setWrittenMarks(marksRef.current);
      });
      const results = questions.map((q, i) => {
        const got = marksRef.current[i] || {};
        return {
          prompt: q.prompt,
          answer: answers[i],
          grade: got.grade || 2,
          comment: got.comment || "",
          marks: got.marks || [],
          whys: got.whys || [],
        };
      });
      setGrading(false);
      const grade = Math.round((results.reduce((a, r) => a + r.grade, 0) / results.length) * 10) / 10;
      const wr = {
        questions: results,
        grade,
        comment: results.map((r, i) => `${i + 1}. ${r.comment || "—"}`).join(" "),
      };
      setWrittenResult(wr);
      setTimeout(() => finish(answersRef.current, quizKnownRef.current, wr, matchOkRef.current), 2600);
    } catch (err) {
      setGrading(false);
      alert(err?.message || "Не удалось проверить ответ");
    }
  };

  if (showGhost) return <GhostQuiz />;

  if (phase === "no-test") {
    const pending = pendingRef.current || { label: "Конспект", subjectId: subjectIdRef.current };
    return (
      <div style={{ paddingTop: 24 }}>
        <div style={{ color: t.text, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Теста пока нет
        </div>
        <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
          Создай тест во вкладке «Тесты» предмета: выбери конспект и типы заданий.
        </div>
        <Button
          variant="primary"
          onClick={() => {
            if (pending.subjectId) navigate(`/subject/${pending.subjectId}`, { state: { tab: "tests" } });
            else navigate(-1);
          }}
          style={{ width: "100%" }}
        >
          К тестам
        </Button>
      </div>
    );
  }

  if (phase === "pick-test") {
    const pending = pendingRef.current || { label: "Конспект" };
    const openExisting = (test) => {
      const b = loadTestBundle(test);
      startBundle(b, {
        testId: test.id,
        noteIds: pending.ids || noteIdsRef.current,
        title: test.title || pending.label,
        subjectId: pending.subjectId || subjectIdRef.current,
        noteText: noteTextRef.current,
      });
    };
    const fmtDate = (ts) => {
      try {
        const d = ts?.toDate?.() || (ts ? new Date(ts) : null);
        if (!d || Number.isNaN(d.getTime())) return "";
        return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
      } catch {
        return "";
      }
    };
    return (
      <div style={{ paddingTop: 8 }}>
        <div style={{ color: t.text, fontSize: 21, fontWeight: 600, lineHeight: 1.35, marginBottom: 8 }}>
          Тест по «{pending.label}»
        </div>
        <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
          Выбери существующий тест или создай новый.
        </div>
        <div style={{ marginBottom: 16 }}>
          {existingTests.map((test) => {
            const b = loadTestBundle(test);
            const nQ = b.questions?.length || 0;
            const nQuiz = b.quizlet?.length || 0;
            const nMatch = b.match?.length || 0;
            const hasW = writtenQuestionsOf(b.written).length > 0;
            const bits = [];
            if (nQ) bits.push(`${nQ} вопр.`);
            if (nQuiz) bits.push(`${nQuiz} карт.`);
            if (nMatch) bits.push(`${nMatch} пар`);
            if (hasW) bits.push("письм.");
            const date = fmtDate(test.created_at);
            return (
              <button
                key={test.id}
                type="button"
                className="rowpress"
                onClick={() => openExisting(test)}
                style={{
                  width: "100%",
                  display: "block",
                  padding: "14px 16px",
                  marginBottom: 8,
                  borderRadius: 16,
                  border: `1px solid ${t.border}`,
                  background: t.surface,
                  color: t.text,
                  fontSize: 15,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {test.title || pending.label || "Тест"}
                </div>
                <div style={{ color: t.sub, fontSize: 13 }}>
                  {[date, bits.join(" · ")].filter(Boolean).join(" · ")}
                </div>
              </button>
            );
          })}
        </div>
        <Button variant="primary" onClick={() => setPhase("new-test")} style={{ width: "100%" }}>
          Новый тест
        </Button>
        {existingTests.length > 0 && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              width: "100%",
              marginTop: 10,
              padding: 12,
              border: "none",
              background: "transparent",
              color: t.sub,
              fontSize: 14,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Назад
          </button>
        )}
      </div>
    );
  }

  if (phase === "new-test") {
    const pending = pendingRef.current || { label: "Конспект" };
    return (
      <div style={{ paddingTop: 8 }}>
        <div style={{ color: t.text, fontSize: 21, fontWeight: 600, lineHeight: 1.35, marginBottom: 8 }}>
          Тест по «{pending.label}»
        </div>
        <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
          Выбери, что включить. Генерация — 1 запрос к ИИ. Сегодня: {aiUsedToday()}/{AI_DAILY_LIMIT}.
        </div>
        <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Что включить</div>
        <div style={{ marginBottom: 20 }}>
          {MODE_OPTS.map((opt) => {
            const on = modes.includes(opt.id);
            return (
              <button key={opt.id} type="button" className="rowpress" onClick={() => toggleMode(opt.id)}
                style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", marginBottom: 8, borderRadius: 16, border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: 15, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, border: on ? "none" : `1.5px solid ${t.border}`, background: on ? t.invBg : "transparent", color: t.inv, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{opt.label}</span>
                  <span style={{ color: t.sub, fontSize: 13, lineHeight: 1.35 }}>{opt.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Сколько вопросов</div>
        <SizeSlider
          options={Object.entries(TEST_SIZES).map(([id, s]) => ({ id, label: s.label, hint: s.hint }))}
          value={size}
          onChange={setSize}
          t={t}
        />
        <Button variant="primary" onClick={generate} disabled={generating || !modes.length} style={{ width: "100%" }}>
          {generating ? "Генерирую…" : "Сгенерировать тест"}
        </Button>
        {existingTests.length > 0 && !generating && (
          <button
            type="button"
            onClick={() => setPhase("pick-test")}
            style={{
              width: "100%",
              marginTop: 10,
              padding: 12,
              border: "none",
              background: "transparent",
              color: t.sub,
              fontSize: 14,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            К списку тестов
          </button>
        )}
        {generating && createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 400, background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 28px", textAlign: "center" }}>
            <div style={{ width: 28, height: 28, borderRadius: 999, border: `2.5px solid ${t.border}`, borderTopColor: t.invBg, animation: "spin 800ms linear infinite" }} />
            <div style={{ color: t.text, fontSize: 17, fontWeight: 600 }}>Генерируем тест…</div>
            <div key={status || GEN_PHRASES[phraseIdx % GEN_PHRASES.length]} style={{ color: status ? "#F5A623" : t.sub, fontSize: 13, minHeight: 18 }}>
              {status || GEN_PHRASES[phraseIdx % GEN_PHRASES.length]}
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  if (!bundle) { navigate("/"); return null; }

  const isForeign = Boolean(
    sourceTest?.owner_id && sourceTest.owner_id !== auth.currentUser?.uid
  );

  const openSaveTest = async () => {
    try {
      const list = await listSubjects();
      setSubjects(list);
      setSaveOpen(true);
    } catch (e) {
      alert(e?.message || "Не удалось загрузить предметы");
    }
  };

  const pickSubjectForTest = async (subject) => {
    if (saving || !sourceTest) return;
    setSaving(true);
    try {
      const ref = await copyTestToSubject(sourceTest, subject.id);
      setSaveOpen(false);
      navigate(`/test/${ref.id}/quiz/full`, { replace: true });
      alert(`Тест сохранён в «${subject.name}».`, { title: "Готово" });
    } catch (e) {
      alert(e?.message || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const saveBar = isForeign ? (
    <Button variant="dashed" onClick={openSaveTest} disabled={saving} style={{ marginBottom: 14 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <BookmarkPlus size={16} />
        {saving ? "Сохраняю…" : "Сохранить тест к себе"}
      </span>
    </Button>
  ) : null;

  const authorBar = isForeign && sourceTest?.author_name ? (
    <AuthorBar
      name={sourceTest.author_name}
      photoUrl={sourceTest.author_photo_url}
      uid={sourceTest.author_uid}
      label="автор теста"
      from={testId ? `/test/${testId}/quiz/full` : undefined}
      t={t}
      navigate={navigate}
    />
  ) : null;

  const saveModal = (
    <SaveToSubjectModal
      open={saveOpen}
      onClose={() => !saving && setSaveOpen(false)}
      onPick={pickSubjectForTest}
      subjects={subjects}
      busy={saving}
      hint="Тест появится в выбранном предмете — только у тебя."
    />
  );

  const progressSegments = (() => {
    const segs = [];
    const nQ = bundle.questions?.length || 0;
    const nQuiz = bundle.quizlet?.length || 0;
    const nMatch = bundle.match?.length || 0;
    const hasW = writtenQuestionsOf(bundle.written).length > 0;

    if (nQ) {
      if (section === "choice") segs.push((qIndex + (picked !== null ? 1 : 0)) / nQ);
      else segs.push(1);
    }
    if (nQuiz) {
      if (section === "choice") segs.push(0);
      else if (section === "quizlet") segs.push((quizIdx + 0.25) / nQuiz);
      else segs.push(1);
    }
    if (nMatch) {
      const rounds = Math.max(1, Math.ceil(nMatch / MATCH_ROUND));
      if (section === "choice" || section === "quizlet") segs.push(0);
      else if (section === "match") {
        segs.push(Math.min(1, (matchRound + matchDone.length / Math.max(1, MATCH_ROUND)) / rounds));
      } else segs.push(1);
    }
    if (hasW) {
      if (section === "written") segs.push(writtenResult ? 1 : 0.15);
      else segs.push(0);
    }
    return segs;
  })();

  const resumeBar = resumed ? (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ color: t.sub, fontSize: 12 }}>Продолжаем с того места</span>
      <button
        type="button"
        className="press"
        onClick={restartQuiz}
        style={{
          border: "none",
          background: "none",
          color: t.sub,
          fontSize: 12,
          fontFamily: "inherit",
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Начать заново
      </button>
    </div>
  ) : null;

  if (section === "choice") {
    const q = bundle.questions[qIndex];
    if (!q) { navigate("/"); return null; }
    const isMulti = q.kind === "multi";
    const showState = picked !== null;
    const lastCorrect = answers[answers.length - 1]?.correct;
    return (
      <div>
        {authorBar}
        {saveBar}
        <ProgressBar segments={progressSegments} />
        {resumeBar}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ color: t.sub, fontSize: 13 }}>
            Вопрос {qIndex + 1} из {bundle.questions.length}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: isMulti ? t.inv : t.sub,
              background: isMulti ? t.invBg : "transparent",
              border: isMulti ? "none" : `1px solid ${t.border}`,
              padding: "5px 10px",
              borderRadius: 999,
              flexShrink: 0,
            }}
          >
            {isMulti ? "Несколько верных" : "Один ответ"}
          </div>
        </div>
        <div style={{ color: t.text, fontSize: 20, fontWeight: 600, lineHeight: 1.5, marginBottom: 8 }}>
          <MathText text={q.q} />
        </div>
        <div style={{ color: t.sub, fontSize: 13, marginBottom: 18 }}>
          {isMulti ? "Отметь все подходящие варианты, затем нажми «Ответить»." : "Выбери ответ — при верном сразу перейдёшь дальше."}
        </div>
        {q.options.map((opt, i) => {
          const selected = isMulti ? multiPick.includes(i) : picked === i;
          const correctSet = Array.isArray(q.correct) ? q.correct.map(Number) : [Number(q.correct)];
          const isCorrect = correctSet.includes(i);
          const flashing = flash.includes(i);
          const missed = isMulti && showState && isCorrect && !selected;
          let bg = t.surface, border = t.border, color = t.text, checkC = t.text, xC = t.text;
          if (flashing) { bg = t.success; border = t.success; color = "#fff"; checkC = "#fff"; }
          else if (missed) { bg = "rgba(245,166,35,0.12)"; border = "#F5A623"; checkC = "#F5A623"; }
          else if (showState && isCorrect) { bg = t.successTint; border = t.success; checkC = t.success; }
          else if (showState && selected && !isCorrect) { border = t.danger; xC = t.danger; }
          else if (!showState && selected) { border = t.invBg; }
          return (
            <button key={i} type="button" className="press"
              onClick={() => {
                if (showState) return;
                if (isMulti) setMultiPick((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
                else pickSingle(i);
              }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", marginBottom: 10, borderRadius: 14, border: `1px solid ${border}`, background: bg, color, fontSize: 14, fontFamily: "inherit", cursor: showState ? "default" : "pointer", textAlign: "left", transition: `transform 180ms ${EASE}, opacity 180ms ease, background 200ms ease, border-color 200ms ease, color 200ms ease` }}>
              {isMulti && (
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    border: flashing || (showState && isCorrect && selected) || (!showState && selected)
                      ? "none"
                      : showState && isCorrect
                        ? `1.5px solid #F5A623`
                        : `1.5px solid ${showState ? t.sub : t.border}`,
                    background: flashing ? "#fff" : missed ? "transparent" : showState && isCorrect ? t.success : !showState && selected ? t.invBg : "transparent",
                    color: flashing ? t.success : showState && isCorrect && !selected ? "#F5A623" : showState && isCorrect ? "#fff" : t.inv,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {flashing || (!showState && selected) ? (
                    <Check size={13} strokeWidth={3} />
                  ) : showState && isCorrect ? (
                    selected ? <Check size={13} strokeWidth={3} /> : <Minus size={13} strokeWidth={3} />
                  ) : null}
                </span>
              )}
              <span style={{ flex: 1, lineHeight: 1.45 }}>
                <MathText as="span" text={opt} style={{ fontSize: 14 }} />
              </span>
              {!isMulti && showState && isCorrect && <Check size={16} color={checkC} />}
              {!isMulti && showState && selected && !isCorrect && <X size={16} color={xC} />}
              {isMulti && showState && selected && !isCorrect && <X size={16} color={xC} />}
              {isMulti && missed && <Minus size={16} color="#F5A623" />}
            </button>
          );
        })}
        {isMulti && !showState && (
          <Button onClick={submitMulti} disabled={multiPick.length === 0} style={{ marginTop: 8 }}>Ответить</Button>
        )}
        {showState && !lastCorrect && (
          <Button onClick={() => advanceAfterChoice(answersRef.current)} style={{ marginTop: 8, width: "100%" }}>
            Дальше
          </Button>
        )}
        {showState && q.explain?.trim() && (
          <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.45, marginTop: 8 }}>
            <MathText as="span" text={q.explain.trim()} style={{ fontSize: 13 }} />
          </div>
        )}
        {saveModal}
      </div>
    );
  }

  if (section === "quizlet") {
    const card = bundle.quizlet[quizIdx];
    if (!card) return <GhostQuiz />;
    return (
      <div>
        {authorBar}
        {saveBar}
        <ProgressBar segments={progressSegments} />
        {resumeBar}
        <div style={{ color: t.sub, fontSize: 13, marginBottom: 12 }}>Квизлет {quizIdx + 1} из {bundle.quizlet.length}</div>
        <div className="quizlet-scene">
          <div
            role="button"
            tabIndex={0}
            className={`quizlet-card${flipped ? " is-flipped" : ""}`}
            onClick={() => { setFlipped((f) => !f); sfx.flip(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setFlipped((f) => !f);
                sfx.flip();
              }
            }}
          >
            <div
              className="quizlet-face front"
              style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }}
            >
              <div style={{ fontSize: 22, fontWeight: 700 }}><MathText text={card.term} /></div>
              <div style={{ color: t.sub, fontSize: 12, fontWeight: 500, marginTop: 14 }}>
                Термин · нажми, чтобы перевернуть
              </div>
            </div>
            <div
              className="quizlet-face back"
              style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text }}
            >
              <div style={{ fontSize: 16, fontWeight: 500 }}><MathText text={card.definition} /></div>
              <div style={{ color: t.sub, fontSize: 12, fontWeight: 500, marginTop: 14 }}>
                Определение
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="dashed" onClick={() => markQuizlet(false)} style={{ flex: 1 }}>Не знаю</Button>
          <Button onClick={() => markQuizlet(true)} style={{ flex: 1 }}>Знаю</Button>
        </div>
        {saveModal}
      </div>
    );
  }

  if (section === "match") {
    const pairs = bundle.match || [];
    const slice = pairs.slice(matchRound * MATCH_ROUND, matchRound * MATCH_ROUND + MATCH_ROUND);
    const totalRounds = Math.max(1, Math.ceil(pairs.length / MATCH_ROUND));
    const cellStyle = (state) => {
      // state: idle | selected | done | wrong
      let bg = t.surface;
      let border = t.border;
      let color = t.text;
      let opacity = 1;
      if (state === "selected") border = t.invBg;
      if (state === "done") {
        bg = t.successTint;
        color = t.text;
        border = t.success;
        opacity = 0.62;
      }
      if (state === "wrong") {
        border = t.danger;
        color = t.danger;
      }
      return {
        width: "100%",
        minHeight: 52,
        padding: "12px 10px",
        marginBottom: 8,
        borderRadius: 14,
        border: `1.5px solid ${border}`,
        background: bg,
        color,
        opacity,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "inherit",
        lineHeight: 1.35,
        textAlign: "center",
        cursor: state === "done" ? "default" : "pointer",
        transition: `transform 180ms ${EASE}, border-color 160ms ease, background 160ms ease, opacity 280ms ease`,
      };
    };

    return (
      <div>
        {authorBar}
        {saveBar}
        <ProgressBar segments={progressSegments} />
        {resumeBar}
        <div style={{ color: t.sub, fontSize: 13, marginBottom: 8 }}>
          Сопоставь · раунд {matchRound + 1} из {totalRounds}
        </div>
        <div style={{ color: t.text, fontSize: 15, fontWeight: 600, marginBottom: 16, lineHeight: 1.4 }}>
          Соедини связанные пары
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            {slice.map((p, i) => {
              const done = matchDone.includes(i);
              const wrong = matchWrong?.left === i;
              const selected = matchLeftSel === i;
              const state = done ? "done" : wrong ? "wrong" : selected ? "selected" : "idle";
              return (
                <button
                  key={`L-${matchRound}-${i}`}
                  type="button"
                  className="press"
                  disabled={done || Boolean(matchWrong)}
                  onClick={() => tryMatch("left", i)}
                  style={cellStyle(state)}
                >
                  <MathText text={p.left} style={{ fontSize: 13 }} />
                </button>
              );
            })}
          </div>
          <div>
            {matchRightOrder.map((pairId, row) => {
              const p = slice[pairId];
              if (!p) return null;
              const done = matchDone.includes(pairId);
              const wrong = matchWrong?.right === pairId;
              const selected = matchRightSel === pairId;
              const state = done ? "done" : wrong ? "wrong" : selected ? "selected" : "idle";
              return (
                <button
                  key={`R-${matchRound}-${pairId}`}
                  type="button"
                  className="press"
                  disabled={done || Boolean(matchWrong)}
                  onClick={() => tryMatch("right", row)}
                  style={cellStyle(state)}
                >
                  <MathText text={p.right} style={{ fontSize: 13 }} />
                </button>
              );
            })}
          </div>
        </div>
        {saveModal}
      </div>
    );
  }

  if (section === "written") {
    const questions = writtenQuestionsOf(bundle.written);
    return (
      <div>
        {authorBar}
        {saveBar}
        <ProgressBar segments={progressSegments} />
        {resumeBar}
        <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          Письменный ответ{questions.length > 1 ? ` · ${questions.length}` : ""}
        </div>
        {!writtenResult ? (
          <>
            {questions.map((q, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 16, border: `1px solid ${t.border}`, background: t.surface, marginBottom: 12 }}>
                <div style={{ color: t.text, fontSize: 16, fontWeight: 600, lineHeight: 1.5, marginBottom: 10 }}>
                  <MathText text={q.prompt} />
                </div>
                {grading ? (
                  <>
                    <MarkedAnswer text={writtenAnswers[i]} marks={writtenMarks[i]?.marks} whys={writtenMarks[i]?.whys} live />
                    <div style={{ color: t.sub, fontSize: 12, marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="mark-spin" style={{ width: 11, height: 11, borderRadius: 999, border: `1.5px solid ${t.border}`, borderTopColor: t.text }} />
                      ИИ проверяет по конспекту…
                    </div>
                  </>
                ) : (
                  <textarea value={writtenAnswers[i] || ""} onChange={(e) => {
                    const next = [...writtenAnswers];
                    next[i] = e.target.value;
                    setWrittenAnswers(next);
                  }} placeholder="Коротко, максимум 4 слова…" rows={2}
                    style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 14, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 14.5, fontFamily: "inherit", lineHeight: 1.45, resize: "vertical" }} />
                )}
              </div>
            ))}
            <Button onClick={submitWritten} disabled={grading || questions.some((_, i) => !(writtenAnswers[i] || "").trim())}>
              {grading ? "Проверяю…" : "Проверить"}
            </Button>
            <button type="button" onClick={() => finish(answersRef.current, quizKnownRef.current, null, matchOkRef.current)}
              style={{ display: "block", width: "100%", marginTop: 10, border: "none", background: "transparent", color: t.sub, fontSize: 14, fontFamily: "inherit", cursor: "pointer", padding: 10 }}>
              Пропустить
            </button>
          </>
        ) : (
          <div style={{ padding: 16, borderRadius: 16, border: `1px solid ${t.border}`, background: t.surface }}>
            <div style={{ color: t.text, fontSize: 28, fontWeight: 700, marginBottom: 14 }}>{writtenResult.grade}/5</div>
            {(writtenResult.questions || []).map((r, i) => (
              <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < writtenResult.questions.length - 1 ? `1px solid ${t.border}` : "none" }}>
                <div style={{ color: t.text, fontSize: 14, fontWeight: 600, marginBottom: 6 }}><MathText text={r.prompt} /></div>
                <MarkedAnswer text={r.answer} marks={r.marks} whys={r.whys} style={{ marginBottom: 8 }} />
                <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.45 }}>{r.grade}/5 · {r.comment || "—"}</div>
              </div>
            ))}
          </div>
        )}
        {saveModal}
      </div>
    );
  }

  return null;
}
