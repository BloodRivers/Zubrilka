import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { useTheme } from "../theme/ThemeContext";
import { EASE } from "../theme/theme";
import { plural } from "../utils";
import Loader from "../components/Loader";
import Avatar from "../components/Avatar";
import { listLeaderboard } from "../api/firestore";

const MEDAL_COLORS = ["#E5B94E", "#A9A9B8", "#C68B4E"];

export default function Leaderboard() {
  const { t } = useTheme();
  const [ranking, setRanking] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const rows = await listLeaderboard();
        setRanking(
          rows
            .sort((a, b) => {
              const pa = a.total ? a.correct / a.total : 0;
              const pb = b.total ? b.correct / b.total : 0;
              return pb - pa || (b.tests || 0) - (a.tests || 0);
            })
            .slice(0, 20)
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
          Рейтинг появится после первого теста.
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
            <span style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ color: mine ? t.inv : t.text, fontSize: 15, fontWeight: 700 }}>
                {r.total ? Math.round((r.correct / r.total) * 100) : 0}%
                <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 13 }}> точности</span>
              </div>
              <div style={{ color: mine ? t.inv : t.sub, fontSize: 11, opacity: 0.8 }}>
                {r.tests || 0} {plural(r.tests || 0, ["тест", "теста", "тестов"])}
              </div>
            </span>
          </div>
        );
      })}
    </div>
  );
}