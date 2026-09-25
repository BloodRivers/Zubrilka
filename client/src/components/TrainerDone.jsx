import { useTheme } from "../theme/ThemeContext";
import Button from "./Button";

function Stat({ label, value, tint }) {
  const { t } = useTheme();
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "8px 6px",
        borderRadius: 14,
        background: t.raised,
        border: `1px solid ${tint ? tint : t.border}`,
        opacity: tint ? 1 : undefined,
      }}
    >
      <span style={{ color: tint || t.sub, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <span style={{ color: t.text, fontSize: 18, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

const rowStyle = (t) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 0",
  borderBottom: `1px solid ${t.border}`,
});

const pillStyle = (t) => ({
  fontSize: 12,
  color: t.sub,
  border: `1px solid ${t.border}`,
  padding: "5px 10px",
  borderRadius: 999,
});

/** Экран завершения тренажёра. */
export default function TrainerDone({ mistakes, total, secondLabel, secondValue, scoreLabel, wrongItems, emptyMsg, onRetry, onBack, backLabel }) {
  const { t } = useTheme();
  return (
    <div style={{ paddingTop: 12 }}>
      <div style={{ color: t.sub, fontSize: 13, marginBottom: 6 }}>Итог тренажёра</div>
      {mistakes === 0 ? (
        <div style={{ color: t.success, fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Без ошибок — отлично!</div>
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
          <div style={{ color: t.text, fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em" }}>{total}</div>
          <div style={{ color: t.sub, fontSize: 15 }}>{scoreLabel}</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <Stat label="Ошибки" value={mistakes} tint={t.danger} />
        <Stat label={secondLabel} value={secondValue} tint={t.success} />
      </div>

      {wrongItems.length > 0 ? (
        <>
          <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Стоит повторить</div>
          {wrongItems.map((w) => (
            <div key={w.key} style={rowStyle(t)}>
              <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>{w.label}</div>
              <div style={pillStyle(t)}>{w.badge}</div>
            </div>
          ))}
        </>
      ) : (
        <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>{emptyMsg}</div>
      )}

      <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 10 }}>
        {onBack && (
          <Button variant="dashed" onClick={onBack}>
            {backLabel || "Вернуться к ЕГЭ"}
          </Button>
        )}
        <Button onClick={onRetry}>Ещё раз</Button>
      </div>
    </div>
  );
}