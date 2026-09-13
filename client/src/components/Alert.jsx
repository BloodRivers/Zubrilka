import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../theme/ThemeContext";

const AlertContext = createContext();

export function useAlert() {
  return useContext(AlertContext);
}

const EXIT_MS = 220;

export function AlertProvider({ children }) {
  const [state, setState] = useState(null);
  const timer = useRef(null);
  const cancelRef = useRef(null);

  const show = useCallback((message, opts = {}) => {
    if (timer.current) clearTimeout(timer.current);
    cancelRef.current = opts.onCancel ?? null;
    setState({
      message,
      title: opts.title ?? (opts.onConfirm ? "Подтверждение" : "Ошибка"),
      shake: opts.shake ?? (!opts.title && !opts.onConfirm),
      leaving: false,
      okLabel: opts.okLabel ?? "ОК",
      onConfirm: opts.onConfirm ?? null,
      confirmLabel: opts.confirmLabel ?? "ОК",
      danger: !!opts.danger,
    });
  }, []);

  const close = useCallback((fromConfirm = false) => {
    if (!fromConfirm && cancelRef.current) {
      try { cancelRef.current(); } catch { /* ignore */ }
    }
    cancelRef.current = null;
    setState((s) => (s ? { ...s, leaving: true } : s));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(null), EXIT_MS);
  }, []);

  return (
    <AlertContext.Provider value={{ alert: show }}>
      {children}
      {state && createPortal(<AlertModal {...state} onClose={close} />, document.body)}
    </AlertContext.Provider>
  );
}

function AlertModal({ title, message, leaving, onClose, okLabel, onConfirm, confirmLabel, danger, shake }) {
  const { t } = useTheme();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const btnBase = {
    flex: 1,
    padding: "13px 0",
    borderRadius: 14,
    border: "none",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
  };

  const twoCols = Boolean(onConfirm);

  return (
    <div
      onClick={() => onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 32px",
        zIndex: 200,
        animation: `${leaving ? "backdropOut" : "backdropIn"} 220ms ease-out forwards`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 300,
          background: t.surface,
          borderRadius: 20,
          padding: "26px 20px 20px 20px",
          textAlign: "center",
          boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
          animation: leaving
            ? "modalOut 220ms cubic-bezier(0.16,1,0.3,1) forwards"
            : shake
              ? "shakeX 450ms cubic-bezier(0.36,0.07,0.19,0.97)"
              : "modalIn 220ms cubic-bezier(0.16,1,0.3,1) forwards",
        }}
      >
        <div style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>{title}</div>
        <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.45, marginTop: 8 }}>{message}</div>
        {twoCols ? (
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button
              className="press"
              onClick={() => onClose()}
              style={{
                ...btnBase,
                background: t.surface,
                color: t.text,
                border: `1px solid ${t.border}`,
              }}
            >
              Отмена
            </button>
            <button
              className="press"
              onClick={() => {
                onClose(true);
                onConfirm();
              }}
              style={{
                ...btnBase,
                background: danger ? "#E5484D" : t.invBg,
                color: danger ? "#fff" : t.inv,
              }}
            >
              {confirmLabel}
            </button>
          </div>
        ) : (
          <button
            className="press"
            onClick={() => onClose()}
            style={{
              marginTop: 20,
              width: "100%",
              ...btnBase,
              background: t.invBg,
              color: t.inv,
            }}
          >
            {okLabel}
          </button>
        )}
      </div>
    </div>
  );
}
