import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import ProgressBar from "../components/ProgressBar";
import Button from "../components/Button";
import { Stat, TRAINER_LIST } from "./StressTrainer";
import { sfx } from "../sfx";
import { setQuizActive } from "../nav";
import { PARONYMS } from "../data/paronyms";

const PARONYM_ITEMS = PARONYMS.map((x) => ({
  ...x,
  answer: x.answer.toLowerCase(),
  options: x.options.map((o) => o.toLowerCase()),
}));
const TOTAL = PARONYM_ITEMS.length;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ParonymsTrainer() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { slug } = useParams();
  const trainer = TRAINER_LIST.find((x) => x.id === slug);
  const queueRef = useRef([]);
  const optsRef = useRef([]);
  const masteredRef = useRef(new Set());
  const errorRef = useRef({});
  const [current, setCurrent] = useState(null);
  const [locked, setLocked] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [mastered, setMastered] = useState(0);
  const [streak, setStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setQuizActive(!done);
    return () => setQuizActive(false);
  }, [done]);

  const next = () => {
    const q = queueRef.current;
    setLocked(false);
    setVerdict(null);
    if (q.length === 0) {
      setCurrent(null);
      setDone(true);
      return;
    }
    const item = q.shift();
    optsRef.current = shuffle(item.options);
    setCurrent(item);
  };

  const start = () => {
    queueRef.current = shuffle(PARONYM_ITEMS);
    masteredRef.current = new Set();
    errorRef.current = {};
    setMastered(0);
    setStreak(0);
    setMistakes(0);
    setDone(false);
    next();
  };

  useEffect(() => {
    if (!current && !done) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answer = (opt) => {
    if (locked || done || !current) return;
    setLocked(true);
    const correct = opt === current.answer;
    if (correct) {
      sfx.correct();
      setStreak((s) => s + 1);
      masteredRef.current.add(current.answer);
      setMastered(masteredRef.current.size);
    } else {
      sfx.wrong();
      setStreak(0);
      setMistakes((m) => m + 1);
      errorRef.current[current.answer] = (errorRef.current[current.answer] || 0) + 1;
      const q = queueRef.current;
      for (let n = 0; n < 2; n++) {
        const copy = { ...current };
        const pos = Math.min(q.length, Math.floor(Math.random() * (Math.min(8, q.length) + 1)));
        q.splice(pos, 0, copy);
      }
    }
    setVerdict({ correct, pickedOpt: opt });
  };

  if (!current && !done) return null;

  const remaining = queueRef.current.length;
  const progress = done ? 1 : Math.min(1, Math.max(0, 1 - remaining / TOTAL));

  const options = optsRef.current;

  const optionStyle = (opt) => {
    const isAnswer = current.answer === opt;
    if (verdict && isAnswer) {
      return { border: "#46A758", background: "rgba(70,167,88,0.14)", color: "#46A758" };
    }
    if (verdict && verdict.pickedOpt === opt) {
      return { border: "#E5484D", background: "rgba(229,72,77,0.10)", color: "#E5484D" };
    }
    return { border: t.border, background: t.raised, color: t.text };
  };

  const [before, after] = current.context.split("___");

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Stat label="Серия" value={streak} tint="#46A758" />
        <Stat label="Осталось" value={remaining} />
        <Stat label="Ошибки" value={mistakes} tint="#E5484D" />
      </div>
      <ProgressBar value={progress} />

      {done ? (
        <div style={{ paddingTop: 12 }}>
          <div style={{ color: t.sub, fontSize: 13, marginBottom: 6 }}>Итог тренажёра</div>
          {mistakes === 0 ? (
            <div style={{ color: "#46A758", fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Без ошибок — отлично!</div>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
              <div style={{ color: t.text, fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em" }}>
                {mastered}/{TOTAL}
              </div>
              <div style={{ color: t.sub, fontSize: 15 }}>слов освоено</div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <Stat label="Ошибки" value={mistakes} tint="#E5484D" />
            <Stat label="Освоено слов" value={mastered} tint="#46A758" />
          </div>

          {Object.keys(errorRef.current).length > 0 ? (
            <>
              <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Стоит повторить</div>
              {Object.entries(errorRef.current).map(([word, n]) => (
                <div
                  key={word}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 0",
                    borderBottom: `1px solid ${t.border}`,
                  }}
                >
                  <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>{word}</div>
                  <div style={{ fontSize: 12, color: t.sub, border: `1px solid ${t.border}`, padding: "5px 10px", borderRadius: 999 }}>
                    {n} ошиб.
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>Все паронимы усвоены уверенно.</div>
          )}

          <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 10 }}>
            {trainer?.egeSubject && (
              <Button variant="dashed" onClick={() => navigate(`/ege/${trainer.egeSubject}`)}>
                Вернуться к ЕГЭ
              </Button>
            )}
            <Button onClick={start}>Ещё раз</Button>
          </div>
        </div>
      ) : (
        <div style={{ padding: "32px 20px", borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, textAlign: "center" }}>
          {!verdict && (
            <div style={{ color: t.sub, fontSize: 13, marginBottom: 18 }}>
              Выбери подходящее слово
            </div>
          )}
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.35, minHeight: 64, color: t.text }}>
            {before}
            <span style={{ borderBottom: `2.5px solid ${t.invBg}`, padding: "0 10px" }}>{"\u00A0\u00A0\u00A0\u00A0\u00A0"}</span>
            {after}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
            {options.map((opt) => {
              const s = optionStyle(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  className={verdict ? undefined : "press"}
                  onClick={() => answer(opt)}
                  disabled={locked}
                  style={{
                    padding: "14px 12px",
                    minHeight: 54,
                    borderRadius: 14,
                    border: `1px solid ${s.border}`,
                    background: s.background,
                    color: s.color,
                    fontSize: 17,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: verdict ? "default" : "pointer",
                    transition: "background .15s, color .15s, border-color .15s",
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {verdict && (
            <div className="swap">
              <div
                style={{
                  color: verdict.correct ? "#46A758" : "#E5484D",
                  fontSize: 15,
                  fontWeight: 700,
                  marginTop: 14,
                }}
              >
                {verdict.correct ? "Верно." : `Ошибка. Правильно: ${current.answer}.`}
              </div>
              <div style={{ color: t.text, fontSize: 13, lineHeight: 1.55, marginTop: 8, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
                {current.why}
              </div>
              {!verdict.correct && (
                <div style={{ color: t.sub, fontSize: 12, marginTop: 6 }}>
                  Слово вернётся ещё дважды.
                </div>
              )}
              <div style={{ marginTop: 16 }}>
                <Button onClick={next}>Далее</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}