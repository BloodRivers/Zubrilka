import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import ProgressBar from "../components/ProgressBar";
import TrainerDone from "../components/TrainerDone";
import Button from "../components/Button";
import Segmented from "../components/Segmented";
import BackToTop from "../components/BackToTop";
import Stat from "../components/Stat";
import { TRAINER_LIST } from "../data/trainers";
import useQuizQueue from "../hooks/useQuizQueue";
import { setQuizActive } from "../nav";
import { ROOT_ITEMS } from "../data/roots";

const TOTAL = ROOT_ITEMS.length;

const THEME_GROUPS = [
  { title: "Гар/гор, Клан/клон, Твар/твор", desc: "Под ударением пишется то, что слышится, без ударения — О.", words: ["загреть", "загар", "клоняться", "поклониться", "творить", "творец"], exceptions: ["пригарь", "кланяющийся", "поклон", "поклонение", "утварь"] },
  { title: "Зар/зор", desc: "Без ударения пишется А, под ударением — О.", words: ["зарница"], exceptions: ["заря", "зарево", "зорька"] },
];

const SUFFIX_GROUPS = [
  { title: "Бер/бир, Дер/дир, Мер/мир, Пер/пир, Тер/тир", desc: "Есть суффикс -а- → И, нет суффикса -а- → Е.", words: ["собирать", "соберу", "замереть", "замирать", "протереть", "выдеру"] },
  { title: "Блест/блист, Жег/жиг, Стел/стил, Чет/чит", desc: "Есть суффикс -а- → И, нет суффикса -а- → Е.", words: ["блистать", "блестеть", "зажечь", "поджигать", "расстилать", "вычтет"], exceptions: ["сочетать", "сочетание"] },
  { title: "Кас/кос, Жим/жм", desc: "Есть суффикс -а- → А (И), нет суффикса -а- → О (Я).", words: ["касаться", "прикоснуться", "сжимать", "сжать"] },
];

const CONS_GROUPS = [
  { title: "Раст/ращ/рос", desc: "Перед СТ и Щ пишется А, перед С — О.", words: ["растение", "наращивать", "выросший"], exceptions: ["росток", "ростовщик", "Ростов", "Ростислав", "отрасль", "на вырост"] },
  { title: "Лаг/лож", desc: "Перед Г пишется А, перед Ж — О.", words: ["полагать", "предположение", "сложение", "излагать"], exceptions: ["пОлог"] },
  { title: "Скак/скоч", desc: "Перед К пишется А, перед Ч — О.", words: ["скакать", "выскочить"], exceptions: ["скачок", "скачу"] },
];

const MEANING_GROUPS = [
  { title: "Мак/мок", desc: "МАК — погружать в жидкость, МОК — пропускать жидкость, становиться мокрым.", words: ["обмакнуть", "вымокнуть", "промокнуть"] },
  { title: "Равн/ровн", desc: "РАВН — равный, одинаковый; РОВН — ровный, гладкий.", words: ["сравнить числа", "выровнять поверхность"], exceptions: ["равнина", "ровесник", "уровень", "поровну"] },
  { title: "Плав/плов/плыв", desc: "Без ударения пишется ПЛАВ.", words: [], exceptions: ["пловец", "пловчиха", "плывуны"] },
];

const IMIN_GROUPS = [
  { title: "Им/ин", desc: "А/я чередуются с ИМ/ИН: перед суффиксом -а- пишется ИМ, без суффикса — Я.", words: ["снимать", "снять", "обнимать", "понять"] },
];

const THEORY = [...THEME_GROUPS, ...SUFFIX_GROUPS, ...CONS_GROUPS, ...MEANING_GROUPS, ...IMIN_GROUPS];

export default function RootsTrainer() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { slug } = useParams();
  const trainer = TRAINER_LIST.find((x) => x.id === slug);
  const inputRef = useRef(null);
  const [tab, setTab] = useState("theory");
  const [input, setInput] = useState("");
  const [locked, setLocked] = useState(false);
  const quiz = useQuizQueue(ROOT_ITEMS, (item) => item.text.replace("•", item.answer));
  const { current, verdict, streak, bestStreak, mistakes, done, remaining, wrongItems, grade } = quiz;

  useEffect(() => {
    setQuizActive(tab === "train" && !done);
    return () => setQuizActive(false);
  }, [tab, done]);

  const focus = () => inputRef.current?.focus();

  const next = () => {
    quiz.next();
    setLocked(false);
    setInput("");
    focus();
  };

  const start = () => {
    quiz.start();
    setInput("");
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
    grade(v === current.answer);
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

  const progress = done ? 1 : Math.min(1, Math.max(0, 1 - remaining / TOTAL));

  const [before, after] = current ? current.text.split("•") : ["", ""];

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
        <BackToTop />
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
              {g.exceptions?.length > 0 && (
                <div style={{ marginTop: 12, padding: "11px 12px", borderRadius: 14, border: `1px solid ${t.danger}`, background: t.dangerTint }}>
                  <div style={{ color: t.danger, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", marginBottom: 8, textTransform: "uppercase" }}>
                    Исключения
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {g.exceptions.map((w) => (
                      <span key={w} style={{ fontSize: 13, fontWeight: 700, color: t.text, border: `1px solid ${t.danger}`, background: t.surface, padding: "4px 10px", borderRadius: 999 }}>
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div style={{ borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, padding: "18px 18px 14px" }}>
            <div style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Проверяемые и словарные</div>
            <div style={{ color: t.sub, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
              Если гласная в корне проверяется ударением (лесной — лес) — это проверяемая, а если нет (аккуратный) — словарное слово, его нужно запомнить. В тренажёре есть и такие слова.
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
        <Stat label="Серия" value={streak} tint={t.success} />
        <Stat label="Осталось" value={remaining} />
        <Stat label="Ошибки" value={mistakes} tint={t.danger} />
      </div>
      <ProgressBar value={progress} />

      {done ? (
        <TrainerDone
          mistakes={mistakes}
          total={TOTAL}
          secondLabel="Лучшая серия"
          secondValue={bestStreak}
          scoreLabel="слов пройдено"
          wrongItems={wrongItems.map((w) => ({ key: w, label: w, badge: "повторить" }))}
          emptyMsg="Все слова усвоены уверенно."
          onRetry={start}
          onBack={trainer?.useSubject ? () => navigate(`/use/${trainer.useSubject}`) : null}
          backLabel="Вернуться к ЕГЭ"
        />
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
                border: `2px solid ${verdict ? (verdict.correct ? t.success : t.danger) : t.border}`,
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
              <div style={{ color: verdict.correct ? t.success : t.danger, fontSize: 15, fontWeight: 700, marginTop: 14 }}>
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