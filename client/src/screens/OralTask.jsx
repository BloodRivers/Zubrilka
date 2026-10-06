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
import { saveAudio, getAudio } from "../audioStore";
import { Square, SkipForward } from "lucide-react";

const mmss = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

let voicesLoaded;
const ensureVoices = () =>
  voicesLoaded ||
  (voicesLoaded = new Promise((res) => {
    if (speechSynthesis?.getVoices().length) return res();
    const to = setTimeout(res, 1200);
    speechSynthesis?.addEventListener?.("voiceschanged", function h() {
      clearTimeout(to);
      res();
    });
  }));

const pickVoice = () => {
  const en = speechSynthesis
    ?.getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (!en?.length) return null;
  return (
    en.find((v) => /natural/i.test(v.name) && /gb|uk/i.test(v.lang)) ||
    en.find((v) => /^google uk/i.test(v.name)) ||
    en.find((v) => /natural/i.test(v.name)) ||
    en.find((v) => /^google/i.test(v.name)) ||
    en.find((v) => /samantha|karen|daniel|moira/i.test(v.name)) ||
    en[0]
  );
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

  const isInterview = task?.task === 3;
  const [ivStage, setIvStage] = useState(null); // null | intro | q | a | finisher | done
  const [ivIdx, setIvIdx] = useState(0);
  const [ivLines, setIvLines] = useState([]); // {kind:"intro"|"q"|"finisher", i?}
  const [qShowed, setQShowed] = useState({});
  const answerDoneRef = useRef(null);
  const pendingSayRef = useRef(null);
  const cancelIvRef = useRef(false);
  const sfxCtxRef = useRef(null);
  const ivAudioRef = useRef(null);

  const sfx = () => {
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      const ctx = sfxCtxRef.current || (sfxCtxRef.current = new Ctor());
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(660, t);
      o.frequency.setValueAtTime(880, t + 0.09);
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.start(t);
      o.stop(t + 0.21);
    } catch {}
  };

  const sayText = (text) =>
    new Promise((resolve) => {
      pendingSayRef.current = resolve;
      const done = () => {
        pendingSayRef.current = null;
        resolve();
      };
      const parts =
        text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ||
        [text];
      if (!parts.length) return done();
      let idx = 0;
      const speakNext = () => {
        if (!pendingSayRef.current || idx >= parts.length) return done();
        const u = new SpeechSynthesisUtterance(parts[idx]);
        const voice = pickVoice();
        u.voice = voice || null;
        u.lang = voice?.lang || "en-GB";
        u.rate = 0.95;
        u.pitch = 1;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(watchdog);
          idx++;
          speakNext();
        };
        const watchdog = setTimeout(() => {
          speechSynthesis.cancel();
          finish();
        }, Math.max(parts[idx].length * 80, 2000) + 1500);
        u.onend = finish;
        u.onerror = finish;
        speechSynthesis.speak(u);
      };
      ensureVoices().then(() => {
        if (!pendingSayRef.current) return done();
        speakNext();
      });
    });

  /** Предзаписанная реплика (mp3 на статике), при отсутствии — браузерный TTS. */
  const playPhrase = (text, url) => {
    if (!url) return sayText(text);
    return new Promise((resolve) => {
      const a = ivAudioRef.current || (ivAudioRef.current = new Audio());
      pendingSayRef.current = resolve;
      const done = () => {
        if (!pendingSayRef.current) return;
        pendingSayRef.current = null;
        resolve();
      };
      a.onended = done;
      a.onerror = done;
      a.src = url;
      a.play().catch(done);
    });
  };

  const finishAnswer = () => {
    if (answerDoneRef.current) {
      const resolve = answerDoneRef.current;
      answerDoneRef.current = null;
      resolve();
    }
  };

  const beginInterview = async () => {
    cancelIvRef.current = false;
    const intro = task.introStart + v.theme + task.introEnd;
    const url = (name) => (v.audio ? `${v.audio}/${name}` : "");
    setIvStage("intro");
    setIvLines([{ kind: "intro" }]);
    setTimer(null);
    await playPhrase(intro, url("intro.mp3"));
    if (cancelIvRef.current) return;
    for (let i = 0; i < v.questions.length; i++) {
      setIvStage("q");
      setIvIdx(i);
      setIvLines((prev) => [...prev, { kind: "q", i }]);
      await playPhrase(v.questions[i], url(`${i}.mp3`));
      if (cancelIvRef.current) return;
      sfx();
      setIvStage("a");
      await new Promise((res) => {
        answerDoneRef.current = res;
      });
      if (cancelIvRef.current) return;
      sfx();
    }
    setIvStage("finisher");
    setIvLines((prev) => [...prev, { kind: "finisher" }]);
    await playPhrase(task.finisher, url("finisher.mp3"));
    if (cancelIvRef.current) return;
    setTimer(null);
    setIvStage("done");
    setEnded(true);
  };

  useEffect(() => {
    setScreenTitle(task && v ? `Задание ${task.task}. ${v.title}` : null);
    return () => setScreenTitle(null);
  }, [task, v]);

  useEffect(() => {
    return () => {
      cancelIvRef.current = true;
      speechSynthesis.cancel();
      ivAudioRef.current?.pause();
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  useEffect(() => {
    setQuizActive((phaseIdx != null || (isInterview && ivStage != null)) && !ended);
    return () => setQuizActive(false);
  }, [phaseIdx, ivStage, ended, isInterview]);

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
    const micKey =
      phaseIdx != null && task.phases[phaseIdx].mic
        ? `use-oral-${task.task}-${v.id}-rec`
        : isInterview && ivStage === "a"
          ? `use-oral-${task.task}-${v.id}-rec-${ivIdx}`
          : null;
    if (!micKey) return undefined;
    const key = micKey;
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
              await saveAudio(key, blob);
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
  }, [phaseIdx, task, v.id, isInterview, ivStage, ivIdx]);

  useEffect(() => {
    if (!isInterview || ivStage !== "a") return undefined;
    const total = task.answerSeconds;
    const endAt = Date.now() + total * 1000;
    const tick = () => {
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      setTimer({ label: `Вопрос ${ivIdx + 1}`, total, left, warn: task.warn ?? 3 });
      if (left <= 0) {
        clearInterval(id);
        finishAnswer();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInterview, ivStage, ivIdx, task]);

  if (!task || !v) {
    return <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>Задание не найдено.</div>;
  }

  const begin = () => {
    setMic("requesting");
    if (isInterview) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(() => setMic("ready"))
        .catch(() => setMic("denied"));
      setEnded(false);
      beginInterview();
      return;
    }
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((tr) => tr.stop());
        setMic("ready");
        setEnded(false);
        setPhaseIdx(0);
      } catch {
        setMic("denied");
      }
    })();
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
    let metrics = null;
    try {
      setChecking("transcribe");
      let transcriptText;
      const recDataUrl = async (key) => {
        const rec = await getAudio(key);
        if (!rec) return null;
        return typeof rec === "string" ? rec : await blobToDataURL(rec);
      };

      if (isInterview) {
        const parts = [];
        for (let i = 0; i < v.questions.length; i++) {
          const dataUrl = await recDataUrl(`use-oral-${task.task}-${v.id}-rec-${i}`);
          if (!dataUrl) throw new Error(`Запись ответа ${i + 1} не найдена — перезапиши вариант`);
          const res = await transcribeRecording(dataUrl);
          parts.push(`Вопрос ${i + 1} — ${v.questions[i]}\nОтвет: ${res.text}`);
        }
        transcriptText = parts.join("\n\n");
        setTranscript(transcriptText);
      } else {
        const dataUrl = await recDataUrl(recordKey);
        if (!dataUrl) throw new Error("Запись не найдена — перезапиши вариант");
        const res = await transcribeRecording(dataUrl);
        metrics = v.content.text
          ? computeMetrics({
              words: res.words,
              duration: res.duration,
              sourceText: v.content.text,
              transcript: res.text,
            })
          : null;
        transcriptText = res.text;
        setTranscript(res.text);
      }
      if (!criteria) throw new Error("Критерии для этого задания ещё не добавлены");
      setChecking("grade");
      const g = await gradeOral(transcriptText, criteria, metrics);
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
  const started = running || (isInterview && ivStage != null);
  const micPhase = running && task.phases[phaseIdx].mic;
  const activeMic = micPhase || (isInterview && ivStage === "a");

  const contentBlock = v.content?.questions ? (
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
      <div style={{ color: t.text, fontSize: 16, lineHeight: 1.65 }}>{v.content?.text}</div>
    </div>
  );

  return (
    <div style={{ paddingBottom: timer ? 120 : 0 }}>
      {!ended &&
        (isInterview ? (
          <div
            style={{
              background: t.raised,
              border: `1px solid ${t.border}`,
              borderRadius: 16,
              padding: "14px 16px",
            }}
          >
            {ivLines.map((line, li) =>
              line.kind === "q" ? (
                <div
                  key={li}
                  className="swap"
                  onClick={() =>
                    setQShowed((p) => ({ ...p, [line.i]: !p[line.i] }))
                  }
                  style={{
                    marginTop: li ? 12 : 0,
                    paddingTop: li ? 12 : 0,
                    borderTop: li ? `1px solid ${t.border}` : "none",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div style={{ color: t.sub, fontSize: 12, fontWeight: 700, letterSpacing: 0.04, marginBottom: 8 }}>
                    ВОПРОС {line.i + 1}
                  </div>
                  <div
                    style={{
                      color: t.text,
                      fontSize: 16,
                      lineHeight: 1.55,
                      filter: qShowed[line.i] ? "none" : "blur(6px)",
                    }}
                  >
                    {v.questions[line.i]}
                  </div>
                  <div style={{ color: t.sub, fontSize: 13, marginTop: 8 }}>
                    {ivStage === "a" && ivIdx === line.i &&
                      `Отвечай — микрофон уже слушает, ${task.answerSeconds} сек.`}
                  </div>
                </div>
              ) : (
                <div key={li} className="swap" style={{ marginTop: li ? 12 : 0 }}>
                  <div style={{ color: t.sub, fontSize: 12, fontWeight: 700, letterSpacing: 0.04, marginBottom: 8 }}>
                    ИНТЕРВЬЮЕР — {line.kind === "intro" ? "ВСТУПЛЕНИЕ" : "ЗАВЕРШЕНИЕ"}
                  </div>
                  <div style={{ color: t.text, fontSize: 16, lineHeight: 1.55 }}>
                    {line.kind === "intro" ? task.introStart + v.theme + task.introEnd : task.finisher}
                  </div>
                </div>
              )
            )}
            {ivStage == null && (
              <div style={{ color: t.sub, fontSize: 13, marginTop: 8 }}>
                Тема: {v.theme}. Тебя ждут {v.questions.length} вопросов — ответ по {task.answerSeconds} секунд.
              </div>
            )}
          </div>
        ) : (
          <>
            {running && (
              <div style={{ color: t.sub, fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                {task.phases[phaseIdx].label}
              </div>
            )}
            <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.55 }}>
              {v.content?.task || task.formulation}
            </div>
            {contentBlock}
          </>
        ))}

      {ended && (
        <div>
          <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>
            {isInterview ? "Интервью завершено." : `Задание завершено. ${recSaved ? "Запись сохранена." : "Запись не сохранилась."}`}
          </div>

          {(isInterview || recSaved) && !transcript && !checking && (
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
                {isInterview ? "Проверить ответы с ИИ" : "Проверить чтение с ИИ"}
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

      {timer && !ended && (
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
          {activeMic && (
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
                    height: 12,
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
            {activeMic && (
              <button
                aria-label={isInterview ? "Закончить ответ" : "Закончить запись"}
                className="press"
                onClick={() => {
                  if (isInterview) {
                    alert("Закончить этот ответ и перейти дальше?", {
                      title: "Закончить ответ?",
                      danger: true,
                      confirmLabel: "Дальше",
                      onConfirm: finishAnswer,
                    });
                  } else {
                    alert("Остановить запись и завершить задание?", {
                      title: "Завершить запись?",
                      danger: true,
                      confirmLabel: "Остановить",
                      onConfirm: finishRecording,
                    });
                  }
                }}
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

      {!started && !ended &&
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