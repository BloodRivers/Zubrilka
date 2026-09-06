import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Plus, Moon, Sun, Check, X } from "lucide-react";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');`;

const THEMES = {
  dark: {
    bg: "#0A0A0A",
    surface: "#141414",
    raised: "#1C1C1C",
    border: "#2A2A2A",
    text: "#FAFAFA",
    sub: "#8C8C8C",
    inv: "#0A0A0A",
    invBg: "#FAFAFA",
  },
  light: {
    bg: "#FAFAFA",
    surface: "#FFFFFF",
    raised: "#F1F1F1",
    border: "#E3E3E3",
    text: "#0A0A0A",
    sub: "#767676",
    inv: "#FAFAFA",
    invBg: "#0A0A0A",
  },
};

const SUBJECTS = [
  { id: "physics", name: "Физика", count: 4 },
  { id: "history", name: "История", count: 2 },
  { id: "biology", name: "Биология", count: 6 },
  { id: "cs", name: "Информатика", count: 3 },
];

const NOTES = {
  physics: [
    { id: "n1", title: "Конспект", date: "04.09.26" },
    { id: "n2", title: "Конспект", date: "28.08.26" },
  ],
  history: [{ id: "n3", title: "Конспект", date: "02.09.26" }],
  biology: [
    { id: "n4", title: "Конспект", date: "05.09.26" },
    { id: "n5", title: "Конспект", date: "30.08.26" },
  ],
  cs: [{ id: "n6", title: "Конспект", date: "01.09.26" }],
};

const NOTE_DETAIL = {
  title: "Конспект",
  date: "04.09.26",
  subject: "Физика",
  subtopics: [
    {
      title: "Законы Ньютона",
      points: ["Первый закон: инерция", "Второй закон: F = ma", "Третий закон: действие и противодействие"],
    },
    {
      title: "Импульс",
      points: ["p = mv", "Закон сохранения импульса в замкнутой системе"],
    },
    {
      title: "Энергия",
      points: ["Кинетическая энергия: E = mv²/2", "Потенциальная энергия", "Закон сохранения энергии"],
    },
  ],
  plan: ["Повторить законы Ньютона", "Разобрать примеры на импульс", "Прорешать задачи на энергию"],
};

const QUIZ = [
  { q: "Второй закон Ньютона выражается формулой:", options: ["F = ma", "E = mc²", "p = mv", "V = IR"], correct: 0, topic: "Законы Ньютона" },
  { q: "Что сохраняется в замкнутой системе без внешних сил?", options: ["Скорость", "Импульс", "Ускорение", "Масса"], correct: 1, topic: "Импульс" },
  { q: "Единица измерения силы в системе СИ:", options: ["Джоуль", "Ватт", "Ньютон", "Паскаль"], correct: 2, topic: "Единицы измерения" },
];

