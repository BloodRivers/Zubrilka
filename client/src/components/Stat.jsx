import { useTheme } from "../theme/ThemeContext";

export default function Stat({ label, value, tint }) {
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
