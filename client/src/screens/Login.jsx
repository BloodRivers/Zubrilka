import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
} from "firebase/auth";
import { Mail, Lock, User, Eye, EyeOff, UserX } from "lucide-react";
import { auth } from "../firebase";
import { createUserProfile } from "../api/firestore";
import { useTheme } from "../theme/ThemeContext";
import { EASE } from "../theme/theme";
import { useAlert } from "../components/Alert";
import Button from "../components/Button";
import Segmented from "../components/Segmented";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.57-5.15 3.57-8.81Z"
      />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3a7.2 7.2 0 0 1-10.74-3.8H1.34v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.32 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.34a12 12 0 0 0 0 10.78l3.98-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.99 11.99 0 0 0 1.34 6.61l3.98 3.1A7.2 7.2 0 0 1 12 4.8Z" />
    </svg>
  );
}

const inputStyle = (t, bad, rightPad = 16) => ({
  width: "100%",
  padding: `14px ${rightPad}px 14px 44px`,
  borderRadius: 16,
  border: `1px solid ${bad ? t.danger : t.border}`,
  background: t.surface,
  color: t.text,
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 250ms ease",
});

function Field({ icon, bad, eye, children }) {
  const { t } = useTheme();
  return (
    <div style={{ position: "relative", marginBottom: 12 }}>
      {icon({ style: { position: "absolute", left: 15, top: 16, pointerEvents: "none" } })}
      {icon && bad && (
        <span
          style={{
            position: "absolute",
            right: eye ? 46 : 15,
            top: 15,
            width: 8,
            height: 8,
            borderRadius: 999,
            background: t.danger,
          }}
        />
      )}
      {children}
    </div>
  );
}

