import { Fragment, useEffect, useMemo, useState } from "react";
import { katexHtml } from "../utils";
import { commonsSearchUrl, pickCommonsImage } from "../imageSearch";

function parseInline(src) {
  const s = String(src || "");
  const nodes = [];
  const buf = [];
  const flush = () => {
    if (buf.length) {
      nodes.push({ type: "text", value: buf.join("") });
      buf.length = 0;
    }
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) {
      buf.push(c, s[i + 1]);
      i += 2;
      continue;
    }
    if (c === "!" && s[i + 1] === "[") {
      const close = s.indexOf("]", i + 2);
      if (close !== -1 && s[close + 1] === "(") {
        const end = s.indexOf(")", close + 2);
        if (end !== -1) {
          flush();
          nodes.push({ type: "image", alt: s.slice(i + 2, close), href: s.slice(close + 2, end) });
          i = end + 1;
          continue;
        }
      }
    }
    if (c === "~" && s[i + 1] === "~") {
      const end = s.indexOf("~~", i + 2);
      if (end !== -1 && end > i + 2) {
        flush();
        nodes.push({ type: "del", children: parseInline(s.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (c === "$") {
      const display = s[i + 1] === "$";
      const delim = display ? "$$" : "$";
      const end = s.indexOf(delim, i + delim.length);
      if (end !== -1 && end > i + delim.length) {
        flush();
        nodes.push({ type: "math", value: s.slice(i + delim.length, end).trim(), display });
        i = end + delim.length;
        continue;
      }
    }
    if (c === "*") {
      const bold = s[i + 1] === "*";
      const delim = bold ? "**" : "*";
      const end = s.indexOf(delim, i + delim.length);
      if (end !== -1 && end > i + delim.length) {
        flush();
        nodes.push({ type: "em", strong: bold, children: parseInline(s.slice(i + delim.length, end)) });
        i = end + delim.length;
        continue;
      }
    }
    if (c === "_") {
      const end = s.indexOf("_", i + 1);
      if (end !== -1 && end > i + 1) {
        flush();
        nodes.push({ type: "em", strong: false, children: parseInline(s.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (c === "`") {
      const end = s.indexOf("`", i + 1);
      if (end !== -1) {
        flush();
        nodes.push({ type: "code", value: s.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (c === "[") {
      const close = s.indexOf("]", i + 1);
      if (close !== -1 && s[close + 1] === "(") {
        const end = s.indexOf(")", close + 2);
        if (end !== -1) {
          flush();
          nodes.push({ type: "link", href: s.slice(close + 2, end), children: parseInline(s.slice(i + 1, close)) });
          i = end + 1;
          continue;
        }
      }
    }
    buf.push(c);
    i += 1;
  }
  flush();
  return nodes;
}

const LIST_RE = /^(\s*)([-*+•\u2014]|\d{1,3}[.)])\s+(.*)$/;

function tableRow(line) {
  const t = line.trim();
  return t.startsWith("|") && t.endsWith("|") && t.replace(/^\||\|$/g, "").split("|").length >= 2;
}

function tableSep(line) {
  const t = line.trim();
  if (!(t.startsWith("|") && t.endsWith("|"))) return false;
  return t.replace(/^\||\|$/g, "").split("|").every((c) => /^:?-{1,}:?$/.test(c.trim()));
}

function splitCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim().replace(/\\\|/g, "|"));
}

function parseBlocks(src) {
  const lines = String(src || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  const para = [];
  const flushPara = () => {
    if (para.length) {
      const text = para.join("\n").trim();
      if (text) blocks.push({ type: "para", text });
      para.length = 0;
    }
  };
  const push = (b) => {
    flushPara();
    blocks.push(b);
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (t.startsWith("```")) {
      const lang = t.slice(3).trim();
      const code = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      push({ type: "codeblock", lang, text: code.join("\n") });
      continue;
    }
    if (t.startsWith("$$")) {
      let j = i;
      let body = line.slice(line.indexOf("$$") + 2);
      while (!body.includes("$$") && j + 1 < lines.length) {
        j += 1;
        body += "\n" + lines[j];
      }
      const close = body.includes("$$") ? body.indexOf("$$") : body.length;
      push({ type: "math", value: body.slice(0, close).trim() });
      i = j + 1;
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    if (h) {
      push({ type: "heading", level: h[1].length, text: h[2].trim() });
      i += 1;
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      push({ type: "hr" });
      i += 1;
      continue;
    }
    if (tableRow(line) && i + 1 < lines.length && tableSep(lines[i + 1])) {
      const headers = splitCells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && tableRow(lines[i])) {
        rows.push(splitCells(lines[i]));
        i += 1;
      }
      push({ type: "table", headers, rows });
      continue;
    }
    const lm = LIST_RE.exec(line);
    if (lm) {
      const items = [];
      const stack = [{ indent: -1, items }];
      while (i < lines.length) {
        const m = LIST_RE.exec(lines[i]);
        if (!m) {
          const cont = /^(\s*)(.*)$/.exec(lines[i]);
          const cur = stack[stack.length - 1].items;
          if (/^\s*$/.test(lines[i]) || !cont || !cur.length || cont[1].length < 2) break;
          cur[cur.length - 1].text += "\n" + cont[2].trim();
          i += 1;
          continue;
        }
        const indent = m[1].replace(/\t/g, "  ").length;
        const ordered = /^\d/.test(m[2]);
        const task = /^\[([ xX])\]\s+(.*)$/.exec(m[3]);
        const item = {
          text: task ? task[2] : m[3],
          ordered,
          checked: task ? /[xX]/.test(task[1]) : null,
          items: [],
        };
        while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
        stack[stack.length - 1].items.push(item);
        stack.push({ indent, items: item.items });
        i += 1;
      }
      push({ type: "list", items });
      continue;
    }
    if (/^>\s?/.test(t)) {
      const quote = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      push({ type: "quote", text: quote.join("\n").trim() });
      continue;
    }
    if (!t) {
      flushPara();
      i += 1;
      continue;
    }
    para.push(line);
    i += 1;
  }
  flushPara();
  return blocks;
}

function Inline({ nodes, t, k }) {
  return (
    <Fragment>
      {nodes.map((n, i) => {
        const key = `${k}-${i}`;
        switch (n.type) {
          case "text":
            return <span key={key}>{n.value}</span>;
          case "del":
            return <s key={key}><Inline nodes={n.children} t={t} k={key} /></s>;
          case "image":
            return <RemoteImage key={`${key}-${n.href}`} alt={n.alt} href={n.href} t={t} />;
          case "math":
            return (
              <span
                key={key}
                dangerouslySetInnerHTML={{ __html: katexHtml(n.value, n.display) }}
                style={n.display ? { display: "block", margin: "10px 0", overflowX: "auto" } : undefined}
              />
            );
          case "code":
            return (
              <code key={key} style={{ background: t.raised, border: `1px solid ${t.border}`, borderRadius: 6, padding: "2px 5px", fontSize: "0.92em", fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>
                {n.value}
              </code>
            );
          case "em":
            return n.strong ? (
              <strong key={key}><Inline nodes={n.children} t={t} k={key} /></strong>
            ) : (
              <em key={key}><Inline nodes={n.children} t={t} k={key} /></em>
            );
          case "link":
            return (
              <a key={key} href={n.href} target="_blank" rel="noreferrer" style={{ color: t.invBg, textDecoration: "underline", textUnderlineOffset: 2 }}>
                <Inline nodes={n.children} t={t} k={key} />
              </a>
            );
          default:
            return null;
        }
      })}
    </Fragment>
  );
}

function List({ items, t, k }) {
  return (
    <div>
      {items.map((item, i) => {
        const key = `${k}-${i}`;
        return (
          <div key={key} style={{ display: "flex", gap: 8, padding: "3px 0", lineHeight: 1.5 }}>
            <span style={{ color: t.sub, flexShrink: 0, fontWeight: 600 }}>
              {item.checked === null ? (item.ordered ? `${i + 1}.` : "•") : (item.checked ? "☑" : "☐")}
            </span>
            <div style={{ flex: 1, minWidth: 0, whiteSpace: "pre-wrap" }}>
              <div style={{ color: t.text }}>
                <Inline nodes={parseInline(item.text)} t={t} k={key} />
              </div>
              {item.items.length > 0 && (
                <div style={{ paddingLeft: 10, marginTop: 2 }}>
                  <List items={item.items} t={t} k={`${key}_s`} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Table({ headers, rows, t }) {
  const lastCol = headers.length - 1;
  return (
    <div style={{ overflowX: "auto", margin: "10px 0" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          borderRadius: 16,
          overflow: "hidden",
          border: `1px solid ${t.border}`,
          background: t.surface,
        }}
      >
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: "left",
                  padding: "10px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: t.sub,
                  background: t.raised,
                  borderBottom: `1px solid ${t.border}`,
                  borderRight: i === lastCol ? "none" : `1px solid ${t.border}`,
                }}
              >
                <Inline nodes={parseInline(h)} t={t} k={`th${i}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "10px 14px",
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: t.text,
                    verticalAlign: "top",
                    borderBottom: ri === rows.length - 1 ? "none" : `1px solid ${t.border}`,
                    borderRight: ci === lastCol ? "none" : `1px solid ${t.border}`,
                  }}
                >
                  <Inline nodes={parseInline(c)} t={t} k={`td${ri}-${ci}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const COMMONS_HOST = /^https:\/\/(upload\.wikimedia\.org|thumb\.wikimedia\.org|commons\.wikimedia\.org)\//i;

function RemoteImage({ alt, href, t }) {
  // Модель пишет img:запрос, а не URL: так нельзя получить выдуманную ссылку.
  const query = href.startsWith("img:") ? href.slice(4).trim() : "";
  const direct = !query && COMMONS_HOST.test(href) ? href : "";
  const [found, setFound] = useState(null);
  const [loading, setLoading] = useState(Boolean(query));
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!query) return undefined;
    let alive = true;
    fetch(commonsSearchUrl(query))
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (alive) setFound(pickCommonsImage(json)); })
      .catch(() => { if (alive) setFound(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [query]);

  const src = direct || found?.src;
  if (loading) return <div style={{ color: t.sub, fontSize: 12, margin: "8px 0" }}>Подбираю картинку…</div>;
  if (!src || broken) {
    return (
      <a href={direct || found?.source || "https://commons.wikimedia.org/"} target="_blank" rel="noreferrer" style={{ color: t.invBg, fontSize: 12 }}>
        {alt || query || "Картинка"} — источник
      </a>
    );
  }
  const source = found?.source || direct;
  const caption = [alt || found?.title, found?.license].filter(Boolean).join(" · ");
  return (
    <figure style={{ margin: "12px 0" }}>
      <img
        src={src}
        alt={alt || found?.title || "Рисунок"}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        style={{ width: "100%", display: "block", borderRadius: 12, border: `1px solid ${t.border}` }}
      />
      <figcaption style={{ color: t.sub, fontSize: 11, lineHeight: 1.4, marginTop: 6 }}>
        {source ? <a href={source} target="_blank" rel="noreferrer" style={{ color: t.invBg }}>{caption || "Wikimedia Commons"}</a> : caption}
      </figcaption>
    </figure>
  );
}

export default function MarkdownText({ text, t, style }) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return (
    <div style={{ fontSize: 13, ...style }}>
      {blocks.map((b, i) => {
        const k = `b${i}`;
        switch (b.type) {
          case "heading":
            return (
              <div key={k} style={{ color: t.text, fontSize: [19, 16, 15, 14, 14, 14][Math.min(5, b.level - 1)], fontWeight: 700, margin: "14px 0 6px", lineHeight: 1.3 }}>
                <Inline nodes={parseInline(b.text)} t={t} k={k} />
              </div>
            );
          case "para":
            return (
              <div key={k} style={{ color: t.text, lineHeight: 1.55, margin: "8px 0", whiteSpace: "pre-line", wordBreak: "break-word" }}>
                <Inline nodes={parseInline(b.text)} t={t} k={k} />
              </div>
            );
          case "codeblock":
            return (
              <pre key={k} style={{ margin: "10px 0", padding: "12px 14px", overflowX: "auto", borderRadius: 12, border: `1px solid ${t.border}`, background: t.raised, color: t.text, fontSize: 12, lineHeight: 1.5, whiteSpace: "pre" }}>
                <code>{b.text}</code>
              </pre>
            );
          case "math":
            return <div key={k} dangerouslySetInnerHTML={{ __html: katexHtml(b.value, true) }} style={{ overflowX: "auto", margin: "12px 0" }} />;
          case "list":
            return <div key={k} style={{ margin: "8px 0" }}><List items={b.items} t={t} k={k} /></div>;
          case "table":
            return <Table key={k} headers={b.headers} rows={b.rows} t={t} />;
          case "quote":
            return (
              <div key={k} style={{ borderLeft: `3px solid ${t.border}`, paddingLeft: 12, margin: "8px 0" }}>
                <MarkdownText text={b.text} t={t} />
              </div>
            );
          case "hr":
            return <div key={k} style={{ borderTop: `1px solid ${t.border}`, margin: "14px 0" }} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
