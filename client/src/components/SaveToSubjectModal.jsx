import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";

/** Модалка выбора предмета для сохранения конспекта/теста из библиотеки. */
export default function SaveToSubjectModal({ open, onClose, onPick, subjects, busy, hint }) {
  const { t } = useTheme();
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const requestClose = () => {
    if (leaving || busy) return;
    setLeaving(true);
    timer.current = setTimeout(() => {
      setLeaving(false);
      onClose();
    }, 220);
  };

  if (!open && !leaving) return null;

  return createPortal(
    <div
      onClick={requestClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 28px",
        zIndex: 200,
        animation: `${leaving ? "backdropOut" : "backdropIn"} 220ms ease-out forwards`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 340,
          maxHeight: "70dvh",
          overflow: "auto",
          background: t.surface,
          borderRadius: 22,
          padding: "20px 18px 16px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
          animation: `${leaving ? "modalOut" : "modalIn"} 220ms cubic-bezier(0.16,1,0.3,1) forwards`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>Куда сохранить</div>
          <button
            type="button"
            className="press"
            onClick={requestClose}
            aria-label="Закрыть"
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: "none",
              background: t.raised,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={15} color={t.sub} />
          </button>
        </div>
        <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.4, marginBottom: 14 }}>
          {hint || "Появится в выбранном предмете — только у тебя."}
        </div>
        {subjects.length === 0 ? (
          <div style={{ color: t.sub, fontSize: 14, padding: "8px 0 12px" }}>
            Сначала создай предмет на вкладке «Предметы».
          </div>
        ) : (
          subjects.map((s) => (
            <button
              key={s.id}
              type="button"
              className="rowpress"
              disabled={busy}
              onClick={() => onPick(s)}
              style={{
                width: "100%",
                display: "block",
                textAlign: "left",
                padding: "14px 16px",
                marginBottom: 8,
                borderRadius: 14,
                border: `1px solid ${t.border}`,
                background: t.raised,
                color: t.text,
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {s.name}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body
  );
}
