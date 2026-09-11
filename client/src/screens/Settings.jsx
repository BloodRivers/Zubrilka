import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { Bell, ChevronRight, ChevronDown, Check, KeyRound, Heart, RefreshCw, Lock } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { auth } from "../firebase";
import { MODEL_OPTIONS, getApiKey, setApiKey, getBalance, getModel, setModel, onApiKeyChange, aiUsedToday, AI_DAILY_LIMIT } from "../api/ai";
import { updateUserProfile, getUserProfile } from "../api/firestore";
import { enablePushNotifications } from "../api/push";
import { GhostInline } from "../components/Ghost";
import { checkForAppUpdate } from "../swUpdate";
import { useAlert } from "../components/Alert";

async function persistKey(key) {
  const trimmed = (key || "").trim();
  setApiKey(trimmed);
  try {
    await updateUserProfile({ polza_key: trimmed });
  } catch {
    /* локально ключ уже сохранён */
  }
  return trimmed;
}

function IconTelegram({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill={color}
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm4.64 6.8-1.55 7.3c-.12.52-.42.65-.86.4l-2.38-1.75-1.15 1.1c-.13.13-.23.23-.47.23l.17-2.42 4.4-3.97c.19-.17-.04-.27-.3-.1l-5.44 3.43-2.34-.73c-.51-.16-.52-.51.1-.76l9.15-3.53c.42-.15.79.1.67.6Z"
      />
    </svg>
  );
}

function IconVk({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill={color}
        d="M12.785 16.328h.904s.273-.03.412-.18c.128-.14.124-.4.124-.4s-.018-1.222.55-1.402c.56-.177 1.278 1.181 2.04 1.703.576.395 1.014.308 1.014.308l2.034-.028s1.064-.066.56-.9c-.041-.068-.294-.62-1.514-1.753-1.276-1.185-1.105-.995.432-3.05.938-1.254 1.313-2.02 1.195-2.347-.112-.312-.804-.23-.804-.23l-2.29.014s-.17-.023-.295.052c-.122.073-.2.243-.2.243s-.36.958-.84 1.773c-1.013 1.72-1.418 1.81-1.585 1.705-.39-.246-.292-.987-.292-1.513 0-1.645.25-2.328-.485-2.506-.244-.06-.424-.1-1.048-.106-.8-.008-1.477.003-1.86.191-.255.125-.452.404-.332.42.148.02.484.09.662.336.23.317.222 1.03.222 1.03s.132 1.966-.308 2.21c-.302.167-.716-.174-1.606-1.736-.456-.8-.8-1.686-.8-1.686s-.066-.162-.184-.25c-.143-.105-.343-.138-.343-.138l-2.176.014s-.326.01-.446.15c-.106.126-.009.386-.009.386s1.687 3.944 3.595 5.934c1.75 1.825 3.737 1.706 3.737 1.706Z"
      />
    </svg>
  );
}

const SOCIAL_LINKS = [
  { label: "Telegram", href: "https://t.me/fawnyac", Icon: IconTelegram },
  { label: "ВКонтакте", href: "https://vk.com/fawnyac", Icon: IconVk },
];

const DONATE_BASE =
  "https://yoomoney.ru/quickpay/confirm.xml?receiver=4100119463380651&quickpay-form=donate&targets=Study+app";
const DONATE_PRESETS = [10, 50, 100];

const row = (t) => ({
  padding: "14px 16px",
  borderRadius: 18,
  background: t.surface,
  border: `1px solid ${t.border}`,
  minHeight: 52,
  display: "flex",
  alignItems: "center",
});

const sectionTitle = (t, extra = {}) => ({
  color: t.sub,
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  margin: "18px 0 8px 4px",
  ...extra,
});

const input = (t) => ({
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: t.text,
  fontSize: 15,
  fontFamily: "inherit",
});

