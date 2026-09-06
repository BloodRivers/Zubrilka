import { useTheme } from "../theme/ThemeContext";

export default function Avatar({ name, src, size = 36 }) {
  const { t } = useTheme();
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt={name || "Аватар"}
        referrerPolicy="no-referrer"
        style={{ width: size, height: size, borderRadius: 999, objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: t.invBg,
        color: t.inv,
        fontWeight: 700,
        fontSize: Math.round(size * 0.4),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}