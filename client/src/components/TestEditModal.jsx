import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { useAlert } from "./Alert";
import Button from "./Button";
import Switch from "./Switch";
import { setTestPublic, getTest, deleteTest } from "../api/firestore";
import { auth } from "../firebase";

function FieldLabel({ children, t }) {
  return (
    <div style={{ color: t.sub, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 8px 2px" }}>
      {children}
    </div>
  );
}

/**
 * Модалка теста: публикация в библиотеке и удаление.
 * @param {{ open: boolean, testId: string, title?: string, onClose: () => void, onChanged?: () => void }} props
 */
export default function TestEditModal({ open, testId, title, onClose, onChanged }) {
  const { t } = useTheme();
  const { alert } = useAlert();
  const [isPublic, setIsPublic] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [label, setLabel] = useState(title || "Тест");
  const timer = useRef(null);

  useEffect(() => {
    if (!open || !testId) return undefined;
    setLeaving(false);
    setLabel(title || "Тест");
    let cancelled = false;
    (async () => {
      try {
        const test = await getTest(testId);
        if (cancelled) return;
        setIsPublic(!!test?.public);
        setCanEdit(!test?.owner_id || test.owner_id === auth.currentUser?.uid);
        if (test?.title) setLabel(test.title);
      } catch {
        if (!cancelled) setCanEdit(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, testId, title]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const requestClose = () => {
    if (leaving || busy) return;
    setLeaving(true);
    timer.current = setTimeout(() => {
      setLeaving(false);
      onClose();
    }, 220);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, leaving, busy]);

  const save = async () => {
    if (!canEdit || busy || !testId) return;
    setBusy(true);
    try {
      await setTestPublic(testId, isPublic);
      onChanged?.();
      requestClose();
    } catch (e) {
      alert(e?.message || "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!canEdit || busy || !testId) return;
    alert(`Удалить тест «${label}» и его результаты?`, {
      danger: true,
      confirmLabel: "Удалить",
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteTest(testId);
          onChanged?.();
          requestClose();
        } catch (e) {
          alert(e?.message || "Не удалось удалить тест");
        } finally {
          setBusy(false);
        }
      },
    });
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
        padding: "0 32px",
        zIndex: 200,
        animation: `${leaving ? "backdropOut" : "backdropIn"} 220ms ease-out forwards`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 320,
          background: t.surface,
          borderRadius: 22,
          padding: "22px 20px 20px 20px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
          animation: `${leaving ? "modalOut" : "modalIn"} 220ms cubic-bezier(0.16,1,0.3,1) forwards`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>Редактировать тест</div>
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

        <div style={{ color: t.sub, fontSize: 13, marginBottom: 16, lineHeight: 1.4 }}>
          {label}
        </div>

        <FieldLabel t={t}>Параметры</FieldLabel>
        <button
          type="button"
          onClick={() => canEdit && setIsPublic((p) => !p)}
          className="press"
          disabled={!canEdit || busy}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            width: "100%",
            marginBottom: 16,
            padding: "14px 16px",
            borderRadius: 14,
            border: `1px solid ${t.border}`,
            background: t.raised,
            cursor: canEdit ? "pointer" : "default",
            fontFamily: "inherit",
            textAlign: "left",
            opacity: canEdit ? 1 : 0.6,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>В библиотеке</div>
            <div style={{ color: t.sub, fontSize: 12, marginTop: 3, lineHeight: 1.35 }}>
              Тест увидят все пользователи
            </div>
          </div>
          <Switch on={isPublic} disabled={!canEdit} />
        </button>

        <Button type="button" variant="primary" onClick={save} disabled={!canEdit || busy}>
          {busy ? "Сохраняю…" : "Сохранить"}
        </Button>

        {canEdit && (
          <button
            type="button"
            className="press"
            onClick={confirmDelete}
            disabled={busy}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "16px",
              borderRadius: 999,
              border: "none",
              background: "transparent",
              color: "#E5484D",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Удалить тест
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
