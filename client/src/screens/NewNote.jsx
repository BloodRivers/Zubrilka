import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Check, FileText, FileType } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { EASE } from "../theme/theme";
import { useAlert } from "../components/Alert";
import Button from "../components/Button";
import { plural } from "../utils";
import { createNote } from "../api/firestore";
import { ocrNotePhotos, structureNote } from "../api/backend";
import { classifyAttachFile, extractPdfText, extractTextFile, extractDocxText, extractLegacyDoc, extractAttachImages, capNoteImages, downscaleImageFile } from "../api/files";
import { onAIStatus, aiUsedToday, AI_DAILY_LIMIT } from "../api/ai";

const WORK_PHRASES = [
  "Читаю между строк…",
  "Распутываю почерк…",
  "Перечитываю страницу…",
  "Собираю смысл в кучу…",
  "Шлифую формулировки…",
  "Достаю суть…",
  "Свожу всё в конспект…",
];

const ACCEPT =
  "image/*,application/pdf,.docx,.doc,"
  + "application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,"
  + "text/plain,text/markdown,text/csv,.pdf,.txt,.md,.markdown,.csv,.log";

const genericName = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `Конспект от ${dd}.${mm}.${yy}`;
};

const TITLE_OPTS = [
  { v: "ai", label: "От ИИ", sub: "Название, которое предложит модель" },
  { v: "generic", label: "Автодата", sub: `Конспект от ${genericName()}` },
  { v: "custom", label: "Своё", sub: "Напиши название вручную" },
];

let attachSeq = 0;
function nextAttachId() {
  attachSeq += 1;
  return `a${attachSeq}`;
}

