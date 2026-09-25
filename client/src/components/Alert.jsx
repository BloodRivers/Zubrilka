import { createContext, useCallback, useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "./Modal";
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
    <Modal
      open
      onClose={onClose}
      leaving={leaving}
      maxWidth={300}
      radius={20}
      pad="26px 20px 20px 20px"
      bodyAnim={shake && !leaving ? "shakeX 450ms cubic-bezier(0.36,0.07,0.19,0.97)" : undefined}
      style={{ textAlign: "center" }}
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
              background: danger ? t.danger : t.invBg,
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
    </Modal>
  );
}
