import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Feather, Mic, RotateCcw, SkipForward, Square } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { setScreenTitle } from "../nav";
import { useAlert } from "../components/Alert";
import Button from "../components/Button";
import FieldLabel from "../components/FieldLabel";
import ListRow from "../components/ListRow";
import MicVisualizer from "../components/MicVisualizer";
import { sfx } from "../sfx";
import { listPoems, savePoem, deletePoem } from "../poemStore";
import {
  parsePoem,
  splitIntoChunks,
  splitRecall,
  compareRecited,
} from "../poemTeacher";
import { speakRussian, stopSpeech } from "../poemSpeech";
import { transcribeRecording } from "../api/ai";

const EMPTY_LINES = [];
const GOOD_LINE = 70;

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const scrollBox = (t) => ({
  maxHeight: "42vh",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  padding: "18px",
  borderRadius: 20,
  border: `1px solid ${t.border}`,
  background: t.surface,
});

const miniButton = (t) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 14px",
  borderRadius: 999,
  border: `1px solid ${t.border}`,
  background: t.raised,
  color: t.text,
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
});

const inputStyle = (t) => ({
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 14,
  border: `1px solid ${t.border}`,
  background: t.raised,
  color: t.text,
  fontFamily: "inherit",
  fontSize: 15,
  outline: "none",
});

