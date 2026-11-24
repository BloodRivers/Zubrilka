import { ChevronLeft } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";

export default function TopBar({ title, onBack, right }) {
  const { t } = useTheme();
  return (
    <div
      style={{
        padding: "22px 22px 10px 22px",
        paddingTop: "calc(18px + env(safe-area-inset-top))",
        paddingLeft: "calc(22px + env(safe-area-inset-left))",
        paddingRight: "calc(22px + env(safe-area-inset-right))",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, height: 36 }}>
        {onBack && (
          <button
            aria-label="Назад"
            onClick={onBack}
            className="press"
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              border: "none",
              background: t.raised,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={22} color={t.text} />
          </button>
        )}
        <div
          style={{
            color: t.text,
            fontSize: 21,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            flex: 1,
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        {right && (
          <div
            style={{
              color: t.sub,
              fontSize: 12,
              lineHeight: 1.2,
              maxWidth: "48%",
              flexShrink: 1,
              textAlign: "right",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {right}
          </div>
        )}
      </div>
    </div>
  );
}