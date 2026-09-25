import { useEffect, useState } from "react";
import { useTheme } from "../theme/ThemeContext";
import { useAlert } from "./Alert";
import Button from "./Button";
import Modal from "./Modal";
import FieldLabel from "./FieldLabel";
import Switch from "./Switch";
import { setTestPublic, updateTest, getTest, deleteTest } from "../api/firestore";
import { auth } from "../firebase";

/**
 * Модалка теста: публикация в библиотеке и удаление.
 * @param {{ open: boolean, testId: string, title?: string, onClose: () => void, onChanged?: () => void }} props
 */
export default function TestEditModal({ open, testId, title, subjectName, onClose, onChanged }) {
  const { t } = useTheme();
  const { alert } = useAlert();
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [label, setLabel] = useState(title || "Тест");

  useEffect(() => {
    if (!open || !testId) return undefined;
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

  const save = async () => {
    if (!canEdit || busy || !testId) return;
    const finalTitle = String(label || "").trim();
    if (!finalTitle) {
      alert("Введи название теста.");
      return;
    }
    setBusy(true);
    try {
      await updateTest(testId, { title: finalTitle });
      await setTestPublic(testId, isPublic, subjectName);
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

  const requestClose = () => onClose();

  return (
    <Modal open={open} onClose={onClose} title="Редактировать тест" allowClose={() => !busy}>
      <div style={{ color: t.sub, fontSize: 13, marginBottom: 16, lineHeight: 1.4 }}>
        Дай тесту понятное название — так проще его найти среди других.
      </div>

      <FieldLabel t={t}>Название</FieldLabel>
      <input
        value={label}
        disabled={!canEdit || busy}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Название теста"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "13px 16px",
          borderRadius: 14,
          border: `1px solid ${t.border}`,
          background: t.raised,
          color: t.text,
          fontSize: 15,
          fontFamily: "inherit",
          outline: "none",
          marginBottom: 16,
          opacity: canEdit ? 1 : 0.6,
        }}
      />

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
            color: t.danger,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Удалить тест
        </button>
      )}
    </Modal>
  );
}