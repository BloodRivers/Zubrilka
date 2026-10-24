import { useCallback, useEffect, useRef, useState } from "react";

const RUN_TIMEOUT = 15000;
const INIT_TIMEOUT = 90000;

// Ленивая загрузка Pyodide: worker создаётся при первом запуске кода.
export default function usePython() {
  const workerRef = useRef(null);
  const readyRef = useRef(false);
  const waitersRef = useRef([]);
  const pendingRef = useRef(null);
  const initTimerRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState(null);

  const settle = (fn) => {
    waitersRef.current.splice(0).forEach(fn);
  };

  const kill = useCallback(() => {
    if (workerRef.current) workerRef.current.terminate();
    workerRef.current = null;
    readyRef.current = false;
    clearTimeout(initTimerRef.current);
    const p = pendingRef.current;
    pendingRef.current = null;
    if (p) {
      clearTimeout(p.timer);
      p.resolve({ stdout: "", stderr: "", value: null, error: "Выполнение прервано" });
    }
    settle((w) => w.reject(new Error("Выполнение прервано")));
    setRunning(false);
  }, []);

  const spawn = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    readyRef.current = false;
    setStatus("loading");
    setError(null);

    const w = new Worker(`${import.meta.env.BASE_URL}pyodide-worker.js`);
    workerRef.current = w;

    w.onmessage = (e) => {
      const msg = e.data || {};
      if (msg.type === "ready") {
        clearTimeout(initTimerRef.current);
        readyRef.current = true;
        setStatus("ready");
        settle((x) => x.resolve());
      } else if (msg.type === "init-error") {
        clearTimeout(initTimerRef.current);
        readyRef.current = false;
        w.terminate();
        if (workerRef.current === w) workerRef.current = null;
        setStatus("error");
        setError(msg.message || "Не удалось загрузить Python");
        settle((x) => x.reject(new Error(msg.message || "init")));
      } else if (msg.type === "result" || msg.type === "run-error") {
        const p = pendingRef.current;
        pendingRef.current = null;
        if (p) {
          clearTimeout(p.timer);
          p.resolve({
            stdout: msg.stdout || "",
            stderr: msg.stderr || "",
            value: msg.value || null,
            error: msg.type === "run-error" ? msg.message || "Ошибка" : null,
          });
        }
        setRunning(false);
      }
    };

    w.onerror = (e) => {
      clearTimeout(initTimerRef.current);
      readyRef.current = false;
      setStatus("error");
      setError(e.message || "Ошибка загрузки Python");
      settle((x) => x.reject(new Error(e.message || "worker")));
      kill();
    };

    initTimerRef.current = setTimeout(() => {
      setError("Python не загрузился за 90 секунд");
      setStatus("error");
      kill();
    }, INIT_TIMEOUT);

    w.postMessage({ type: "init" });
    return w;
  }, [kill]);

  const waitReady = () =>
    new Promise((resolve, reject) => {
      if (readyRef.current) resolve();
      else waitersRef.current.push({ resolve, reject });
    });

  const run = useCallback(
    async (code) => {
      if (pendingRef.current) return;
      setRunning(true);
      setOutput(null);
      const w = spawn();
      try {
        await waitReady();
      } catch (err) {
        setRunning(false);
        setOutput({ stdout: "", stderr: "", value: null, error: err.message });
        return;
      }
      const result = await new Promise((resolve) => {
        const timer = setTimeout(() => {
          pendingRef.current = null;
          resolve({
            stdout: "",
            stderr: "",
            value: null,
            error: `Превышено время выполнения (${RUN_TIMEOUT / 1000} с). Похоже на бесконечный цикл.`,
          });
          kill();
        }, RUN_TIMEOUT);
        pendingRef.current = { resolve, timer };
        w.postMessage({ type: "run", code });
      });
      setRunning(false);
      setOutput(result);
    },
    [spawn, kill]
  );

  const reset = useCallback(() => setOutput(null), []);

  useEffect(() => () => kill(), [kill]);

  return { status, error, running, output, run, reset };
}
