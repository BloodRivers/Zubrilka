import { ChevronRight } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { EASE } from "../theme/theme";
import useLongPress from "../hooks/useLongPress";

export default function ListRow({ icon, title, sub, onClick, onLongPress, right, idx = 0, borderless, iconWrap }) {
  const { t } = useTheme();
  const long = useLongPress({ onClick, onLongPress });

  return (
    <button
      className="rowpress"
      {...long}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        padding: "20px 0",
        gap: 14,
        background: "none",
        border: "none",
        borderBottom: borderless ? "none" : `1px solid ${t.border}`,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        WebkitTouchCallout: "none",
        userSelect: "none",
        animation: `fadeUp 500ms ${EASE} both`,
        animationDelay: `${idx * 60}ms`,
      }}
    >
      {icon && (
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: iconWrap?.background || t.raised,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ color: t.text, fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</div>
        {sub && <div style={{ color: t.sub, fontSize: 13, marginTop: 4 }}>{sub}</div>}
      </div>
      {right ?? <ChevronRight size={20} color={t.sub} />}
    </button>
  );
}
