import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Book,
  FlaskConical,
  Calculator,
  Languages,
  Globe,
  Atom,
  Landmark,
  Palette,
  Music2,
  Dumbbell,
  TrendingUp,
  HeartPulse,
  MapPin,
  X,
} from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { useAlert } from "../components/Alert";
import ListRow from "../components/ListRow";
import Button from "../components/Button";
import { GhostList, useGhostHold } from "../components/Ghost";
import { listSubjects, createSubject, updateSubject, deleteSubject, countNotes } from "../api/firestore";

const ICONS = {
  Book, FlaskConical, Calculator, Languages, Globe, Atom, Landmark, Palette, Music2, Dumbbell, TrendingUp, HeartPulse, MapPin,
};
const ICON_KEYS = Object.keys(ICONS);

const ICON_LABELS = {
  Book: "Книга",
  FlaskConical: "Пробирка",
  Calculator: "Калькулятор",
  Languages: "Языки",
  Globe: "Глобус",
  Atom: "Атом",
  Landmark: "Здание",
  Palette: "Палитра",
  Music2: "Музыка",
  Dumbbell: "Спорт",
  TrendingUp: "График",
  HeartPulse: "Пульс",
  MapPin: "Пин",
};

const ITEM = 60;
const GAP = 12;
const STEP = ITEM + GAP;

const SIDE_FADE =
  "linear-gradient(to right, transparent 0%, #000 22%, #000 78%, transparent 100%)";

function mod(a, n) {
  return ((a % n) + n) % n;
}

