import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  Sparkles,
} from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { EASE } from "../theme/theme";
import { useAlert } from "../components/Alert";
import { plural } from "../utils";
import ListRow from "../components/ListRow";
import Button from "../components/Button";
import Modal from "../components/Modal";
import FieldLabel from "../components/FieldLabel";
import Accordion from "../components/Accordion";
import { GhostList, useGhostHold } from "../components/Ghost";
import { auth } from "../firebase";
import { listSubjects, createSubject, updateSubject, deleteSubject, countNotes } from "../api/firestore";

const ICONS = {
  Book, FlaskConical, Calculator, Languages, Globe, Atom, Landmark, Palette, Music2, Dumbbell, TrendingUp, HeartPulse, MapPin,
};
const ICON_KEYS = Object.keys(ICONS);

const SUBJECT_COLORS = [
  null,
  "#E5484D",
  "#F76B15",
  "#F5A623",
  "#46A758",
  "#0091FF",
  "#8E4EC6",
  "#E93D82",
];

const PREMADE_SUBJECTS = [
  "Математика", "Алгебра", "Геометрия", "Русский язык",
  "Литература", "История", "Обществознание", "Английский язык",
  "Немецкий язык", "Физика", "Химия", "Биология",
  "География", "Информатика", "ОБЖ",
];

const CHANGELOG = [
  {
    date: "24 октября 2026",
    items: [
      "ЕГЭ → Информатика: тренажёр задания 2 — таблицы истинности, банк задач и теория",
      "Решай прямо в браузере на Python: редактор с подсветкой, лигатурами, переносом строк и подсказками",
      "Ответ проверяется по последней строке вывода — можно вывести результат через print и сразу идти дальше",
    ],
  },
  {
    date: "6 октября 2026",
    items: [
      "Устная часть ЕГЭ (Английский → ЕГЭ): задание 1 — чтение текста вслух, задание 2 — условный диалог-расспрос по рекламе",
      "Говоришь в микрофон — Whisper расшифровывает, ИИ оценивает по критериям экзамена и объясняет баллы, для чтения видно метрики: паузы, темп, совпадение с текстом",
      "Банк вариантов с прогрессом «Пройдено»: результаты сохраняются на аккаунт, для гостей — в браузере",
      "Поиск в Библиотеке стал нечётким — находит и с опечатками",
    ],
  },
  {
    date: "1 октября 2026",
    items: [
      "Тренажёр правописания ПРЕ- и ПРИ- (задание 10) — введи пропущенную приставку, разбор пар и исключений в теории",
      "Настройка «Вид конспекта» — Настройки → Оформление: аккордеон с разделами или сплошной текст с заголовками",
      "Картинки из PDF и Word сохраняются в конспекте: новая вкладка «Картинки», нажми на схему, чтобы рассмотреть",
      "Прикрепляешь Word (.docx) — текст читается прямо из файла, без переименования в .txt",
    ],
  },
  {
    date: "28 сентября 2026",
    items: [
      "Письменный ответ проверяется на глазах: ИИ разбирает твои слова по одному, пока ты смотришь",
      "Ошибки и неточности подсвечиваются: жёлтый минус — неполно, красный крестик — неверно; нажми на слово — скажу, что с ним не так",
      "Зелёная галочка справа, если весь ответ верный",
      "Письменные ответы — короткие, максимум 4 слова: ИИ спрашивает про конкретные факты, термины и формулы",
      "В тестах от 3 до 6 вариантов ответа вместо ровно четырёх",
      "Все письменные задания проверяются одним запросом к ИИ — расход дневного лимита ниже",
    ],
  },
  {
    date: "25 сентября 2026",
    items: [
      "Тренажёры частей речи, корней и паронимов — в Библиотеке, с уровнями и разбором",
    ],
  },
  {
    date: "13 сентября 2026",
    items: [
      "Вкладка «Конспект» — аккордеоны по разделам и подразделам (таблицы и формулы внутри); собирается сразу при анализе",
      "Вкладка «Пересказ» вместо плана — ориентир по разделам и так виден в самом конспекте",
      "Раздел «ЕГЭ» в Библиотеке — задания по русскому собраны отдельно",
      "Тест со «Сопоставлением» сохраняется даже при небольшом числе пар",
    ],
  },
  {
    date: "сентябрь 2026",
    items: [
      "Плавный переход при смене темы",
      "Настройка звуков интерфейса (включить/выключить)",
      "Экранные переходы анимируются стабильно, не пропуская кадры",
    ],
  },
  {
    date: "сентябрь 2026",
    items: [
      "Тренажёр ударений: орфоэпический словник с правилами — во вкладке «Библиотека»"
    ],
  },
  {
    date: "сентябрь 2026",
    items: [
      "Количество вопросов теста — выбирай перед стартом (Экспресс / Стандарт / Максимум)",
      "Правильный ответ подсвечивается зелёным, при ошибке тест ждёт кнопки «Дальше»",
      "Письменный ответ: читаешь конспект и отмечаешь это перед проверкой",
      "Тесты, результаты и публичные копии каскадно удаляются вместе с конспектом или предметом",
      "Вычитка распознанного текста — второй проход по фото убирает ошибки OCR",
      "Название и цвет предмета выбираются колёсиками, «Другое…» для своего названия",
      "Темы убраны: план и пересказ внутри конспекта",
      "Библиотека показывает все типы заданий на карточке теста",
      "Обновлённые документы",
    ],
  },
  {
    date: "сентябрь 2026",
    items: [
      "Цвета для предметов — выбирай из палитры",
      "Готовые названия предметов + «Другое»",
      "Библиотека: фильтры по типу и предмету",
      "Статистика публикаций в профиле",
      "Карточки авторов в библиотеке и профили пользователей",
      "Интерактивный план с пересказом по разделам",
      "Тесты прямо из конспекта",
      "Переименование тестов",
      "Гостевой режим без регистрации",
      "Формулы в конспектах (KaTeX)",
      "Смена фото профиля",
      "Обновлённые документы",
    ],
  },
];

