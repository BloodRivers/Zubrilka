import { useEffect, useRef, useState } from "react";
import { signOut, deleteUser } from "firebase/auth";
import { Download, Camera, Pencil } from "lucide-react";
import { auth } from "../firebase";
import { useTheme } from "../theme/ThemeContext";
import { useAlert } from "../components/Alert";
import { Bone, useGhostHold } from "../components/Ghost";
import Avatar from "../components/Avatar";
import { getUserProfile, updateUserProfile, exportUserData, deleteAllUserData, countPublishedContent } from "../api/firestore";
import { downscaleImageFile } from "../api/files";

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

function StatsCard({ t, label, value, hint }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "16px 18px",
        borderRadius: 18,
        background: t.surface,
        border: `1px solid ${t.border}`,
      }}
    >
      <div style={{ color: t.text, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ color: t.sub, fontSize: 13, marginTop: 2 }}>{hint}</div>
      <div style={{ color: t.text, fontSize: 14, fontWeight: 600, marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function Account() {
  const { t } = useTheme();
  const { alert } = useAlert();
  const [name, setName] = useState("");
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const showGhost = useGhostHold(!ready);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await getUserProfile().catch(() => null);
        setProfile(me || {});
        setName(me?.name || auth.currentUser?.displayName || "");
        const st = await countPublishedContent().catch(() => null);
        setStats(st);
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

  const pickPhoto = () => fileRef.current?.click();

  const onPhotoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await downscaleImageFile(file, 128);
      await updateUserProfile({ photo_url: dataUrl });
      setProfile((p) => ({ ...p, photo_url: dataUrl }));
    } catch (err) {
      alert("Не удалось загрузить фото: " + (err?.message ?? ""));
    } finally {
      setPhotoBusy(false);
    }
  };

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
        <button
          type="button"
          className="press"
          onClick={photoBusy ? undefined : pickPhoto}
          aria-label="Сменить фото профиля"
          disabled={photoBusy}
          style={{
            position: "relative",
            border: "none",
            background: "none",
            cursor: photoBusy ? "default" : "pointer",
            padding: 0,
            width: 58,
            height: 58,
            flexShrink: 0,
            opacity: photoBusy ? 0.6 : 1,
          }}
        >
          <Avatar name={displayName} src={auth.currentUser?.photoURL || profile?.photo_url} size={58} />
          <span
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 24,
              height: 24,
              borderRadius: 999,
              background: t.invBg,
              color: t.inv,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 0 2px ${t.bg}`,
            }}
          >
            <Camera size={13} />
          </span>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: t.text, fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayName}
          </div>
          <div style={{ color: t.sub, fontSize: 13, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {auth.currentUser?.email || ""}
          </div>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPhotoFile} style={{ display: "none" }} />
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
        <Pencil size={15} color={t.sub} style={{ flexShrink: 0 }} />
      </div>

      <div style={sectionTitle(t)}>Статистика</div>
      <div style={{ display: "flex", gap: 10 }}>
        <StatsCard t={t} label="конспектов" value={stats?.notes ?? 0} hint="опубликовано" />
        <StatsCard t={t} label="тестов" value={stats?.tests ?? 0} hint="опубликовано" />
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
