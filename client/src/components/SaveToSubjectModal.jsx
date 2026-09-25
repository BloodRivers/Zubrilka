import { useTheme } from "../theme/ThemeContext";
import Modal from "./Modal";

/** Модалка выбора предмета для сохранения конспекта/теста из библиотеки. */
export default function SaveToSubjectModal({ open, onClose, onPick, subjects, busy, hint }) {
  const { t } = useTheme();

  return (
    <Modal open={open} onClose={onClose} title="Куда сохранить" maxWidth={340} maxHeight="70dvh" pad="20px 18px 16px" allowClose={() => !busy}>
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
    </Modal>
  );
}