function hexToRgba(hex, alpha) {
  const h = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const ITEM = 60;
const NAME_WIDTH = 190;
const NAME_HEIGHT = 46;
const GAP = 12;

const SIDE_FADE =
  "linear-gradient(to right, transparent 0%, #000 22%, #000 78%, transparent 100%)";

function mod(a, n) {
  return ((a % n) + n) % n;
}

function PickerWheel({ value, onSelect, items, getValue = (x) => x, renderItem, itemWidth = ITEM, itemHeight = ITEM }) {
  const wheelRef = useRef(null);
  const len = items.length;
  const [pos, setPos] = useState(0);
  const posRef = useRef(0);
  const [snapping, setSnapping] = useState(false);
  const drag = useRef(null);
  const raf = useRef(0);
  const lastSel = useRef(-1);
  const step = itemWidth + GAP;
  const activeIdx = items.findIndex((x) => getValue(x) === value);

  const applyPos = (v) => {
    posRef.current = v;
    setPos(v);
  };

  const nearestFold = (idx, from) => idx - Math.round((idx - from) / len) * len;

  const settle = (m) => {
    if (m !== lastSel.current) {
      lastSel.current = m;
      onSelect(items[m]);
    }
    applyPos(nearestFold(m, posRef.current));
    setSnapping(true);
  };

  const fling = (iv) => {
    let vel = Math.max(-10 / step, Math.min(10 / step, iv));
    let lastT = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(now - lastT, 34);
      lastT = now;
      applyPos(posRef.current + vel * dt);
      vel *= Math.pow(0.95, dt / 16.667);
      if (Math.abs(vel) * step >= 0.12) {
        raf.current = requestAnimationFrame(tick);
      } else {
        settle(mod(Math.round(posRef.current), len));
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useLayoutEffect(() => {
    if (activeIdx < 0) return;
    lastSel.current = activeIdx;
    if (mod(Math.round(posRef.current), len) !== activeIdx) {
      applyPos(nearestFold(activeIdx, posRef.current));
    }
  }, [activeIdx]);

  const cw = wheelRef.current?.clientWidth || 280;
  const start = Math.floor(pos) - 3;

  const rendered = [];
  for (let k = 0; k < len + 7; k++) {
    const v = start + k;
    rendered.push({ v, m: mod(v, len), item: items[mod(v, len)] });
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
    applyPos(d.startPos - (e.clientX - d.startX) / step);
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
      const v = Math.round(posRef.current + (e.clientX - rect.left - cwL / 2) / step);
      settle(mod(v, len));
      return;
    }
    const s = d.samples;
    const vel =
      s.length > 1
        ? (s[s.length - 1].x - s[0].x) / (s[s.length - 1].t - s[0].t)
        : 0;
    if (Math.abs(vel) >= 0.4 && Math.abs(e.clientX - d.startX) >= 30)
      fling(-vel / step);
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
        height: itemHeight + 28,
        overflow: "hidden",
        touchAction: "pan-y",
        cursor: "grab",
        WebkitMaskImage: SIDE_FADE,
        maskImage: SIDE_FADE,
      }}
    >
      {rendered.map(({ v, m, item }, i) => {
        const isActive = m === activeIdx;
        return (
          <div
            key={`${v}-${i}`}
            style={{
              position: "absolute",
              left: cw / 2 - itemWidth / 2 + (v - pos) * step,
              top: 14,
              width: itemWidth,
              height: itemHeight,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "grab",
              touchAction: "pan-y",
              userSelect: "none",
              transform: isActive ? "scale(1.05)" : "scale(0.92)",
              transition: snapping
                ? `left 240ms ${EASE}, transform 220ms ${EASE}`
                : `transform 220ms ${EASE}`,
            }}
          >
            {renderItem(item, isActive)}
          </div>
        );
      })}
    </div>
  );
}

