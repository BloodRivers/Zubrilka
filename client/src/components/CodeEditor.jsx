import { useEffect, useMemo, useRef, useState } from "react";
import { Braces, Lightbulb, Play, WrapText } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";

const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** Иконка-тоггл лигатур: «fi» с включёнными лигатурами шрифта. */
function LigaturesIcon({ size = 16 }) {
  return (
    <span
      aria-hidden
      style={{
        fontFamily: MONO,
        fontSize: Math.max(11, size - 3),
        fontWeight: 700,
        lineHeight: 1,
        fontVariantLigatures: "common-ligatures",
        letterSpacing: "-0.04em",
      }}
    >
      fi
    </span>
  );
}
const KEYWORDS =
  "and|as|assert|async|await|break|case|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|match|None|nonlocal|not|or|pass|raise|return|True|try|type|while|with|yield";
const BUILTINS =
  "print|range|len|int|str|bool|list|dict|set|tuple|enumerate|zip|sum|min|max|sorted|reversed|abs|all|any|map|filter|input|open|type|isinstance|permutations|product";
const COLORS = {
  dark: { keyword: "#C792EA", string: "#8BC98F", number: "#F0B37E", comment: "#6F6F6F", func: "#82AAFF", builtin: "#FFCB6B", op: "#89DDFF" },
  light: { keyword: "#8B3FA8", string: "#2E7D32", number: "#B35C00", comment: "#8A8A8A", func: "#1565C0", builtin: "#8C5A00", op: "#00695C" },
};
const PYTHON_WORDS = ["print", "range", "len", "enumerate", "zip", "sorted", "reversed", "sum", "min", "max", "all", "any", "map", "filter", "list", "dict", "set", "tuple", "int", "str", "bool", "open", "type", "isinstance", "permutations", "product", "abs", "round", "input", "if", "elif", "else", "for", "while", "break", "continue", "pass", "def", "class", "return", "yield", "lambda", "import", "from", "as", "with", "try", "except", "finally", "raise", "assert", "del", "global", "nonlocal", "async", "await", "match", "case", "and", "or", "not", "in", "is", "True", "False", "None"];

function symbolsFromCode(code) {
  const names = new Set(PYTHON_WORDS);
  for (const match of code.matchAll(/(?:\b(?:def|class)\s+|^\s*)([A-Za-z_]\w*)\s*(?:\(|=)/gm)) names.add(match[1]);
  for (const match of code.matchAll(/\b(?:from\s+[\w.]+\s+import|import)\s+([\w.]+)/g)) {
    match[1].split(",").forEach((name) => names.add(name.trim().split(" as ")[0]));
  }
  return [...names];
}

function fuzzyScore(query, candidate) {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  let pos = 0;
  let score = c.startsWith(q) ? 80 : 0;
  for (const char of q) {
    const found = c.indexOf(char, pos);
    if (found === -1) return -Infinity;
    score += 8 - Math.min(6, found - pos);
    pos = found + 1;
  }
  return score - c.length * 0.1;
}

const TOKEN_RE = new RegExp(
  "(#[^\\n]*)" +
    "|(\"\"\"[\\s\\S]*?\"\"\"|'''[\\s\\S]*?'''|\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*')" +
    "|(\\b\\d+(?:\\.\\d+)?\\b)" +
    "|(\\b(?:" +
    KEYWORDS +
    ")\\b)" +
    "|(\\b(?:" +
    BUILTINS +
    ")\\b)" +
    "|(\\b[A-Za-z_]\\w*(?=\\s*\\())" +
    "|([+\\-*/%<>=!&|^~]+)",
  "g"
);

function highlight(code, colors) {
  const nodes = [];
  let last = 0;
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(code))) {
    if (m.index > last) nodes.push(code.slice(last, m.index));
    const cls = m[1] ? "comment" : m[2] ? "string" : m[3] ? "number" : m[4] ? "keyword" : m[5] ? "builtin" : m[6] ? "func" : "op";
    nodes.push(
      <span key={m.index} style={{ color: colors[cls] }}>
        {m[0]}
      </span>
    );
    last = TOKEN_RE.lastIndex;
  }
  if (last < code.length) nodes.push(code.slice(last));
  return nodes;
}