export default function NewNote() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { t } = useTheme();
  const { alert } = useAlert();
  /** @type {[{id:string,kind:"image"|"pdf"|"text"|"docx",name:string,src?:string,text?:string,images?:[{name:string,src:string}]}]} */
  const [attachments, setAttachments] = useState([]);
  const [text, setText] = useState("");
  const [titleMode, setTitleMode] = useState("ai");
  const [customTitle, setCustomTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const fileRef = useRef(null);
  const [status, setStatus] = useState(null);
  const statusTimer = useRef(null);
  const [phraseIdx, setPhraseIdx] = useState(0);

  const photos = attachments.filter((a) => a.kind === "image");
  const docs = attachments.filter((a) => a.kind !== "image");
  const hasInput = attachments.length > 0 || text.trim() !== "";

  useEffect(() => {
    const off = onAIStatus((msg) => {
      setStatus(msg);
      clearTimeout(statusTimer.current);
      statusTimer.current = setTimeout(() => setStatus(null), 3500);
    });
    return off;
  }, []);

  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % WORK_PHRASES.length), 1500);
    return () => clearInterval(id);
  }, [busy]);

  const addFiles = async (e) => {
    const picked = [...(e.target.files || [])];
    e.target.value = "";
    if (!picked.length) return;

    const next = [];
    const errors = [];

    for (const file of picked) {
      const kind = classifyAttachFile(file);
      if (!kind) {
        errors.push(`«${file.name}» — нужен фото, PDF, Word (.docx) или текст (.txt/.md)`);
        continue;
      }
      try {
        if (kind === "image") {
          const src = await downscaleImageFile(file, 1280);
          next.push({ id: nextAttachId(), kind: "image", name: file.name, src });
        } else if (kind === "pdf" || kind === "docx") {
          const extracted = await (kind === "pdf" ? extractPdfText(file) : extractDocxText(file));
          next.push({
            id: nextAttachId(),
            kind,
            name: file.name,
            text: extracted,
            // Картинки из файла — то, чего нет в тексте. Фото-скан не трогаем:
            // его содержание уже в разборе.
            images: await extractAttachImages(file, kind),
          });
        } else if (kind === "doc") {
          const extracted = await extractLegacyDoc(file);
          next.push({
            id: nextAttachId(),
            kind: "docx",
            name: file.name,
            text: extracted,
          });
        } else {
          const extracted = await extractTextFile(file);
          next.push({
            id: nextAttachId(),
            kind: "text",
            name: file.name,
            text: extracted,
          });
        }
      } catch (err) {
        console.error("[newnote] file:", file.name, err);
        errors.push(err?.message || `Не удалось прочитать «${file.name}»`);
      }
    }

    if (next.length) setAttachments((prev) => [...prev, ...next]);
    if (errors.length) {
      alert(errors.join("\n"), { title: next.length ? "Часть файлов не добавлена" : "Не удалось" });
    }
  };

  const removeAttach = (id) => setAttachments((prev) => prev.filter((a) => a.id !== id));

  const submit = async () => {
    if (busy || submitting.current) return;
    if (!hasInput) {
      alert("Добавь фото, PDF, текстовый файл или вставь текст.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const chunks = [];
      const imageSrcs = photos.map((p) => p.src).filter(Boolean);
      if (imageSrcs.length) {
        const ocr = await ocrNotePhotos(imageSrcs);
        if (ocr?.trim()) chunks.push(ocr.trim());
      }
      for (const doc of docs) {
        if (doc.text?.trim()) {
          chunks.push(`--- ${doc.name} ---\n${doc.text.trim()}`);
        }
      }
      if (text.trim()) chunks.push(text.trim());

      const transcript = chunks.join("\n\n");
      if (!transcript.trim()) {
        alert("Не удалось получить текст из вложений.");
        return;
      }

      const parsed = await structureNote(transcript, {
        keepSourceText: docs.length > 0 || transcript.length > 10000,
      });
      if (!parsed.text?.trim()) {
        const e = new Error("Не удалось разобрать конспект — попробуй ещё раз или поправь текст");
        e.isParse = true;
        throw e;
      }

      const fallback = genericName();
      let title = fallback;
      if (titleMode === "ai") title = parsed.title || fallback;
      if (titleMode === "custom") title = customTitle.trim() || fallback;

      // Firestore не примет документ больше 1 МБ: текст и конспект уже заняли
      // часть места, картинкам остаётся остаток.
      const spent = new Blob([parsed.text, JSON.stringify(parsed.summary || "")]).size;
      await createNote({
        subject_id: subjectId,
        title,
        text: parsed.text,
        plan: null,
        summary: parsed.summary,
        retelling: parsed.retelling,
        images: capNoteImages(docs.flatMap((d) => d.images || []), 950_000 - spent),
      });
      navigate(-1);
    } catch (err) {
      console.error("[newnote] submit:", err);
      const msg = err?.message || "попробуй ещё раз";
      if (err?.isParse) {
        alert(msg);
      } else if (/failed to fetch|нет связи с polza|network/i.test(msg)) {
        alert(msg.includes("Polza") ? msg : "Нет связи с сервером ИИ. Проверь интернет и ключ Polza в Настройках.");
      } else {
        alert("Не удалось сохранить конспект: " + msg);
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const optionRow = (o) => {
    const active = titleMode === o.v;
    return (
      <button
        key={o.v}
        type="button"
        className="press"
        onClick={() => setTitleMode(o.v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          marginBottom: 8,
          borderRadius: 14,
          border: `1px solid ${active ? t.invBg : t.border}`,
          background: active ? t.raised : t.surface,
          cursor: "pointer",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <span
          style={{
            position: "relative",
            width: 20,
            height: 20,
            borderRadius: 999,
            border: `2px solid ${active ? t.invBg : t.sub}`,
            flexShrink: 0,
            boxSizing: "border-box",
          }}
        >
          {active && (
            <span
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 10,
                height: 10,
                borderRadius: 999,
                background: t.invBg,
              }}
            />
          )}
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", color: t.text, fontSize: 15, fontWeight: 600 }}>{o.label}</span>
          <span style={{ display: "block", color: t.sub, fontSize: 13, marginTop: 2 }}>{o.sub}</span>
        </span>
        {active && <Check size={16} color={t.invBg} strokeWidth={3} />}
      </button>
    );
  };

  const removeBtn = (id, label) => (
    <button
      type="button"
      aria-label={label}
      onClick={() => removeAttach(id)}
      style={{
        position: "absolute",
        top: -5,
        right: -5,
        width: 20,
        height: 20,
        borderRadius: 999,
        border: "none",
        background: t.invBg,
        color: t.inv,
        fontSize: 12,
        lineHeight: 1,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
    >
      ×
    </button>
  );

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        style={{ display: "none" }}
        onChange={addFiles}
      />

      <div style={{ marginBottom: 22 }}>
        <div style={{ color: t.sub, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 4px 10px" }}>
          Название конспекта
        </div>
        {TITLE_OPTS.map(optionRow)}
        {titleMode === "custom" && (
          <input
            autoFocus
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Название конспекта"
            style={{
              width: "100%",
              marginTop: 4,
              padding: "14px 16px",
              borderRadius: 14,
              border: `1px solid ${t.border}`,
              background: t.raised,
              color: t.text,
              fontSize: 15,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        )}
      </div>

      <div style={{ color: t.sub, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 4px 10px" }}>
        Файлы
      </div>
      <button
        type="button"
        className="press"
        onClick={() => fileRef.current?.click()}
        style={{
          width: "100%",
          padding: "16px",
          borderRadius: 16,
          border: `1px dashed ${t.border}`,
          background: t.raised,
          color: t.text,
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <Plus size={16} /> Добавить файлы
      </button>
      <div style={{ color: t.sub, fontSize: 12, margin: "6px 4px 0", lineHeight: 1.4 }}>
        Фото, PDF, Word (.docx) или текст (.txt, .md). PDF — с текстовым слоем (не скан).
        Картинки из PDF и Word попадут в конспект отдельной вкладкой.
      </div>

      {photos.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {photos.map((a) => (
            <div key={a.id} style={{ position: "relative" }}>
              <img
                src={a.src}
                alt={a.name || "Фото конспекта"}
                style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 12, border: `1px solid ${t.border}` }}
              />
              {removeBtn(a.id, "Убрать фото")}
            </div>
          ))}
        </div>
      )}

      {docs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {docs.map((a) => {
            const Icon = a.kind === "pdf" ? FileType : FileText;
            const chars = a.text?.length || 0;
            return (
              <div
                key={a.id}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${t.border}`,
                  background: t.raised,
                }}
              >
                <Icon size={18} color={t.sub} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      color: t.text,
                      fontSize: 14,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.name}
                  </div>
                  <div style={{ color: t.sub, fontSize: 12, marginTop: 2 }}>
                    {a.kind === "pdf" ? "PDF" : a.kind === "docx" ? "Word" : "Текст"} · ~{chars.toLocaleString("ru-RU")} симв.
                    {a.images?.length ? ` · ${a.images.length} ${plural(a.images.length, ["картинка", "картинки", "картинок"])}` : ""}
                  </div>
                </div>
                {removeBtn(a.id, "Убрать файл")}
              </div>
            );
          })}
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Или вставь текст конспекта…"
        rows={4}
        style={{
          width: "100%",
          marginTop: 14,
          padding: "14px 16px",
          borderRadius: 14,
          border: `1px solid ${t.border}`,
          background: t.raised,
          color: t.text,
          fontSize: 15,
          fontFamily: "inherit",
          outline: "none",
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />

      <Button variant="primary" onClick={submit} disabled={busy || !hasInput} style={{ marginTop: 18 }}>
        {busy ? "Анализирую…" : "Анализировать"}
      </Button>
      <div style={{ color: t.sub, fontSize: 12, margin: "8px 6px 0", lineHeight: 1.4, textAlign: "center" }}>
        Анализ — запросы к ИИ. Сегодня: {aiUsedToday()}/{AI_DAILY_LIMIT}.
      </div>

      {busy &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 400,
              background: t.bg,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              padding: "0 28px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                border: `2.5px solid ${t.border}`,
                borderTopColor: t.invBg,
                animation: "spin 800ms linear infinite",
              }}
            />
            <div style={{ color: t.text, fontSize: 17, fontWeight: 600 }}>Распознаём конспект…</div>
            <div
              key={status || WORK_PHRASES[phraseIdx]}
              style={{ color: status ? "#F5A623" : t.sub, fontSize: 13, lineHeight: 1.4, minHeight: 18, animation: `fadeUp 400ms ${EASE}` }}
            >
              {status || WORK_PHRASES[phraseIdx]}
            </div>
            <div style={{ color: t.sub, fontSize: 12, lineHeight: 1.4 }}>
              Не закрывай приложение. Это может занять до минуты.
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
