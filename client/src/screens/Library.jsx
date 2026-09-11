import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { GhostLibrary, useGhostHold } from "../components/Ghost";
import Segmented from "../components/Segmented";
import Avatar from "../components/Avatar";
import ListRow from "../components/ListRow";
import { Brain } from "lucide-react";
import { listPublicNotes, listPublicTests } from "../api/firestore";
import { testSizeLabel } from "../api/backend";
import { setReturnTo } from "../nav";
import { TRAINER_LIST } from "./StressTrainer";

function testModeChips(test) {
  const modes = Array.isArray(test?.modes) ? test.modes : [];
  const hasChoice = modes.includes("single")
    || modes.includes("multi")
    || (test?.questions?.length || 0) > 0;
  const hasQuizlet = modes.includes("quizlet") || (test?.quizlet?.length || 0) > 0;
  const hasMatch = modes.includes("match") || (test?.match?.length || 0) > 0;
  const hasWritten = modes.includes("written") || Boolean(test?.written?.prompt) || (test?.written?.questions?.length || 0) > 0;
  const chips = ["Тест"];
  if (hasChoice) chips.push("Выбор");
  if (hasQuizlet) chips.push("Квизлет");
  if (hasMatch) chips.push("Пары");
  if (hasWritten) chips.push("Письм.");
  return chips;
}

function Chip({ children, t, color }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.02em",
        color: color ? "rgba(255,255,255,0.9)" : t.sub,
        background: color || "transparent",
        border: color ? "none" : `1px solid ${t.border}`,
        padding: "2px 7px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function testScoreBadge(test) {
  return testSizeLabel(test);
}

const KIND_COLOR = {
  note: "#0091FF",
  test: "#8E4EC6",
};

export default function Library() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const showGhost = useGhostHold(loading);
  const [notes, setNotes] = useState([]);
  const [tests, setTests] = useState([]);
  const [tab, setTab] = useState("notes");
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");

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

  const subjectOptions = useMemo(() => {
    const set = new Set();
    for (const n of notes) if (n.subject_name?.trim()) set.add(n.subject_name.trim());
    for (const x of tests) if (x.subject_name?.trim()) set.add(x.subject_name.trim());
    return [...set].sort((a, b) => a.localeCompare(b, "ru"));
  }, [notes, tests]);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (title, author) => {
      if (!needle) return true;
      return `${title || ""} ${author || ""}`.toLowerCase().includes(needle);
    };
    const subjOk = (name) => !subject || (name || "").trim() === subject;

    const noteItems = notes
      .filter((n) => match(n.title, n.author_name) && subjOk(n.subject_name))
      .map((n) => ({
        kind: "note",
        id: n.id,
        title: n.title || "Конспект",
        author: n.author_name || "",
        photo: n.author_photo_url || "",
        authorUid: n.author_uid || "",
        subject: n.subject_name || "",
        chips: ["Конспект"],
        badge: "",
        at: n.published_at,
      }));
    const testItems = tests
      .filter((x) => match(x.title, x.author_name) && subjOk(x.subject_name))
      .map((x) => ({
        kind: "test",
        id: x.id,
        title: x.title || "Тест",
        author: x.author_name || "",
        photo: x.author_photo_url || "",
        authorUid: x.author_uid || "",
        subject: x.subject_name || "",
        chips: testModeChips(x),
        badge: testScoreBadge(x),
        at: x.published_at,
      }));

    if (tab === "notes") return noteItems;
    if (tab === "tests") return testItems;
    return [];
  }, [notes, tests, tab, q, subject]);

  const searchBar = (opacity) => (
    <div
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "14px 16px",
        marginBottom: 14,
        borderRadius: 16,
        border: `1px solid ${t.border}`,
        background: t.surface,
        color: t.sub,
        fontSize: 15,
        opacity,
      }}
    >
      Поиск по названию или автору
    </div>
  );

  if (showGhost) {
    return (
      <div>
        {searchBar(0.7)}
        <Segmented
          options={[
            { v: "notes", label: "Конспекты" },
            { v: "tests", label: "Тесты" },
            { v: "trainers", label: "Тренажёры" },
          ]}
          value={tab}
          onChange={setTab}
          style={{ marginBottom: 12 }}
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
          marginBottom: 12,
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
          { v: "notes", label: "Конспекты" },
          { v: "tests", label: "Тесты" },
          { v: "trainers", label: "Тренажёры" },
        ]}
        value={tab}
        onChange={setTab}
        style={{ marginBottom: 10 }}
      />

      {tab === "trainers" ? (
        TRAINER_LIST.filter((x) => !q.trim() || `${x.title} ${x.sub}`.toLowerCase().includes(q.trim().toLowerCase())).map((x, i) => (
          <ListRow
            key={x.id}
            idx={i}
            icon={<Brain size={20} color={t.text} strokeWidth={2} />}
            title={x.title}
            sub={x.sub}
            onClick={() => navigate(`/trainer/${x.id}`)}
          />
        ))
      ) : (
        <>
      {subjectOptions.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            padding: "2px 2px 8px",
            marginBottom: 4,
            WebkitOverflowScrolling: "touch",
          }}
        >
          <button
            type="button"
            className="press"
            onClick={() => setSubject("")}
            style={{
              flexShrink: 0,
              padding: "7px 12px",
              borderRadius: 999,
              border: `1px solid ${subject === "" ? t.invBg : t.border}`,
              background: subject === "" ? t.invBg : t.raised,
              color: subject === "" ? t.inv : t.sub,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Все предметы
          </button>
          {subjectOptions.map((s) => (
            <button
              key={s}
              type="button"
              className="press"
              onClick={() => setSubject(subject === s ? "" : s)}
              style={{
                flexShrink: 0,
                padding: "7px 12px",
                borderRadius: 999,
                border: `1px solid ${subject === s ? t.invBg : t.border}`,
                background: subject === s ? t.invBg : t.raised,
                color: subject === s ? t.inv : t.sub,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.5, padding: "24px 4px" }}>
          Пока пусто. Опубликуй конспект или тест — и он появится здесь у всех.
        </div>
      ) : (
        items.map((item, i) => (
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
              width: "100%",
              display: "block",
              padding: "14px 16px",
              marginBottom: 10,
              borderRadius: 18,
              border: `1px solid ${t.border}`,
              background: t.surface,
              color: t.text,
              fontFamily: "inherit",
              cursor: "pointer",
              textAlign: "left",
              overflow: "hidden",
              animation: `fadeUp 460ms cubic-bezier(0.16,1,0.3,1) both`,
              animationDelay: `${i * 60}ms`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                background: KIND_COLOR[item.kind],
                opacity: 0.55,
              }}
            />
            <div style={{ paddingLeft: 8, minWidth: 0 }}>
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
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {item.chips.map((label) => (
                    <Chip key={label} t={t} color={label === item.chips[0] ? KIND_COLOR[item.kind] : null}>
                      {label}
                    </Chip>
                  ))}
                  {item.subject && <Chip t={t}>{item.subject}</Chip>}
                  {item.kind === "test" && item.badge && <Chip t={t}>{item.badge}</Chip>}
                </div>
              {item.author ? (
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9 }}>
                  <Avatar name={item.author} src={item.photo || ""} size={20} />
                  <span style={{ color: t.sub, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.author}
                  </span>
                </div>
              ) : null}
            </div>
          </button>
        ))
      )}
        </>
      )}
    </div>
  );
}