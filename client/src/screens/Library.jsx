import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { GhostLibrary, useGhostHold } from "../components/Ghost";
import Segmented from "../components/Segmented";
import { listPublicNotes, listPublicTests } from "../api/firestore";
import { setReturnTo } from "../nav";

function testModeChips(test) {
  const modes = Array.isArray(test?.modes) ? test.modes : [];
  const hasChoice = modes.includes("single")
    || modes.includes("multi")
    || (test?.questions?.length || 0) > 0;
  const hasQuizlet = modes.includes("quizlet") || (test?.quizlet?.length || 0) > 0;
  const hasMatch = modes.includes("match") || (test?.match?.length || 0) > 0;
  const hasWritten = modes.includes("written") || Boolean(test?.written?.prompt);
  const chips = [];
  if (hasChoice) chips.push("Выбор");
  if (hasQuizlet) chips.push("Квизлет");
  if (hasMatch) chips.push("Пары");
  if (hasWritten) chips.push("Письм.");
  return chips.length ? chips : ["Тест"];
}

function Chip({ children, t }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: t.sub,
        border: `1px solid ${t.border}`,
        padding: "2px 8px",
        borderRadius: 999,
      }}
    >
      {children}
    </span>
  );
}

function AuthorMark({ name, photo, surface }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        right: -18,
        bottom: -22,
        width: 96,
        height: 96,
        borderRadius: 999,
        overflow: "hidden",
        transform: "rotate(14deg)",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          referrerPolicy="no-referrer"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            opacity: 1,
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(128,128,128,0.22)",
            color: "rgba(128,128,128,0.55)",
            fontSize: 42,
            fontWeight: 700,
          }}
        >
          {initial}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to top left, transparent 28%, ${surface} 78%)`,
        }}
      />
    </div>
  );
}

export default function Library() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const showGhost = useGhostHold(loading);
  const [notes, setNotes] = useState([]);
  const [tests, setTests] = useState([]);
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [ns, ts] = await Promise.all([
        listPublicNotes().catch(() => []),
        listPublicTests().catch(() => []),
      ]);
      setNotes(ns);
      setTests(ts);
      setLoading(false);
    })();
  }, []);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (title, author) => {
      if (!needle) return true;
      return `${title || ""} ${author || ""}`.toLowerCase().includes(needle);
    };
    const noteItems = notes
      .filter((n) => match(n.title, n.author_name))
      .map((n) => ({
        kind: "note",
        id: n.id,
        title: n.title || "Конспект",
        author: n.author_name || "",
        photo: n.author_photo_url || "",
        chips: ["Конспект"],
        at: n.published_at,
      }));
    const testItems = tests
      .filter((x) => match(x.title, x.author_name))
      .map((x) => ({
        kind: "test",
        id: x.id,
        title: x.title || "Тест",
        author: x.author_name || "",
        photo: x.author_photo_url || "",
        chips: testModeChips(x),
        at: x.published_at,
      }));

    let list = [];
    if (tab === "notes") list = noteItems;
    else if (tab === "tests") list = testItems;
    else list = [...noteItems, ...testItems].sort((a, b) => (b.at?.toMillis?.() || 0) - (a.at?.toMillis?.() || 0));
    return list;
  }, [notes, tests, tab, q]);

  if (showGhost) {
    return (
      <div>
        <div
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "14px 16px",
            marginBottom: 14,
            borderRadius: 16,
            border: `1px solid ${t.border}`,
            background: t.surface,
            opacity: 0.7,
          }}
        >
          <span style={{ color: t.sub, fontSize: 15 }}>Поиск по названию или автору</span>
        </div>
        <Segmented
          options={[
            { v: "all", label: "Все" },
            { v: "notes", label: "Конспекты" },
            { v: "tests", label: "Тесты" },
          ]}
          value={tab}
          onChange={setTab}
          style={{ marginBottom: 16 }}
        />
        <GhostLibrary count={6} />
      </div>
    );
  }

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Поиск по названию или автору"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "14px 16px",
          marginBottom: 14,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
          background: t.surface,
          color: t.text,
          fontSize: 15,
          fontFamily: "inherit",
          outline: "none",
        }}
      />

      <Segmented
        options={[
          { v: "all", label: "Все" },
          { v: "notes", label: "Конспекты" },
          { v: "tests", label: "Тесты" },
        ]}
        value={tab}
        onChange={setTab}
        style={{ marginBottom: 16 }}
      />

      {items.length === 0 ? (
        <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.5, padding: "24px 4px" }}>
          Пока пусто. Опубликуй конспект или тест — и он появится здесь у всех.
        </div>
      ) : (
        items.map((item) => (
          <button
            key={`${item.kind}-${item.id}`}
            type="button"
            className="rowpress"
            onClick={() => {
              setReturnTo("/library");
              if (item.kind === "note") navigate(`/note/${item.id}`, { state: { from: "/library" } });
              else navigate(`/test/${item.id}/quiz/full`, { state: { from: "/library" } });
            }}
            style={{
              position: "relative",
              overflow: "hidden",
              width: "100%",
              display: "block",
              padding: "16px 18px",
              paddingRight: 72,
              marginBottom: 10,
              borderRadius: 18,
              border: `1px solid ${t.border}`,
              background: t.surface,
              color: t.text,
              fontFamily: "inherit",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <AuthorMark name={item.author || item.title} photo={item.photo} surface={t.surface} />
            <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.title}
              </div>
              <div
                style={{
                  color: t.sub,
                  fontSize: 12,
                  marginTop: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                {(item.chips || []).map((label) => (
                  <Chip key={label} t={t}>{label}</Chip>
                ))}
                {item.author ? <span>{item.author}</span> : null}
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
