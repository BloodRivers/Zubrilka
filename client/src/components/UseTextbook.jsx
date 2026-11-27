import { useEffect, useState } from "react";
import { useTheme } from "../theme/ThemeContext";
import Dropdown from "./Dropdown";
import FieldLabel from "./FieldLabel";
import Switch from "./Switch";
import { sfx } from "../sfx";
import { plural } from "../utils";
import { listTextbooks } from "../api/firestore";
import { parseTextbookPages, textbookLink } from "../textbookPage";

/** Свитч в редакторе конспекта: выбрать учебник и добавить страницы в конспект. */
export default function UseTextbook({ subjectId, onLinks }) {
  const { t, theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [books, setBooks] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [bookId, setBookId] = useState("");
  const [pages, setPages] = useState("");
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!open || !subjectId) return;
    let alive = true;
    listTextbooks(subjectId)
      .then((list) => { if (alive) setBooks(list); })
      .catch((e) => { if (alive) setLoadError(e?.message || "Не удалось загрузить учебники"); });
    return () => { alive = false; };
  }, [open, subjectId]);

  const book = books.find((b) => b.id === bookId) || books[0];
  const parsed = pages.trim() ? parseTextbookPages(pages) : { pages: [], error: "" };
  const linkText = book && !parsed.error && parsed.pages.length
    ? parsed.pages.map((page) => textbookLink(book, page)).join("\n")
    : "";

  useEffect(() => { onLinks(linkText); }, [linkText, onLinks]);

  return (
    <div style={{ marginTop: 14, borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          sfx.tap();
          setSettled(false);
          if (open) { setPages(""); setBookId(""); }
          setOpen(!open);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          width: "100%",
          padding: "16px 18px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", color: t.text, fontSize: 16, fontWeight: 700 }}>Использовать учебник</span>
          <span style={{ display: "block", color: t.sub, fontSize: 12, marginTop: 3 }}>
            Страницы учебника добавятся в конспект
          </span>
        </span>
        <Switch on={open} />
      </button>

      <div
        className={`accordion${open ? " open" : ""}`}
        onTransitionEnd={(e) => { if (e.target === e.currentTarget) setSettled(open); }}
      >
        <div className="accordion-inner" style={{ overflow: open && settled ? "visible" : "hidden" }}>
          <div style={{ padding: "0 18px 14px" }}>
            {!subjectId ? (
              <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.45 }}>
                Открой конспект из предмета — тогда здесь появятся его учебники.
              </div>
            ) : loadError ? (
              <div style={{ color: t.danger, fontSize: 13 }}>{loadError}</div>
            ) : books.length === 0 ? (
              <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.45 }}>
                В этом предмете нет учебников. Добавь их на странице предмета.
              </div>
            ) : (
              <>
                <FieldLabel t={t}>Учебник</FieldLabel>
                <Dropdown
                  t={t}
                  theme={theme}
                  options={books.map((b) => ({ v: b.id, label: b.title }))}
                  value={book?.id}
                  onChange={(id) => { sfx.tap(); setBookId(id); }}
                  placeholder="Выбери учебник"
                  inset={0}
                  rowStyle={{
                    width: "100%",
                    marginBottom: 8,
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: `1px solid ${t.border}`,
                    background: t.raised,
                  }}
                />

                <FieldLabel t={t} style={{ marginTop: 14, marginBottom: 8 }}>Страницы</FieldLabel>
                <input
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
                  placeholder="1-4,7,9,11-20"
                  aria-label="Страницы учебника"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "13px 14px",
                    borderRadius: 14,
                    border: `1px solid ${parsed.error ? t.danger : t.border}`,
                    background: t.raised,
                    color: t.text,
                    fontFamily: "inherit",
                    fontSize: 15,
                    outline: "none",
                  }}
                />
                {parsed.error ? (
                  <div style={{ color: t.danger, fontSize: 12, marginTop: 6 }}>{parsed.error}</div>
                ) : (
                  <div style={{ color: t.sub, fontSize: 12, marginTop: 6 }}>
                    {linkText
                      ? `${parsed.pages.length} ${plural(parsed.pages.length, ["страница", "страницы", "страниц"])} уже в конспекте`
                      : "Страницы появятся здесь, когда укажешь номера"}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
