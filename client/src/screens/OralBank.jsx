import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import ListRow from "../components/ListRow";
import { Shuffle, BookOpen, Megaphone } from "lucide-react";
import { oralTaskByNumber, pickRandomVariant } from "../useOral";
import { listOralResults, loadOralDone } from "../oralResults";

export const TASK_ICONS = { 1: BookOpen, 2: Megaphone };

export default function OralBank() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { task: taskNum } = useParams();
  const task = oralTaskByNumber(Number(taskNum));
  const Icon = TASK_ICONS[task?.task] || Shuffle;
  const [done, setDone] = useState([]);
  const [results, setResults] = useState({});
  useEffect(() => {
    let alive = true;
    Promise.all([listOralResults(), loadOralDone(taskNum)])
      .then(([rs, ids]) => {
        if (!alive) return;
        const map = {};
        for (const r of rs) if (Number(r.task) === task.task) map[r.variant_id] = r;
        setResults(map);
        setDone(Array.isArray(ids) ? ids : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [taskNum, task]);

  if (!task) {
    return <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>Задание не найдено.</div>;
  }

  const openVariant = (v) => {
    navigate(`/use/english/oral/${task.task}/${v.id}`, { state: { from: `/use/english/oral/${task.task}` } });
  };

  const goRandom = () => {
    const v = pickRandomVariant(task.variants, done);
    if (v) openVariant(v);
  };

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14, color: t.text }}>
        Задание {task.task}. {task.title}
      </div>

      <button
        type="button"
        className="press"
        onClick={goRandom}
        disabled={!task.variants.length}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "13px 16px",
          borderRadius: 999,
          border: "none",
          background: t.invBg,
          color: t.inv,
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: task.variants.length ? "pointer" : "default",
          opacity: task.variants.length ? 1 : 0.5,
        }}
      >
        <Shuffle size={18} strokeWidth={2} color={t.inv} />
        Случайное задание
      </button>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          margin: "4px 0",
          color: t.sub,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span>Варианты</span>
        <span>Пройдено {done.length} из {task.variants.length}</span>
      </div>

      {task.variants.map((v, i) => {
        const r = results[v.id];
        return (
          <ListRow
            key={v.id}
            idx={i}
            borderless={i === task.variants.length - 1}
            icon={<Icon size={20} color={t.text} strokeWidth={2} />}
            title={v.title}
            right={
              r ? (
                <span
                  style={{
                    background: t.border,
                    color: t.text,
                    borderRadius: 999,
                    padding: "5px 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {r.score}/{r.max}
                </span>
              ) : undefined
            }
            onClick={() => openVariant(v)}
          />
        );
      })}
    </div>
  );
}