export default function App() {
  const [theme, setTheme] = useState("dark");
  const t = THEMES[theme];

  const [screen, setScreen] = useState("home");
  const [dir, setDir] = useState("fwd");
  const [animKey, setAnimKey] = useState(0);
  const [entered, setEntered] = useState(true);

  const [activeSubject, setActiveSubject] = useState(null);
  const [openTopic, setOpenTopic] = useState(null);

  const [qIndex, setQIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [answers, setAnswers] = useState([]);

  function go(to, direction = "fwd") {
    setDir(direction);
    setEntered(false);
    setScreen(to);
    setAnimKey((k) => k + 1);
  }

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [animKey]);

  function openSubject(s) {
    setActiveSubject(s);
    go("notes");
  }

  function startQuiz() {
    setQIndex(0);
    setPicked(null);
    setAnswers([]);
    go("quiz");
  }

  function pickAnswer(i) {
    if (picked !== null) return;
    setPicked(i);
    const nextAnswers = [...answers, { i, topic: QUIZ[qIndex].topic, correct: i === QUIZ[qIndex].correct }];
    setAnswers(nextAnswers);
    setTimeout(() => {
      if (qIndex + 1 < QUIZ.length) {
        setQIndex(qIndex + 1);
        setPicked(null);
      } else {
        go("results");
      }
    }, 650);
  }

  const score = answers.filter((a) => a.correct).length;
  const weakTopics = [...new Set(answers.filter((a) => !a.correct).map((a) => a.topic))];

  const titles = { home: "Твои предметы", notes: activeSubject ? activeSubject.name : "", note: "Конспект", quiz: "Тест", results: "Результат" };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: theme === "dark" ? "#000" : "#DADADA",
        fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
        padding: "32px 12px",
      }}
    >
      <style>{`
        ${FONT_IMPORT}
        .press:active { transform: scale(0.97); }
        .rowpress:active { opacity: 0.6; }
        .accordion { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 420ms cubic-bezier(0.16,1,0.3,1); }
        .accordion.open { grid-template-rows: 1fr; }
        .accordion-inner { overflow: hidden; }
        .scrollarea::-webkit-scrollbar { width: 0; height: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* phone frame */}
      <div
        style={{
          width: 390,
          height: 780,
          borderRadius: 44,
          background: t.bg,
          border: `1px solid ${theme === "dark" ? "#2E2E2E" : "#D4D4D4"}`,
          boxShadow: theme === "dark" ? "0 40px 80px rgba(0,0,0,0.6)" : "0 40px 80px rgba(0,0,0,0.25)",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "22px 22px 12px 22px",
            flexShrink: 0,
          }}
        >
          <div style={{ width: 34, height: 34, display: "flex", alignItems: "center" }}>
            {screen !== "home" && (
              <button
                className="press"
                onClick={() => {
                  if (screen === "notes") go("home", "back");
                  else if (screen === "note") go("notes", "back");
                  else if (screen === "results") go("home", "back");
                  else go("home", "back");
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: `1px solid ${t.border}`,
                  background: t.surface,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "transform 150ms ease",
                  cursor: "pointer",
                }}
              >
                <ChevronLeft size={18} color={t.text} />
              </button>
            )}
          </div>

          <div style={{ color: t.text, fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>{titles[screen]}</div>

          <button
            className="press"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: `1px solid ${t.border}`,
              background: t.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "transform 150ms ease",
              cursor: "pointer",
            }}
          >
            {theme === "dark" ? <Sun size={16} color={t.text} /> : <Moon size={16} color={t.text} />}
          </button>
        </div>

        {/* animated content */}
        <div
          key={animKey}
          className="scrollarea"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 22px 28px 22px",
            transform: entered ? "translateX(0)" : dir === "fwd" ? "translateX(28px)" : "translateX(-28px)",
            opacity: entered ? 1 : 0,
            transition: "transform 420ms cubic-bezier(0.16,1,0.3,1), opacity 380ms ease-out",
          }}
        >
          {screen === "home" && (
            <div>
              <div style={{ color: t.sub, fontSize: 14, marginBottom: 24 }}>4 участника · синхронизировано</div>
              {SUBJECTS.map((s, idx) => (
                <button
                  key={s.id}
                  className="rowpress"
                  onClick={() => openSubject(s)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "20px 0",
                    borderBottom: `1px solid ${t.border}`,
                    background: "none",
                    border: "none",
                    borderBottomWidth: 1,
                    borderBottomStyle: "solid",
                    borderBottomColor: t.border,
                    cursor: "pointer",
                    textAlign: "left",
                    animation: `fadeUp 500ms cubic-bezier(0.16,1,0.3,1) both`,
                    animationDelay: `${idx * 60}ms`,
                  }}
                >
                  <div>
                    <div style={{ color: t.text, fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>{s.name}</div>
                    <div style={{ color: t.sub, fontSize: 13, marginTop: 4 }}>{s.count} конспекта</div>
                  </div>
                  <ChevronRight size={20} color={t.sub} />
                </button>
              ))}

              <button
                className="press"
                style={{
                  marginTop: 24,
                  width: "100%",
                  padding: "16px",
                  borderRadius: 18,
                  border: `1px dashed ${t.border}`,
                  background: "none",
                  color: t.sub,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 14,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  transition: "transform 150ms ease",
                }}
              >
                <Plus size={16} /> Новый предмет
              </button>
            </div>
          )}

          {screen === "notes" && activeSubject && (
            <div>
              {NOTES[activeSubject.id].map((n, idx) => (
                <div
                  key={n.id}
                  onClick={() => go("note")}
                  className="rowpress"
                  style={{
                    padding: "18px 18px",
                    marginBottom: 12,
                    borderRadius: 20,
                    background: t.surface,
                    border: `1px solid ${t.border}`,
                    cursor: "pointer",
                    animation: `fadeUp 460ms cubic-bezier(0.16,1,0.3,1) both`,
                    animationDelay: `${idx * 60}ms`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: t.text, fontSize: 16, fontWeight: 600 }}>{n.title}</div>
                      <div style={{ color: t.sub, fontSize: 13, marginTop: 3 }}>{n.date}</div>
                    </div>
                    {idx === 0 && (
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: t.inv,
                          background: t.invBg,
                          padding: "8px 14px",
                          borderRadius: 999,
                        }}
                      >
                        Изучить
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button
                className="press"
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: 18,
                  border: `1px dashed ${t.border}`,
                  background: "none",
                  color: t.sub,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 14,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                <Plus size={16} /> Загрузить конспект
              </button>
            </div>
          )}

          {screen === "note" && (
            <div>
              <div style={{ color: t.sub, fontSize: 13, marginBottom: 2 }}>{NOTE_DETAIL.subject} · {NOTE_DETAIL.date}</div>
              <div style={{ color: t.text, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 20 }}>
                {NOTE_DETAIL.title}
              </div>

              <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>План изучения</div>
              <div style={{ marginBottom: 26 }}>
                {NOTE_DETAIL.plan.map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "9px 0" }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        border: `1px solid ${t.border}`,
                        color: t.sub,
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div style={{ color: t.text, fontSize: 14, lineHeight: 1.4 }}>{step}</div>
                  </div>
                ))}
              </div>

              <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Темы</div>
              {NOTE_DETAIL.subtopics.map((topic, i) => {
                const isOpen = openTopic === i;
                return (
                  <div key={i} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <button
                      onClick={() => setOpenTopic(isOpen ? null : i)}
                      className="rowpress"
                      style={{
                        width: "100%",
                        padding: "16px 0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "inherit",
                      }}
                    >
                      <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>{topic.title}</div>
                      <ChevronRight
                        size={16}
                        color={t.sub}
                        style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 300ms cubic-bezier(0.16,1,0.3,1)" }}
                      />
                    </button>
                    <div className={`accordion ${isOpen ? "open" : ""}`}>
                      <div className="accordion-inner">
                        <div style={{ paddingBottom: 16 }}>
                          {topic.points.map((p, j) => (
                            <div key={j} style={{ color: t.sub, fontSize: 13.5, padding: "5px 0", paddingLeft: 4 }}>
                              — {p}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                className="press"
                onClick={startQuiz}
                style={{
                  marginTop: 26,
                  width: "100%",
                  padding: "16px",
                  borderRadius: 999,
                  border: "none",
                  background: t.invBg,
                  color: t.inv,
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  transition: "transform 150ms ease",
                }}
              >
                Начать тест
              </button>
            </div>
          )}

          {screen === "quiz" && (
            <div>
              <div style={{ height: 3, background: t.border, borderRadius: 999, marginBottom: 28, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${((qIndex + (picked !== null ? 1 : 0)) / QUIZ.length) * 100}%`,
                    background: t.invBg,
                    borderRadius: 999,
                    transition: "width 500ms cubic-bezier(0.16,1,0.3,1)",
                  }}
                />
              </div>
              <div style={{ color: t.sub, fontSize: 13, marginBottom: 10 }}>
                Вопрос {qIndex + 1} из {QUIZ.length}
              </div>
              <div style={{ color: t.text, fontSize: 21, fontWeight: 600, lineHeight: 1.35, marginBottom: 28, letterSpacing: "-0.01em" }}>
                {QUIZ[qIndex].q}
              </div>
              {QUIZ[qIndex].options.map((opt, i) => {
                const isPicked = picked === i;
                const isCorrect = i === QUIZ[qIndex].correct;
                const showState = picked !== null;
                let bg = t.surface;
                let border = t.border;
                let color = t.text;
                if (showState && isCorrect) {
                  bg = t.invBg;
                  color = t.inv;
                  border = t.invBg;
                } else if (showState && isPicked && !isCorrect) {
                  bg = "transparent";
                  border = t.sub;
                  color = t.sub;
                }
                return (
                  <button
                    key={i}
                    className="press"
                    onClick={() => pickAnswer(i)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px 18px",
                      marginBottom: 12,
                      borderRadius: 16,
                      border: `1px solid ${border}`,
                      background: bg,
                      color: color,
                      fontSize: 14.5,
                      fontFamily: "inherit",
                      cursor: picked === null ? "pointer" : "default",
                      transition: "background 300ms ease, border-color 300ms ease, color 300ms ease, transform 150ms ease",
                      textAlign: "left",
                    }}
                  >
                    <span>{opt}</span>
                    {showState && isCorrect && <Check size={16} />}
                    {showState && isPicked && !isCorrect && <X size={16} />}
                  </button>
                );
              })}
            </div>
          )}

          {screen === "results" && (
            <div style={{ paddingTop: 16 }}>
              <div style={{ color: t.sub, fontSize: 13, marginBottom: 6 }}>Итог теста</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 30 }}>
                <div style={{ color: t.text, fontSize: 64, fontWeight: 700, letterSpacing: "-0.03em" }}>
                  {score}/{QUIZ.length}
                </div>
                <div style={{ color: t.sub, fontSize: 15 }}>верно</div>
              </div>

              {weakTopics.length > 0 ? (
                <>
                  <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Стоит повторить</div>
                  {weakTopics.map((topic, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "16px 0",
                        borderBottom: `1px solid ${t.border}`,
                      }}
                    >
                      <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>{topic}</div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: t.sub,
                          border: `1px solid ${t.border}`,
                          padding: "5px 10px",
                          borderRadius: 999,
                        }}
                      >
                        повторить
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>Все темы усвоены уверенно.</div>
              )}

              <button
                className="press"
                onClick={() => go("home", "back")}
                style={{
                  marginTop: 30,
                  width: "100%",
                  padding: "16px",
                  borderRadius: 999,
                  border: "none",
                  background: t.invBg,
                  color: t.inv,
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Готово
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