function EyeButton({ shown, onClick, t }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={shown ? "Скрыть пароль" : "Показать пароль"}
      className="press"
      style={{
        position: "absolute",
        right: 10,
        top: 10,
        width: 32,
        height: 32,
        borderRadius: 999,
        border: "none",
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {shown ? <EyeOff size={17} color={t.sub} /> : <Eye size={17} color={t.sub} />}
    </button>
  );
}

export default function Login() {
  const { t, theme } = useTheme();
  const { alert } = useAlert();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const nope = () => setShakeKey((k) => k + 1);

  const switchMode = (m) => {
    setMode(m);
    setSubmitted(false);
    if (m === "signup") setConfirm("");
  };

  const emailBad = submitted && email.trim() === "" ? true : email.trim() !== "" && !EMAIL_RE.test(email.trim());
  const passBad =
    mode === "signup"
      ? password.length > 0 && password.length < 6
      : submitted && password === "";
  const confirmBad =
    mode === "signup" && ((submitted && confirm === "") || (confirm !== "" && confirm !== password));

  const submit = async (e) => {
    e.preventDefault();
    if (mode === "reset") {
      if (email.trim() === "") {
        nope();
        return alert("Введи email.");
      }
      if (!EMAIL_RE.test(email.trim())) {
        nope();
        return alert("Проверь адрес — он выглядит неверно.");
      }
      setBusy(true);
      try {
        await sendPasswordResetEmail(auth, email.trim());
        alert(
          "Если аккаунт с таким email существует, ссылка для сброса пароля уже в пути. Проверь папку «Спам».",
          { title: "Письмо отправлено" }
        );
        setMode("login");
      } catch (err) {
        nope();
        const msg = humanize(err);
        if (msg) alert(msg);
      } finally {
        setBusy(false);
      }
      return;
    }
    setSubmitted(true);
    if (email.trim() === "") {
      nope();
      return alert("Введи email.");
    }
    if (!EMAIL_RE.test(email.trim())) {
      nope();
      return alert("Проверь адрес — он выглядит неверно.");
    }
    if (mode === "signup" && name.trim() === "") {
      nope();
      return alert("Введи имя.");
    }
    if (mode === "signup" && password.length < 6) {
      nope();
      return alert("Пароль должен быть не короче 6 символов.");
    }
    if (mode === "signup" && password !== confirm) {
      nope();
      return alert("Пароли не совпадают.");
    }
    if (password === "") {
      nope();
      return alert("Введи пароль.");
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        await createUserProfile({ name, email: email.trim() }).catch(() => {});
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      nope();
      const msg = humanize(err);
      if (msg) alert(msg);
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setBusy(true);
    try {
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
      await createUserProfile({ name: user.displayName || "", email: user.email || "" }).catch(() => {});
    } catch (err) {
      nope();
      const msg = humanize(err);
      if (msg) alert(msg);
      setBusy(false);
    }
  };

  const onGuest = async () => {
    setBusy(true);
    try {
      await signInAnonymously(auth);
      await createUserProfile({ name: "", email: "" }).catch(() => {});
    } catch (err) {
      nope();
      const msg = humanize(err);
      if (msg) alert(msg);
      setBusy(false);
    }
  };

  const anim = (delay) => ({
    animation: `fadeUp 500ms ${EASE} both`,
    animationDelay: `${delay}ms`,
  });

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "36px 0 8px 0", ...anim(0) }}>
        <img
          src="/favicon.png"
          alt="Зубрилка"
          width={72}
          height={72}
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            objectFit: "cover",
            display: "block",
            boxShadow:
              theme === "dark" ? "0 12px 28px rgba(0,0,0,0.5)" : "0 12px 28px rgba(0,0,0,0.12)",
          }}
        />
      </div>

      <div style={{ marginTop: 20, ...anim(80) }}>
        <div style={{ color: t.text, fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em" }}>
          Зубрилка
        </div>
      </div>

      <div style={{ marginTop: 8, ...anim(160) }}>
        <div style={{ color: t.sub, fontSize: 15, lineHeight: 1.5 }}>
          Конспекты, тесты и повторение — в одном месте.
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 28 }} />

      <form
        key={shakeKey}
        onSubmit={submit}
        noValidate
        style={shakeKey > 0 ? { animation: "shakeX 450ms cubic-bezier(0.36,0.07,0.19,0.97)" } : anim(240)}
      >
        {mode !== "reset" && (
          <Segmented
            options={[
              { v: "login", label: "Вход" },
              { v: "signup", label: "Регистрация" },
            ]}
            value={mode}
            onChange={switchMode}
            style={{ marginBottom: 14 }}
          />
        )}

        {mode !== "reset" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateRows: mode === "signup" ? "1fr" : "0fr",
                transition: `grid-template-rows 400ms ${EASE}`,
              }}
            >
              <div
                style={{
                  overflow: "hidden",
                  opacity: mode === "signup" ? 1 : 0,
                  pointerEvents: mode === "signup" ? "auto" : "none",
                  transition: "opacity 260ms ease",
                }}
              >
                <Field icon={(p) => <User size={17} color={t.sub} {...p} />} bad={submitted && name.trim() === ""}>
              <input
                style={inputStyle(t, submitted && name.trim() === "")}
                type="text"
                placeholder="Имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </Field>
          </div>
        </div>

        <Field icon={(p) => <Mail size={17} color={t.sub} {...p} />} bad={emailBad}>
          <input
            style={inputStyle(t, emailBad)}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>

        <Field icon={(p) => <Lock size={17} color={t.sub} {...p} />} bad={passBad} eye>
          <input
            style={inputStyle(t, passBad, 46)}
            type={showPass ? "text" : "password"}
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
          <EyeButton shown={showPass} onClick={() => setShowPass((v) => !v)} t={t} />
        </Field>

        <div
          style={{
            display: "grid",
            gridTemplateRows: mode === "signup" ? "1fr" : "0fr",
            transition: `grid-template-rows 400ms ${EASE}`,
            marginBottom: mode === "signup" ? 0 : 12,
          }}
        >
          <div
            style={{
              overflow: "hidden",
              opacity: mode === "signup" ? 1 : 0,
              pointerEvents: mode === "signup" ? "auto" : "none",
              transition: "opacity 260ms ease",
            }}
          >
            <Field icon={(p) => <Lock size={17} color={t.sub} {...p} />} bad={confirmBad} eye>
              <input
                style={inputStyle(t, confirmBad, 46)}
                type={showConfirm ? "text" : "password"}
                placeholder="Повтори пароль"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
              <EyeButton shown={showConfirm} onClick={() => setShowConfirm((v) => !v)} t={t} />
            </Field>
          </div>
        </div>

        <Button type="submit" disabled={busy}>
              {busy ? "Погоди…" : mode === "login" ? "Войти" : "Создать аккаунт"}
            </Button>
          </>
        )}

        {mode === "reset" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>
                Восстановление пароля
              </div>
              <div style={{ color: t.sub, fontSize: 14, lineHeight: 1.45, marginTop: 4 }}>
                Отправим письмо со ссылкой для сброса пароля на твой email.
              </div>
            </div>

            <Field icon={(p) => <Mail size={17} color={t.sub} {...p} />} bad={emailBad}>
              <input
                autoFocus
                style={inputStyle(t, emailBad)}
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>

            <Button type="submit" disabled={busy}>
              {busy ? "Отправляю…" : "Отправить ссылку"}
            </Button>

            {!busy && (
              <button
                type="button"
                className="press"
                onClick={() => setMode("login")}
                style={{
                  marginTop: 12,
                  width: "100%",
                  textAlign: "center",
                  background: "none",
                  border: "none",
                  color: t.sub,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                ← Вернуться ко входу
              </button>
            )}
          </>
        )}

        {mode === "login" && (
          <button
            type="button"
            className="press"
            onClick={() => setMode("reset")}
            style={{
              marginTop: 12,
              width: "100%",
              textAlign: "center",
              background: "none",
              border: "none",
              color: t.sub,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Не помню пароль
          </button>
        )}
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "18px 0", ...anim(300) }}>
        <div style={{ flex: 1, height: 1, background: t.border }} />
        <div style={{ color: t.sub, fontSize: 13 }}>или</div>
        <div style={{ flex: 1, height: 1, background: t.border }} />
      </div>

      <div style={anim(340)}>
        <button
          className="press"
          onClick={onGoogle}
          disabled={busy}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 999,
            border: `1px solid ${t.border}`,
            background: t.surface,
            color: t.text,
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <GoogleG /> Продолжить с Google
        </button>
      </div>

      <div style={{ marginTop: 10, ...anim(380) }}>
        <button
          className="press"
          onClick={onGuest}
          disabled={busy}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 999,
            border: `1px solid ${t.border}`,
            background: "transparent",
            color: t.sub,
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <UserX size={18} /> Войти как гость
        </button>
      </div>

      <div style={{ marginTop: 22, textAlign: "center", ...anim(400) }}>
        <div style={{ color: t.sub, fontSize: 13 }}>
          Данные синхронизируются между твоими устройствами
        </div>
      </div>
    </div>
  );
}

function humanize(err) {
  const map = {
    "auth/invalid-credential": "Неверный email или пароль.",
    "auth/user-not-found": "Пользователь не найден.",
    "auth/wrong-password": "Неверный пароль.",
    "auth/email-already-in-use": "Этот email уже зарегистрирован.",
    "auth/invalid-email": "Некорректный email.",
    "auth/weak-password": "Пароль слишком короткий.",
    "auth/too-many-requests": "Слишком много попыток. Подожди немного.",
    "auth/popup-closed-by-user": "",
    "auth/popup-blocked": "Всплывающее окно заблокировано. Разреши попапы в браузере.",
  };
  return map[err?.code] ?? err?.message ?? "Что-то пошло не так.";
}