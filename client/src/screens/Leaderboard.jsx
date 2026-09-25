import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { useTheme } from "../theme/ThemeContext";
import { EASE } from "../theme/theme";
import Loader from "../components/Loader";
import Avatar from "../components/Avatar";
import { listAllUsers, listAllResults } from "../api/firestore";

const MEDAL_COLORS = ["#E5B94E", "#A9A9B8", "#C68B4E"];

export default function Leaderboard() {
  const { t } = useTheme();
  const [ranking, setRanking] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [allResults, allUsers] = await Promise.all([listAllResults().catch(() => []), listAllUsers().catch(() => [])]);
        const byId = new Map((allUsers || []).map((u) => [u.id, u]));
        const rows = new Map();
        for (const r of allResults) {
          if (!r.user_id) continue;
          if (!rows.has(r.user_id))
            rows.set(r.user_id, { id: r.user_id, name: "", email: "", photo_url: null, correct: 0, total: 0, attempts: 0 });
          const row = rows.get(r.user_id);
          row.correct += r.score || 0;
          row.total += r.total || 0;
          row.attempts += 1;
        }
        for (const [id, row] of rows) {
          const u = byId.get(id);
          row.name = u?.name || row.email || "";
          row.email = u?.email || "";
          row.photo_url = u?.photo_url || null;
          if (!row.name) row.name = (u?.email || "").split("@")[0];
        }
        setRanking(
          [...rows.values()].sort((a, b) => b.correct - a.correct || b.attempts - a.attempts).slice(0, 20)
        );
      } catch {
        setRanking([]);
      }
    })();
  }, []);

  if (!ranking) return <Loader />;

  const me = auth.currentUser?.uid;

  if (ranking.length === 0) {
    return (
      <div style={{ paddingTop: 40, textAlign: "center" }}>
        <div style={{ color: t.text, fontWeight: 600, fontSize: 15 }}>Пока пусто</div>
        <div style={{ color: t.sub, fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
          Очки появятся после первого теста.
        </div>
      </div>
    );
  }

  return (
    <div>
      {ranking.map((r, i) => {
        const mine = r.id === me;
        return (
          <div
            key={r.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              marginBottom: 8,
              borderRadius: 18,
              background: mine ? t.invBg : t.surface,
              border: `1px solid ${mine ? "transparent" : t.border}`,
              animation: `fadeUp 460ms ${EASE} both`,
              animationDelay: `${i * 60}ms`,
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                background: i < 3 ? MEDAL_COLORS[i] : "transparent",
                color: i < 3 ? "#0f0f12" : t.sub,
              }}
            >
              {i + 1}
            </span>
            <Avatar name={r.name} src={r.photo_url} size={38} />
            <span style={{ flex: 1, color: mine ? t.inv : t.text, fontSize: 15, fontWeight: 600 }}>{r.name || "Без имени"}</span>
            <span style={{ color: mine ? t.inv : t.text, fontSize: 15, fontWeight: 700 }}>
              {r.correct}
              <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 13 }}> очков</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}