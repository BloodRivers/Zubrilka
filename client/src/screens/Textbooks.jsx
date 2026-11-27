import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Pencil, Plus, Upload } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { EASE } from "../theme/theme";
import { useAlert } from "../components/Alert";
import Button from "../components/Button";
import Modal from "../components/Modal";
import {
  createTextbook,
  deleteTextbook,
  listTextbooks,
  updateTextbook,
} from "../api/firestore";
import { deleteBookPdf, getBookPdf, saveBookPdf } from "../bookStore";

export default function Textbooks({ subjectId }) {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { alert } = useAlert();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const list = await listTextbooks(subjectId);
    const withLocal = await Promise.all(
      list.map(async (b) => ({ ...b, local: !!(await getBookPdf(b.id)) }))
    );
    setBooks(withLocal);
    setLoading(false);
  }, [subjectId]);

  useEffect(() => {
    load().catch((e) => {
      alert("Не удалось загрузить учебники: " + (e?.message ?? ""));
      setLoading(false);
    });
  }, [alert, load]);

  const add = async () => {
    if (!title.trim() || !file) {
      alert("Введи название и выбери PDF-файл.");
      return;
    }
    if (!/\.pdf$/i.test(file.name || "") && file.type !== "application/pdf") {
      alert("Нужен PDF-файл.");
      return;
    }
    setBusy(true);
    let id = null;
    try {
      const ref = await createTextbook({ subject_id: subjectId, title });
      id = ref.id;
      await saveBookPdf(ref.id, file);
      setTitle("");
      setFile(null);
      setOpen(false);
      await load();
    } catch (e) {
      if (id) await deleteTextbook(id).catch(() => {});
      alert("Не удалось добавить учебник: " + (e?.message ?? ""));
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || !editTitle.trim()) return;
    setBusy(true);
    try {
      await updateTextbook(editing.id, { title: editTitle });
      setEditing(null);
      await load();
    } catch (e) {
      alert("Не удалось сохранить учебник: " + (e?.message ?? ""));
    } finally {
      setBusy(false);
    }
  };

  const remove = (book) => {
    alert(`Удалить «${book.title}»? PDF будет удалён с этого устройства.`, {
      danger: true,
      confirmLabel: "Удалить",
      onConfirm: async () => {
        try {
          await deleteTextbook(book.id);
          await deleteBookPdf(book.id);
          setEditing(null);
          await load();
        } catch (e) {
          alert("Не удалось удалить учебник: " + (e?.message ?? ""));
        }
      },
    });
  };

  const field = {
    boxSizing: "border-box",
    width: "100%",
    padding: "13px 14px",
    borderRadius: 14,
    border: `1px solid ${t.border}`,
    background: t.raised,
    color: t.text,
    fontSize: 15,
    fontFamily: "inherit",
    outline: "none",
  };

  return (
    <div>
      <div style={{ color: t.sub, fontSize: 12, lineHeight: 1.45, marginBottom: 14 }}>
        Название хранится в аккаунте, PDF — только на этом устройстве. Ссылку на страницу можно вставить в конспект.
      </div>

      {loading ? (
        <div style={{ color: t.sub, fontSize: 14, padding: "20px 4px" }}>Загружаем…</div>
      ) : books.length === 0 ? (
        <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.5, padding: "20px 4px" }}>
          Пока нет учебников. Добавь PDF — и он откроется здесь же, без фотографий.
        </div>
      ) : (
        books.map((book, i) => (
          <div
            key={book.id}
            className="rowpress"
            onClick={() => navigate(`/textbook/${book.id}`, { state: { from: `/subject/${subjectId}` } })}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 0",
              borderBottom: `1px solid ${t.border}`,
              cursor: "pointer",
              animation: `fadeUp 460ms ${EASE} both`,
              animationDelay: `${i * 50}ms`,
            }}
          >
            <span
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                background: t.raised,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <BookOpen size={20} color={t.text} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: t.text, fontSize: 16, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {book.title}
              </div>
              <div style={{ color: t.sub, fontSize: 12, marginTop: 3 }}>
                {book.local ? "PDF на устройстве" : "PDF не загружен"}
              </div>
            </div>
            <button
              type="button"
              aria-label={`Редактировать ${book.title}`}
              onClick={(e) => {
                e.stopPropagation();
                setEditing(book);
                setEditTitle(book.title);
              }}
              style={{
                flexShrink: 0,
                padding: 8,
                border: "none",
                background: "none",
                color: t.sub,
                cursor: "pointer",
              }}
            >
              <Pencil size={18} />
            </button>
          </div>
        ))
      )}

      <Button variant="dashed" onClick={() => setOpen(true)} style={{ padding: "13px", marginTop: 14 }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Plus size={17} /> Добавить учебник
        </span>
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Новый учебник" maxWidth={340}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название, например «Алгебра 10 класс»"
          style={{ ...field, marginBottom: 8 }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="press"
          onClick={() => fileRef.current?.click()}
          style={{
            ...field,
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            color: file ? t.text : t.sub,
          }}
        >
          <Upload size={16} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file ? file.name : "Выбрать PDF с устройства"}
          </span>
        </button>
        <Button onClick={add} disabled={busy || !title.trim() || !file} style={{ marginTop: 14 }}>
          {busy ? "Сохраняем…" : "Добавить"}
        </Button>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Учебник" maxWidth={340}>
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Название учебника"
          style={field}
        />
        <Button onClick={saveEdit} disabled={busy || !editTitle.trim()} style={{ marginTop: 14 }}>
          {busy ? "Сохраняем…" : "Сохранить"}
        </Button>
        <button
          type="button"
          className="press"
          onClick={() => remove(editing)}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "16px",
            borderRadius: 999,
            border: "none",
            background: t.danger,
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Удалить учебник
        </button>
      </Modal>
    </div>
  );
}
