import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import MarkdownText from "./MarkdownText";

/** Карточка теории с раскрытием: Markdown и произвольное содержимое внутрь. */
export default function TheoryCard({ group, children }) {
  const { t } = useTheme();
  const [open, setOpen] = useState(true);
  const danger = group.tone === "danger";

  return (
    <div style={{ borderRadius: 20, border: `1px solid ${danger ? t.danger : t.border}`, background: danger ? t.dangerTint : t.surface, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          width: "100%", padding: "16px 18px", background: "none", border: "none",
          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}
      >
        <span style={{ color: danger ? t.danger : t.text, fontSize: 16, fontWeight: 700 }}>{group.title}</span>
        <ChevronDown
          size={18}
          color={danger ? t.danger : t.sub}
          style={{ flex: "0 0 auto", transform: open ? "rotate(180deg)" : "none", transition: "transform 240ms ease" }}
        />
      </button>
      <div className={`accordion${open ? " open" : ""}`}>
        <div className="accordion-inner">
          <div style={{ padding: "0 18px 14px" }}>
            <MarkdownText text={group.md} t={t} />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
