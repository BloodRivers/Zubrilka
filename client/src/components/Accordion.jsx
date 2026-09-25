import { ChevronRight } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { EASE } from "../theme/theme";

export default function Accordion({ title, open, onToggle, children }) {
  const { t } = useTheme();
  return (
    <div style={{ borderBottom: `1px solid ${t.border}` }}>
      <button
        onClick={onToggle}
        className="rowpress"
        style={{
          width: "100%",
          padding: "16px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
        }}
      >
        <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>{title}</div>
        <ChevronRight
          size={16}
          color={t.sub}
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: `transform 300ms ${EASE}`,
          }}
        />
      </button>
      <div className={`accordion ${open ? "open" : ""}`}>
        <div className="accordion-inner">
          <div style={{ paddingBottom: 16 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