export default function PoemTeacher() {
  const { t } = useTheme();
  const { alert } = useAlert();

  const [poems, setPoems] = useState(() => listPoems());
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [active, setActive] = useState(null);

  const [phase, setPhase] = useState("intro");
  const [blockIdx, setBlockIdx] = useState(0);
  const [chunkIdx, setChunkIdx] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [repeatIdx, setRepeatIdx] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [built, setBuilt] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  const [recordReady, setRecordReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [stream, setStream] = useState(null);
  const [checkingLine, setCheckingLine] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lineError, setLineError] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const heldRef = useRef(true);

  const blocks = useMemo(() => (active ? parsePoem(active.text) : []), [active]);
  const chunks = useMemo(() => splitIntoChunks(blocks[blockIdx] || EMPTY_LINES), [blocks, blockIdx]);
  const chunkLines = chunks[chunkIdx] || EMPTY_LINES;
  const currentLine = blocks[blockIdx]?.[lineIdx] || "";
  const recall = splitRecall(currentLine);

  useEffect(() => {
    setScreenTitle(active ? active.title : null);
    return () => setScreenTitle(null);
  }, [active]);

  useEffect(() => () => {
    stopSpeech();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const acceptLine = (idx, line) => {
    setBuilt((prev) => [...prev, line]);
    setLineError("");
    if (idx + 1 < (blocks[blockIdx] || EMPTY_LINES).length) setLineIdx(idx + 1);
    else setPhase("blockEnd");
  };

  const advance = useCallback(() => {
    sfx.tap();
    setError("");
    if (phase === "intro") {
      setBlockIdx(0);
      setChunkIdx(0);
      setPhase("read");
    } else if (phase === "read") {
      setChunkIdx(0);
      setPhase("chunks");
    } else if (phase === "chunks") {
      if (chunkIdx + 1 < chunks.length) setChunkIdx(chunkIdx + 1);
      else {
        setLineIdx(0);
        setBuilt([]);
        setPhase("recall");
      }
    } else if (phase === "blockEnd") {
      if (blockIdx + 1 < blocks.length) {
        setBlockIdx(blockIdx + 1);
        setChunkIdx(0);
        setLineIdx(0);
        setBuilt([]);
        setPhase("read");
      } else {
        setRecordReady(false);
        setPhase("finale");
      }
    }
  }, [phase, chunkIdx, chunks, blockIdx, blocks]);

  const skipBlock = () => {
    sfx.tap();
    stopSpeech();
    setError("");
    setLineError("");
    setBuilt([]);
    setLineIdx(0);
    setChunkIdx(0);
    if (blockIdx + 1 < blocks.length) {
      setBlockIdx(blockIdx + 1);
      setPhase("read");
    } else {
      setRecordReady(false);
      setPhase("finale");
    }
  };

  const repeat = () => {
    sfx.tap();
    stopSpeech();
    setError("");
    if (phase === "recall") {
      speakRussian(currentLine).catch((e) => setError(e?.message || "Не удалось озвучить"));
    } else {
      setNonce((n) => n + 1);
    }
  };

  // Озвучивание шага; следующий шаг включается сам, когда аудио закончилось.
  useEffect(() => {
    if (!active || phase === "recall") return undefined;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      setSpeaking(true);
      try {
        if (phase === "intro" || phase === "finale") {
          await speakRussian(active.text);
          if (phase === "finale") {
            if (!cancelled) setRecordReady(true);
          } else if (!cancelled) {
            advance();
          }
        } else if (phase === "read" || phase === "blockEnd") {
          await speakRussian((blocks[blockIdx] || EMPTY_LINES).join("\n"));
          if (!cancelled) advance();
        } else if (phase === "chunks") {
          for (let i = 0; i < 3; i++) {
            if (cancelled) return;
            setRepeatIdx(i + 1);
            await speakRussian(chunkLines.join(", "), 0.88);
          }
          if (!cancelled) advance();
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Не удалось озвучить стих");
      } finally {
        if (!cancelled) setSpeaking(false);
      }
    })();
    return () => { cancelled = true; stopSpeech(); };
  }, [active, blocks, blockIdx, chunkLines, phase, nonce, advance]);

  const start = (poem) => {
    const saved = savePoem(poem);
    setPoems(listPoems());
    stopSpeech();
    setActive(saved);
    setPhase("intro");
    setBlockIdx(0);
    setChunkIdx(0);
    setLineIdx(0);
    setRepeatIdx(0);
    setBuilt([]);
    setResult(null);
    setError("");
    setLineError("");
    setRecordReady(false);
    setNonce((n) => n + 1);
  };

  const add = () => {
    if (!parsePoem(text).length) {
      alert("Вставь текст стихотворения — пустые блоки не сохраняются");
      return;
    }
    const poem = savePoem({ title, author, text });
    setTitle("");
    setAuthor("");
    setText("");
    setAdding(false);
    start(poem);
  };

  const leave = () => {
    stopSpeech();
    setActive(null);
    setPoems(listPoems());
  };

  const startRecording = async (onBlob, onError) => {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = micStream;
      setStream(micStream);
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
        .find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(micStream, mime ? { mimeType: mime } : undefined);
      const pieces = [];
      recorder.ondataavailable = (e) => { if (e.data.size) pieces.push(e.data); };
      recorder.onstop = async () => {
        micStream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setStream(null);
        await onBlob(new Blob(pieces, { type: recorder.mimeType || "audio/webm" }));
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      if (!heldRef.current) recorder.stop(); // отпустили кнопку, пока просили доступ к микрофону
    } catch {
      onError("Нет доступа к микрофону");
    }
  };

  const stopRecording = () => {
    heldRef.current = false;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  // PTT: строка звучит, пользователь говорит; совпало или пропущено — строка добавляется в блок.
  const startLineRecording = () => {
    if (checkingLine || recording) return;
    heldRef.current = true;
    setLineError("");
    const idx = lineIdx;
    const expected = currentLine;
    if (!expected) { acceptLine(idx, expected); return; }
    startRecording(async (blob) => {
      setRecording(false);
      if (!blob.size) return;
      setCheckingLine(true);
      try {
        const said = await transcribeRecording(await blobToDataUrl(blob), {
          language: "ru",
          prompt: "Расшифруй одну прочитанную строку стихотворения по-русски дословно, без перевода и исправлений.",
        });
        const check = compareRecited(expected, said.text);
        if (check.score >= GOOD_LINE) {
          sfx.correct();
          acceptLine(idx, expected);
        } else {
          sfx.wrong();
          setLineError(`Сказали: «${said.text}». Попробуй ещё или пропусти строку.`);
        }
      } catch (e) {
        setLineError(e?.message || "Не удалось распознать речь");
      } finally {
        setCheckingLine(false);
      }
    }, (msg) => setLineError(msg));
  };

  const skipLine = () => {
    sfx.tap();
    acceptLine(lineIdx, currentLine);
  };

  const startFinalRecording = () => {
    heldRef.current = true;
    setError("");
    startRecording(async (blob) => {
      setRecording(false);
      if (!blob.size) return;
      setChecking(true);
      try {
        const said = await transcribeRecording(await blobToDataUrl(blob), {
          language: "ru",
          prompt: "Расшифруй прочитанное стихотворение по-русски дословно, без перевода и исправлений.",
        });
        setResult(compareRecited(active.text, said.text));
        sfx.win();
      } catch (e) {
        setError(e?.message || "Не удалось проверить чтение");
      } finally {
        setChecking(false);
      }
    }, (msg) => setError(msg));
  };

  if (active) {
    const whole = phase === "intro" || phase === "finale";
    const blockText = (blocks[blockIdx] || EMPTY_LINES).join("\n");
    return (
      <div>
        <div style={scrollBox(t)}>
          <div style={{ color: t.sub, fontSize: 12, marginBottom: 10 }}>
            {active.author || "Автор не указан"}
            {speaking && " · говорит…"}
          </div>
          {whole && (
            <div style={{ whiteSpace: "pre-wrap", color: t.text, fontSize: 16, lineHeight: 1.7, textAlign: "center" }}>
              {active.text}
            </div>
          )}
          {(phase === "read" || phase === "blockEnd") && (
            <div style={{ whiteSpace: "pre-wrap", color: t.text, fontSize: 17, lineHeight: 1.8, textAlign: "center" }}>
              {blockText}
            </div>
          )}
          {phase === "chunks" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ color: t.sub, fontSize: 12, marginBottom: 10 }}>
                {speaking ? `Прочтение ${repeatIdx} из 3` : "Прочитано 3 раза"}
              </div>
              <div style={{ whiteSpace: "pre-wrap", color: t.text, fontSize: 18, lineHeight: 1.9 }}>
                {chunkLines.join("\n")}
              </div>
            </div>
          )}
          {phase === "recall" && (
            <div>
              {built.map((line, i) => (
                <div key={i} style={{ color: t.text, fontSize: 17, lineHeight: 1.8 }}>
                  {line}
                </div>
              ))}
              <div style={{ color: t.sub, fontSize: 17, lineHeight: 1.8, marginTop: built.length ? 10 : 0 }}>
                {recall.hint}{" "}
                <span style={{ filter: "blur(7px)", opacity: 0.75 }}>{recall.rest || "…"}</span>
              </div>
            </div>
          )}
        </div>

        {error && <div style={{ color: t.danger, fontSize: 13, marginTop: 10 }}>{error}</div>}

        {phase === "recall" && (
          <div style={{ marginTop: 14 }}>
            {lineError && <div style={{ color: t.danger, fontSize: 13, marginBottom: 10 }}>{lineError}</div>}
            {checkingLine && <div style={{ color: t.sub, fontSize: 13, marginBottom: 10 }}>Слушаем…</div>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button
                type="button"
                className="press"
                disabled={checkingLine}
                onPointerDown={(e) => {
                  try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
                  startLineRecording();
                }}
                onPointerUp={stopRecording}
                onPointerLeave={stopRecording}
                onPointerCancel={stopRecording}
                style={{ ...miniButton(t), opacity: checkingLine || recording ? 0.5 : 1 }}
              >
                <Mic size={15} /> {recording ? "Говори…" : "Держать и сказать"}
              </button>
              <button type="button" className="press" onClick={skipLine} style={miniButton(t)}>
                <SkipForward size={15} /> Пропустить строку
              </button>
            </div>
          </div>
        )}

        {phase === "finale" && (
          <div style={{ marginTop: 14, textAlign: "center" }}>
            {!recordReady && <div style={{ color: t.sub, fontSize: 13 }}>Слушаем стих целиком…</div>}
            {recordReady && !checking && !result && (
              <>
                {recording && stream && <MicVisualizer stream={stream} />}
                <Button onClick={recording ? stopRecording : startFinalRecording}>
                  {recording
                    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Square size={15} /> Завершить запись</span>
                    : <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Mic size={16} /> Прочитать на оценку</span>}
                </Button>
              </>
            )}
            {checking && <div style={{ color: t.sub, fontSize: 14 }}>Проверяем прочтение…</div>}
            {result && (
              <div style={{ marginTop: 14 }}>
                <div style={{ color: t.text, fontSize: 30, fontWeight: 700 }}>{result.score}%</div>
                <div style={{ color: t.sub, fontSize: 13, marginTop: 4 }}>
                  Совпало {result.matched} из {result.total} слов
                </div>
                {result.missing.length > 0 && (
                  <div style={{ color: t.sub, fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>
                    Пропущено: {result.missing.slice(0, 40).join(", ")}
                    {result.missing.length > 40 && " …"}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <Button variant="dashed" onClick={leave}>К списку</Button>
                  <Button onClick={() => start(active)}>Ещё раз</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {phase !== "finale" && (
          <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" className="press" onClick={repeat} style={miniButton(t)}>
              <RotateCcw size={15} /> Повторить
            </button>
            <button type="button" className="press" onClick={skipBlock} style={miniButton(t)}>
              <SkipForward size={15} /> Пропустить блок
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {adding ? (
        <div style={{ ...scrollBox(t), maxHeight: "none" }}>
          <FieldLabel t={t}>Название</FieldLabel>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например, Я вас любил…"
            style={{ ...inputStyle(t), marginBottom: 14 }}
          />
          <FieldLabel t={t}>Автор</FieldLabel>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Например, А. С. Пушкин"
            style={{ ...inputStyle(t), marginBottom: 14 }}
          />
          <FieldLabel t={t}>Текст стихотворения</FieldLabel>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Строки через перенос, блоки — через пустую строку"
            rows={10}
            style={{ ...inputStyle(t), resize: "vertical", lineHeight: 1.5 }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <Button variant="dashed" onClick={() => setAdding(false)}>Отмена</Button>
            <Button onClick={add}>Сохранить и начать</Button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
            Вставь стих один раз — он сохранится на устройстве, и его можно будет повторить позже. Долгое нажатие на стих удаляет его.
          </div>
          {poems.length === 0 && (
            <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>Пока нет сохранённых стихов.</div>
          )}
          {poems.map((poem, idx) => {
            const count = parsePoem(poem.text).length;
            return (
              <ListRow
                key={poem.id}
                idx={idx}
                icon={<Feather size={20} color={t.text} />}
                title={poem.title}
                sub={`${poem.author || "Без автора"} · ${count} ${count === 1 ? "блок" : "блоков"}`}
                onClick={() => start(poem)}
                onLongPress={() => alert(`Удалить «${poem.title}»?`, {
                  onConfirm: () => { deletePoem(poem.id); setPoems(listPoems()); },
                  confirmLabel: "Удалить",
                  danger: true,
                })}
              />
            );
          })}
          <div style={{ marginTop: 20 }}>
            <Button onClick={() => setAdding(true)}>Добавить стих</Button>
          </div>
        </>
      )}
    </div>
  );
}
