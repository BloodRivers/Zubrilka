import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import ProgressBar from "../components/ProgressBar";
import Button from "../components/Button";
import Segmented from "../components/Segmented";
import { Stat, TRAINER_LIST } from "./StressTrainer";
import { sfx } from "../sfx";
import { setQuizActive } from "../nav";
import { ROOT_ITEMS } from "../data/roots";

const TOTAL = ROOT_ITEMS.length;

const THEME_GROUPS = [
  { title: "Гар/гор, Клан/клон, Твар/твор", desc: "Под ударением пишется А, без ударения — О.", words: ["заг•реть (о)", "заг•р (а)", "кл•няться (а)", "покл•ниться (о)", "тв•рить (о)", "тв•рец (о)"] },
  { title: "Зар/зор", desc: "Без ударения пишется А, под ударением — О. Исключение: з•ревать (зоревать).", words: ["з•ря (а)", "з•рница (а)", "з•ревать (о — искл.)"] },
];

const SUFFIX_GROUPS = [
  { title: "Бер/бир, Дер/дир, Мер/мир, Пер/пир, Тер/тир", desc: "Есть суффикс -а- → И, нет суффикса -а- → Е.", words: ["соб•рать (и)", "соб•ру (е)", "зам•реть (е)", "зами•рать (и)", "прот•реть (е)", "выд•ру (е)"] },
  { title: "Блест/блист, Жег/жиг, Стел/стил, Чет/чит", desc: "Есть суффикс -а- → И, нет суффикса -а- → Е.", words: ["бл•стать (и)", "бл•стеть (е)", "заж•чь (е)", "подж•гать (и)", "расст•лать (и)", "выч•т (е)"] },
  { title: "Кас/кос, Жим/жм", desc: "Есть суффикс -а- → А (И), нет суффикса -а- → О (Я).", words: ["к•саться (а)", "прик•снуться (о)", "сж•мать (и)", "сж•ть (я)"] },
];

const CONS_GROUPS = [
  { title: "Раст/ращ/рос", desc: "Перед СТ и Щ пишется А, перед С — О. Исключения: р•сток (росток), отрасль, Ростов.", words: ["р•стение (а)", "нар•щивать (а)", "выр•сший (о)", "р•сток (о — искл.)"] },
  { title: "Лаг/лож", desc: "Перед Г пишется А, перед Ж — О.", words: ["пол•гать (а)", "предпол•жение (о)", "сл•жение (о)", "изл•гать (а)"] },
  { title: "Скак/скоч", desc: "Перед К пишется А, перед Ч — О. Исключение: ск•чок (скачок), скачу.", words: ["ск•кать (а)", "выск•чить (о)", "ск•чок (а — искл.)"] },
];

const MEANING_GROUPS = [
  { title: "Мак/мок", desc: "МАК — погружать в жидкость, МОК — пропускать жидкость, становиться мокрым.", words: ["обм•кнуть (а)", "вым•кнуть (о)", "пром•кнуть (о)"] },
  { title: "Равн/ровн", desc: "РАВН — равный, одинаковый; РОВН — ровный, гладкий.", words: ["ср•внить числа (а)", "выр•внять поверхность (о)"] },
  { title: "Плав/плов/плыв", desc: "Пишется ПЛАВ. Исключения: пл•вец (пловец), пл•вчиха (пловчиха), плывуны.", words: ["пл•вец (о — искл.)", "пл•вчиха (о — искл.)"] },
];

const IMIN_GROUPS = [
  { title: "Им/ин", desc: "А/я чередуются с ИМ/ИН: перед суффиксом -а- пишется ИМ, без суффикса — Я.", words: ["сн•мать (и)", "сн•ть (я)", "обн•мать (и)", "пон•ть (я)"] },
];

