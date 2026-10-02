import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { shuffle } from "../utils";
import ProgressBar from "../components/ProgressBar";
import TrainerDone from "../components/TrainerDone";
import Button from "../components/Button";
import Segmented from "../components/Segmented";
import { Stat, TRAINER_LIST } from "./StressTrainer";
import { sfx } from "../sfx";
import { setQuizActive } from "../nav";
import { PREPRI_ITEMS, PREPRI_THEORY } from "../data/prepri";

const TOTAL = PREPRI_ITEMS.length;

export default function PrePriTrainer() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { slug } = useParams();
  const trainer = TRAINER_LIST.find((x) => x.id === slug);
  const queueRef = useRef([]);
  const wrongRef = useRef(new Set());
  const inputRef = useRef(null);
  const [tab, setTab] = useState("theory");
  const [current, setCurrent] = useState(null);
  const [input, setInput] = useState("");
  const [locked, setLocked] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setQuizActive(tab === "train" && !done);
    return () => setQuizActive(false);
  }, [tab, done]);

  const focus = () => inputRef.current?.focus();

  const next = () => {
    const q = queueRef.current;
    setLocked(false);
    setVerdict(null);
    setInput("");
    if (q.length === 0) {
      setCurrent(null);
      setDone(true);
      return;
    }
    setCurrent(q.shift());
    focus();
  };

  const start = () => {
    queueRef.current = shuffle(PREPRI_ITEMS);
    wrongRef.current = new Set();
    setStreak(0);
    setBestStreak(0);
    setMistakes(0);
    setDone(false);
    next();
  };

  useEffect(() => {
    if (!current && !done) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (current && !done) focus();
  }, [current, done]);

  const submit = (value) => {
    if (locked || done || !current) return;
    const v = (value ?? input).toLowerCase();
    if (!/^[а-яё]{3}$/.test(v)) return;
    setLocked(true);
    const correct = v === current.answer;
    if (correct) {
      sfx.correct();
      setStreak((s) => s + 1);
      setBestStreak((b) => Math.max(b, streak + 1));
    } else {
      sfx.wrong();
      setStreak(0);
      setMistakes((m) => m + 1);
      wrongRef.current.add(current.text.replace("•", current.answer));
      const q = queueRef.current;
      for (let n = 0; n < 2; n++) {
        const copy = { ...current };
        const pos = Math.min(q.length, Math.floor(Math.random() * (Math.min(8, q.length) + 1)));
        q.splice(pos, 0, copy);
      }
    }
    setVerdict({ correct });
    focus();
  };

  const onKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (verdict) next();
      else submit();
    }
  };

  if (!current && !done) return null;

  const remaining = queueRef.current.length;
  const progress = done ? 1 : Math.min(1, Math.max(0, 1 - remaining / TOTAL));

  const [before, after] = current ? current.text.split("•") : ["", ""];

  const renderTop = () => (
    <Segmented
      value={tab}
      onChange={setTab}
      options={[
        { v: "theory", label: "Теория" },
        { v: "train", label: "Тренажёр" },
      ]}
    />
  );

  if (tab === "theory") {
    return (
      <div style={{ paddingTop: 4 }}>
        {renderTop()}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {PREPRI_THEORY.map((g) => (
            <div key={g.title} style={{ borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, padding: "18px 18px 14px" }}>
              <div style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{g.title}</div>
              <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{g.desc}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {g.words.map((w) => (
                  <span key={w} style={{ fontSize: 13, fontWeight: 600, color: t.text, border: `1px solid ${t.border}`, background: t.raised, padding: "5px 12px", borderRadius: 999 }}>
                    {w}
                  </span>
                ))}
              </div>
              {g.rows?.length > 0 && (
                <div style={{ marginTop: 4, border: `1px solid ${t.border}`, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: t.raised }}>
                    <div style={{ padding: "9px 12px", color: t.sub, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em" }}>ПРЕ-</div>
                    <div style={{ padding: "9px 12px", color: t.sub, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", borderLeft: `1px solid ${t.border}` }}>ПРИ-</div>
                  </div>
                  {g.rows.map((row) => (
                    <div key={row.pre} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: `1px solid ${t.border}` }}>
                      <div style={{ padding: "9px 12px" }}>
                        <div style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>{row.pre}</div>
                        <div style={{ color: t.sub, fontSize: 12, lineHeight: 1.4, marginTop: 2 }}>{row.preNote}</div>
                      </div>
                      <div style={{ padding: "9px 12px", borderLeft: `1px solid ${t.border}` }}>
                        <div style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>{row.pri}</div>
                        <div style={{ color: t.sub, fontSize: 12, lineHeight: 1.4, marginTop: 2 }}>{row.priNote}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {g.exceptions?.length > 0 && (
                <div style={{ marginTop: 12, padding: "11px 12px", borderRadius: 14, border: `1px solid ${t.danger}`, background: t.dangerTint }}>
                  <div style={{ color: t.danger, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", marginBottom: 8, textTransform: "uppercase" }}>
                    Исключения
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {g.exceptions.map((w) => (
                      <span key={w} style={{ fontSize: 13, fontWeight: 700, color: t.text, border: `1px solid ${t.danger}`, background: t.surface, padding: "4px 10px", borderRadius: 999 }}>
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div style={{ borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, padding: "18px 18px 14px" }}>
            <div style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Главное правило</div>
            <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.5 }}>
              ПРИ- — приближение, присоединение, неполнота, близость. ПРЕ- — очень или пере-. Сначала определи значение, потом пиши приставку.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 4 }}>
      {renderTop()}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, marginTop: 12 }}>
        <Stat label="Серия" value={streak} tint={t.success} />
        <Stat label="Осталось" value={remaining} />
        <Stat label="Ошибки" value={mistakes} tint={t.danger} />
      </div>
      <ProgressBar value={progress} />

      {done ? (
        <TrainerDone
          mistakes={mistakes}
          total={TOTAL}
          secondLabel="Лучшая серия"
          secondValue={bestStreak}
          scoreLabel="слов пройдено"
          wrongItems={[...wrongRef.current].map((w) => ({ key: w, label: w, badge: "повторить" }))}
          emptyMsg="Все слова усвоены уверенно."
          onRetry={start}
          onBack={trainer?.egeSubject ? () => navigate(`/ege/${trainer.egeSubject}`) : null}
          backLabel="Вернуться к ЕГЭ"
        />
      ) : (
        <div style={{ padding: "32px 20px", borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, textAlign: "center" }}>
          {!verdict && (
            <div style={{ color: t.sub, fontSize: 13, marginBottom: 18 }}>
              Введи пропущенную приставку и нажми Enter
            </div>
          )}
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "0.03em", minHeight: 48, color: t.text }}>
            {before}
            <span style={{ borderBottom: `2.5px solid ${t.invBg}`, padding: "0 10px", minWidth: 78, display: "inline-block" }}>
              {input ? input.toUpperCase() : "\u00A0"}
            </span>
            {after}
          </div>
          <div style={{ marginTop: 24 }}>
            <input
              ref={inputRef}
              value={input}
              maxLength={3}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              onKeyDown={onKey}
              onChange={(e) => {
                const v = e.target.value.slice(-3).toLowerCase();
                setInput(v);
                if (v.length === 3 && !locked && !verdict) submit(v);
              }}
              style={{
                width: 150,
                height: 64,
                border: `2px solid ${verdict ? (verdict.correct ? t.success : t.danger) : t.border}`,
                borderRadius: 12,
                textAlign: "center",
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "0.1em",
                outline: "none",
                color: t.text,
                background: t.raised,
                fontFamily: "inherit",
                caretColor: t.text,
              }}
            />
          </div>
          {verdict && (
            <div className="swap">
              <div style={{ color: verdict.correct ? t.success : t.danger, fontSize: 15, fontWeight: 700, marginTop: 14 }}>
                {verdict.correct ? "Верно." : `Ошибка. Правильно: ${current.answer.toUpperCase()}.`}
              </div>
              <div style={{ color: t.text, fontSize: 13, lineHeight: 1.55, marginTop: 8, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
                {current.explanation}
              </div>
              {!verdict.correct && (
                <div style={{ color: t.sub, fontSize: 12, marginTop: 6 }}>Слово вернётся ещё дважды.</div>
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