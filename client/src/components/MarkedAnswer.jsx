import { useEffect, useState } from "react";
import { X, Minus } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";

/** Пауза между словами — чтобы «проверку» было видно, а не только итог. */
const STEP = 130;

/** Нет темы для жёлтого в THEMES — Quiz.jsx тоже хардкодит этот оранжевый. */
const AMBER = "#F5A623";

// Подсвечиваем только проблемные слова: "ok" — обычный текст без кружка.
// Значения — ключи темы либо готовый цвет (жёлтого ключа нет).
const LOOKS = {
  part: { line: AMBER, tint: "rgba(245,166,35,0.14)", color: AMBER, Icon: Minus },
  bad: { line: "danger", tint: "dangerTint", color: "danger", Icon: X },
};

/**
 * Ответ ученика, который ИИ проверяет на глазах: слова раскрываются по мере
 * стрима (marks), и только ошибки/неточности получают цветной кружок.
 * Клик по такому слову (whys[i]) показывает, что с ним не так.
 * live — пока идёт стрим; после него все слова показываются сразу.
 */
export default function MarkedAnswer({ text, marks = [], whys = [], live = false, style }) {
  const { t } = useTheme();
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const total = Math.min(marks.length, words.length);
  const [tick, setTick] = useState(0);
  const [openIdx, setOpenIdx] = useState(null);

  useEffect(() => {
    if (!live || tick >= total) return;
    const id = setTimeout(() => setTick((v) => v + 1), STEP);
    return () => clearTimeout(id);
  }, [live, total, tick]);

  // Пока стрим идёт — по одному слову; после него разом всё.
  const shown = live ? Math.min(tick, total) : total;

  if (!words.length) return null;

  const open = openIdx != null && shown > openIdx ? openIdx : null;
  const reason = open != null ? String(whys?.[open] || "").trim() : "";
  const openLook = open != null ? LOOKS[marks[open]] : null;
  const flagged = words.some((_, i) => i < shown && LOOKS[marks[i]]);

  return (
    <div style={style}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {words.map((w, i) => {
          const resolved = i < shown;
          const look = resolved ? LOOKS[marks[i]] : null;
          if (!look) {
            return (
              <span
                key={i}
                className={resolved ? undefined : "mark-pending"}
                style={{ color: resolved ? t.text : t.sub, fontSize: 14.5, lineHeight: 1.3, transition: "color 260ms ease" }}
              >
                {w}
              </span>
            );
          }
          const Icon = look.Icon;
          // line/tint — либо ключ темы, либо готовый цвет (у жёлтого ключа нет).
          const line = t[look.line] || look.line;
          const tint = t[look.tint] || look.tint;
          const dot = t[look.color] || look.color;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setOpenIdx(open === i ? null : i)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 9px 3px 4px",
                borderRadius: 999,
                border: `1px solid ${line}`,
                background: tint,
                color: t.text,
                fontSize: 14.5,
                fontWeight: 600,
                lineHeight: 1.3,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "background 260ms ease, border-color 260ms ease, transform 160ms ease",
              }}
            >
              <span
                className="mark-in"
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: 999,
                  background: dot,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={11} strokeWidth={3.5} />
              </span>
              {w}
            </button>
          );
        })}
      </div>
      {reason && openLook ? (
        <div
          className="fadeUp"
          style={{
            marginTop: 10,
            padding: "9px 12px",
            borderRadius: 12,
            border: `1px solid ${t[openLook.line] || openLook.line}`,
            background: t[openLook.tint] || openLook.tint,
            color: t.text,
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          <span style={{ fontWeight: 600 }}>{words[open]}:</span> {reason}
        </div>
      ) : (
        flagged && (
          <div style={{ color: t.sub, fontSize: 12, marginTop: 8 }}>
            Нажми на выделенное слово — покажу, что не так
          </div>
        )
      )}
    </div>
  );
}
