import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import Button from "../components/Button";
import MarkedAnswer from "../components/MarkedAnswer";
import { gradeWritten, parseWrittenMarks, parseWrittenWhys } from "../api/backend";
import { aiRemainingToday } from "../api/ai";

const SAMPLE_NOTE = "Основания клетки. Клеточная мембрана состоит из липидного бислоя и белков. "
  + "Транспорт через мембрану бывает пассивным (диффузия, осмос) и активным (с затратой АТФ).";

/** Мок: гоняет UI без запроса к ИИ (лимит 20/сутки жалко). */
function mockGrade(answer, onDelta) {
  const words = String(answer).trim().split(/\s+/).filter(Boolean);
  const REASONS = {
    part: "перечислено не всё",
    bad: "не относится к вопросу",
  };
  const cycle = ["ok", "ok", "part", "bad"];
  const payload = JSON.stringify({
    s: words.map((_, i) => cycle[i % cycle.length]),
    w: words.map((_, i) => REASONS[cycle[i % cycle.length]] || ""),
    grade: 3,
    comment: "Мок-ответ: кликни по жёлтому или красному слову.",
  });
  let i = 0;
  return new Promise((resolve) => {
    const id = setInterval(() => {
      i = Math.min(payload.length, i + 4);
      onDelta(payload.slice(0, i));
      if (i >= payload.length) {
        clearInterval(id);
        resolve(JSON.parse(payload));
      }
    }, 26);
  });
}

export default function GradeLab() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const [note, setNote] = useState(SAMPLE_NOTE);
  const [question, setQuestion] = useState("Какие бывают виды транспорта через мембрану?");
  const [answer, setAnswer] = useState("Диффузия и осмос АТФ");
  const [marks, setMarks] = useState([]);
  const [whys, setWhys] = useState([]);
  const [raw, setRaw] = useState("");
  const [live, setLive] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");

  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const box = { width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 14, border: `1px solid ${t.border}`, background: t.bg, color: t.text, fontSize: 14, fontFamily: "inherit", lineHeight: 1.45, resize: "vertical" };
  const label = { color: t.sub, fontSize: 12, fontWeight: 600, marginBottom: 6 };

  const run = async (kind) => {
    setErr("");
    setRes(null);
    setMarks([]);
    setWhys([]);
    setRaw("");
    setLive(true);
    try {
      const onDelta = (partial) => {
        setRaw(partial);
        setMarks(parseWrittenMarks(partial));
        setWhys(parseWrittenWhys(partial));
      };
      const out = kind === "mock"
        ? await mockGrade(answer, onDelta)
        : await gradeWritten(note, question, answer, onDelta);
      setRes(out);
    } catch (e) {
      setErr(e?.message || "Ошибка");
    } finally {
      setLive(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "18px 16px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ color: t.text, fontSize: 20, fontWeight: 700 }}>Проверка письменных</div>
        <button type="button" onClick={() => navigate(-1)} style={{ border: "none", background: "none", color: t.sub, fontSize: 14, fontFamily: "inherit", cursor: "pointer" }}>Назад</button>
      </div>

      <div style={{ color: t.sub, fontSize: 12, marginBottom: 16 }}>
        ИИ-запросов осталось сегодня: {aiRemainingToday()}. «Мок» квоту не тратит.
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={label}>КОНСПЕКТ</div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} style={box} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={label}>ВОПРОС УЧЕНИКУ</div>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} style={{ ...box, borderRadius: 14 }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={label}>ОТВЕТ УЧЕНИКА · {words} сл.</div>
        <input value={answer} onChange={(e) => setAnswer(e.target.value)} style={{ ...box, borderRadius: 14 }} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <Button onClick={() => run("mock")} disabled={live} variant="dashed" style={{ flex: 1 }}>Мок</Button>
        <Button onClick={() => run("ai")} disabled={live} style={{ flex: 1 }}>Проверить ИИ</Button>
      </div>

      <div style={{ padding: 16, borderRadius: 16, border: `1px solid ${t.border}`, background: t.surface, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ ...label, marginBottom: 0 }}>РАЗМЕТКА ОТВЕТА</div>
          {res && <div style={{ color: t.text, fontSize: 20, fontWeight: 700 }}>{res.grade}/5</div>}
        </div>
        <MarkedAnswer text={answer} marks={marks} whys={whys} live={live} />
        <div style={{ color: marks.length === words ? t.sub : t.danger, fontSize: 12, marginTop: 12 }}>
          статусов {marks.length} / слов {words} · причин {whys.filter(Boolean).length}
          {marks.length === words ? " ✓" : " — модель не совпала по длине"}
        </div>
        {res?.comment && <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.45, marginTop: 8 }}>{res.comment}</div>}
        {err && <div style={{ color: t.danger, fontSize: 13, marginTop: 8 }}>{err}</div>}
      </div>

      <div style={{ padding: 16, borderRadius: 16, border: `1px solid ${t.border}`, background: t.surface }}>
        <div style={{ ...label, marginBottom: 6 }}>СЫРОЙ ПОТОК JSON</div>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", color: t.sub, fontSize: 11.5, fontFamily: "ui-monospace, monospace" }}>
          {raw || "—"}
        </pre>
      </div>
    </div>
  );
}
