import { useEffect, useRef, useState } from "react";
import { ListChecks, Tag, ScanSearch, Keyboard, MessageSquareText, PenLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { shuffle } from "../utils";
import ProgressBar from "../components/ProgressBar";
import TrainerDone from "../components/TrainerDone";
import Button from "../components/Button";
import Segmented from "../components/Segmented";
import ListRow from "../components/ListRow";
import { Stat } from "./StressTrainer";
import { sfx } from "../sfx";
import { setQuizActive } from "../nav";

const norm = (s) => String(s || "").trim().toLowerCase().replace(/ё/g, "е").replace(/[?!.,;:]+$/g, "");
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function buildItems(categories, ambiguous) {
  const items = [];
  for (const category of categories) {
    for (const word of category.words) {
      const existing = items.find((item) => item.word === word);
      const memberships = [category.id, ...(ambiguous[word] || [])];
      if (existing) {
        existing.cats = [...new Set([...existing.cats, ...memberships])];
        continue;
      }
      items.push({ word, cats: [...new Set(memberships)] });
    }
  }
  return items;
}

const answerTokens = (value) => String(value || "")
  .toLowerCase()
  .replace(/ё/g, "е")
  .replace(/[…?!.,;:«»“”‘’]+/g, " ")
  .trim()
  .split(/\s+/)
  .filter(Boolean);

function gradeTypedWords(value, words) {
  const input = answerTokens(value);
  const expected = [...new Set(words.map((word) => answerTokens(word).join(" ")).filter(Boolean))].sort((a, b) => b.split(" ").length - a.split(" ").length);
  const consumed = new Set();
  const matched = new Set();
  for (const term of expected) {
    const termTokens = term.split(" ");
    for (let start = 0; start <= input.length - termTokens.length; start++) {
      if (termTokens.some((_, offset) => consumed.has(start + offset))) continue;
      if (!termTokens.every((token, offset) => input[start + offset] === token)) continue;
      termTokens.forEach((_, offset) => consumed.add(start + offset));
      matched.add(term);
      break;
    }
  }
  const minimum = Math.min(5, expected.length);
  return matched.size >= minimum && consumed.size === input.length;
}

function makePick(catId, catMap, items) {
  const cat = catMap[catId];
  const target = shuffle(cat.words).slice(0, Math.min(5, cat.words.length));
  const distractors = shuffle(items.filter((item) => !item.cats.includes(catId) && !target.includes(item.word)).map((item) => item.word)).slice(0, Math.max(1, 6 - target.length));
  return { type: "pick", catId, words: shuffle([...target, ...distractors]), answer: target };
}

function makeName(item, categories) {
  const pool = shuffle(categories.map((category) => category.id).filter((id) => !item.cats.includes(id)));
  const optionCount = Math.min(6, Math.max(4, item.cats.length + 1));
  const options = [...new Set([...item.cats, ...pool.slice(0, optionCount - item.cats.length)])];
  return { type: "name", word: item.word, cats: item.cats, options: shuffle(options) };
}

function makeOdd(catId, catMap, items) {
  const cat = catMap[catId];
  const main = shuffle(cat.words).slice(0, 3);
  const dist = shuffle(items.filter((item) => !item.cats.includes(catId) && !main.includes(item.word)).map((item) => item.word))[0];
  if (!dist) return null;
  return { type: "odd", catId, words: shuffle([...main, dist]), answer: dist };
}

function buildItemsAll(categories) {
  const items = [];
  for (const category of categories) {
    for (const word of category.words) {
      const existing = items.find((item) => item.word === word);
      if (existing) {
        existing.cats = [...new Set([...existing.cats, category.id])];
        continue;
      }
      items.push({ word, cats: [category.id] });
    }
  }
  return items;
}

function buildDescQuestions(categories) {
  const structure = { simple: "простой", compound: "сложный", composite: "составной" };
  const deriv = { nonderived: "непроизводный", "noun-derived": "производный от сущ.", "adverb-derived": "производный от наречия", "verbal-derived": "отглагольный" };

  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const items = buildItemsAll(categories);

  const seen = new Set();
  const questions = [];

  for (const item of items) {
    const parts = [];
    for (const cid of item.cats) {
      if (structure[cid]) parts.push(structure[cid]);
      if (deriv[cid]) parts.push(deriv[cid]);
    }
    for (const cid of item.cats) {
      const cat = catById[cid];
      if (cat && cat.group === "По значению") parts.push(cat.title.toLowerCase());
    }
    if (!parts.length) continue;
    const desc = [...new Set(parts)].sort().join(", ");
    if (seen.has(desc)) continue;
    seen.add(desc);
    questions.push({ type: "type-desc", desc });
  }

  return shuffle(questions);
}

function buildQueue(level, categories, catMap, items, descItems = []) {
  if (level === "pick") return shuffle(categories.map((category) => makePick(category.id, catMap, items)));
  if (level === "name") return shuffle(items).map((item) => makeName(item, categories));
  if (level === "meaning") return shuffle(categories.filter((category) => category.group === "По значению").map((category) => ({ type: "type-word", catId: category.id })));
  if (level === "odd") return shuffle(categories.filter((category) => category.words.length >= 3).map((category) => makeOdd(category.id, catMap, items)).filter(Boolean));
  if (level === "desc") {
    return buildDescQuestions(categories);
  }
  const typed = categories.map((category) => ({ type: "type-word", catId: category.id }));
  const named = shuffle(items).slice(0, 12).map((item) => ({ type: "type-cat", word: item.word, cats: item.cats }));
  return shuffle([...typed, ...named]);
}

function catInline(id, catMap) {
  const category = catMap[id];
  return `${category.title}: ${category.desc} (${category.words.join(", ")})`;
}

let SEQ = 1;

export default function RanksTrainer({ level, categories, ambiguous = {}, categoryNames, slug, labels, notes = [], theory, descItems = [] }) {
  const { t } = useTheme();
  const navigate = useNavigate();
  const catMap = Object.fromEntries(categories.map((category) => [category.id, category]));
  const items = buildItems(categories, ambiguous);
  const queueRef = useRef([]);
  const wrongRef = useRef(new Set());
  const totalRef = useRef(0);
  const [tab, setTab] = useState("theory");
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
  const levels = [
    { id: "pick", icon: ListChecks, title: `${capitalize(labels.plural)} по разряду`, sub: `Выбери все ${labels.plural}, относящиеся к указанному разряду` },
    { id: "name", icon: Tag, title: `Разряд по ${labels.singular}`, sub: `Укажи разряд предложенного ${labels.singular}` },
    ...(categories.some((category) => category.group === "По значению") ? [{ id: "meaning", icon: PenLine, title: "По значению", sub: `Напиши ${labels.plural}, относящиеся к указанному значению` }] : []),
    { id: "type", icon: Keyboard, title: "Пиши вручную", sub: `Впиши разряд или ${labels.plural} без подсказок` },
    ...(slug === "prepositions" || descItems.length ? [{ id: "desc", icon: MessageSquareText, title: "По описанию", sub: "По характеристикам напиши подходящий предлог" }] : []),
  ];

  useEffect(() => {
    setQuizActive(tab === "train" && started && !done);
    return () => setQuizActive(false);
  }, [tab, started, done]);

  const next = () => {
    const queue = queueRef.current;
    setLocked(false);
    setVerdict(null);
    setSel(new Set());
    setInput("");
    if (queue.length === 0) {
      setCurrent(null);
      setDone(true);
      return;
    }
    setCurrent(queue.shift());
  };

  const start = (selectedLevel) => {
    setTab("train");
    queueRef.current = buildQueue(selectedLevel, categories, catMap, items, descItems);
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
    if (level) start(level);
  }, [level]);

  const reinsert = (question) => {
    const queue = queueRef.current;
    for (let n = 0; n < 2; n++) {
      const copy = { ...question, key: SEQ++ };
      const pos = Math.min(queue.length, Math.floor(Math.random() * (Math.min(8, queue.length) + 1)));
      queue.splice(pos, 0, copy);
    }
  };

  const descToCats = (desc) => {
    const d = String(desc || "").toLowerCase();
    const res = new Set();
    if (d.includes("простой")) res.add("simple");
    if (d.includes("сложный")) res.add("compound");
    if (d.includes("составной")) res.add("composite");
    if (d.includes("непроизводный")) res.add("nonderived");
    if (d.includes("производный от сущ")) res.add("noun-derived");
    if (d.includes("производный от наречия")) res.add("adverb-derived");
    if (d.includes("отглагольный")) res.add("verbal-derived");
    for (const c of categories) {
      if (c.group === "По значению" && d.includes(c.title.toLowerCase())) res.add(c.id);
    }
    return [...res];
  };

  const wrongLabel = (question) => {
    if (question.type === "pick") return `${catMap[question.catId].title}: ${question.answer.join(", ")}`;
    if (question.type === "name" || question.type === "type-cat") return question.word;
    if (question.type === "odd") return `лишнее — «${question.answer}»`;
    if (question.type === "type-desc") {
      const req = descToCats(question.desc);
      const all = items.filter((i) => req.every((r) => i.cats.includes(r))).map((i) => i.word);
      return [...new Set(all)].join(", ");
    }
    return catMap[question.catId].title;
  };

  const submit = (payload) => {
    if (locked || done || !current) return;
    setLocked(true);
    let correct = false;
    let explain = "";
    const question = current;
    if (question.type === "pick") {
      const got = new Set(payload);
      const answer = new Set(question.answer);
      correct = answer.size === got.size && [...answer].every((word) => got.has(word));
      explain = catMap[question.catId].desc;
    } else if (question.type === "name") {
      correct = question.cats.includes(payload);
      explain = question.cats.map((catId) => catInline(catId, catMap)).join(" · ");
    } else if (question.type === "odd") {
      correct = payload === question.answer;
      explain = catInline(question.catId, catMap);
    } else if (question.type === "type-word") {
      correct = gradeTypedWords(input, catMap[question.catId].words);
      explain = `Правильный ответ: ${catMap[question.catId].words.join(", ")}`;
    } else if (question.type === "type-desc") {
      const req = descToCats(question.desc);
      const w = norm(input);
      const item = items.find((i) => norm(i.word) === w);
      correct = !!(item && req.length && req.every((r) => item.cats.includes(r)));
      const all = items.filter((i) => req.every((r) => i.cats.includes(r))).map((i) => i.word);
      explain = `Правильный ответ: ${[...new Set(all)].join(", ")}`;
    } else {
      const accepted = norm(input);
      correct = question.cats.some((catId) => categoryNames[catId].includes(accepted));
      explain = `Правильный ответ: ${question.cats.map((catId) => catMap[catId].title).join(" или ")}`;
    }

    if (correct) {
      sfx.correct();
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setBestStreak((value) => Math.max(value, nextStreak));
    } else {
      sfx.wrong();
      setStreak(0);
      setMistakes((value) => value + 1);
      wrongRef.current.add(wrongLabel(question));
      reinsert(question);
    }
    setVerdict({ correct, explain, payload });
  };

  const remaining = current ? queueRef.current.length : 0;
  const progress = done ? 1 : Math.min(1, Math.max(0, (totalRef.current - remaining) / totalRef.current));

  const chipStyle = (word) => {
    if (verdict) {
      const isAnswer = Array.isArray(current.answer) ? current.answer.includes(word) : current.answer === word;
      if (isAnswer) return { border: t.success, background: t.successTint, color: t.success };
      if (typeof verdict.payload === "string" && verdict.payload === word) return { border: t.danger, background: t.dangerTint, color: t.danger };
      if (sel.has(word)) return { border: t.danger, background: t.dangerTint, color: t.danger };
    }
    if (sel.has(word)) return { border: t.invBg, background: t.invBg, color: t.inv };
    return { border: t.border, background: t.raised, color: t.text };
  };

  const optStyle = (catId) => {
    const isAnswer = current.cats.includes(catId);
    if (verdict && isAnswer) return { border: t.success, background: t.successTint, color: t.success };
    if (verdict && verdict.payload === catId) return { border: t.danger, background: t.dangerTint, color: t.danger };
    return { border: t.border, background: t.raised, color: t.text };
  };

  const renderTop = () => (
    <Segmented
      value={tab}
      onChange={setTab}
      options={[
        { v: "theory", label: "Теория" },
        { v: "train", label: "Тренажёр" },
      ]}
    />
  );

  if (tab === "theory") {
    return (
      <div style={{ paddingTop: 4 }}>
        {renderTop()}
        {theory ? (
          theory
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            {categories.map((category) => (
              <div key={category.id} style={{ borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, padding: "18px 18px 14px" }}>
                {category.group && <div style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{category.group}</div>}
                <div style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{category.title}</div>
                <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{category.desc}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {category.words.map((word) => (
                    <span key={word} style={{ fontSize: 13, fontWeight: 600, color: t.text, border: `1px solid ${t.border}`, background: t.raised, padding: "5px 12px", borderRadius: 999 }}>
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {notes.map((note) => (
              <div key={note.title} style={{ borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, padding: "18px 18px 14px" }}>
                <div style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{note.title}</div>
                <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.5 }}>{note.text}</div>
              </div>
            ))}
          </div>
        )}
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
        {levels.map((item, i) => (
          <ListRow
            key={item.id}
            idx={i}
            icon={<item.icon size={22} color={t.text} />}
            title={item.title}
            sub={item.sub}
            onClick={() => navigate(`/trainer/${slug}/${item.id}`, { state: { from: `/trainer/${slug}` } })}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 4 }}>
      {done ? (
        <TrainerDone
          mistakes={mistakes}
          total={totalRef.current}
          secondLabel="Лучшая серия"
          secondValue={bestStreak}
          scoreLabel="заданий пройдено"
          wrongItems={[...wrongRef.current].map((word) => ({ key: word, label: word, badge: "повторить" }))}
          emptyMsg={labels.empty}
          onRetry={() => start(level)}
          onBack={() => navigate(`/trainer/${slug}`, { state: { from: labels.backTo } })}
          backLabel="Вернуться к тренажёру"
        />
      ) : (
        <div style={{ padding: "28px 18px", borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, textAlign: "center" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <Stat label="Серия" value={streak} tint={t.success} />
            <Stat label="Осталось" value={remaining} />
            <Stat label="Ошибки" value={mistakes} tint={t.danger} />
          </div>
          <ProgressBar value={progress} />

          {current.type === "pick" && (
            <>
              {!verdict && <div style={{ color: t.sub, fontSize: 13, marginBottom: 16 }}>{catMap[current.catId].title}. Выбери все, что подходят</div>}
              <div style={{ color: t.text, fontSize: 18, fontWeight: 700, marginBottom: 18 }}>{catMap[current.catId].title}</div>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 20 }}>
                {current.words.map((word) => {
                  const style = chipStyle(word);
                  return (
                    <button
                      key={word}
                      type="button"
                      className={verdict ? undefined : "press"}
                      onClick={() => !locked && setSel((prev) => { const next = new Set(prev); if (next.has(word)) next.delete(word); else next.add(word); return next; })}
                      disabled={locked}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 999,
                        border: `1px solid ${style.border}`,
                        background: style.background,
                        color: style.color,
                        fontSize: 15,
                        fontWeight: 600,
                        fontFamily: "inherit",
                        cursor: verdict ? "default" : "pointer",
                        transition: "background .15s, color .15s, border-color .15s",
                      }}
                    >
                      {word}
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
                {current.options.map((catId) => {
                  const style = optStyle(catId);
                  return (
                    <button
                      key={catId}
                      type="button"
                      className={verdict ? undefined : "press"}
                      onClick={() => submit(catId)}
                      disabled={locked}
                      style={{
                        padding: "14px 12px",
                        minHeight: 54,
                        borderRadius: 14,
                        border: `1px solid ${style.border}`,
                        background: style.background,
                        color: style.color,
                        fontSize: 17,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        cursor: verdict ? "default" : "pointer",
                        transition: "background .15s, color .15s, border-color .15s",
                      }}
                    >
                      {catMap[catId].title}
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
                {current.words.map((word) => {
                  const style = chipStyle(word);
                  return (
                    <button
                      key={word}
                      type="button"
                      className={verdict ? undefined : "press"}
                      onClick={() => submit(word)}
                      disabled={locked}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 999,
                        border: `1px solid ${style.border}`,
                        background: style.background,
                        color: style.color,
                        fontSize: 15,
                        fontWeight: 600,
                        fontFamily: "inherit",
                        cursor: verdict ? "default" : "pointer",
                        transition: "background .15s, color .15s, border-color .15s",
                      }}
                    >
                      {word}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {current.type === "type-word" && (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 4 }}>{catMap[current.catId].title}</div>
              {!verdict && <div style={{ color: t.sub, fontSize: 13, marginBottom: 16 }}>{level === "meaning" ? "Напиши предлоги этого значения" : "Введи слова этого разряда"} через запятую или пробел (минимум {Math.min(5, catMap[current.catId].words.length)})</div>}
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
                  placeholder={labels.wordPlaceholder}
                />
                {!verdict && <Button>Ответить</Button>}
              </form>
            </>
          )}

          {current.type === "type-cat" && (
            <>
              {!verdict && <div style={{ color: t.sub, fontSize: 13, marginBottom: 16 }}>Напиши разряд этого {labels.singular}</div>}
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
                  placeholder={labels.categoryPlaceholder}
                />
                {!verdict && <Button>Ответить</Button>}
              </form>
            </>
          )}

          {current.type === "type-desc" && (
            <>
              {!verdict && <div style={{ color: t.sub, fontSize: 13, marginBottom: 16 }}>Напиши предлог по описанию</div>}
              <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 18, lineHeight: 1.6 }}>{current.desc}</div>
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
                  placeholder="например, от"
                />
                {!verdict && <Button>Ответить</Button>}
              </form>
            </>
          )}

          {verdict && (
            <div className="swap">
              <div style={{ color: verdict.correct ? t.success : t.danger, fontSize: 15, fontWeight: 700, marginTop: 14 }}>
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
