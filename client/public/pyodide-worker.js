// Pyodide в отдельном worker: тяжёлый Python не блокирует интерфейс.
const CDN = "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/";

let pyodide = null;
let stdout = "";
let stderr = "";

function post(msg) {
  self.postMessage(msg);
}

async function init() {
  try {
    importScripts(CDN + "pyodide.js");
    pyodide = await loadPyodide({ indexURL: CDN });
    pyodide.setStdout({ batched: (text) => (stdout += text + "\n") });
    pyodide.setStderr({ batched: (text) => (stderr += text + "\n") });
    post({ type: "ready" });
  } catch (err) {
    post({ type: "init-error", message: String(err?.message || err) });
  }
}

self.onmessage = async (e) => {
  const msg = e.data || {};
  if (msg.type === "init") {
    await init();
    return;
  }
  if (msg.type !== "run") return;
  if (!pyodide) {
    post({ type: "run-error", stdout: "", stderr: "", message: "Python ещё не загружен" });
    return;
  }
  stdout = "";
  stderr = "";
  try {
    const value = await pyodide.runPythonAsync(msg.code);
    post({
      type: "result",
      stdout,
      stderr,
      value: value === undefined || value === null ? null : String(value),
    });
  } catch (err) {
    post({ type: "run-error", stdout, stderr, message: String(err?.message || err) });
  }
};
