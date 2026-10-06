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
import { SPEECH_STYLES, SPEECH_STYLE_MAP, SPEECH_STYLE_NOTES, SPEECH_STYLE_QUESTIONS } from "../data/speechStyles";

const TOTAL = SPEECH_STYLE_QUESTIONS.length;
const STYLE_IDS = SPEECH_STYLES.map((style) => style.id);

export default function SpeechStylesTrainer() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { slug } = useParams();
  const trainer = TRAINER_LIST.find((item) => item.id === slug);
  const queueRef = useRef([]);
  const optionsRef = useRef([]);
  const wrongRef = useRef(new Set());
  const [tab, setTab] = useState("theory");
  const [current, setCurrent] = useState(null);
  const [locked, setLocked] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setQuizActive(tab === "train" && Boolean(current) && !done);
    return () => setQuizActive(false);
  }, [tab, current, done]);

  const next = () => {
    const queue = queueRef.current;
    setLocked(false);
    setVerdict(null);
    if (queue.length === 0) {
      setCurrent(null);
      setDone(true);
      return;
    }
    setCurrent(queue.shift());
    optionsRef.current = shuffle(STYLE_IDS);
  };

  const start = () => {
    queueRef.current = shuffle(SPEECH_STYLE_QUESTIONS);
    wrongRef.current = new Set();
    setStreak(0);
    setBestStreak(0);
    setMistakes(0);
    setDone(false);
    setLocked(false);
    setVerdict(null);
    next();
  };

  useEffect(() => {
    if (tab === "train" && !current && !done) start();
  }, [tab, current, done]);

  const answer = (styleId) => {
    if (locked || done || !current) return;
    setLocked(true);
    const correct = styleId === current.answer;
    if (correct) {
      sfx.correct();
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setBestStreak((value) => Math.max(value, nextStreak));
    } else {
      sfx.wrong();
      setStreak(0);
      setMistakes((value) => value + 1);
      wrongRef.current.add(SPEECH_STYLE_MAP[current.answer].title);
      const queue = queueRef.current;
      for (let i = 0; i < 2; i++) {
        const position = Math.min(queue.length, Math.floor(Math.random() * (Math.min(8, queue.length) + 1)));
        queue.splice(position, 0, current);
      }
    }
    setVerdict({ correct, picked: styleId });
  };

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
          <div style={{ borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, padding: "18px 18px 14px" }}>
            <div style={{ color: t.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Задание 3 ЕГЭ</div>
            <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.5 }}>Функциональные разновидности языка. Памятка по определению стилей речи для выполнения задания 3 ЕГЭ по русскому языку.</div>
          </div>
          {SPEECH_STYLES.map((style) => (
            <div key={style.id} style={{ borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, padding: "18px 18px 14px" }}>
              <div style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{style.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 12 }}>
                <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.5 }}><b style={{ color: t.text }}>Цель:</b> {style.purpose}</div>
                <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.5 }}><b style={{ color: t.text }}>Сфера:</b> {style.sphere}</div>
                <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.5 }}><b style={{ color: t.text }}>Форма:</b> {style.form}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {style.features.map((feature) => (
                  <div key={feature.label}>
                    <div style={{ color: t.text, fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{feature.label}</div>
                    <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.55 }}>{feature.text}</div>
                  </div>
                ))}
              </div>
              <div style={{ color: t.sub, fontSize: 12, lineHeight: 1.5, marginTop: 12 }}>Примеры: {style.examples.join(" · ")}</div>
            </div>
          ))}
          <div style={{ borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, padding: "18px 18px 14px" }}>
            <div style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Что важно помнить</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {SPEECH_STYLE_NOTES.map((note) => (
                <div key={note.title}>
                  <div style={{ color: t.text, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{note.title}</div>
                  <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.55 }}>{note.text}</div>
                  {note.examples && <div style={{ color: t.sub, fontSize: 12, lineHeight: 1.5, marginTop: 4 }}>Примеры: {note.examples.join(" · ")}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!current && !done) return null;

  const remaining = queueRef.current.length;
  const progress = done ? 1 : Math.min(1, Math.max(0, (TOTAL - remaining) / TOTAL));
  const correctStyle = SPEECH_STYLE_MAP[current?.answer];

  const optionStyle = (styleId) => {
    if (verdict && styleId === current.answer) return { border: t.success, background: t.successTint, color: t.success };
    if (verdict && styleId === verdict.picked) return { border: t.danger, background: t.dangerTint, color: t.danger };
    return { border: t.border, background: t.raised, color: t.text };
  };

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
          scoreLabel="заданий пройдено"
          wrongItems={[...wrongRef.current].map((title) => ({ key: title, label: title, badge: "повторить" }))}
          emptyMsg="Стили речи различаются уверенно."
          onRetry={start}
          onBack={trainer?.useSubject ? () => navigate(`/use/${trainer.useSubject}`) : null}
          backLabel="Вернуться к ЕГЭ"
        />
      ) : (
        <div style={{ padding: "28px 18px", borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, textAlign: "center" }}>
          {!verdict && <div style={{ color: t.sub, fontSize: 13, marginBottom: 14 }}>Определи стиль по фрагменту</div>}
          <div style={{ color: t.sub, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>{current.focus}</div>
          <div style={{ color: t.text, fontSize: 19, fontWeight: 700, lineHeight: 1.5, marginBottom: 22 }}>{current.text}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {optionsRef.current.map((styleId) => {
              const style = SPEECH_STYLE_MAP[styleId];
              const s = optionStyle(styleId);
              return (
                <button
                  key={styleId}
                  type="button"
                  className={verdict ? undefined : "press"}
                  onClick={() => answer(styleId)}
                  disabled={locked}
                  style={{
                    padding: "14px 12px",
                    minHeight: 52,
                    borderRadius: 14,
                    border: `1px solid ${s.border}`,
                    background: s.background,
                    color: s.color,
                    fontSize: 16,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: verdict ? "default" : "pointer",
                    transition: "background .15s, color .15s, border-color .15s",
                  }}
                >
                  {style.title}
                </button>
              );
            })}
          </div>
          {verdict && (
            <div className="swap">
              <div style={{ color: verdict.correct ? t.success : t.danger, fontSize: 15, fontWeight: 700, marginTop: 14 }}>
                {verdict.correct ? "Верно." : `Ошибка. Правильный ответ: ${correctStyle.title}.`}
              </div>
              <div style={{ color: t.text, fontSize: 13, lineHeight: 1.55, marginTop: 8, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>{current.why}</div>
              {!verdict.correct && <div style={{ color: t.sub, fontSize: 12, marginTop: 6 }}>Задание вернётся ещё дважды.</div>}
              <div style={{ marginTop: 16 }}><Button onClick={next}>Далее</Button></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
