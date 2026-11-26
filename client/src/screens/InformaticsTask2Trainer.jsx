import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { shuffle } from "../utils";
import TrainerDone from "../components/TrainerDone";
import Button from "../components/Button";
import Segmented from "../components/Segmented";
import TheoryCard from "../components/TheoryCard";
import BackToTop from "../components/BackToTop";
import CodeEditor, { CodeBlock } from "../components/CodeEditor";
import usePython from "../hooks/usePython";
import { TRAINER_LIST } from "../data/trainers";
import { sfx } from "../sfx";
import { setQuizActive } from "../nav";
import { INF_TASK2 } from "../data/informatics-task2";
import { INF_TASK2_THEORY } from "../data/informatics-theory";

const TOTAL = INF_TASK2.length;
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const EMPTY_OUTPUT = {};

function Formula({ item, t }) {
  return (
    <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 16, lineHeight: 1.65, color: t.text, marginBottom: 14, wordBreak: "break-word" }}>
      {item.formulas.map((f, i) => (
        <div key={i}>
          <span style={{ color: t.sub }}>{item.formulas.length > 1 ? `F${i + 1}` : "F"} = </span>
          {f}
        </div>
      ))}
    </div>
  );
}

function TruthTable({ item, t }) {
  const fCount = item.rows[0].length - item.cols;
  const headers = [];
  for (let i = 0; i < item.cols; i++) headers.push(item.labels?.[i] || "?");
  for (let k = 0; k < fCount; k++) headers.push(fCount > 1 ? `F${k + 1}` : "F");
  const lastRow = item.rows.length - 1;

  return (
    <div style={{ overflowX: "auto", margin: "12px 0" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          borderRadius: 16,
          overflow: "hidden",
          border: `1px solid ${t.border}`,
          background: t.surface,
        }}
      >
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: "center",
                  padding: "10px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: t.sub,
                  background: t.raised,
                  borderBottom: `1px solid ${t.border}`,
                  borderRight: i === headers.length - 1 ? "none" : `1px solid ${t.border}`,
                  fontFamily: MONO,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {item.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "10px 14px",
                    fontSize: 13,
                    textAlign: "center",
                    fontFamily: MONO,
                    color: cell === "?" ? t.sub : t.text,
                    borderBottom: ri === lastRow ? "none" : `1px solid ${t.border}`,
                    borderRight: ci === row.length - 1 ? "none" : `1px solid ${t.border}`,
                  }}
                >
                  {cell === "" ? "\u00A0" : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InformaticsTask2Trainer() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { slug } = useParams();
  const trainer = TRAINER_LIST.find((x) => x.id === slug);
  const py = usePython();
  const queueRef = useRef([]);
  const inputRef = useRef(null);
  const [tab, setTab] = useState("theory");
  const [current, setCurrent] = useState(null);
  const [code, setCode] = useState("");
  const [input, setInput] = useState("");
  const [verdict, setVerdict] = useState(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [solved, setSolved] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setQuizActive(tab === "train" && !done);
    return () => setQuizActive(false);
  }, [tab, done]);

  const focus = () => inputRef.current?.focus();

  const resetAttempt = () => {
    setVerdict(null);
    setInput("");
    setCode("");
    py.reset();
  };

  const next = () => {
    resetAttempt();
    const q = queueRef.current;
    if (!q.length) {
      setCurrent(null);
      setDone(true);
      return;
    }
    setCurrent(q.shift());
    focus();
  };

  const start = () => {
    const q = shuffle(INF_TASK2);
    queueRef.current = q;
    setCurrent(q.shift());
    setInput("");
    setCode("");
    setVerdict(null);
    setStreak(0);
    setBestStreak(0);
    setMistakes(0);
    setSolved(0);
    setDone(false);
    py.reset();
    focus();
  };

  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "train" && current && !done) focus();
  }, [tab, current, done]);

  const submit = () => {
    if (!current || done) return;
    if (verdict?.ok) {
      next();
      return;
    }
    if (input.length !== current.cols) return;
    if (input === current.answer) {
      sfx.correct();
      setStreak((s) => s + 1);
      setBestStreak((b) => Math.max(b, streak + 1));
      setSolved((s) => s + 1);
      setVerdict({ ok: true });
      return;
    }
    sfx.wrong();
    setStreak(0);
    setMistakes((m) => m + 1);
    setVerdict({ ok: false });
    inputRef.current?.select();
  };

  const onKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const variables = current ? [...new Set(current.formulas.join(" ").match(/[a-z]/g))].sort() : [];
  const runDisabled = py.running || py.status === "loading" || !code.trim();
  const out = py.output || EMPTY_OUTPUT;
  const noOutput = py.output && !out.error && !out.stdout && !out.stderr && !out.value;

  useEffect(() => {
    if (tab !== "train" || !current || done || verdict?.ok) return;
    if (!out || out.error) return;
    const s = (out.stdout || "").trim().replace(/\r\n/g, "\n").split("\n").filter(Boolean).pop() || "";
    const m = s.match(/[a-zA-Z]{2,5}/);
    if (!m) return;
    const cand = m[0].toLowerCase();
    if (cand.length === current.cols) {
      setInput(cand);
      if (cand === current.answer) {
        sfx.correct();
        setStreak((st) => st + 1);
        setBestStreak((b) => Math.max(b, streak + 1));
        setSolved((sv) => sv + 1);
        setVerdict({ ok: true });
      }
    }
  }, [out, tab, current, done, verdict?.ok, streak, bestStreak]);

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
        <BackToTop />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {INF_TASK2_THEORY.map((g) => (
            <TheoryCard key={g.title} group={g}>{g.code && <CodeBlock code={g.code} />}</TheoryCard>
          ))}
        </div>
      </div>
    );
  }

    return (
    <div style={{ paddingTop: 4 }}>
      {renderTop()}

      {done ? (
        <TrainerDone
          mistakes={mistakes}
          total={TOTAL}
          secondLabel="Лучшая серия"
          secondValue={bestStreak}
          scoreLabel="заданий решено"
          wrongItems={[]}
          emptyMsg="Все задания банка решены верно."
          onRetry={start}
          onBack={trainer?.useSubject ? () => navigate(`/use/${trainer.useSubject}`) : null}
          backLabel="Вернуться к ЕГЭ"
        />
      ) : current ? (
        <div className="inf2-split" style={{ padding: "20px 16px", borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, marginTop: 12 }}>
          <div className="inf2-task">
          <div style={{ color: t.sub, fontSize: 12, marginBottom: 12, textAlign: "center" }}>
            Случайная задача
          </div>

          <Formula item={current} t={t} />

          <div style={{ background: t.raised, borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
            <div style={{ color: t.text, fontSize: 13, lineHeight: 1.5 }}>
              Определи, какой переменной ({variables.join(", ")}) соответствует каждый столбец таблицы.
            </div>
            <div style={{ color: t.sub, fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>
              Ответ — {current.cols} {current.cols >= 5 ? "букв" : "буквы"} подряд, в порядке столбцов слева направо, без пробелов.
              {current.labels?.some(Boolean) ? " Подписанные в шапке буквы менять нельзя." : ""}
            </div>
          </div>

          {current.note && (
            <div style={{ color: t.sub, fontSize: 12, lineHeight: 1.5, textAlign: "center", marginBottom: 10 }}>
              {current.note}
            </div>
          )}

          <TruthTable item={current} t={t} />
          </div>

          <div className="inf2-work">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>Решение на Python</span>
            </div>
            <CodeEditor
              value={code}
              onChange={setCode}
              onRun={() => !runDisabled && py.run(code)}
              running={py.running || py.status === "loading"}
              height={180}
              attachedOutput
            />

            <div
              aria-live="polite"
                style={{
                  minHeight: "calc(1.5em + 20px)",
                  maxHeight: "calc(4.5em + 20px)",
                  padding: "10px 12px",
                  borderRadius: "0 0 14px 14px",
                  border: `1px solid ${out?.error ? t.danger : t.border}`,
                  borderTop: "none",
                  background: t.bg,
                  fontFamily: MONO,
                  fontSize: 12,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  overflow: "auto",
                }}
              >
                {out?.stdout && <div style={{ color: t.text }}>{out.stdout}</div>}
                {out?.stderr && <div style={{ color: t.sub }}>{out.stderr}</div>}
                {out?.value && <div style={{ color: t.sub }}>→ {out.value}</div>}
                {out?.error && <div style={{ color: t.danger }}>{out.error}</div>}
                {noOutput && <div style={{ color: t.sub }}>Программа ничего не вывела. Добавь print(...)</div>}
              </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              {py.status === "error" && <span style={{ color: t.danger, fontSize: 12 }}>{py.error}</span>}
              {py.status === "loading" && <span style={{ color: t.sub, fontSize: 12 }}>первый запуск ~10–15 с</span>}
            </div>

          <div style={{ height: 1, background: t.border, margin: "18px 0 14px" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: t.sub, fontSize: 13, flex: "0 0 auto" }}>Ответ</span>
            <input
              ref={inputRef}
              value={input}
              maxLength={current.cols}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Буквы переменных по порядку столбцов"
              onKeyDown={onKey}
              onChange={(e) => {
                setInput(e.target.value.toLowerCase().replace(/[^a-z]/g, "").slice(0, current.cols));
                if (!verdict?.ok) setVerdict(null);
              }}
              disabled={verdict?.ok}
              style={{
                flex: 1,
                minWidth: 0,
                height: 44,
                border: `1.5px solid ${verdict ? (verdict.ok ? t.success : t.danger) : t.border}`,
                borderRadius: 12,
                textAlign: "center",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.14em",
                outline: "none",
                color: t.text,
                background: t.raised,
                fontFamily: MONO,
                caretColor: t.text,
                boxSizing: "border-box",
              }}
              placeholder={"?".repeat(current.cols)}
            />
            <Button
              onClick={submit}
              disabled={!verdict?.ok && input.length !== current.cols}
              style={{ width: "auto", flex: "0 0 auto", padding: "0 20px", height: 44, fontSize: 14 }}
            >
              {verdict?.ok ? "Дальше" : "Проверить"}
            </Button>
          </div>

          <div style={{ minHeight: 20, marginTop: 8, textAlign: "center" }}>
            {verdict && (
              <span className="swap" style={{ color: verdict.ok ? t.success : t.danger, fontSize: 13, fontWeight: 600 }}>
                {verdict.ok ? "Верно." : "Неверно. Задача останется, пока не решишь."}
              </span>
            )}
          </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