export default function Settings({ isGuest }) {
  const { pref, setPref, t, theme } = useTheme();
  const { alert } = useAlert();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [keyInput, setKeyInput] = useState(getApiKey());
  const [balanceKey, setBalanceKey] = useState(getApiKey());
  const [balance, setBalance] = useState({ status: "idle", amount: null, error: "" });
  const [refreshTick, setRefreshTick] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushOk, setPushOk] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted"
  );

  const model = getModel();

  // Локальный ключ + облако + события синка с других экранов
  useEffect(() => {
    let cancelled = false;
    const apply = (k) => {
      const key = (k || "").trim();
      setKeyInput(key);
      setBalanceKey(key);
    };
    apply(getApiKey());
    const off = onApiKeyChange(apply);
    (async () => {
      try {
        const profile = await getUserProfile();
        if (cancelled) return;
        const remote = (profile?.polza_key || "").trim();
        const local = getApiKey().trim();
        if (remote && remote !== local) {
          setApiKey(remote);
          apply(remote);
        } else if (local && !remote) {
          await updateUserProfile({ polza_key: local }).catch(() => {});
        } else if (remote) {
          apply(remote);
        }
      } catch {
        /* офлайн / нет профиля */
      }
    })();
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBalance({ status: balanceKey.trim() ? "loading" : "idle", amount: null, error: "" });
    if (!balanceKey.trim()) return undefined;

    getBalance(balanceKey)
      .then((amount) => {
        if (!cancelled) setBalance({ status: "ready", amount, error: "" });
      })
      .catch((error) => {
        if (!cancelled) setBalance({ status: "error", amount: null, error: error.message });
      });

    return () => { cancelled = true; };
  }, [balanceKey, refreshTick]);

  const themeOpts = [
    { v: "light", label: "Светлая" },
    { v: "dark", label: "Тёмная" },
    { v: "system", label: "Система" },
  ];
  const currentLabel = themeOpts.find((o) => o.v === pref)?.label ?? "Система";

  const docRow = (label, path) => (
    <button
      className="rowpress"
      onClick={() => navigate(path)}
      style={{
        width: "100%",
        marginBottom: 8,
        ...row(t),
        color: t.text,
        fontSize: 15,
        fontFamily: "inherit",
        cursor: "pointer",
        textAlign: "left",
        justifyContent: "space-between",
      }}
    >
      {label}
      <ChevronRight size={16} color={t.sub} />
    </button>
  );

  return (
    <div>
      <div style={sectionTitle(t)}>Оформление</div>
      <div style={{ position: "relative", ...row(t), justifyContent: "space-between", gap: 12, cursor: "pointer", zIndex: open ? 30 : undefined }} onClick={() => setOpen((o) => !o)}>
        <span style={{ color: t.text, fontSize: 15, pointerEvents: "none" }}>Тема</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: t.sub, fontSize: 14, fontWeight: 600, pointerEvents: "none" }}>
          {currentLabel}
          <ChevronDown size={16} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 200ms ease" }} />
        </span>

        {open && (
          <>
            <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 10, background: "transparent" }} />
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 8,
                right: 8,
                zIndex: 20,
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 16,
                padding: 6,
                boxShadow: theme === "dark" ? "0 16px 40px rgba(0,0,0,0.6)" : "0 16px 40px rgba(0,0,0,0.15)",
                animation: "modalIn 160ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              {themeOpts.map((o) => {
                const active = pref === o.v;
                return (
                  <button
                    key={o.v}
                    className="rowpress"
                    onClick={() => { setPref(o.v); setOpen(false); }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "none",
                      background: "transparent",
                      color: t.text,
                      fontSize: 15,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {o.label}
                    {active && <Check size={16} color={t.invBg} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div style={sectionTitle(t, { marginTop: 24 })}>Модель ИИ</div>

      {isGuest ? (
        <div style={{ ...row(t), flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.text, fontSize: 15, fontWeight: 600 }}>
            <Lock size={14} color={t.sub} />
            Доступно после регистрации
          </div>
          <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.45 }}>
            Настройка ключа и модели ИИ — для владельцев аккаунта. Регистрация бесплатная.
          </div>
          <button
            className="press"
            onClick={async () => {
              await signOut(auth).catch(() => {});
              navigate("/login");
            }}
            style={{
              border: "none",
              background: t.invBg,
              color: t.inv,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              padding: "10px 18px",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            Создать аккаунт
          </button>
        </div>
      ) : (
        <>
      <div
        style={{
          ...row(t),
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>
          Polza AI · свой ключ (BYOK)
        </div>
        <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.45 }}>
          API Ключ синхронизируется между устройствами через аккаунт.
          Лимит: {aiUsedToday()}/{AI_DAILY_LIMIT} запросов сегодня.
        </div>
      </div>

      <div style={{ ...row(t), gap: 10, marginBottom: 8 }}>
        <KeyRound size={16} color={t.sub} style={{ flexShrink: 0 }} />
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          onBlur={async () => {
            const key = await persistKey(keyInput);
            setBalanceKey(key);
          }}
          placeholder="Вставь ключ из polza.ai"
          style={input(t)}
        />
        <button
          className="rowpress"
          onClick={async () => {
            try {
              const txt = (await navigator.clipboard.readText()).trim();
              if (!txt) return;
              setKeyInput(txt);
              const key = await persistKey(txt);
              setBalanceKey(key);
            } catch {}
          }}
          style={{
            border: "none",
            background: t.invBg,
            color: t.inv,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            padding: "8px 14px",
            borderRadius: 999,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Вставить
        </button>
      </div>

      <button
        type="button"
        className="rowpress"
        onClick={() => {
          if (!balanceKey.trim()) return;
          setRefreshTick((n) => n + 1);
        }}
        style={{
          ...row(t),
          width: "100%",
          justifyContent: "space-between",
          marginBottom: 8,
          cursor: balanceKey.trim() ? "pointer" : "default",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <span style={{ color: t.text, fontSize: 15 }}>Баланс</span>
        <span style={{ color: balance.status === "error" ? "#E5484D" : t.text, fontSize: 14, fontWeight: 600 }}>
          {balance.status === "loading" && <GhostInline width={64} />}
          {balance.status === "idle" && "Вставь ключ"}
          {balance.status === "ready" && `${Number(balance.amount).toFixed(2)} руб.`}
          {balance.status === "error" && "Хз сколько"}
        </span>
      </button>
      {balance.status === "error" && (
        <div style={{ color: "#E5484D", fontSize: 12, margin: "-2px 4px 8px" }}>{balance.error}</div>
      )}

      <div
        style={{ position: "relative", ...row(t), justifyContent: "space-between", gap: 12, cursor: "pointer", zIndex: modelOpen ? 30 : undefined }}
        onClick={() => setModelOpen((o) => !o)}
      >
        <span style={{ color: t.text, fontSize: 15, pointerEvents: "none" }}>Модель</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: t.sub, fontSize: 14, fontWeight: 600, pointerEvents: "none" }}>
          {MODEL_OPTIONS.find((o) => o.v === model)?.label || model}
          <ChevronDown size={16} style={{ transform: modelOpen ? "rotate(180deg)" : undefined, transition: "transform 200ms ease" }} />
        </span>

        {modelOpen && (
          <>
            <div onClick={(e) => { e.stopPropagation(); setModelOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 10, background: "transparent" }} />
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 8,
                right: 8,
                zIndex: 20,
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 16,
                padding: 6,
                boxShadow: theme === "dark" ? "0 16px 40px rgba(0,0,0,0.6)" : "0 16px 40px rgba(0,0,0,0.15)",
                animation: "modalIn 160ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              {MODEL_OPTIONS.map((o) => {
                const active = model === o.v;
                return (
                  <button
                    key={o.v}
                    className="rowpress"
                    onClick={() => { setModel(o.v); setModelOpen(false); }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "none",
                      background: "transparent",
                      color: t.text,
                      fontSize: 15,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {o.label}
                    {active && <Check size={16} color={t.invBg} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      </>
      )}

      <div style={sectionTitle(t, { marginTop: 24 })}>Поддержка</div>
      {SOCIAL_LINKS.map(({ label, href, Icon }) => (
        <button
          key={label}
          className="rowpress"
          type="button"
          onClick={() => window.open(href, "_blank", "noopener,noreferrer")}
          style={{
            width: "100%",
            marginBottom: 8,
            ...row(t),
            color: t.text,
            fontSize: 15,
            fontFamily: "inherit",
            cursor: "pointer",
            textAlign: "left",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon size={16} color={t.sub} />
            {label}
          </span>
          <ChevronRight size={16} color={t.sub} />
        </button>
      ))}

      <div
        style={{
          ...row(t),
          flexDirection: "column",
          alignItems: "stretch",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10, color: t.text, fontSize: 15 }}>
          <Heart size={16} color={t.sub} />
          Поддержать
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {DONATE_PRESETS.map((sum) => (
            <button
              key={sum}
              className="rowpress"
              type="button"
              onClick={() =>
                window.open(`${DONATE_BASE}&sum=${sum}`, "_blank", "noopener,noreferrer")
              }
              style={{
                flex: 1,
                border: "none",
                background: t.invBg,
                color: t.inv,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "inherit",
                padding: "10px 8px",
                borderRadius: 999,
                cursor: "pointer",
              }}
            >
              {sum} ₽
            </button>
          ))}
        </div>
      </div>

      <div style={sectionTitle(t, { marginTop: 24 })}>Приложение</div>
      <button
        className="rowpress"
        type="button"
        disabled={pushBusy || pushOk}
        onClick={async () => {
          setPushBusy(true);
          try {
            const token = await enablePushNotifications();
            if (token) {
              setPushOk(true);
              alert("Будем сообщать, когда выйдет обновление.", { title: "Готово" });
            } else {
              alert(
                Notification?.permission === "denied"
                  ? "Разрешение на уведомления запрещено в браузере."
                  : "Проверь VAPID-ключ или разрешение на уведомления.",
                { title: "Не удалось" }
              );
            }
          } catch (e) {
            alert(e?.message || "Не удалось включить уведомления", { title: "Ошибка" });
          } finally {
            setPushBusy(false);
          }
        }}
        style={{
          width: "100%",
          marginBottom: 8,
          ...row(t),
          color: t.text,
          fontSize: 15,
          fontFamily: "inherit",
          cursor: pushBusy || pushOk ? "default" : "pointer",
          textAlign: "left",
          justifyContent: "space-between",
          gap: 12,
          opacity: pushBusy ? 0.7 : 1,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Bell size={16} color={t.sub} />
          {pushOk
            ? "Уведомления включены"
            : pushBusy
              ? "Включаю…"
              : "Уведомления об обновлениях"}
        </span>
        {pushOk ? <Check size={16} color={t.sub} /> : <ChevronRight size={16} color={t.sub} />}
      </button>
      <button
        className="rowpress"
        type="button"
        disabled={updating}
        onClick={async () => {
          setUpdating(true);
          try {
            await checkForAppUpdate();
          } catch (e) {
            alert(e?.message || "Не удалось обновить");
            setUpdating(false);
          }
        }}
        style={{
          width: "100%",
          marginBottom: 8,
          ...row(t),
          color: t.text,
          fontSize: 15,
          fontFamily: "inherit",
          cursor: updating ? "default" : "pointer",
          textAlign: "left",
          justifyContent: "space-between",
          gap: 12,
          opacity: updating ? 0.7 : 1,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <RefreshCw size={16} color={t.sub} />
          {updating ? "Обновляю…" : "Обновить приложение"}
        </span>
        <ChevronRight size={16} color={t.sub} />
      </button>
      <div style={{ color: t.sub, fontSize: 12, lineHeight: 1.4, margin: "0 4px 8px" }}>
        Пуш — когда выйдет релиз. Баннер «Обновить» появится и внутри приложения. На Android
        без pull-to-refresh можно обновить кнопкой выше.
      </div>

      <div style={sectionTitle(t, { marginTop: 24 })}>Документы</div>
      {docRow("Условия использования", "/terms")}
      {docRow("Политика конфиденциальности", "/privacy")}
      {docRow("Политика cookies", "/cookies")}
    </div>
  );
}