function IconWheel({ value, onSelect }) {
  const { t } = useTheme();
  const wheelRef = useRef(null);
  const keys = ICON_KEYS;
  const len = keys.length;
  const [pos, setPos] = useState(0);
  const posRef = useRef(0);
  const [snapping, setSnapping] = useState(false);
  const drag = useRef(null);
  const raf = useRef(0);
  const lastSel = useRef(-1);

  const applyPos = (v) => {
    posRef.current = v;
    setPos(v);
  };

  const nearestFold = (icon, from) =>
    icon - Math.round((icon - from) / len) * len;

  const settle = (m) => {
    if (m !== lastSel.current) {
      lastSel.current = m;
      onSelect(keys[m]);
    }
    applyPos(nearestFold(m, posRef.current));
    setSnapping(true);
  };

  const fling = (iv) => {
    let vel = Math.max(-10 / STEP, Math.min(10 / STEP, iv));
    let lastT = performance.now();
    const step = () => {
      const now = performance.now();
      const dt = Math.min(now - lastT, 34);
      lastT = now;
      applyPos(posRef.current + vel * dt);
      vel *= Math.pow(0.95, dt / 16.667);
      if (Math.abs(vel) * STEP >= 0.12) {
        raf.current = requestAnimationFrame(step);
      } else {
        settle(mod(Math.round(posRef.current), len));
      }
    };
    raf.current = requestAnimationFrame(step);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useLayoutEffect(() => {
    const i = Math.max(0, keys.findIndex((x) => x === value));
    lastSel.current = i;
    if (mod(Math.round(posRef.current), len) !== i) {
      applyPos(nearestFold(i, posRef.current));
    }
  }, [value]);

  const cw = wheelRef.current?.clientWidth || 280;
  const activeMod = mod(Math.round(pos), len);
  const start = Math.floor(pos) - 3;

  const items = [];
  for (let k = 0; k < len + 7; k++) {
    const v = start + k;
    const m = mod(v, len);
    const C = ICONS[keys[m]];
    if (C) items.push({ v, m, key: keys[m], C });
  }

  const onPointerDown = (e) => {
    cancelAnimationFrame(raf.current);
    setSnapping(false);
    drag.current = {
      startX: e.clientX,
      startPos: posRef.current,
      samples: [{ t: performance.now(), x: e.clientX }],
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!drag.current) return;
    const d = drag.current;
    applyPos(d.startPos - (e.clientX - d.startX) / STEP);
    const now = performance.now();
    d.samples.push({ t: now, x: e.clientX });
    while (d.samples.length > 2 && d.samples[0].t < now - 120) d.samples.shift();
  };

  const onPointerUp = (e) => {
    if (!drag.current) return;
    const d = drag.current;
    drag.current = null;
    if (Math.abs(e.clientX - d.startX) < 6) {
      const rect = wheelRef.current.getBoundingClientRect();
      const cwL = wheelRef.current.clientWidth;
      const v = Math.round(
        posRef.current + (e.clientX - rect.left - cwL / 2) / STEP
      );
      settle(mod(v, len));
      return;
    }
    const s = d.samples;
    const vel =
      s.length > 1
        ? (s[s.length - 1].x - s[0].x) / (s[s.length - 1].t - s[0].t)
        : 0;
    if (Math.abs(vel) >= 0.4 && Math.abs(e.clientX - d.startX) >= 30)
      fling(-vel / STEP);
    else settle(mod(Math.round(posRef.current), len));
  };

  return (
    <div
      ref={wheelRef}
      className="wheel"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "relative",
        height: ITEM + 28,
        overflow: "hidden",
        touchAction: "pan-y",
        cursor: "grab",
        WebkitMaskImage: SIDE_FADE,
        maskImage: SIDE_FADE,
      }}
    >
      {items.map(({ v, m, key, C }) => {
        const isActive = m === activeMod;
        return (
          <button
            key={`${v}-${key}`}
            type="button"
            aria-label={key}
            style={{
              position: "absolute",
              left: cw / 2 - ITEM / 2 + (v - pos) * STEP,
              top: 14,
              width: ITEM,
              height: ITEM,
              borderRadius: 18,
              border: "none",
              background: isActive ? t.invBg : t.raised,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "grab",
              touchAction: "pan-y",
              userSelect: "none",
              transform: isActive ? "scale(1.15)" : "scale(0.85)",
              transition: snapping
                ? "left 240ms cubic-bezier(0.16,1,0.3,1), transform 220ms cubic-bezier(0.16,1,0.3,1), background 220ms ease"
                : "transform 220ms cubic-bezier(0.16,1,0.3,1), background 220ms ease",
            }}
          >
            <C size={26} color={isActive ? t.inv : t.text} strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}

function plural(n) {
  const s = n % 100;
  if (s >= 11 && s <= 14) return "конспектов";
  const d = s % 10;
  if (d === 1) return "конспект";
  if (d >= 2 && d <= 4) return "конспекта";
  return "конспектов";
}

function SubjectModal({ open, initial, onClose, onSave, onDelete }) {
  const { t } = useTheme();
  const { alert } = useAlert();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Book");
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setIcon(initial?.icon ?? "Book");
      setLeaving(false);
    }
  }, [open, initial]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const requestClose = () => {
    if (leaving) return;
    setLeaving(true);
    timer.current = setTimeout(() => {
      setLeaving(false);
      onClose();
    }, 220);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = async () => {
    if (leaving) return;
    if (name.trim() === "") {
      alert("Введи название предмета.");
      return;
    }
    setLeaving(true);
    try {
      await onSave(initial, name.trim(), icon);
    } catch (err) {
      alert("Не удалось сохранить предмет: " + (err?.message ?? ""));
    } finally {
      setLeaving(false);
    }
  };

  const confirmDelete = () => {
    if (!initial || leaving) return;
    alert(`Удалить предмет «${name}»?`, {
      danger: true,
      confirmLabel: "Удалить",
      onConfirm: async () => {
        setLeaving(true);
        try {
          await onDelete(initial.id);
        } finally {
          setLeaving(false);
        }
      },
    });
  };

  if (!open && !leaving) return null;

  return createPortal(
    <div
      onClick={requestClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 32px",
        zIndex: 200,
        animation: `${leaving ? "backdropOut" : "backdropIn"} 220ms ease-out forwards`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 320,
          background: t.surface,
          borderRadius: 22,
          padding: "22px 20px 20px 20px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
          animation: `${leaving ? "modalOut" : "modalIn"} 220ms cubic-bezier(0.16,1,0.3,1) forwards`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>
            {initial ? "Редактировать предмет" : "Новый предмет"}
          </div>
          <button
            type="button"
            className="press"
            onClick={requestClose}
            aria-label="Закрыть"
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: "none",
              background: t.raised,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={15} color={t.sub} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div style={{ color: t.sub, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 8px 2px" }}>
            Название
          </div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например «Математика»"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "14px 16px",
              borderRadius: 14,
              border: `1px solid ${t.border}`,
              background: t.raised,
              color: t.text,
              fontSize: 15,
              fontFamily: "inherit",
              outline: "none",
              marginBottom: 16,
            }}
          />

          <div style={{ color: t.sub, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 8px 2px" }}>
            Иконка
          </div>
          <IconWheel value={icon} onSelect={setIcon} />

          <Button
            type="submit"
            variant="primary"
            disabled={name.trim() === "" || leaving}
            style={{ marginTop: 16 }}
          >
            {initial ? "Сохранить" : "Создать"}
          </Button>
        </form>

        {initial && (
          <button
            type="button"
            className="press"
            onClick={confirmDelete}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "16px",
              borderRadius: 999,
              border: "none",
              background: "#E5484D",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Удалить предмет
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function Subjects() {
  const { t } = useTheme();
  const { alert } = useAlert();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const showGhost = useGhostHold(loading);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const openCreate = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setShowModal(true);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listSubjects();
      const withCounts = await Promise.all(
        list.map(async (s) => ({
          ...s,
          count: await countNotes(s.id).catch(() => 0),
        }))
      );
      setSubjects(withCounts);
    } catch (e) {
      setError(e.message || "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSave = async (initial, name, icon) => {
    setAdding(true);
    try {
      if (initial) await updateSubject(initial.id, { name, icon });
      else await createSubject(name, icon);
      await load();
      setShowModal(false);
    } catch {
      alert(
        initial
          ? "Не удалось сохранить предмет, проверь соединение и настройки Firebase"
          : "Не удалось добавить предмет, проверь соединение и настройки Firebase"
      );
    } finally {
      setAdding(false);
    }
  };

  const onDelete = async (id) => {
    try {
      await deleteSubject(id);
      await load();
      setShowModal(false);
    } catch {
      alert("Не удалось удалить предмет, проверь соединение и настройки Firebase");
    }
  };

  return (
    <div>
      {showGhost ? (
        <GhostList count={5} />
      ) : error ? (
        <div style={{ color: t.sub, fontSize: 14, padding: "10px 0", lineHeight: 1.4 }}>
          Не удалось загрузить предметы: {error}
        </div>
      ) : (
        subjects.map((s, idx) => {
          const C = ICONS[s.icon] || ICONS.Book;
          return (
            <ListRow
              key={s.id}
              idx={idx}
              icon={<C size={20} color={t.text} strokeWidth={2} />}
              title={s.name}
              sub={`${s.count} ${plural(s.count)}`}
              onClick={() => navigate(`/subject/${s.id}`)}
              onLongPress={() => openEdit(s)}
            />
          );
        })
      )}

      {!showGhost && subjects.length === 0 && (
        <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>Пока нет предметов.</div>
      )}

      {!showGhost && (
        <div style={{ marginTop: 24 }}>
          <Button variant="dashed" onClick={openCreate} disabled={adding}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Plus size={16} /> Новый предмет
            </span>
          </Button>
        </div>
      )}

      <SubjectModal
        open={showModal}
        initial={editing}
        onClose={() => !adding && setShowModal(false)}
        onSave={onSave}
        onDelete={onDelete}
      />
    </div>
  );
}