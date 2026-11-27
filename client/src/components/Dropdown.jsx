import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { EASE } from "../theme/theme";

/** Выпадающий выбор: та же механика, что у дропдауна темы в Настройках. */
export default function Dropdown({
  t,
  theme,
  options,
  value,
  onChange,
  title,
  placeholder = "Выбери",
  rowStyle,
  inset = 8,
  maxHeight = 240,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation(); // не закрываем модалку вместе с дропдауном
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const current = options.find((o) => o.v === value);

  return (
    <div
      onClick={() => setOpen((o) => !o)}
      style={{ position: "relative", ...rowStyle, justifyContent: "space-between", gap: 12, cursor: "pointer", zIndex: open ? 30 : undefined }}
    >
      {title && <span style={{ color: t.text, fontSize: 15, pointerEvents: "none" }}>{title}</span>}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: title ? "right" : "left",
          color: title ? t.sub : t.text,
          fontSize: 14,
          fontWeight: 600,
          pointerEvents: "none",
        }}
      >
        {current?.label || placeholder}
      </span>
      <ChevronDown
        size={16}
        color={t.sub}
        style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : undefined, transition: "transform 200ms ease" }}
      />

      {open && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 10, background: "transparent" }} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: inset,
              right: inset,
              zIndex: 20,
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 16,
              padding: 6,
              boxShadow: theme === "dark" ? "0 16px 40px rgba(0,0,0,0.6)" : "0 16px 40px rgba(0,0,0,0.15)",
              animation: `modalIn 160ms ${EASE}`,
              maxHeight,
              overflowY: "auto",
            }}
          >
            {options.length === 0 && (
              <div style={{ color: t.sub, fontSize: 13, padding: "10px 12px" }}>Ничего не нашлось</div>
            )}
            {options.map((o) => {
              const active = o.v === value;
              return (
                <button
                  key={o.v}
                  type="button"
                  className="rowpress"
                  onClick={() => { onChange(o.v); setOpen(false); }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "none",
                    background: "transparent",
                    color: t.text,
                    fontSize: 15,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                  {active && <Check size={16} color={t.invBg} strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
