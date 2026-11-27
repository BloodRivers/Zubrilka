import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { ChevronLeft, ChevronRight, Link2, Upload } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { useAlert } from "../components/Alert";
import Button from "../components/Button";
import { getTextbook } from "../api/firestore";
import { getBookPdf, saveBookPdf } from "../bookStore";
import { setScreenTitle } from "../nav";
import { textbookPage } from "../textbookPage";

GlobalWorkerOptions.workerSrc = pdfWorker;
// Сканы учебников сжимаются в JBIG2 — без wasm pdf.js их не рисует.
const PDF_WASM_URL = "/pdfjs-wasm/";

export default function TextbookReader() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTheme();
  const { alert } = useAlert();
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const [book, setBook] = useState(undefined);
  const [blob, setBlob] = useState(undefined);
  const [pdf, setPdf] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const page = textbookPage(searchParams.get("page"), numPages);

  const goTo = (n) => {
    setSearchParams({ page: String(n) }, { replace: true });
    canvasRef.current?.closest?.(".scrollarea")?.scrollTo({ top: 0 });
  };

  useEffect(() => {
    let alive = true;
    Promise.all([getTextbook(id), getBookPdf(id)])
      .then(([b, localPdf]) => {
        if (!alive) return;
        setBook(b);
        setBlob(localPdf || null);
        setScreenTitle(b?.title || "Учебник");
      })
      .catch((e) => {
        if (alive) {
          setBook(null);
          setError(e?.message || "Не удалось загрузить учебник");
        }
      });
    return () => {
      alive = false;
      setScreenTitle(null);
    };
  }, [id]);

  useEffect(() => {
    if (!blob) return undefined;
    let alive = true;
    let task;
    (async () => {
      const data = new Uint8Array(await blob.arrayBuffer());
      task = getDocument({
        data,
        disableFontFace: true,
        useSystemFonts: true,
        wasmUrl: PDF_WASM_URL,
      });
      const doc = await task.promise;
      if (!alive) {
        task.destroy().catch(() => {});
        return;
      }
      setPdf(doc);
      setNumPages(doc.numPages);
      setError("");
    })().catch((e) => {
      if (alive) setError("Не удалось открыть PDF: " + (e?.message ?? ""));
    });
    return () => {
      alive = false;
      setPdf(null);
      // pdf.js v6: destroy() есть у loading task, а не у PDFDocumentProxy.
      task?.destroy().catch(() => {});
    };
  }, [blob]);

  useEffect(() => {
    if (!pdf || !page) return undefined;
    let alive = true;
    let task;
    (async () => {
      const p = await pdf.getPage(page);
      if (!alive) return;
      const viewport = p.getViewport({ scale: 2 });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = p.render({ canvasContext: canvas.getContext("2d"), viewport });
      await task.promise;
    })().catch((e) => {
      if (alive && e?.name !== "RenderingCancelledException") {
        setError("Не удалось показать страницу: " + (e?.message ?? ""));
      }
    });
    return () => {
      alive = false;
      task?.cancel();
    };
  }, [pdf, page]);

  const attach = async (file) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name || "") && file.type !== "application/pdf") {
      alert("Нужен PDF-файл.");
      return;
    }
    try {
      await saveBookPdf(id, file);
      setBlob(file);
      setError("");
    } catch (e) {
      alert("Не удалось сохранить PDF на устройстве: " + (e?.message ?? ""));
    }
  };

  const copyLink = async () => {
    try {
      const href = `${window.location.pathname}?page=${page}`;
      const label = book.title.replaceAll("[", "").replaceAll("]", "");
      await navigator.clipboard.writeText(`[${label}, с. ${page}](${href})`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("Не удалось скопировать ссылку.");
    }
  };

  if (book === undefined) {
    return <div style={{ color: t.sub, fontSize: 14, padding: "20px 4px" }}>Открываем учебник…</div>;
  }

  if (!book) {
    return <div style={{ color: t.sub, fontSize: 14, padding: "20px 4px" }}>Учебник не найден.</div>;
  }

  if (!blob) {
    return (
      <div>
        <div style={{ color: t.text, fontSize: 18, fontWeight: 700 }}>{book.title}</div>
        <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.5, margin: "10px 0 18px" }}>
          PDF этого учебника нет на этом устройстве. Выбери файл — он останется только здесь.
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => attach(e.target.files?.[0])}
          style={{ display: "none" }}
        />
        <Button variant="dashed" onClick={() => fileRef.current?.click()}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Upload size={17} /> Прикрепить PDF
          </span>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          position: "sticky",
          top: 0,
          zIndex: 2,
          background: t.bg,
          padding: "6px 0",
        }}
      >
        <button
          type="button"
          aria-label="Предыдущая страница"
          disabled={page <= 1}
          onClick={() => goTo(page - 1)}
          style={{ padding: 8, border: "none", background: "none", color: t.text, cursor: "pointer", opacity: page <= 1 ? 0.35 : 1 }}
        >
          <ChevronLeft size={20} />
        </button>
        <input
          aria-label="Номер страницы"
          type="number"
          min={1}
          max={numPages || undefined}
          value={page}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (n >= 1 && n <= (numPages || n)) goTo(n);
          }}
          style={{
            width: 62,
            padding: "8px 6px",
            textAlign: "center",
            borderRadius: 10,
            border: `1px solid ${t.border}`,
            background: t.surface,
            color: t.text,
            fontFamily: "inherit",
            fontSize: 14,
          }}
        />
        <span style={{ color: t.sub, fontSize: 13 }}>/ {numPages || "…"}</span>
        <button
          type="button"
          aria-label="Следующая страница"
          disabled={page >= numPages}
          onClick={() => goTo(page + 1)}
          style={{ padding: 8, border: "none", background: "none", color: t.text, cursor: "pointer", opacity: page >= numPages ? 0.35 : 1 }}
        >
          <ChevronRight size={20} />
        </button>
        <button
          type="button"
          className="press"
          onClick={copyLink}
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 12px",
            borderRadius: 999,
            border: `1px solid ${t.border}`,
            background: t.surface,
            color: t.text,
            fontSize: 13,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <Link2 size={15} /> {copied ? "Скопировано" : "В конспект"}
        </button>
      </div>
      {error && <div style={{ color: t.danger, fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "auto", display: "block", borderRadius: 8, boxShadow: `0 4px 24px ${t.border}` }}
      />
    </div>
  );
}