export function CodeBlock({ code, style }) {
  const { t, theme, codeLigatures, setCodeLigatures } = useTheme();
  const [wrap, setWrap] = useState(() => localStorage.getItem("zubrilka:warp-code") === "1");
  const [syntax, setSyntax] = useState(() => localStorage.getItem("zubrilka:syntax-highlight") !== "0");
  const colors = COLORS[theme] || COLORS.dark;
  const nodes = useMemo(() => highlight(code, colors), [code, colors]);
  const toggle = (key, setter) => setter((current) => {
    const next = !current;
    localStorage.setItem(key, next ? "1" : "0");
    return next;
  });
  const button = (active, title, onClick, Icon) => (
    <button type="button" onClick={onClick} title={title} aria-label={title} style={{ width: 30, height: 30, border: "none", borderRadius: 8, background: active ? t.surface : "transparent", color: active ? t.text : t.sub, cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}><Icon size={16} /></button>
  );
  return (
    <div style={{ margin: "12px 0 4px" }}>
      <div style={{ height: 38, display: "flex", alignItems: "center", gap: 2, padding: "4px 8px", border: `1px solid ${t.border}`, borderBottom: "none", borderRadius: "14px 14px 0 0", background: t.bg }}>
        {button(wrap, "Перенос строк", () => toggle("zubrilka:warp-code", setWrap), WrapText)}
        {button(syntax, "Подсветка синтаксиса", () => toggle("zubrilka:syntax-highlight", setSyntax), Braces)}
        {button(codeLigatures, "Лигатуры", () => setCodeLigatures(!codeLigatures), LigaturesIcon)}
      </div>
      <pre
        style={{
        margin: 0,
        padding: "14px 12px",
        borderRadius: "0 0 14px 14px",
        border: `1px solid ${t.border}`,
        background: t.raised,
        color: t.text,
        fontSize: 12,
        lineHeight: 1.55,
        fontFamily: MONO,
        fontVariantLigatures: codeLigatures ? "common-ligatures" : "none",
        whiteSpace: wrap ? "pre-wrap" : "pre",
        overflowWrap: wrap ? "anywhere" : "normal",
        wordBreak: wrap ? "break-word" : "normal",
        overflowX: wrap ? "hidden" : "auto",
        ...style,
      }}
      >
        {syntax ? nodes : code}
      </pre>
    </div>
  );
}

export default function CodeEditor({ value, onChange, onRun, running = false, height = 220, attachedOutput = false }) {
  const { t, theme, codeLigatures, setCodeLigatures } = useTheme();
  const preRef = useRef(null);
  const taRef = useRef(null);
  const [wrap, setWrap] = useState(() => localStorage.getItem("zubrilka:warp-code") === "1");
  const [syntax, setSyntax] = useState(() => localStorage.getItem("zubrilka:syntax-highlight") !== "0");
  const [suggestionsOn, setSuggestionsOn] = useState(() => localStorage.getItem("zubrilka:code-suggestions") !== "0");
  const [query, setQuery] = useState("");
  const [caret, setCaret] = useState({ left: 14, top: 52 });
  const [editorHeight, setEditorHeight] = useState(height);
  const resizeRef = useRef(null);
  const colors = COLORS[theme] || COLORS.dark;
  const highlighted = useMemo(() => highlight(value, colors), [value, colors]);
  const suggestions = useMemo(() => {
    if (!suggestionsOn || !query) return [];
    return symbolsFromCode(value)
      .map((item) => ({ item, score: fuzzyScore(query, item) }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((a, b) => b.score - a.score || a.item.localeCompare(b.item))
      .slice(0, 5)
      .map(({ item }) => item);
  }, [value, query, suggestionsOn]);
  useEffect(() => setEditorHeight(height), [height]);
  useEffect(() => {
    const move = (event) => {
      const resize = resizeRef.current;
      if (!resize) return;
      const maxHeight = Math.max(260, window.innerHeight * 0.72);
      setEditorHeight(Math.round(Math.max(160, Math.min(maxHeight, resize.height + event.clientY - resize.y))));
    };
    const stop = () => { resizeRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
  }, []);
  const saveToggle = (key, setter) => setter((current) => {
    const next = !current;
    localStorage.setItem(key, next ? "1" : "0");
    return next;
  });

  const syncScroll = (e) => {
    const el = e.target;
    if (preRef.current) {
      preRef.current.scrollTop = el.scrollTop;
      preRef.current.scrollLeft = el.scrollLeft;
    }
    updateCaret(e.target);
  };
  const updateCaret = (el = taRef.current) => {
    if (!el) return;
    const source = getComputedStyle(el);
    const mirror = document.createElement("div");
    const marker = document.createElement("span");
    ["fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight", "tabSize", "padding", "border", "boxSizing", "whiteSpace", "overflowWrap", "wordBreak"].forEach((key) => {
      mirror.style[key] = source[key];
    });
    mirror.style.cssText += `;position:fixed;visibility:hidden;left:-9999px;top:0;width:${el.clientWidth}px;overflow:hidden;`;
    mirror.textContent = el.value.slice(0, el.selectionStart);
    marker.textContent = el.value.slice(el.selectionStart, el.selectionStart + 1) || ".";
    mirror.append(marker);
    document.body.append(mirror);
    const lineHeight = Number.parseFloat(source.lineHeight) || 20;
    const markerLeft = marker.offsetLeft;
    const markerTop = marker.offsetTop;
    mirror.remove();
    setCaret({
      left: Math.max(8, Math.min(el.clientWidth - 170, markerLeft - el.scrollLeft)),
      top: Math.max(44, Math.min(el.clientHeight - 32, el.offsetTop + markerTop - el.scrollTop + lineHeight)),
    });
  };
  const updateValue = (next, caret = next.length) => {
    onChange(next);
    const word = next.slice(0, caret).match(/[A-Za-z_]\w*$/)?.[0] || "";
    setQuery(word);
    requestAnimationFrame(() => updateCaret());
  };
  const pickSuggestion = (suggestion) => {
    const el = taRef.current;
    const end = el?.selectionStart ?? value.length;
    const start = end - query.length;
    const next = value.slice(0, start) + suggestion + value.slice(end);
    updateValue(next, start + suggestion.length);
    setQuery("");
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + suggestion.length, start + suggestion.length);
    });
  };
  const insertPair = (open, close, el) => {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + open + selected + close + value.slice(end);
    const caretAt = selected ? start + selected.length + 2 : start + 1;
    updateValue(next, caretAt);
    requestAnimationFrame(() => el.setSelectionRange(caretAt, caretAt));
  };
  const onBeforeInput = (e) => {
    const typed = e.data ?? e.nativeEvent?.data;
    const pair = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'" }[typed];
    if (!pair) return;
    e.preventDefault();
    insertPair(typed, pair, e.currentTarget);
  };
  const startResize = (e) => {
    e.preventDefault();
    resizeRef.current = { y: e.clientY, height: editorHeight };
  };
  const onKeyDown = (e) => {
    if (e.key === "Escape") setQuery("");
    const pairs = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'" };
    if (pairs[e.key] && !e.nativeEvent.isComposing) {
      e.preventDefault();
      insertPair(e.key, pairs[e.key], e.currentTarget);
      return;
    }
    if (")]}\"'".includes(e.key) && e.currentTarget.selectionStart === e.currentTarget.selectionEnd && value[e.currentTarget.selectionStart] === e.key) {
      e.preventDefault();
      const next = e.currentTarget.selectionStart + 1;
      e.currentTarget.setSelectionRange(next, next);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      if (suggestions.length) return pickSuggestion(suggestions[0]);
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.slice(0, start) + "    " + value.slice(end);
      updateValue(next, start + 4);
      requestAnimationFrame(() => el.setSelectionRange(start + 4, start + 4));
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onRun?.();
    }
  };
  const shared = {
    position: "absolute", inset: "42px 0 0", margin: 0, padding: "12px 14px", border: "none",
    fontFamily: MONO, fontSize: 13, lineHeight: 1.55, tabSize: 4,
    fontVariantLigatures: codeLigatures ? "common-ligatures" : "none",
    whiteSpace: wrap ? "pre-wrap" : "pre", overflowWrap: wrap ? "anywhere" : "normal", wordBreak: wrap ? "break-word" : "normal",
  };
  const toolButton = (active, title, onClick, Icon) => (
    <button type="button" onClick={onClick} title={title} aria-label={title} style={{ width: 30, height: 30, border: "none", borderRadius: 8, background: active ? t.surface : "transparent", color: active ? t.text : t.sub, cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}><Icon size={16} /></button>
  );

  return (
    <div style={{ position: "relative", height: editorHeight, borderRadius: attachedOutput ? "14px 14px 0 0" : 14, border: `1px solid ${t.border}`, background: t.raised, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: "0 0 auto", height: 42, zIndex: 3, display: "flex", alignItems: "center", gap: 2, padding: "6px 8px", borderBottom: `1px solid ${t.border}`, background: t.bg }}>
        {toolButton(wrap, "Перенос строк", () => saveToggle("zubrilka:warp-code", setWrap), WrapText)}
        {toolButton(syntax, "Подсветка синтаксиса", () => saveToggle("zubrilka:syntax-highlight", setSyntax), Braces)}
        {toolButton(codeLigatures, "Лигатуры", () => setCodeLigatures(!codeLigatures), LigaturesIcon)}
        {toolButton(suggestionsOn, "Подсказки", () => saveToggle("zubrilka:code-suggestions", setSuggestionsOn), Lightbulb)}
        <button type="button" onClick={onRun} disabled={!onRun || running || !value.trim()} title="Запустить (Ctrl+Enter)" style={{ marginLeft: "auto", height: 30, border: "none", borderRadius: 8, padding: "0 10px", background: t.invBg, color: t.inv, cursor: running || !value.trim() ? "default" : "pointer", opacity: running || !value.trim() ? 0.55 : 1, fontFamily: "inherit", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}><Play size={14} fill="currentColor" />{running ? "…" : "Запустить"}</button>
      </div>
      <pre ref={preRef} aria-hidden="true" style={{ ...shared, color: t.text, background: "transparent", overflow: "hidden", pointerEvents: "none" }}>
        {value ? (syntax ? highlighted : value) : <span style={{ color: t.sub }}># напиши решение на Python</span>}{"\n"}
      </pre>
      <textarea ref={taRef} value={value} onBeforeInput={onBeforeInput} onChange={(e) => updateValue(e.target.value, e.target.selectionStart)} onKeyDown={onKeyDown} onKeyUp={(e) => updateCaret(e.currentTarget)} onClick={(e) => updateCaret(e.currentTarget)} onScroll={syncScroll} wrap={wrap ? "soft" : "off"} spellCheck={false} autoComplete="off" autoCapitalize="off" autoCorrect="off" aria-label="Код на Python" style={{ ...shared, color: "transparent", caretColor: t.text, background: "transparent", resize: "none", outline: "none", overflow: "auto", WebkitTextFillColor: "transparent" }} />
      {suggestions.length > 0 && <div style={{ position: "absolute", zIndex: 4, top: caret.top, left: caret.left, minWidth: 150, padding: 4, borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface, boxShadow: theme === "dark" ? "0 8px 22px rgba(0,0,0,.4)" : "0 8px 22px rgba(0,0,0,.15)" }}>{suggestions.map((item) => <button key={item} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickSuggestion(item)} style={{ display: "block", width: "100%", border: "none", borderRadius: 6, background: "transparent", color: t.text, cursor: "pointer", textAlign: "left", padding: "6px 8px", fontFamily: MONO, fontSize: 12 }}>{item}</button>)}</div>}
      <div onPointerDown={startResize} aria-label="Изменить высоту редактора" role="separator" aria-orientation="horizontal" style={{ position: "absolute", zIndex: 5, left: 0, right: 0, bottom: 0, height: 14, cursor: "ns-resize", touchAction: "none", display: "grid", placeItems: "center" }}>
        <span style={{ width: 34, height: 3, borderRadius: 999, background: t.border }} />
      </div>
    </div>
  );
}
