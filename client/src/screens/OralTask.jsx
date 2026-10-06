import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { oralTaskByNumber } from "../useOral";
import { setScreenTitle, setQuizActive } from "../nav";
import MicVisualizer from "../components/MicVisualizer";
import { useAlert } from "../components/Alert";
import { transcribeRecording } from "../api/ai";
import { gradeOral } from "../oralGrade";
import { computeMetrics } from "../oralMetrics";
import { saveOralResult, addOralDone } from "../oralResults";
import { Square, SkipForward } from "lucide-react";

const mmss = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

function AdImage({ src }) {
  const { t } = useTheme();
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div
        style={{
          color: t.sub,
          fontSize: 13,
          fontStyle: "italic",
          textAlign: "center",
          padding: "18px 0",
        }}
      >
        Изображение рекламы скоро появится
      </div>
    );
  }
  return <img src={src} alt="Advertisement" onError={() => setBroken(true)} style={{ width: "100%", borderRadius: 10, display: "block" }} />;
}

const blobToDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });

export default function OralTask() {
  const { t, theme } = useTheme();
  const navigate = useNavigate();
  const { task: taskNum, variant: vId } = useParams();
  const task = oralTaskByNumber(Number(taskNum));
  const v = task?.variants.find((x) => x.id === vId);
  const { alert } = useAlert();
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const [mic, setMic] = useState("idle"); // idle | requesting | ready | denied
  const [phaseIdx, setPhaseIdx] = useState(null);
  const [timer, setTimer] = useState(null);
  const [ended, setEnded] = useState(false);
  const [recSaved, setRecSaved] = useState(false);
  const [checking, setChecking] = useState(null); // null | transcribe | grade
  const [checkError, setCheckError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [grade, setGrade] = useState(null);

  useEffect(() => {
    setScreenTitle(task && v ? `Задание ${task.task}. ${v.title}` : null);
    return () => setScreenTitle(null);
  }, [task, v]);

  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((tr) => tr.stop());
  }, []);

  useEffect(() => {
    setQuizActive(phaseIdx != null);
    return () => setQuizActive(false);
  }, [phaseIdx]);

  useEffect(() => {
    if (phaseIdx == null) {
      setTimer(null);
      return undefined;
    }
    const phase = task.phases[phaseIdx];
    const total = phase.seconds;
    const endAt = Date.now() + total * 1000;
    const tick = () => {
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setTimer({ label: phase.label, total, left, warn: phase.warn ?? 10 });
      if (left <= 0) {
        clearInterval(id);
        if (phaseIdx + 1 < task.phases.length) {
          setPhaseIdx(phaseIdx + 1);
        } else {
          setPhaseIdx(null);
          setEnded(true);
        }
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [phaseIdx, task]);

  useEffect(() => {
    if (phaseIdx == null || !task.phases[phaseIdx].mic) return undefined;
    const key = `use-oral-${task.task}-${v.id}-rec`;
    let stream;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) =>
          MediaRecorder.isTypeSupported(m)
        );
        recorderRef.current = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        const chunks = [];
        recorderRef.current.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        recorderRef.current.onstop = async () => {
          const blob = new Blob(chunks, { type: recorderRef.current.mimeType || "audio/webm" });
          stream.getTracks().forEach((tr) => tr.stop());
          streamRef.current = null;
          if (blob.size) {
            try {
              localStorage.setItem(key, await blobToDataURL(blob));
              setRecSaved(true);
            } catch {
              setRecSaved(false);
            }
          }
        };
        recorderRef.current.start();
      } catch {
        setRecSaved(false);
      }
    })();
    return () => {
      cancelled = true;
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
  }, [phaseIdx, task, v.id]);

  if (!task || !v) {
    return <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>Задание не найдено.</div>;
  }

  const begin = async () => {
    setMic("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((tr) => tr.stop());
      setMic("ready");
      setEnded(false);
      setPhaseIdx(0);
    } catch {
      setMic("denied");
    }
  };

  const finishRecording = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    setPhaseIdx(null);
    setEnded(true);
  };

  const recordKey = `use-oral-${task.task}-${v.id}-rec`;

  const runCheck = async () => {
    setCheckError("");
    const criteria = task.criteria;
    try {
      setChecking("transcribe");
      const dataUrl = localStorage.getItem(recordKey);
      if (!dataUrl) throw new Error("Запись не найдена — перезапиши вариант");
      const res = await transcribeRecording(dataUrl);
      const metrics = v.content.text
        ? computeMetrics({
            words: res.words,
            duration: res.duration,
            sourceText: v.content.text,
            transcript: res.text,
          })
        : null;
      setTranscript(res.text);
      if (!criteria) throw new Error("Критерии для этого задания ещё не добавлены");
      setChecking("grade");
      const g = await gradeOral(res.text, criteria, metrics);
      setGrade(g);
      saveOralResult({
        task: task.task,
        variant_id: v.id,
        score: Number(g.total) || 0,
        max: Number(g.max) || 0,
      }).catch(() => {});
    } catch (err) {
      setCheckError(err?.message || "Не удалось проверить");
    } finally {
      setChecking(null);
    }
  };

  const running = phaseIdx != null;
  const micPhase = running && task.phases[phaseIdx].mic;

  const contentBlock = v.content.questions ? (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          background: t.raised,
          border: `1px solid ${t.border}`,
          borderRadius: 16,
          padding: "14px 16px",
        }}
      >
        <div
          style={{
            color: t.sub,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.04,
            marginBottom: 8,
          }}
        >
          ADVERTISEMENT
        </div>
        {v.content.kicker && (
          <div style={{ color: t.text, fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
            {v.content.kicker}
          </div>
        )}
        <AdImage src={v.content.ad} />
      </div>
      <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, margin: "14px 0 6px" }}>
        Find out the following
      </div>
      {v.content.questions.map((q, i) => (
        <div key={i} style={{ color: t.text, fontSize: 14, lineHeight: 1.5, marginTop: 4 }}>
          <span style={{ color: t.sub, fontWeight: 700, marginRight: 6 }}>{i + 1}.</span>
          {q}
        </div>
      ))}
    </div>
  ) : (
    <div
      style={{
        marginTop: 18,
        background: t.raised,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        padding: "14px 16px",
      }}
    >
      <div style={{ color: t.sub, fontSize: 12, fontWeight: 700, letterSpacing: 0.04, marginBottom: 8 }}>
        TEXT TO READ ALOUD
      </div>
      <div style={{ color: t.text, fontSize: 16, lineHeight: 1.65 }}>{v.content.text}</div>
    </div>
  );

  return (
    <div style={{ paddingBottom: running ? 120 : 0 }}>
      {!ended && (
        <>
          {running && (
            <div style={{ color: t.sub, fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
              {task.phases[phaseIdx].label}
            </div>
          )}
          <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.55 }}>
            {v.content.task || task.formulation}
          </div>
          {contentBlock}
        </>
      )}

      {ended && (
        <div>
          <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>
            Задание завершено. {recSaved ? "Запись сохранена." : "Запись не сохранилась."}
          </div>

          {recSaved && !transcript && !checking && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
              <button
                className="press"
                onClick={runCheck}
                style={{
                  padding: "13px 26px",
                  borderRadius: 999,
                  border: "none",
                  background: t.invBg,
                  color: t.inv,
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Проверить чтение с ИИ
              </button>
            </div>
          )}

          {checking && (
            <div style={{ color: t.sub, fontSize: 14, marginTop: 16 }}>
              {checking === "transcribe" ? "Расшифровываю запись…" : "Gemini сверяет с критериями…"}
            </div>
          )}

          {checkError && <div style={{ color: t.danger, fontSize: 14, marginTop: 16 }}>{checkError}</div>}

          {transcript && (
            <div style={{ marginTop: 16 }}>
              <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Расшифровка</div>
              <div
                style={{
                  color: t.text,
                  fontSize: 14,
                  lineHeight: 1.55,
                  background: t.raised,
                  border: `1px solid ${t.border}`,
                  borderRadius: 16,
                  padding: "12px 14px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {transcript}
              </div>
            </div>
          )}

          {grade && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ color: t.text, fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  {grade.total ?? "—"}
                </span>
                <span style={{ color: t.sub, fontSize: 15, fontWeight: 600 }}>из {grade.max ?? 10}</span>
              </div>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {(grade.items || []).map((item, i) => (
                  <div
                    key={i}
                    style={{
                      background: t.raised,
                      border: `1px solid ${t.border}`,
                      borderRadius: 14,
                      padding: "10px 14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ color: t.text, fontSize: 14, fontWeight: 600, flex: 1 }}>{item.name}</span>
                      <span style={{ color: t.sub, fontSize: 13, fontWeight: 700, marginLeft: 10 }}>
                        {item.points}/{item.max}
                      </span>
                    </div>
                    {item.comment && (
                      <div style={{ color: t.sub, fontSize: 13, marginTop: 4, lineHeight: 1.45 }}>{item.comment}</div>
                    )}
                  </div>
                ))}
              </div>
              {grade.summary && (
                <div
                  style={{
                    color: t.text,
                    fontSize: 14,
                    lineHeight: 1.5,
                    background: t.border,
                    borderRadius: 14,
                    padding: "10px 14px",
                    marginTop: 8,
                  }}
                >
                  {grade.summary}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
            <button
              className="press"
              onClick={async () => {
                try {
                  await addOralDone(task.task, v.id);
                } catch {}
                navigate(`/use/english/oral/${task.task}`, { replace: true });
              }}
              style={{
                padding: "13px 30px",
                borderRadius: 999,
                border: "none",
                background: t.border,
                color: t.text,
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              Завершить
            </button>
          </div>
        </div>
      )}

      {running && timer && (
        createPortal(
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100,
            padding: "8px 18px calc(10px + env(safe-area-inset-bottom)) 18px",
            pointerEvents: "none",
          }}
        >
          {micPhase && (
            <div style={{ marginBottom: 10 }}>
              <MicVisualizer stream={streamRef.current} height={48} />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                flex: 1,
                borderRadius: 999,
                background: t.raised,
                border: `1px solid ${t.border}`,
                padding: "12px 16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 999,
                    background: t.border,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 999,
                      background: timer.left <= timer.warn ? t.danger : t.invBg,
                      transition: "width 250ms linear, background 250ms linear",
                      width: `${Math.max(0, Math.min(1, timer.left / timer.total)) * 100}%`,
                    }}
                  />
                </div>
                <span
                  style={{
                    color: timer.left <= timer.warn ? t.danger : t.text,
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    fontVariantNumeric: "tabular-nums",
                    minWidth: 56,
                    textAlign: "right",
                    transition: "color 250ms linear",
                  }}
                >
                  {mmss(timer.left)}
                </span>
              </div>
            </div>
{phaseIdx === 0 && (
              <button
                aria-label="Пропустить подготовку"
                className="press"
                onClick={() =>
                  alert("Перейти к этапу «Ответ» без ожидания таймера?", {
                    title: "Пропустить подготовку?",
                    danger: true,
                    confirmLabel: "Пропустить",
                    onConfirm: () => {
                      if (phaseIdx + 1 < task.phases.length) setPhaseIdx(phaseIdx + 1);
                    },
                  })
                }
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 999,
                  border: `1px solid ${t.border}`,
                  background: t.raised,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                  pointerEvents: "auto",
                }}
              >
                <SkipForward size={18} strokeWidth={2.5} color={t.text} />
              </button>
            )}
            {micPhase && (
              <button
                aria-label="Закончить запись"
                className="press"
                onClick={() =>
                    alert("Остановить запись и завершить задание?", {
                      title: "Завершить запись?",
                      danger: true,
                      confirmLabel: "Остановить",
                      onConfirm: finishRecording,
                    })
                  }
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 999,
                  border: "none",
                  background: t.invBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                  pointerEvents: "auto",
                }}
              >
                <Square size={16} strokeWidth={3} color={t.inv} fill={t.inv} />
              </button>
            )}
          </div>
        </div>,
        document.body
        )
      )}

      {!running && !ended &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 80,
              background: theme === "dark" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.5)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 16,
              padding: "0 30px",
            }}
          >
            {mic === "requesting" ? (
              <div style={{ color: t.sub, fontSize: 15 }}>Разрешаем доступ к микрофону…</div>
            ) : (
              <>
                {mic === "denied" && (
                  <div style={{ color: t.danger, fontSize: 14, textAlign: "center", lineHeight: 1.5 }}>
                    Доступ к микрофону не получен. Разреши его в браузере и попробуй ещё раз.
                  </div>
                )}
                <button
                  className="press"
                  onClick={begin}
                  style={{
                    padding: "14px 40px",
                    borderRadius: 999,
                    border: "none",
                    background: t.invBg,
                    color: t.inv,
                    fontSize: 16,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  Начать
                </button>
              </>
            )}
            <button
              className="press"
              onClick={() => navigate(`/use/english/oral/${task.task}`)}
              style={{
                background: "none",
                border: "none",
                color: t.sub,
                fontSize: 14,
                fontFamily: "inherit",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Вернуться к вариантам
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}