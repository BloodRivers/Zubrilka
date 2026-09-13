import { useEffect, useRef, useState } from "react";
import { ListChecks, Tag, ScanSearch, Keyboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import ProgressBar from "../components/ProgressBar";
import Button from "../components/Button";
import Segmented from "../components/Segmented";
import ListRow from "../components/ListRow";
import { Stat } from "./StressTrainer";
import { sfx } from "../sfx";
import { setQuizActive } from "../nav";

const CATS = [
  { id: "personal", title: "Личные", desc: "Указывают на участников беседы или предметы.", words: ["я", "ты", "он", "она", "оно", "мы", "вы", "они"] },
  { id: "reflexive", title: "Возвратное", desc: "Показывает, что действие направлено на самого себя (нет формы именительного падежа).", words: ["себя"] },
  { id: "possessive", title: "Притяжательные", desc: "Указывают на принадлежность предмета лицу или другому предмету — отвечают на вопрос чей?", words: ["мой", "твой", "наш", "ваш", "свой", "его", "её", "их"] },
  { id: "demonstrative", title: "Указательные", desc: "Выделяют определённый предмет, признак или количество из других.", words: ["тот", "этот", "такой", "таков", "столько"] },
  { id: "attributive", title: "Определительные", desc: "Указывают на обобщённый признак предмета.", words: ["весь", "всякий", "каждый", "сам", "самый", "иной", "другой", "любой"] },
  { id: "interrogative", title: "Вопросительные", desc: "Служат для выражения вопроса.", words: ["кто?", "что?", "какой?", "каков?", "чей?", "который?", "сколько?"] },
  { id: "relative", title: "Относительные", desc: "Совпадают по форме с вопросительными, но выполняют роль союзных слов в сложном предложении.", words: ["кто", "что", "какой", "чей", "который", "сколько"] },
  { id: "negative", title: "Отрицательные", desc: "Указывают на отсутствие предмета или признака либо на их отрицание.", words: ["никто", "ничто", "никакой", "ничей", "некого", "нечего"] },
  { id: "indefinite", title: "Неопределённые", desc: "Указывают на неизвестные или неточно определённые предметы, признаки и количества.", words: ["кто-то", "что-нибудь", "кое-какой", "нечто", "несколько"] },
];
const CAT_MAP = Object.fromEntries(CATS.map((c) => [c.id, c]));

const AMBIG = {
  "его": ["possessive", "personal"],
  "её": ["possessive", "personal"],
  "их": ["possessive", "personal"],
  "кто": ["interrogative", "relative"],
  "что": ["interrogative", "relative"],
  "какой": ["interrogative", "relative"],
  "чей": ["interrogative", "relative"],
  "который": ["interrogative", "relative"],
  "сколько": ["interrogative", "relative"],
};

const ITEMS = [];
CATS.forEach((c) =>
  c.words.forEach((w) => {
    const cats = w.endsWith("?") ? ["interrogative"] : AMBIG[w] || [c.id];
    ITEMS.push({ word: w, cats });
  })
);

const CAT_NAMES = {
  personal: ["личные", "личное"],
  reflexive: ["возвратное", "возвратный"],
  possessive: ["притяжательные", "притяжательное"],
  demonstrative: ["указательные", "указательное"],
  attributive: ["определительные", "определительное"],
  interrogative: ["вопросительные", "вопросительное"],
  relative: ["относительные", "относительное"],
  negative: ["отрицательные", "отрицательное"],
  indefinite: ["неопределённые", "неопределенные", "неопределённое", "неопределенное"],
};

const norm = (s) => s.toLowerCase().replace(/ё/g, "е");

const foreignWords = (mainId) => ITEMS.filter((i) => !i.cats.includes(mainId)).map((i) => i.word);

const LEVELS = [
  { id: "pick", icon: ListChecks, title: "Местоимения по разряду", sub: "Выбери все местоимения, относящиеся к указанному разряду" },
  { id: "name", icon: Tag, title: "Разряд по местоимению", sub: "Укажи разряд предложенного местоимения" },
  { id: "odd", icon: ScanSearch, title: "Найди лишнее", sub: "В ряду местоимений найди слово из чужого разряда" },
  { id: "type", icon: Keyboard, title: "Пиши вручную", sub: "Впиши разряд или местоимения без подсказок" },
];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makePick(catId) {
  const cat = CAT_MAP[catId];
  const target = shuffle(cat.words).slice(0, Math.min(5, cat.words.length));
  const distractors = shuffle(foreignWords(catId).filter((w) => !target.includes(w))).slice(0, Math.max(1, 6 - target.length));
  return { type: "pick", catId, words: shuffle([...target, ...distractors]), answer: target };
}

function makeName(item) {
  const cats = item.cats;
  const pool = shuffle(CATS.map((c) => c.id).filter((id) => !cats.includes(id)));
  return { type: "name", word: item.word, cats, options: shuffle([...cats.slice(0, 2), ...pool.slice(0, 4 - cats.length)]) };
}

function makeOdd(catId) {
  const cat = CAT_MAP[catId];
  const main = shuffle(cat.words).slice(0, 3);
  const dist = shuffle(foreignWords(catId).filter((w) => !main.includes(w)))[0];
  return { type: "odd", catId, words: shuffle([...main, dist]), answer: dist };
}

function buildQueue(level) {
  if (level === "pick") return shuffle(CATS.map((c) => makePick(c.id)));
  if (level === "name") return shuffle(ITEMS).map(makeName);
  if (level === "odd") return shuffle(CATS.filter((c) => c.words.length >= 3).map((c) => makeOdd(c.id)));
  const typed = CATS.map((c) => ({ type: "type-word", catId: c.id }));
  const named = shuffle(ITEMS).slice(0, 12).map((i) => ({ type: "type-cat", word: i.word, cats: i.cats }));
  return shuffle([...typed, ...named]);
}

function catInline(id) {
  const c = CAT_MAP[id];
  return `${c.title}: ${c.desc} (${c.words.join(", ")})`;
}

let SEQ = 1;

export default function PronounsTrainer({ level }) {
  const { t } = useTheme();
  const navigate = useNavigate();
  const queueRef = useRef([]);
  const wrongRef = useRef(new Set());
  const totalRef = useRef(0);
  const [tab, setTab] = useState("train");
  const [current, setCurrent] = useState(null);
  const [locked, setLocked] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [input, setInput] = useState("");
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);
  const started = Boolean(level);

  useEffect(() => {
    setQuizActive(tab === "train" && started && !done);
    return () => setQuizActive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, started, done]);

  const next = () => {
    const q = queueRef.current;
    setLocked(false);
    setVerdict(null);
    setSel(new Set());
    setInput("");
    if (q.length === 0) {
      setCurrent(null);
      setDone(true);
      return;
    }
    setCurrent(q.shift());
  };

  const start = (lv) => {
    queueRef.current = buildQueue(lv);
    totalRef.current = queueRef.current.length;
    wrongRef.current = new Set();
    setStreak(0);
    setBestStreak(0);
    setMistakes(0);
    setDone(false);
    setLocked(false);
    setVerdict(null);
    setSel(new Set());
    setInput("");
    next();
  };

  useEffect(() => {
    if (level && !queueRef.current.length) start(level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const reinsert = (q) => {
    const queue = queueRef.current;
    for (let n = 0; n < 2; n++) {
      const copy = { ...q, key: SEQ++ };
      const pos = Math.min(queue.length, Math.floor(Math.random() * (Math.min(8, queue.length) + 1)));
      queue.splice(pos, 0, copy);
    }
  };

  const wrongLabel = (q) => {
    if (q.type === "pick") return `${CAT_MAP[q.catId].title}: ${q.answer.join(", ")}`;
    if (q.type === "name" || q.type === "type-cat") return q.word;
    if (q.type === "odd") return `лишнее — «${q.answer}»`;
    return CAT_MAP[q.catId].title;
  };

  const submit = (payload) => {
    if (locked || done || !current) return;
    setLocked(true);
    let correct = false;
    let explain = "";
    const q = current;
    if (q.type === "pick") {
      const got = new Set(payload);
      const ans = new Set(q.answer);
      correct = ans.size === got.size && [...ans].every((w) => got.has(w));
      explain = CAT_MAP[q.catId].desc;
    } else if (q.type === "name") {
      correct = q.cats.includes(payload);
      explain = q.cats.map(catInline).join(" · ");
    } else if (q.type === "odd") {
      correct = payload === q.answer;
      explain = catInline(q.catId);
    } else if (q.type === "type-word") {
      const tokens = input
        .toLowerCase()
        .split(/[\s,;]+/)
        .map((w) => norm(w).replace(/\?$/, ""))
        .filter(Boolean);
      const expected = CAT_MAP[q.catId].words.map((w) => norm(w).replace(/\?$/, ""));
      correct = tokens.length === expected.length && expected.every((w) => tokens.includes(w));
      explain = `Правильный ответ: ${CAT_MAP[q.catId].words.join(", ")}`;
    } else {
      const accepted = norm(input);
      correct = q.cats.some((cid) => CAT_NAMES[cid].includes(accepted));
      explain = `Правильный ответ: ${q.cats.map((cid) => CAT_MAP[cid].title).join(" или ")}`;
    }

    if (correct) {
      sfx.correct();
      const ns = streak + 1;
      setStreak(ns);
      setBestStreak((b) => Math.max(b, ns));
    } else {
      sfx.wrong();
      setStreak(0);
      setMistakes((m) => m + 1);
      wrongRef.current.add(wrongLabel(q));
      reinsert(q);
    }
    setVerdict({ correct, explain, payload });
  };

  const remaining = current ? queueRef.current.length : 0;
  const progress = done ? 1 : Math.min(1, Math.max(0, (totalRef.current - remaining) / totalRef.current));

  const chipStyle = (word) => {
    if (verdict) {
      if (current.answer.includes(word)) return { border: "#46A758", background: "rgba(70,167,88,0.14)", color: "#46A758" };
      if (typeof verdict.payload === "string" && verdict.payload === word) return { border: "#E5484D", background: "rgba(229,72,77,0.10)", color: "#E5484D" };
      if (sel.has(word)) return { border: "#E5484D", background: "rgba(229,72,77,0.10)", color: "#E5484D" };
    }
    if (sel.has(word)) return { border: t.invBg, background: t.invBg, color: t.inv };
    return { border: t.border, background: t.raised, color: t.text };
  };

  const optStyle = (cid) => {
    const isAnswer = current.cats.includes(cid);
    if (verdict && isAnswer) return { border: "#46A758", background: "rgba(70,167,88,0.14)", color: "#46A758" };
    if (verdict && verdict.payload === cid) return { border: "#E5484D", background: "rgba(229,72,77,0.10)", color: "#E5484D" };
    return { border: t.border, background: t.raised, color: t.text };
  };

  const renderTop = () => (
    <Segmented
      value={tab}
      onChange={setTab}
      options={[
        { v: "train", label: "Тренажёр" },
        { v: "theory", label: "Теория" },
      ]}
    />
  );

  if (tab === "theory") {
    return (
      <div style={{ paddingTop: 4 }}>
        {renderTop()}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {CATS.map((c) => (
            <div key={c.id} style={{ borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, padding: "18px 18px 14px" }}>
              <div style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{c.title}</div>
              <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{c.desc}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {c.words.map((w) => (
                  <span key={w} style={{ fontSize: 13, fontWeight: 600, color: t.text, border: `1px solid ${t.border}`, background: t.raised, padding: "5px 12px", borderRadius: 999 }}>
                    {w}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (started && !current && !done) return null;

  if (!started) {
    return (
      <div style={{ paddingTop: 4 }}>
        {renderTop()}
        <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", margin: "18px 0 4px" }}>
          Выбери уровень
        </div>
        {LEVELS.map((lv, i) => (
          <ListRow
            key={lv.id}
            idx={i}
            icon={<lv.icon size={22} color={t.text} />}
            title={lv.title}
            sub={lv.sub}
            onClick={() => navigate(`/trainer/pronouns/${lv.id}`, { state: { from: "/trainer/pronouns" } })}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 4 }}>
      {done ? (
        <div style={{ paddingTop: 12 }}>
          <div style={{ color: t.sub, fontSize: 13, marginBottom: 6 }}>Итог тренажёра</div>
          {mistakes === 0 ? (
            <div style={{ color: "#46A758", fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Без ошибок — отлично!</div>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
              <div style={{ color: t.text, fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em" }}>{totalRef.current}</div>
              <div style={{ color: t.sub, fontSize: 15 }}>заданий пройдено</div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <Stat label="Ошибки" value={mistakes} tint="#E5484D" />
            <Stat label="Лучшая серия" value={bestStreak} tint="#46A758" />
          </div>
          {wrongRef.current.size > 0 ? (
            <>
              <div style={{ color: t.sub, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Стоит повторить</div>
              {[...wrongRef.current].map((w) => (
                <div
                  key={w}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 0",
                    borderBottom: `1px solid ${t.border}`,
                  }}
                >
                  <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>{w}</div>
                  <div style={{ fontSize: 12, color: t.sub, border: `1px solid ${t.border}`, padding: "5px 10px", borderRadius: 999 }}>
                    повторить
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>Разряды местоимений усвоены уверенно.</div>
          )}
          <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 10 }}>
            <Button onClick={() => start(level)}>Ещё раз</Button>
            <Button variant="dashed" onClick={() => navigate("/trainer/pronouns", { state: { from: "/ege/russian" } })}>
              Вернуться к тренажёру
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ padding: "28px 18px", borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, textAlign: "center" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <Stat label="Серия" value={streak} tint="#46A758" />
            <Stat label="Осталось" value={remaining} />
            <Stat label="Ошибки" value={mistakes} tint="#E5484D" />
          </div>
          <ProgressBar value={progress} />

          {current.type === "pick" && (
            <>
              {!verdict && <div style={{ color: t.sub, fontSize: 13, marginBottom: 16 }}>{CAT_MAP[current.catId].title}. Выбери все, что подходят</div>}
              <div style={{ color: t.text, fontSize: 18, fontWeight: 700, marginBottom: 18 }}>{CAT_MAP[current.catId].title}</div>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 20 }}>
                {current.words.map((w) => {
                  const s = chipStyle(w);
                  return (
                    <button
                      key={w}
                      type="button"
                      className={verdict ? undefined : "press"}
                      onClick={() => !locked && setSel((prev) => { const n = new Set(prev); if (n.has(w)) n.delete(w); else n.add(w); return n; })}
                      disabled={locked}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 999,
                        border: `1px solid ${s.border}`,
                        background: s.background,
                        color: s.color,
                        fontSize: 15,
                        fontWeight: 600,
                        fontFamily: "inherit",
                        cursor: verdict ? "default" : "pointer",
                        transition: "background .15s, color .15s, border-color .15s",
                      }}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
              {!verdict && <Button onClick={() => submit([...sel])}>Проверить</Button>}
            </>
          )}

          {current.type === "name" && (
            <>
              {!verdict && <div style={{ color: t.sub, fontSize: 13, marginBottom: 16 }}>Какой разряд?</div>}
              <div style={{ fontSize: 28, fontWeight: 700, color: t.text, marginBottom: 24 }}>{current.word}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {current.options.map((cid) => {
                  const s = optStyle(cid);
                  return (
                    <button
                      key={cid}
                      type="button"
                      className={verdict ? undefined : "press"}
                      onClick={() => submit(cid)}
                      disabled={locked}
                      style={{
                        padding: "14px 12px",
                        minHeight: 54,
                        borderRadius: 14,
                        border: `1px solid ${s.border}`,
                        background: s.background,
                        color: s.color,
                        fontSize: 17,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        cursor: verdict ? "default" : "pointer",
                        transition: "background .15s, color .15s, border-color .15s",
                      }}
                    >
                      {CAT_MAP[cid].title}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {current.type === "odd" && (
            <>
              {!verdict && <div style={{ color: t.sub, fontSize: 13, marginBottom: 16 }}>Найди лишнее слово</div>}
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 20 }}>
                {current.words.map((w) => {
                  const s = chipStyle(w);
                  return (
                    <button
                      key={w}
                      type="button"
                      className={verdict ? undefined : "press"}
                      onClick={() => submit(w)}
                      disabled={locked}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 999,
                        border: `1px solid ${s.border}`,
                        background: s.background,
                        color: s.color,
                        fontSize: 15,
                        fontWeight: 600,
                        fontFamily: "inherit",
                        cursor: verdict ? "default" : "pointer",
                        transition: "background .15s, color .15s, border-color .15s",
                      }}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {current.type === "type-word" && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>{CAT_MAP[current.catId].title}</div>
              {!verdict && <div style={{ color: t.sub, fontSize: 13, marginBottom: 16 }}>Напиши местоимения этого разряда (через запятую или пробел)</div>}
              <form
                onSubmit={(e) => { e.preventDefault(); submit(); }}
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={locked}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: `1px solid ${t.border}`,
                    background: t.raised,
                    color: t.text,
                    fontSize: 16,
                    fontFamily: "inherit",
                    textAlign: "center",
                    outline: "none",
                  }}
                  placeholder="мой, твой, наш…"
                />
                {!verdict && <Button>Ответить</Button>}
              </form>
            </>
          )}

          {current.type === "type-cat" && (
            <>
              {!verdict && <div style={{ color: t.sub, fontSize: 13, marginBottom: 16 }}>Напиши разряд этого местоимения</div>}
              <div style={{ fontSize: 28, fontWeight: 700, color: t.text, marginBottom: 18 }}>{current.word}</div>
              <form
                onSubmit={(e) => { e.preventDefault(); submit(); }}
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={locked}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: `1px solid ${t.border}`,
                    background: t.raised,
                    color: t.text,
                    fontSize: 16,
                    fontFamily: "inherit",
                    textAlign: "center",
                    outline: "none",
                  }}
                  placeholder="притяжательные"
                />
                {!verdict && <Button>Ответить</Button>}
              </form>
            </>
          )}

          {verdict && (
            <div className="swap">
              <div style={{ color: verdict.correct ? "#46A758" : "#E5484D", fontSize: 15, fontWeight: 700, marginTop: 14 }}>
                {verdict.correct ? "Верно." : "Неверно. Задание вернётся ещё дважды."}
              </div>
              <div style={{ color: t.text, fontSize: 13, lineHeight: 1.55, marginTop: 8, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
                {verdict.explain}
              </div>
              <div style={{ marginTop: 16 }}>
                <Button onClick={next}>Далее</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}