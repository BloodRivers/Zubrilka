import { useEffect, useState } from "react";
import { signOut, deleteUser } from "firebase/auth";
import { Download } from "lucide-react";
import { auth } from "../firebase";
import { useTheme } from "../theme/ThemeContext";
import { useAlert } from "../components/Alert";
import { Bone, useGhostHold } from "../components/Ghost";
import Avatar from "../components/Avatar";
import { getUserProfile, updateUserProfile, exportUserData, deleteAllUserData } from "../api/firestore";

const row = (t) => ({
  padding: "14px 16px",
  borderRadius: 18,
  background: t.surface,
  border: `1px solid ${t.border}`,
  minHeight: 52,
  display: "flex",
  alignItems: "center",
});

const sectionTitle = (t, first = false) => ({
  color: t.sub,
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  margin: first ? "4px 0 8px 4px" : "22px 0 8px 4px",
});

function GhostAccountSimple() {
  return (
    <div aria-busy="true" aria-label="Загрузка">
      <Bone width={80} height={12} radius={6} style={{ margin: "4px 0 12px 4px" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "4px 2px 12px" }}>
        <Bone width={58} height={58} radius={999} />
        <div style={{ flex: 1 }}>
          <Bone width="55%" height={20} radius={8} />
          <Bone width="40%" height={12} radius={6} style={{ marginTop: 10 }} />
        </div>
      </div>
      <Bone width="100%" height={52} radius={18} />
      <Bone width={80} height={12} radius={6} style={{ margin: "28px 0 12px 4px" }} />
      <Bone width="100%" height={52} radius={18} />
      <Bone width={100} height={12} radius={6} style={{ margin: "28px 0 12px 4px" }} />
      <Bone width="100%" height={52} radius={18} />
      <Bone width="100%" height={52} radius={18} style={{ marginTop: 8 }} />
    </div>
  );
}

export default function Account() {
  const { t } = useTheme();
  const { alert } = useAlert();
  const [name, setName] = useState("");
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);
  const showGhost = useGhostHold(!ready);

  useEffect(() => {
    (async () => {
      try {
        const me = await getUserProfile().catch(() => null);
        setProfile(me || {});
        setName(me?.name || auth.currentUser?.displayName || "");
      } catch {
        setProfile({});
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    const id = setTimeout(async () => {
      const v = name.trim();
      if (!v || v === profile?.name) return;
      try {
        await updateUserProfile({ name: v });
        setProfile((p) => ({ ...p, name: v }));
      } catch (err) {
        alert("Не удалось сохранить имя: " + (err?.message ?? ""));
      }
    }, 3000);
    return () => clearTimeout(id);
  }, [name]);

  const exportData = async () => {
    try {
      const data = await exportUserData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zubrilka-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Не удалось выгрузить данные: " + (err?.message ?? ""));
    }
  };

  const confirmDelete = () =>
    alert("Аккаунт, предметы, конспекты, тесты и результаты будут удалены без возможности восстановления.", {
      title: "Удалить аккаунт",
      danger: true,
      confirmLabel: "Удалить",
      onConfirm: async () => {
        try {
          await deleteAllUserData();
          await deleteUser(auth.currentUser);
          await signOut(auth);
        } catch (e) {
          alert(
            e?.code === "auth/requires-recent-login"
              ? "Для удаления аккаунта нужно заново войти."
              : "Не удалось удалить аккаунт: " + (e?.message ?? "")
          );
        }
      },
    });

  const confirmExit = () =>
    alert("Ты вернёшься на экран входа.", {
      title: "Выйти из аккаунта?",
      confirmLabel: "Выйти",
      danger: true,
      onConfirm: async () => {
        try {
          await signOut(auth);
        } catch (err) {
          alert(err?.message || "Не получилось выйти. Попробуй ещё раз.");
        }
      },
    });

  if (showGhost) return <GhostAccountSimple />;

  const displayName = name || auth.currentUser?.displayName || (auth.currentUser?.email || "").split("@")[0];

  return (
    <div>
      <div style={sectionTitle(t, true)}>Данные</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "2px 2px 12px" }}>
        <Avatar name={displayName} src={auth.currentUser?.photoURL || profile?.photo_url} size={58} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: t.text, fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayName}
          </div>
          <div style={{ color: t.sub, fontSize: 13, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {auth.currentUser?.email || ""}
          </div>
        </div>
      </div>
      <div style={{ ...row(t), gap: 10 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Как тебя зовут"
          aria-label="Имя"
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            color: t.text,
            fontSize: 15,
            fontFamily: "inherit",
          }}
        />
      </div>

      <div style={sectionTitle(t)}>Данные</div>
      <button
        className="rowpress"
        onClick={exportData}
        style={{
          width: "100%",
          ...row(t),
          color: t.text,
          fontSize: 15,
          fontFamily: "inherit",
          cursor: "pointer",
          textAlign: "left",
          justifyContent: "space-between",
        }}
      >
        Экспорт данных
        <Download size={16} color={t.sub} />
      </button>

      <div style={sectionTitle(t)}>Опасная зона</div>
      <button
        className="rowpress"
        onClick={confirmExit}
        style={{
          width: "100%",
          ...row(t),
          color: t.text,
          fontSize: 15,
          fontFamily: "inherit",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        Выйти из аккаунта
      </button>
      <button
        className="rowpress"
        onClick={confirmDelete}
        style={{
          width: "100%",
          marginTop: 8,
          ...row(t),
          color: "#E5484D",
          fontSize: 15,
          fontFamily: "inherit",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        Удалить аккаунт
      </button>
    </div>
  );
}
