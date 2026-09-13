import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileText, FlaskConical } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import Avatar from "../components/Avatar";
import { Bone, useGhostHold } from "../components/Ghost";
import {
  getUserProfileById,
  listPublicNotesByUser,
  listPublicTestsByUser,
} from "../api/firestore";
import { setReturnTo } from "../nav";

export default function UserProfile() {
  const { userId } = useParams();
  const { t } = useTheme();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [notes, setNotes] = useState([]);
  const [tests, setTests] = useState([]);
  const [ready, setReady] = useState(false);
  const showGhost = useGhostHold(!ready);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [me, ns, ts] = await Promise.all([
        getUserProfileById(userId).catch(() => null),
        listPublicNotesByUser(userId).catch(() => []),
        listPublicTestsByUser(userId).catch(() => []),
      ]);
      if (!alive) return;
      setProfile(me);
      setNotes(ns);
      setTests(ts);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const ghostBlock = (
    <div aria-busy="true">
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "4px 2px 20px" }}>
        <Bone width={64} height={64} radius={999} />
        <div style={{ flex: 1 }}>
          <Bone width="55%" height={20} radius={8} />
          <Bone width="40%" height={12} radius={6} style={{ marginTop: 10 }} />
        </div>
      </div>
      <Bone width="100%" height={52} radius={18} />
      <Bone width="100%" height={52} radius={18} style={{ marginTop: 10 }} />
      <Bone width="100%" height={52} radius={18} style={{ marginTop: 10 }} />
    </div>
  );

  if (showGhost) return ghostBlock;

  // Чужой профиль недоступен для чтения (rules), поэтому имя/фото берём
  // из его публикаций. Нет ни профиля, ни публикаций — показываем скелетон.
  const pub = notes[0] || tests[0];
  const name = profile?.name || pub?.author_name || "";
  const photo = profile?.photo_url || pub?.author_photo_url || "";
  if (ready && !profile && !pub) return ghostBlock;

  const displayName = name || "Пользователь";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "2px 2px 20px" }}>
        <Avatar name={displayName} src={photo} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: t.text, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayName}
          </div>
          <div style={{ color: t.sub, fontSize: 13, marginTop: 4 }}>
            {notes.length} конспект{plural(notes.length)} · {tests.length} тест{pluralTest(tests.length)} в библиотеке
          </div>
        </div>
      </div>

      {notes.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <SectionTitle t={t}>Конспекты</SectionTitle>
          {notes.map((n) => (
            <Item
              key={n.id}
              icon={<FileText size={16} color={t.sub} />}
              title={n.title || "Конспект"}
              onOpen={() => {
                setReturnTo(`/user/${userId}`);
                navigate(`/note/${n.id}`, { state: { from: `/user/${userId}` } });
              }}
              t={t}
            />
          ))}
        </div>
      )}

      {tests.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <SectionTitle t={t}>Тесты</SectionTitle>
          {tests.map((x) => (
            <Item
              key={x.id}
              icon={<FlaskConical size={16} color={t.sub} />}
              title={x.title || "Тест"}
              onOpen={() => {
                setReturnTo(`/user/${userId}`);
                navigate(`/test/${x.id}/quiz/full`, { state: { from: `/user/${userId}` } });
              }}
              t={t}
            />
          ))}
        </div>
      )}

      {notes.length === 0 && tests.length === 0 && (
        <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.5, padding: "24px 4px" }}>
          Пока ничего не опубликовано.
        </div>
      )}
    </div>
  );
}

function plural(n) {
  const s = n % 100;
  if (s >= 11 && s <= 14) return "ов";
  const d = s % 10;
  if (d === 1) return "";
  if (d >= 2 && d <= 4) return "а";
  return "ов";
}

function pluralTest(n) {
  const s = n % 100;
  if (s >= 11 && s <= 14) return "ов";
  const d = s % 10;
  if (d === 1) return "";
  if (d >= 2 && d <= 4) return "а";
  return "ов";
}

function SectionTitle({ t, children }) {
  return (
    <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px 4px" }}>
      {children}
    </div>
  );
}

function Item({ icon, title, onOpen, t }) {
  return (
    <button
      type="button"
      className="rowpress"
      onClick={onOpen}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        marginBottom: 8,
        borderRadius: 16,
        border: `1px solid ${t.border}`,
        background: t.surface,
        color: t.text,
        fontFamily: "inherit",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          background: t.raised,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </span>
    </button>
  );
}