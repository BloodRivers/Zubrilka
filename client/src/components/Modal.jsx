import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { EASE } from "../theme/theme";

const EXIT_MS = 220;
const SHADOW = "0 24px 48px rgba(0,0,0,0.35)";

export default function Modal({
  open,
  onClose,
  title,
  leaving: controlledLeaving,
  maxWidth = 320,
  pad = "22px 20px 20px 20px",
  radius = 22,
  zIndex = 200,
  backdrop = "rgba(0,0,0,0.45)",
  backdropPad = "0 32px",
  maxHeight,
  bodyAnim,
  style,
  allowClose = () => true,
  children,
}) {
  const { t } = useTheme();
  const [leavingState, setLeavingState] = useState(false);
  const controlled = controlledLeaving !== undefined;
  const leaving = controlled ? controlledLeaving : leavingState;
  const leavingRef = useRef(false);
  const timer = useRef(null);
  const allowRef = useRef(allowClose);
  allowRef.current = allowClose;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (open) leavingRef.current = false;
  }, [open]);

  const requestClose = useCallback(() => {
    if (leavingRef.current || !allowRef.current()) return;
    leavingRef.current = true;
    setLeavingState(true);
    timer.current = setTimeout(() => {
      leavingRef.current = false;
      setLeavingState(false);
      onCloseRef.current();
    }, EXIT_MS);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (controlled) onCloseRef.current();
      else requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, controlled, requestClose]);

  if (!open && !leaving) return null;

  return createPortal(
    <div
      onClick={controlled ? onCloseRef.current : requestClose}
      style={{
        position: "fixed",
        inset: 0,
        background: backdrop,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: backdropPad,
        zIndex,
        animation: `${leaving ? "backdropOut" : "backdropIn"} ${EXIT_MS}ms ease-out forwards`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          maxHeight,
          overflow: maxHeight ? "auto" : undefined,
          background: t.surface,
          borderRadius: radius,
          padding: pad,
          boxShadow: SHADOW,
          animation: leaving
            ? `modalOut ${EXIT_MS}ms ${EASE} forwards`
            : bodyAnim || `modalIn ${EXIT_MS}ms ${EASE} forwards`,
          ...style,
        }}
      >
        {title && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>{title}</div>
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
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}