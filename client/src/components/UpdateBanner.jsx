import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { useTheme } from "../theme/ThemeContext";
import { db } from "../firebase";
import { applyAppUpdate, onAppUpdateAvailable } from "../swUpdate";
import { onForegroundUpdateMessage } from "../api/push";

const SEEN_KEY = "zubrilka:seen_release";

/**
 * Баннер: доступно обновление (SW / релиз в Firestore / foreground push).
 */
export default function UpdateBanner() {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("Доступна новая версия");

  useEffect(() => {
    const offSw = onAppUpdateAvailable((available) => {
      if (available) {
        setHint("Доступна новая версия");
        setOpen(true);
      }
    });

    const offFg = onForegroundUpdateMessage((payload) => {
      setHint(payload?.notification?.title || payload?.data?.title || "Доступна новая версия");
      setOpen(true);
    });

    let cancelled = false;
    const check = async () => {
      try {
        const snap = await getDoc(doc(db, "app", "release"));
        if (cancelled) return;
        const data = snap.data();
        const version = data?.version;
        if (!version) return;
        const seen = localStorage.getItem(SEEN_KEY) || "";
        if (version !== seen) {
          setHint(data?.message || "Доступна новая версия");
          setOpen(true);
        }
      } catch {
        /* offline / rules */
      }
    };
    check();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      offSw();
      offFg();
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!open) return null;

  const apply = async () => {
    setBusy(true);
    try {
      const snap = await getDoc(doc(db, "app", "release"));
      const version = snap.data()?.version;
      if (version) localStorage.setItem(SEEN_KEY, version);
    } catch {
      /* ignore */
    }
    await applyAppUpdate();
  };

  return createPortal(
    <div
      role="status"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
        zIndex: 250,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 16,
        background: t.invBg,
        color: t.inv,
        boxShadow: "0 12px 32px rgba(0,0,0,0.28)",
        animation: "fadeUp 320ms cubic-bezier(0.16,1,0.3,1) both",
      }}
    >
      <RefreshCw size={18} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>
        {hint}
      </div>
      <button
        type="button"
        className="press"
        disabled={busy}
        onClick={apply}
        style={{
          flexShrink: 0,
          border: "none",
          borderRadius: 999,
          padding: "8px 14px",
          background: t.inv,
          color: t.invBg,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "…" : "Обновить"}
      </button>
      <button
        type="button"
        aria-label="Позже"
        onClick={() => setOpen(false)}
        style={{
          flexShrink: 0,
          border: "none",
          background: "transparent",
          color: t.inv,
          opacity: 0.7,
          fontSize: 13,
          fontFamily: "inherit",
          cursor: "pointer",
          padding: 4,
        }}
      >
        Позже
      </button>
    </div>,
    document.body
  );
}
