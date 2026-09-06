import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Check } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { useAlert } from "../components/Alert";
import Button from "../components/Button";
import { createNote } from "../api/firestore";
import { analyzeNote } from "../api/backend";
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

async function readFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function compressImage(dataUrl, max = 1280) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Не удалось декодировать фото (нужен JPG/PNG, не HEIC)"));
    i.src = dataUrl;
  });
  if (!img.width || !img.height) {
    throw new Error("Фото с нулевым размером — не загрузилось");
  }
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL("image/jpeg", 0.8);
  if (out.length < 5000) {
    throw new Error("После сжатия фото почти пустое — попробуй другое");
  }
  return out;
}

const genericName = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `Конспект от ${dd}.${mm}.${yy}`;
};

const TITLE_OPTS = [
  { v: "ai", label: "От ИИ", sub: "Название, которое предложит модель" },
  { v: "generic", label: "Автодата", sub: "Конспект от 05.09.26" },
  { v: "custom", label: "Своё", sub: "Напиши название вручную" },
];

export default function NewNote() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { t } = useTheme();
  const { alert } = useAlert();
  const [photos, setPhotos] = useState([]);
  const [text, setText] = useState("");
  const [titleMode, setTitleMode] = useState("ai");
  const [customTitle, setCustomTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const fileRef = useRef(null);
  const [status, setStatus] = useState(null);
  const statusTimer = useRef(null);
  const [phraseIdx, setPhraseIdx] = useState(0);

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
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith("image/"));
    if (!files.length) {
      e.target.value = "";
      return;
    }
    try {
      // сразу жмём до JPEG — в state лежит то, что реально уйдёт в ИИ
      const urls = await Promise.all(
        files.map(async (f) => compressImage(await readFile(f)))
      );
      setPhotos((p) => [...p, ...urls]);
    } catch (err) {
      console.error("[newnote] addFiles:", err);
      alert(err?.message || "Не удалось прочитать фото");
    }
    e.target.value = "";
  };

  const submit = async () => {
    if (busy || submitting.current) return;
    if (photos.length === 0 && text.trim() === "") {
      alert("Добавь фото или вставь текст конспекта.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      let parsed = { title: "", text: "", retelling: "", topics: [], plan: [] };
      if (photos.length) {
        // уже JPEG после addFiles; повторный compress на всякий случай
        const comp = await Promise.all(photos.map((p) => compressImage(p)));
        parsed = await analyzeNote(comp);
        if (!parsed.text?.trim()) {
          const e = new Error("Не удалось распознать текст на фото — попробуй ещё раз или вставь текст вручную");
          e.isParse = true;
          throw e;
        }
      }
      const body = (parsed.text ? parsed.text : "") + (text ? (parsed.text ? "\n\n" : "") + text : "");
      if (!body.trim()) {
        alert("Добавь фото или вставь текст конспекта.");
        return;
      }
      const fallback = genericName();
      let title = fallback;
      if (titleMode === "ai") title = parsed.title || fallback;
      if (titleMode === "custom") title = customTitle.trim() || fallback;
      await createNote({
        subject_id: subjectId,
        title,
        text: body,
        topics: parsed.topics,
        plan: parsed.plan,
        retelling: parsed.retelling,
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

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={addFiles} />

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

      <div style={{ color: t.sub, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 4px 10px" }}>Фото</div>
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
        <Plus size={16} /> Добавить фото
      </button>
      <div style={{ color: t.sub, fontSize: 12, margin: "6px 4px 0", lineHeight: 1.4 }}>
        Можно несколько — фотографируй страницу ровно, без бликов.
      </div>

      {photos.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {photos.map((src, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img
                src={src}
                alt="Фото конспекта"
                style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 12, border: `1px solid ${t.border}` }}
              />
              <button
                type="button"
                aria-label="Убрать фото"
                onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
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
            </div>
          ))}
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

      <Button variant="primary" onClick={submit} disabled={busy || (photos.length === 0 && text.trim() === "")} style={{ marginTop: 18 }}>
        {busy ? "Анализирую…" : "Анализировать"}
      </Button>
      <div style={{ color: t.sub, fontSize: 12, margin: "8px 6px 0", lineHeight: 1.4, textAlign: "center" }}>
        Анализ — это 1 запрос к ИИ. Сегодня: {aiUsedToday()}/{AI_DAILY_LIMIT}.
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
              style={{ color: status ? "#F5A623" : t.sub, fontSize: 13, lineHeight: 1.4, minHeight: 18, animation: "fadeUp 400ms cubic-bezier(0.16,1,0.3,1)" }}
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