function SubjectModal({ open, initial, onClose, onSave, onDelete }) {
  const { t } = useTheme();
  const { alert } = useAlert();
  const [name, setName] = useState("");
  const [custom, setCustom] = useState(false);
  const [icon, setIcon] = useState("Book");
  const [color, setColor] = useState(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setCustom(Boolean(initial) && !PREMADE_SUBJECTS.includes(initial.name));
      setIcon(initial?.icon ?? "Book");
      setColor(initial?.color ?? null);
    }
  }, [open, initial]);

  const submit = async () => {
    if (name.trim() === "") {
      alert("Введи название предмета.");
      return;
    }
    try {
      await onSave(initial, name.trim(), icon, color);
    } catch (err) {
      alert("Не удалось сохранить предмет: " + (err?.message ?? ""));
    }
  };

  const confirmDelete = () => {
    if (!initial) return;
    alert(`Удалить предмет «${name}»?`, {
      danger: true,
      confirmLabel: "Удалить",
      onConfirm: async () => {
        try {
          await onDelete(initial.id);
        } catch {
          /* ошибка уже показана в onDelete */
        }
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Редактировать предмет" : "Новый предмет"}>
      <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FieldLabel t={t}>Название</FieldLabel>
          {!custom ? (
            <>
              <PickerWheel
                value={name}
                items={PREMADE_SUBJECTS}
                onSelect={(s) => setName(s)}
                itemWidth={NAME_WIDTH}
                itemHeight={NAME_HEIGHT}
                renderItem={(s, isActive) => (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: 999,
                      border: "none",
                      background: isActive ? t.invBg : t.raised,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 14px",
                      boxSizing: "border-box",
                      overflow: "hidden",
                      color: isActive ? t.inv : t.text,
                      fontSize: 14,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {s}
                  </div>
                )}
              />
              <button
                type="button"
                className="press"
                onClick={() => setCustom(true)}
                style={{
                  margin: "10px auto 16px",
                  display: "block",
                  padding: "9px 16px",
                  borderRadius: 999,
                  border: `1px solid ${t.border}`,
                  background: t.raised,
                  color: t.sub,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Другое…
              </button>
            </>
          ) : (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Своё название"
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
          )}

          <FieldLabel t={t}>Цвет</FieldLabel>
          <PickerWheel
            value={color}
            items={SUBJECT_COLORS}
            onSelect={(c) => setColor(c)}
            renderItem={(c, isActive) => (
              <div
                aria-label={c ? "Цвет" : "Без цвета"}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  boxSizing: "border-box",
                  border: isActive ? `2px solid ${t.text}` : `1px solid ${c ? "transparent" : t.border}`,
                  background: c || t.raised,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {!c && <X size={15} color={t.sub} />}
              </div>
            )}
          />

          <FieldLabel t={t} style={{ margin: "18px 0 8px 2px" }}>Иконка</FieldLabel>
          <PickerWheel
            value={icon}
            items={ICON_KEYS}
            onSelect={(k) => setIcon(k)}
            renderItem={(k, isActive) => {
              const C = ICONS[k];
              return C ? (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 18,
                    border: "none",
                    background: isActive ? t.invBg : t.raised,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <C size={26} color={isActive ? t.inv : t.text} strokeWidth={2} />
                </div>
              ) : null;
            }}
          />

          <Button
            type="submit"
            variant="primary"
            disabled={name.trim() === ""}
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
              background: t.danger,
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
    </Modal>
  );
}

function Changelog({ t }) {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ marginTop: 34, paddingBottom: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: t.sub,
          fontSize: 13,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          margin: "0 0 10px 4px",
        }}
      >
        <Sparkles size={15} /> Что нового
      </div>
      {CHANGELOG.map((rel, i) => (
        <Accordion
          key={i}
          title={rel.date}
          open={open === i}
          onToggle={() => setOpen(open === i ? null : i)}
        >
          {(rel.items || []).map((item, j) => (
            <div key={j} style={{ color: t.sub, fontSize: 14, padding: "5px 0", paddingLeft: 4, lineHeight: 1.45 }}>
              — {item}
            </div>
          ))}
        </Accordion>
      ))}
    </div>
  );
}

function GuestBanner({ t }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 18,
        border: `1px solid ${t.border}`,
        background: t.surface,
        marginBottom: 16,
      }}
    >
      <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>
        Ты в гостевом режиме
      </div>
      <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
        Можно смотреть библиотеку и проходить тесты. Создание конспектов доступно после регистрации.
      </div>
    </div>
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

  const onSave = async (initial, name, icon, color) => {
    setAdding(true);
    try {
      if (initial) await updateSubject(initial.id, { name, icon, color });
      else await createSubject(name, icon, color);
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
      {auth.currentUser?.isAnonymous && <GuestBanner t={t} />}
      {showGhost ? (
        <GhostList count={5} />
      ) : error ? (
        <div style={{ color: t.sub, fontSize: 14, padding: "10px 0", lineHeight: 1.4 }}>
          Не удалось загрузить предметы: {error}
        </div>
      ) : (
        subjects.map((s, idx) => {
          const C = ICONS[s.icon] || ICONS.Book;
          const iconColor = s.color || t.text;
          const tint = hexToRgba(s.color, 0.16);
          return (
            <ListRow
              key={s.id}
              idx={idx}
              icon={<C size={20} color={iconColor} strokeWidth={2} />}
              title={s.name}
              sub={`${s.count} ${plural(s.count, ["конспект", "конспекта", "конспектов"])}`}
              onClick={() => navigate(`/subject/${s.id}`)}
              onLongPress={() => openEdit(s)}
              iconWrap={tint ? { background: tint } : undefined}
            />
          );
        })
      )}

      {!showGhost && subjects.length === 0 && (
        <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>Пока нет предметов.</div>
      )}

      {!showGhost && (
        <div style={{ marginTop: 24 }}>
          {!auth.currentUser?.isAnonymous && (
            <Button variant="dashed" onClick={openCreate} disabled={adding}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Plus size={16} /> Новый предмет
              </span>
            </Button>
          )}
        </div>
      )}

      {!showGhost && <Changelog t={t} />}

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