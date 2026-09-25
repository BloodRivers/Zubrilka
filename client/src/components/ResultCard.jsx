import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { EASE } from "../theme/theme";
import useLongPress from "../hooks/useLongPress";

/** Сравнение: лучший результат выше (доля, затем score, затем дата). */
export function isBetterResult(a, b) {
  const ra = (b.total || 0) > 0 ? (b.score || 0) / b.total : 0;
  const rb = (a.total || 0) > 0 ? (a.score || 0) / a.total : 0;
  if (rb !== ra) return rb > ra;
  if ((a.score || 0) !== (b.score || 0)) return (a.score || 0) > (b.score || 0);
  return (a.created_at?.toMillis?.() || 0) >= (b.created_at?.toMillis?.() || 0);
}

/** Одна карточка на test_id — с лучшим результатом. */
export function bestResultsByTest(results) {
  const map = new Map();
  for (const r of results || []) {
    const key = r.test_id || r.id;
    const prev = map.get(key);
    if (!prev || isBetterResult(r, prev)) map.set(key, r);
  }
  return [...map.values()].sort(
    (a, b) => (b.created_at?.toMillis?.() || 0) - (a.created_at?.toMillis?.() || 0)
  );
}

export default function ResultCard({ result, idx, onLongPress }) {
  const { t } = useTheme();
  const navigate = useNavigate();
  const long = useLongPress({
    onClick: () => {
      if (!result.test_id) return;
      navigate(`/test/${result.test_id}/quiz/full`);
    },
    onLongPress: () => onLongPress(result),
  });
  const weak = result.weak_topics || [];
  const extras = [];
  if (result.quizlet_total) extras.push(`квизлет ${result.quizlet_score ?? 0}/${result.quizlet_total}`);
  if (result.match_total) extras.push(`пары ${result.match_score ?? 0}/${result.match_total}`);
  if (result.written_grade != null) extras.push(`письм. ${result.written_grade}/5`);

  return (
    <div
      {...long}
      className="rowpress"
      style={{
        padding: "16px 18px",
        marginBottom: 12,
        borderRadius: 20,
        background: t.surface,
        border: `1px solid ${t.border}`,
        cursor: result.test_id ? "pointer" : "default",
        WebkitTouchCallout: "none",
        userSelect: "none",
        animation: `fadeUp 460ms ${EASE} both`,
        animationDelay: `${idx * 60}ms`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ minWidth: 0, paddingRight: 12 }}>
          <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>{result.title || "Тест"}</div>
          <div style={{ color: t.sub, fontSize: 13, marginTop: 3 }}>
            {result.created_at?.toDate?.().toLocaleDateString("ru-RU") ?? ""}
            {extras.length ? ` · ${extras.join(" · ")}` : ""}
          </div>
        </div>
        <div style={{ color: t.text, fontSize: 21, fontWeight: 700, flexShrink: 0 }}>
          {result.score}/{result.total}
        </div>
      </div>

      {weak.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {weak.map((topic, i) => (
            <span
              key={i}
              style={{
                fontSize: 12,
                color: t.sub,
                border: `1px solid ${t.border}`,
                padding: "5px 10px",
                borderRadius: 999,
              }}
            >
              {topic}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
