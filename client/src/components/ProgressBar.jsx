import { useTheme } from "../theme/ThemeContext";

/**
 * @param {{ value?: number, segments?: number[] }} props
 * value — одна полоса 0..1; segments — несколько полос (каждая 0..1).
 */
export default function ProgressBar({ value = 0, segments }) {
  const { t } = useTheme();
  const parts = Array.isArray(segments) && segments.length > 0
    ? segments
    : [value];

  return (
    <div
      style={{
        display: "flex",
        gap: parts.length > 1 ? 5 : 0,
        marginBottom: 28,
      }}
    >
      {parts.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 3,
            background: t.border,
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, Math.max(0, Number(v) * 100))}%`,
              background: t.invBg,
              borderRadius: 999,
              transition: "width 500ms cubic-bezier(0.16,1,0.3,1)",
            }}
          />
        </div>
      ))}
    </div>
  );
}
