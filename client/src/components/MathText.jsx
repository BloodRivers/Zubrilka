import { useMemo } from "react";
import { katexHtml } from "../utils";

export function splitMath(text) {
  const nodes = [];
  const src = String(text || "");
  let i = 0;
  while (i < src.length) {
    const dl = src.indexOf("$$", i);
    const il = src.indexOf("$", i);
    let next = -1;
    let isBlock = false;
    if (dl !== -1 && (il === -1 || dl <= il)) {
      next = dl;
      isBlock = true;
    } else if (il !== -1) {
      next = il;
    }
    if (next === -1) {
      nodes.push({ type: "text", value: src.slice(i) });
      break;
    }
    if (src[next - 1] === "\\") {
      nodes.push({ type: "text", value: src.slice(i, next + 1) });
      i = next + 1;
      continue;
    }
    if (next > i) nodes.push({ type: "text", value: src.slice(i, next) });
    if (isBlock) {
      const end = src.indexOf("$$", next + 2);
      if (end === -1) {
        nodes.push({ type: "text", value: src.slice(next) });
        break;
      }
      nodes.push({ type: "block", value: src.slice(next + 2, end) });
      i = end + 2;
    } else {
      const end = src.indexOf("$", next + 1);
      if (end === -1) {
        nodes.push({ type: "text", value: src.slice(next) });
        break;
      }
      nodes.push({ type: "inline", value: src.slice(next + 1, end) });
      i = end + 1;
    }
  }
  return nodes;
}

export default function MathText({ text, style, as: Tag = "div" }) {
  const nodes = useMemo(() => splitMath(text), [text]);
  return (
    <Tag style={style}>
      {nodes.map((n, i) =>
        n.type === "text" ? (
          <span key={i}>{n.value}</span>
        ) : (
          <span
            key={i}
            dangerouslySetInnerHTML={{
              __html: katexHtml(n.value, n.type === "block"),
            }}
            style={n.type === "block" ? { display: "block", margin: "10px 0", overflowX: "auto" } : undefined}
          />
        )
      )}
    </Tag>
  );
}