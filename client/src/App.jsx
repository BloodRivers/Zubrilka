import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { onAuthStateChanged, deleteUser, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { updateUserProfile } from "./api/firestore";
import { ThemeProvider, useTheme } from "./theme/ThemeContext";
import { AlertProvider, useAlert } from "./components/Alert";
import ErrorBoundary from "./components/ErrorBoundary";
import TopBar from "./components/TopBar";
import ScreenTransition from "./components/ScreenTransition";
import BottomNav from "./components/BottomNav";
import { rememberTab, backOf, onScreenTitle, isQuizActive, setQuizActive } from "./nav";
import { getApiKey, setApiKey, syncAiUsage } from "./api/ai";
import { syncPushTokenIfGranted } from "./api/push";
import UpdateBanner from "./components/UpdateBanner";
import Login from "./screens/Login";
import Subjects from "./screens/Subjects";
import StressTrainer from "./screens/StressTrainer";
import SubjectHub from "./screens/SubjectHub";
import NewNote from "./screens/NewNote";
import NoteDetail from "./screens/NoteDetail";
import Quiz from "./screens/Quiz";
import Results from "./screens/Results";
import Settings from "./screens/Settings";
import Account from "./screens/Account";
import Library from "./screens/Library";
import UserProfile from "./screens/UserProfile";
import Legal from "./screens/Legal";
import NotFound from "./screens/NotFound";
import { Check, Lock } from "lucide-react";
import { TRAINER_LIST } from "./screens/StressTrainer";

function titleFor(path) {
  if (path === "/") return "Главная";
  if (path === "/account") return "Аккаунт";
  if (path === "/library") return "Библиотека";
  if (path === "/settings") return "Настройки";
  if (/\/subject\/.+\/quiz/.test(path)) return "Тест";
  if (/\/subject\/.+\/new/.test(path)) return "Новый конспект";
  if (/\/subject\//.test(path)) return "Предмет";
  if (/\/note\/.+\/quiz/.test(path)) return "Тест";
  if (/\/note\//.test(path)) return "Конспект";
  if (/\/test\//.test(path)) return "Тест";
  if (path === "/results") return "Результат";
  if (/^\/user\//.test(path)) return "Профиль";
  if (path === "/terms") return "Условия использования";
  if (path === "/privacy") return "Конфиденциальность";
  if (path === "/cookies") return "Политика cookies";
  if (/^\/trainer\//.test(path)) {
  const t = TRAINER_LIST.find((x) => path.endsWith(x.id));
  return t?.title || "Тренажёр";
}
  if (path === "/login") return "";
  return "Забубрилка";
}

function ConsentModal({ onAccept, onDecline, readTerms, readPrivacy, readCookies }) {
  const { t } = useTheme();
  const navigate = useNavigate();
  const allRead = readTerms && readPrivacy && readCookies;
  const docBtn = {
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: "12px 16px",
    borderRadius: 14,
    border: `1px solid ${t.border}`,
    background: t.raised,
    color: t.text,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    textAlign: "left",
  };
  const readBadge = {
    width: 22,
    height: 22,
    borderRadius: 999,
    background: t.invBg,
    color: t.inv,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
    flexShrink: 0,
  };
  const docItem = (label, path, read) => (
    <button className="press" onClick={() => navigate(path)} style={{ ...docBtn }}>
      {label}
      {read && (
        <span style={readBadge}>
          <Check size={14} strokeWidth={3} />
        </span>
      )}
    </button>
  );
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        zIndex: 150,
        animation: "backdropIn 220ms ease-out forwards",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: t.surface,
          borderRadius: 24,
          padding: "26px 22px 20px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
          animation: "modalIn 220ms cubic-bezier(0.16,1,0.3,1) forwards",
        }}
      >
        <div style={{ color: t.text, fontSize: 21, fontWeight: 700 }}>Добро пожаловать</div>
        <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.45, marginTop: 10 }}>
          Чтобы согласиться, прочитай все документы до конца.
        </div>
        <div style={{ margin: "18px 0" }}>
          {docItem("Условия использования", "/terms", readTerms)}
          <div style={{ marginTop: 8 }}>{docItem("Политика конфиденциальности", "/privacy", readPrivacy)}</div>
          <div style={{ marginTop: 8 }}>{docItem("Политика cookies", "/cookies", readCookies)}</div>
        </div>
        <button
          className="press"
          onClick={onAccept}
          disabled={!allRead}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: 999,
            border: "none",
            background: t.invBg,
            color: t.inv,
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: allRead ? "pointer" : "default",
            opacity: allRead ? 1 : 0.4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          Принимаю
          {allRead && <Check size={16} strokeWidth={3} />}
        </button>
        <button
          className="press"
          onClick={onDecline}
          style={{
            width: "100%",
            marginTop: 6,
            padding: "10px 0",
            borderRadius: 999,
            border: "none",
            background: "transparent",
            color: "#E5484D",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Отклонить и удалить аккаунт
        </button>
      </div>
    </div>,
    document.body
  );
}

function GuestBlock() {
  const { t } = useTheme();
  const navigate = useNavigate();
  return (
    <div style={{ paddingTop: 48, textAlign: "center" }}>
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 20,
          margin: "0 auto 18px",
          background: t.raised,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Lock size={26} color={t.sub} />
      </div>
      <div style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>Нужен аккаунт</div>
      <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.5, marginTop: 8, padding: "0 24px" }}>
        В гостевом режиме нельзя создавать конспекты и тесты. Зарегистрируйся — это бесплатно.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", marginTop: 24 }}>
        <button
          className="press"
          onClick={async () => {
            await signOut(auth).catch(() => {});
            navigate("/login");
          }}
          style={{
            padding: "14px 28px",
            borderRadius: 999,
            border: "none",
            background: t.invBg,
            color: t.inv,
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            minWidth: 220,
          }}
        >
          Создать аккаунт
        </button>
        <button
          className="press"
          onClick={() => navigate("/library")}
          style={{
            padding: "12px 24px",
            borderRadius: 999,
            border: "none",
            background: "transparent",
            color: t.sub,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          Поролистать библиотеку
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const { t, theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { alert } = useAlert();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [consentPending, setConsentPending] = useState(false);
  const [userName, setUserName] = useState("");
  const [nameReady, setNameReady] = useState(true);
  const [minBoot, setMinBoot] = useState(true);
  const [bootPhase, setBootPhase] = useState(0); // 0 in, 1 fading out, 2 gone

  useEffect(() => {
    const id = setTimeout(() => setMinBoot(false), 1100);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!user) {
      setUserName("");
      setNameReady(true);
      return;
    }
    let alive = true;
    setNameReady(false);
    setUserName(user.displayName || "");
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!alive) return;
        const stored = snap.exists() ? snap.data() : null;
        const patch = {};
        if (user.displayName && !stored?.name) patch.name = user.displayName;
        if (user.photoURL && stored?.photo_url !== user.photoURL) patch.photo_url = user.photoURL;

        // Ключ Polza: облако ↔ устройство
        const remoteKey = (stored?.polza_key || "").trim();
        const localKey = getApiKey().trim();
        if (remoteKey && remoteKey !== localKey) {
          setApiKey(remoteKey);
        } else if (localKey && !remoteKey) {
          patch.polza_key = localKey;
        } else if (remoteKey && remoteKey === localKey) {
          // уже совпали — всё равно уведомим UI (Settings мог открыться раньше)
          setApiKey(remoteKey);
        }

        if (Object.keys(patch).length) await updateUserProfile(patch);
        setUserName(stored?.name || user.displayName || (user.email || "").split("@")[0]);
        await syncAiUsage().catch(() => {});
        await syncPushTokenIfGranted().catch(() => {});
      } catch {
      } finally {
        if (alive) setNameReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const bootDone = !minBoot && nameReady;
  useEffect(() => {
    if (bootPhase === 2 || bootPhase === 1) return;
    if (!bootDone) return;
    setBootPhase(1);
    const id = setTimeout(() => setBootPhase(2), 380);
    return () => clearTimeout(id);
  }, [bootPhase, bootDone]);

  const confirmLeaveQuiz = () =>
    new Promise((resolve) => {
      if (!isQuizActive()) {
        resolve(true);
        return;
      }
      alert("Прогресс будет потерян.", {
        title: "Выйти?",
        danger: true,
        confirmLabel: "Уйти",
        onConfirm: () => {
          setQuizActive(false);
          resolve(true);
        },
        onCancel: () => resolve(false),
      });
    });
  const leaveQuizRef = useRef(confirmLeaveQuiz);
  leaveQuizRef.current = confirmLeaveQuiz;
  const locRef = useRef(location);
  locRef.current = location;

  const stageRef = useRef(null);
  const backRef = useRef(null);
  const [screenTitle, setScreenTitle] = useState(null);
  useEffect(() => onScreenTitle(setScreenTitle), []);

  const [dir, setDir] = useState("fwd");
  const [animKey, setAnimKey] = useState(0);
  const [entered, setEntered] = useState(true);

  const stagger = (delay) => ({
    animation: "fadeUp 500ms cubic-bezier(0.16,1,0.3,1) both",
    animationDelay: `${delay}ms`,
  });

  const resetDragVisual = () => {
    if (stageRef.current) {
      stageRef.current.style.transition = "none";
      stageRef.current.style.transform = "";
      stageRef.current.style.boxShadow = "";
    }
    if (backRef.current) {
      backRef.current.style.transition = "none";
      backRef.current.style.opacity = 0;
    }
  };

  const snapTimer = useRef(null);
  const snapBack = () => {
    if (snapTimer.current) clearTimeout(snapTimer.current);
    if (stageRef.current) {
      stageRef.current.style.transition =
        "transform 280ms cubic-bezier(0.32,0.72,0,1), box-shadow 280ms ease-out";
      stageRef.current.style.transform = "translateX(0)";
      stageRef.current.style.boxShadow = "0 0 0 rgba(0,0,0,0)";
    }
    if (backRef.current) {
      backRef.current.style.transition = "opacity 280ms ease-out";
      backRef.current.style.opacity = 0;
    }
    snapTimer.current = setTimeout(resetDragVisual, 320);
  };

  useEffect(() => {
    if (location.pathname === "/login") return;
    let drag = null;
    const zone = Math.max(56, Math.min(120, window.innerWidth * 0.25));

    const inZone = (x) => x <= zone;

    const begin = (x) => {
      drag = { startX: x, width: window.innerWidth, active: false };
    };

    const apply = (x) => {
      if (!drag) return;
      const dx = x - drag.startX;
      if (!drag.active) {
        if (dx < 10) return;
        drag.active = true;
      }
      const eff = 1 - Math.pow(1 - Math.min(Math.max(dx, 0) / drag.width, 1), 2);
      if (stageRef.current) {
        stageRef.current.style.transition = "none";
        stageRef.current.style.transform = `translateX(${drag.width * eff}px)`;
        stageRef.current.style.boxShadow = `-${Math.round(32 * eff)}px 0 ${Math.round(64 * eff)}px rgba(0,0,0,${0.32 * eff})`;
      }
      if (backRef.current) backRef.current.style.opacity = 0.4 * eff;
    };

    const cancel = () => {
      if (!drag) return;
      drag = null;
      snapBack();
    };

    const finish = async (x) => {
      const cur = drag;
      drag = null;
      if (!cur || !cur.active) return;
      snapBack();
      if (Math.min((x - cur.startX) / cur.width, 1) < 0.42) return;
      if (!(await leaveQuizRef.current())) return;
      const loc = locRef.current;
      const dest = backOf(loc.pathname, loc.state);
      if (dest) navigate(dest, { replace: true });
      else navigate(-1);
    };

    const onPointerDown = (e) => {
      if (e.pointerType === "touch") return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (!inZone(e.clientX)) return;
      begin(e.clientX);
    };
    const onPointerMove = (e) => {
      if (e.pointerType !== "touch") apply(e.clientX);
    };
    const onPointerUp = (e) => {
      if (e.pointerType !== "touch") finish(e.clientX);
    };
    const onTouchStart = (e) => {
      if (e.touches.length > 1) {
        drag = null;
        return;
      }
      const t = e.touches[0];
      if (t && inZone(t.clientX)) begin(t.clientX);
    };
    const onTouchMove = (e) => {
      if (!drag || !drag.active) return;
      const t = e.touches[0];
      if (!t) return;
      e.preventDefault();
      apply(t.clientX);
    };
    const onTouchEnd = (e) => {
      const t = e.changedTouches[0];
      if (t) finish(t.clientX);
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", cancel);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", cancel);
    };
  }, [location.pathname]);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setReady(true); }), []);

  const isGuest = !!user?.isAnonymous;

  useEffect(() => {
    if (!user) {
      setConsentPending(false);
      return;
    }
    if (isGuest) {
      setConsentPending(false);
      return;
    }
    setConsentPending(localStorage.getItem(`zubrilka:consent:${user.uid}`) !== "1");
  }, [user, isGuest]);

  const legalPath = /^\/(terms|privacy|cookies)(\/|$)/.test(location.pathname);

  const acceptConsent = () => {
    if (!user) return;
    localStorage.setItem(`zubrilka:consent:${user.uid}`, "1");
    setConsentPending(false);
  };

  const declineConsent = () => {
    alert("Аккаунт и связанные данные будут удалены без возможности восстановления.", {
      title: "Удалить аккаунт",
      danger: true,
      confirmLabel: "Удалить",
      onConfirm: async () => {
        try {
          await deleteUser(auth.currentUser);
          await signOut(auth);
          setConsentPending(false);
        } catch (e) {
          alert(
            e?.code === "auth/requires-recent-login"
              ? "Для удаления аккаунта нужно заново войти."
              : "Не удалось удалить аккаунт: " + (e?.message ?? "")
          );
        }
      },
    });
  };

  useEffect(() => {
    rememberTab(location.pathname);
    resetDragVisual();
    setDir((location.state?.dir) || "fwd");
    setEntered(false);
    setAnimKey((k) => k + 1);
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [location.pathname]);

  const splash = (title, sub) => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: t.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "0 32px",
        textAlign: "center",
      }}
    >
      <img
        src="/favicon.png"
        alt="Забубрилка"
        width={72}
        height={72}
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          objectFit: "cover",
          marginBottom: 20,
          display: "block",
        }}
      />
      <div style={{ color: t.text, fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}>
        {title}
      </div>
      <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.5, marginTop: 4 }}>
        {sub}
      </div>
      <div style={{ width: 24, height: 24, marginTop: 24 }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 999,
            border: `2.5px solid ${t.border}`,
            borderTopColor: t.invBg,
            animation: "spin 800ms linear infinite",
          }}
        />
      </div>
    </div>
  );

  if (!ready) return splash("Забубрилка", "Загружаем…");
  if (!user && location.pathname !== "/login") return <Navigate to="/login" replace />;
  if (user && location.pathname === "/login") return <Navigate to="/" replace />;

  const showBoot = !!user && bootPhase !== 2;
  const bootOverlay = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: t.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: "0 32px",
        textAlign: "center",
        pointerEvents: bootPhase === 1 ? "none" : "auto",
        animation: bootPhase === 1 ? "fadeUpOut 380ms cubic-bezier(0.16,1,0.3,1) forwards" : undefined,
      }}
    >
      <img
        src="/favicon.png"
        alt="Забубрилка"
        width={72}
        height={72}
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          objectFit: "cover",
          marginBottom: 20,
          display: "block",
          animation: "fadeUp 500ms cubic-bezier(0.16,1,0.3,1) both",
        }}
      />
      <div style={{ color: t.text, fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", ...stagger(70) }}>
        {userName ? `Привет, ${userName}!` : "Привет!"}
      </div>
      <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.5, ...stagger(140) }}>
        Собираем твои конспекты и тесты…
      </div>
      <div style={{ width: 24, height: 24, marginTop: 24, ...stagger(210) }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 999,
            border: `2.5px solid ${t.border}`,
            borderTopColor: t.invBg,
            animation: "spin 800ms linear infinite",
          }}
        />
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100dvh",
        background: theme === "dark" ? "#000" : "#DADADA",
        fontFamily: '"SF Pro", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
        overflow: "hidden",
        position: "relative",
        touchAction: "pan-y",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: t.bg,
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {location.pathname === "/login" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: -140,
                right: -120,
                width: 340,
                height: 340,
                borderRadius: 999,
                background: `radial-gradient(circle, ${theme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"} 0%, transparent 70%)`,
              }}
            />
            <div
              aria-hidden
              style={{
                position: "absolute",
                bottom: -160,
                left: -140,
                width: 380,
                height: 380,
                borderRadius: 999,
                background: `radial-gradient(circle, ${theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} 0%, transparent 70%)`,
              }}
            />
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 20,
                left: -62,
                width: 240,
                height: 240,
                borderRadius: 999,
                border: `1px solid ${t.border}`,
                opacity: 0.5,
              }}
            />
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 60,
                left: -22,
                width: 160,
                height: 160,
                borderRadius: 999,
                border: `1px solid ${t.border}`,
                opacity: 0.35,
              }}
            />
          </div>
        )}
        <div ref={backRef} style={{ position: "absolute", inset: 0, background: t.bg, opacity: 0, pointerEvents: "none", zIndex: 0 }} />
        <div
          ref={stageRef}
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            background: t.bg,
            touchAction: "pan-y",
            willChange: "transform",
          }}
        >
          {location.pathname !== "/login" && (
            <TopBar
              title={screenTitle || titleFor(location.pathname)}
              onBack={
                /\/subject\/|\/note\/|\/test\/|\/results|\/user\/|\/trainer\/|\/(terms|privacy|cookies)/.test(location.pathname)
                  ? async () => {
                      if (!(await confirmLeaveQuiz())) return;
                      const dest = backOf(location.pathname, location.state);
                      if (dest) navigate(dest, { replace: true });
                      else navigate(-1);
                    }
                  : undefined
              }
            />
          )}
          <ScreenTransition animKey={animKey} entered={entered} dir={dir}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Subjects />} />
              <Route path="/trainer/:slug" element={<StressTrainer />} />
              <Route path="/account" element={isGuest ? <GuestBlock /> : <Account />} />
              <Route path="/library" element={<Library />} />
              <Route path="/settings" element={isGuest ? <GuestBlock /> : <Settings />} />
              <Route path="/subject/:subjectId" element={<SubjectHub />} />
              <Route path="/subject/:subjectId/new" element={isGuest ? <GuestBlock /> : <NewNote />} />
              <Route path="/subject/:subjectId/quiz" element={isGuest ? <GuestBlock /> : <Quiz />} />
              <Route path="/note/:noteId" element={<NoteDetail />} />
              <Route path="/note/:noteId/quiz" element={isGuest ? <GuestBlock /> : <Quiz />} />
              <Route path="/test/:testId/quiz/:mode" element={<Quiz />} />
              <Route path="/results" element={isGuest ? <GuestBlock /> : <Results />} />
              <Route path="/user/:userId" element={<UserProfile />} />
              <Route path="/terms" element={<Legal doc="terms" />} />
              <Route path="/privacy" element={<Legal doc="privacy" />} />
              <Route path="/cookies" element={<Legal doc="cookies" />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ScreenTransition>
          {user && !legalPath && <BottomNav confirmLeave={confirmLeaveQuiz} />}
          {user && !legalPath && <UpdateBanner />}
        </div>
        {consentPending && !legalPath && (
          <ConsentModal
            onAccept={acceptConsent}
            onDecline={declineConsent}
            readTerms={!!user && localStorage.getItem(`zubrilka:read:terms:${user.uid}`) === "1"}
            readPrivacy={!!user && localStorage.getItem(`zubrilka:read:privacy:${user.uid}`) === "1"}
            readCookies={!!user && localStorage.getItem(`zubrilka:read:cookies:${user.uid}`) === "1"}
          />
        )}
        {showBoot && createPortal(bootOverlay, document.body)}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AlertProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Shell />
          </ErrorBoundary>
        </BrowserRouter>
      </AlertProvider>
    </ThemeProvider>
  );
}