const THEORY = [...THEME_GROUPS, ...SUFFIX_GROUPS, ...CONS_GROUPS, ...MEANING_GROUPS, ...IMIN_GROUPS];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function RootsTrainer() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { slug } = useParams();
  const trainer = TRAINER_LIST.find((x) => x.id === slug);
  const queueRef = useRef([]);
  const wrongRef = useRef(new Set());
  const inputRef = useRef(null);
  const [tab, setTab] = useState("train");
  const [current, setCurrent] = useState(null);
  const [input, setInput] = useState("");
  const [locked, setLocked] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setQuizActive(tab === "train" && !done);
    return () => setQuizActive(false);
  }, [tab, done]);

  const focus = () => inputRef.current?.focus();

  const next = () => {
    const q = queueRef.current;
    setLocked(false);
    setVerdict(null);
    setInput("");
    if (q.length === 0) {
      setCurrent(null);
      setDone(true);
      return;
    }
    setCurrent(q.shift());
    focus();
  };

  const start = () => {
    queueRef.current = shuffle(ROOT_ITEMS);
    wrongRef.current = new Set();
    setStreak(0);
    setBestStreak(0);
    setMistakes(0);
    setDone(false);
    next();
  };

  useEffect(() => {
    if (!current && !done) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (current && !done) focus();
  }, [current, done]);

  const submit = (value) => {
    if (locked || done || !current) return;
    const v = (value ?? input).toLowerCase();
    if (!/^[а-яё]$/.test(v)) return;
    setLocked(true);
    const correct = v === current.answer;
    if (correct) {
      sfx.correct();
      setStreak((s) => s + 1);
      setBestStreak((b) => Math.max(b, streak + 1));
    } else {
      sfx.wrong();
      setStreak(0);
      setMistakes((m) => m + 1);
      wrongRef.current.add(current.text.replace("•", current.answer));
      const q = queueRef.current;
      for (let n = 0; n < 2; n++) {
        const copy = { ...current };
        const pos = Math.min(q.length, Math.floor(Math.random() * (Math.min(8, q.length) + 1)));
        q.splice(pos, 0, copy);
      }
    }
    setVerdict({ correct });
    focus();
  };

  const onKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (verdict) next();
      else submit();
    }
  };

  if (!current && !done) return null;

  const remaining = queueRef.current.length;
  const progress = done ? 1 : Math.min(1, Math.max(0, 1 - remaining / TOTAL));

  const [before, after] = current ? current.text.split("•") : ["", ""];

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
          {THEORY.map((g) => (
            <div key={g.title} style={{ borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, padding: "18px 18px 14px" }}>
              <div style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{g.title}</div>
              <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{g.desc}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {g.words.map((w) => (
                  <span key={w} style={{ fontSize: 13, fontWeight: 600, color: t.text, border: `1px solid ${t.border}`, background: t.raised, padding: "5px 12px", borderRadius: 999 }}>
                    {w}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div style={{ borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, padding: "18px 18px 14px" }}>
            <div style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Проверяемые и словарные</div>
            <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
              Если гласная в корне проверяется ударением (л•сной — лес) — это проверяемая, а если нет (акк•ратный) — словарное слово, его нужно запомнить. В тренажёре есть и такие слова.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!current && !done) return null;

  return (
    <div style={{ paddingTop: 4 }}>
      {renderTop()}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, marginTop: 12 }}>
        <Stat label="Серия" value={streak} tint="#46A758" />
        <Stat label="Осталось" value={remaining} />
        <Stat label="Ошибки" value={mistakes} tint="#E5484D" />
      </div>
      <ProgressBar value={progress} />

      {done ? (
        <div style={{ paddingTop: 12 }}>
          <div style={{ color: t.sub, fontSize: 13, marginBottom: 6 }}>Итог тренажёра</div>
          {mistakes === 0 ? (
            <div style={{ color: "#46A758", fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Без ошибок — отлично!</div>
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
              <div style={{ color: t.text, fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em" }}>{TOTAL}</div>
              <div style={{ color: t.sub, fontSize: 15 }}>слов пройдено</div>
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
            <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>Все слова усвоены уверенно.</div>
          )}
          <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 10 }}>
            {trainer?.egeSubject && (
              <Button variant="dashed" onClick={() => navigate(`/ege/${trainer.egeSubject}`)}>
                Вернуться к ЕГЭ
              </Button>
            )}
            <Button onClick={start}>Ещё раз</Button>
          </div>
        </div>
      ) : (
        <div style={{ padding: "32px 20px", borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, textAlign: "center" }}>
          {!verdict && (
            <div style={{ color: t.sub, fontSize: 13, marginBottom: 18 }}>
              Введи пропущенную букву и нажми Enter
            </div>
          )}
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "0.03em", minHeight: 48, color: t.text }}>
            {before}
            <span style={{ borderBottom: `2.5px solid ${t.invBg}`, padding: "0 10px", minWidth: 26, display: "inline-block" }}>
              {input ? input.toUpperCase() : "\u00A0"}
            </span>
            {after}
          </div>
          <div style={{ marginTop: 24 }}>
            <input
              ref={inputRef}
              value={input}
              maxLength={1}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              onKeyDown={onKey}
              onChange={(e) => {
                const v = e.target.value.slice(-1).toLowerCase();
                setInput(v);
                if (v && !locked && !verdict) submit();
              }}
              style={{
                width: 82,
                height: 64,
                border: `2px solid ${verdict ? (verdict.correct ? "#46A758" : "#E5484D") : t.border}`,
                borderRadius: 12,
                textAlign: "center",
                fontSize: 36,
                fontWeight: 700,
                outline: "none",
                color: t.text,
                background: t.raised,
                fontFamily: "inherit",
                caretColor: t.text,
              }}
            />
          </div>
          {verdict && (
            <div className="swap">
              <div style={{ color: verdict.correct ? "#46A758" : "#E5484D", fontSize: 15, fontWeight: 700, marginTop: 14 }}>
                {verdict.correct ? "Верно." : `Ошибка. Правильно: ${current.answer.toUpperCase()}.`}
              </div>
              <div style={{ color: t.text, fontSize: 13, lineHeight: 1.55, marginTop: 8, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
                {current.explanation}
              </div>
              {!verdict.correct && (
                <div style={{ color: t.sub, fontSize: 12, marginTop: 6 }}>Слово вернётся ещё дважды.</div>
              )}
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