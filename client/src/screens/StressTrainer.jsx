import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import { shuffle } from "../utils";
import ProgressBar from "../components/ProgressBar";
import TrainerDone from "../components/TrainerDone";
import Button from "../components/Button";
import { sfx } from "../sfx";
import { setQuizActive } from "../nav";

const RAW_WORDS = [
"отзЫв","Отрочество","партЕр","портфЕль","пОручни","придАное","призЫв","свЁкла","сирОты","сиротА",
"созЫв","сосредотОчение","срЕдства","срЕдство","стАтуя","столЯр","тамОжня","тОрты","тУфля","цемЕнт",
"цЕнтнер","цепОчка","шАрфы","шофЁр","экспЕрт",
"вернА","вЕрный","знАчимый","красИвее","красИвый","красИвейший","кУхонный","ловкА","лОвкий","мозаИчный",
"оптОвый","прозорлИвый","прозорлИва","слИвовый",
"бралА","брАть","бралАсь","брАться","взялА","взЯть","взялАсь","взЯться","влилАсь","влИться",
"ворвалАсь","ворвАться","воспринЯть","воспринялА","воссоздалА","воссоздАть","оклЕить","окружИт","окружИть","опОшлить",
"освЕдомиться","освЕдомится","отбылА","отбЫть","отдалА","отдАть","откУпорить","отозвалА","отозвАть","отозвалАсь",
"отозвАться","перезвонИт","перезвонИть","перелилА","перелИть","плодоносИть","пломбировАть","повторИт","повторИть","позвалА",
"позвАть","позвонИт","позвонИть","полилА","полИть","положИть","положИл","понЯть","понялА","послАла",
"послАть","прибЫть","прИбыл","прибылА","прИбыли","принЯть","прИнял","принялА","прИняли","рвалА",
"рвАть","сверлИт","сверлИть","снялА","снЯть","совралА","соврАть","создалА","создАть","сорвалА",
"сорвАть","сорИт","сорИть","убралА","убрАть","углубИть","укрепИт","укрепИть","чЕрпать","щемИт",
"щемИть","щЁлкать",
"довезЁнный","зАгнутый","зАнятый","занятА","зАпертый","заселЁнный","заселенА","кормЯщий","кровоточАщий","нажИвший","налИвший"
];

const R_PAST_FEM = "Ударение в прошедшем времени этого глагола: в форме женского рода оно переходит на окончание -А, а в мужском, среднем роде и множественном числе остаётся на корне.";
const R_PAST_BASE = "В этой форме (инфинитив, мужской/средний род, множественное число) ударение стоит на корне или суффиксе. Смещается оно только в форме женского рода прошедшего времени.";
const R_CONJ_END = "Глагол II спряжения на -ить: в личных формах ударение падает на окончание, как в «звонИт», «повторИт» — частая ошибка ставить его на корень.";
const R_ADJ_SHORT_FEM = "В краткой форме женского рода ударение переходит на окончание. В остальных формах (полной, мужском, среднем роде, множественном числе) оно остаётся на корне.";
const R_YO = "Буква «ё» в русском языке всегда ударная — других вариантов произношения у неё нет.";
const R_BORROWED = "Слово заимствованное (чаще из французского), и в языке-источнике ударение исторически падало на последний слог — так оно и закрепилось в русском.";
const R_COMPARATIVE = "Сравнительная и превосходная степень сохраняют то же место ударения, что и исходное прилагательное в положительной степени.";
const R_PARTICIPLE_ACTIVE = "Причастие сохраняет ударение той формы глагола, от которой оно образовано.";
const R_NOUN_FIXED = "У этого существительного ударение остаётся на корне и в единственном, и во множественном числе — оно не смещается на окончание.";
const R_LEXICAL = "Чёткого правила нет — это словарная норма, которую нужно запомнить как есть.";

const EXPLANATIONS = {};
[
  [["бралА","взялА","бралАсь","взялАсь","влилАсь","ворвалАсь","воспринялА","воссоздалА","отбылА","отдалА",
    "отозвалА","отозвалАсь","перелилА","позвалА","полилА","понялА","послАла","прибылА","принялА","рвалА",
    "снялА","совралА","создалА","сорвалА","убралА"], R_PAST_FEM],
  [["брАть","взЯть","взЯться","влИться","ворвАться","воспринЯть","воссоздАть","отбЫть","отдАть","отозвАть",
    "отозвАться","перелИть","позвАть","полИть","понЯть","послАть","прибЫть","принЯть","рвАть","снЯть",
    "соврАть","создАть","сорвАть","убрАть"], R_PAST_BASE],
  [["окружИт","окружИть","перезвонИт","перезвонИть","повторИт","повторИть","позвонИт","позвонИть",
    "сверлИт","сверлИть","сорИт","сорИть","укрепИт","укрепИть","щемИт","щемИть","положИть"], R_CONJ_END],
  [["вернА","ловкА","занятА","заселенА"], R_ADJ_SHORT_FEM],
  [["свЁкла","шофЁр","довезЁнный","заселЁнный","щЁлкать"], R_YO],
  [["партЕр","портфЕль","экспЕрт","цемЕнт"], R_BORROWED],
  [["красИвее","красИвейший"], R_COMPARATIVE],
  [["кормЯщий","кровоточАщий","нажИвший","налИвший"], R_PARTICIPLE_ACTIVE],
  [["тОрты","шАрфы","срЕдства","срЕдство"], R_NOUN_FIXED],
].forEach(([list, rule]) => list.forEach((w) => (EXPLANATIONS[w] = rule)));

const OVERRIDES = {
  "отзЫв": "Здесь это отглагольное существительное («отозвАть посла» — отзЫв), ударение на суффиксе, как в «призЫв», «созЫв». Слово «Отзыв» в значении «мнение, рецензия» — омограф с ударением на первом слоге.",
  "призЫв": "Отглагольное существительное с ударением на суффиксе -ыв, как «отзЫв», «созЫв».",
  "созЫв": "Отглагольное существительное с ударением на суффиксе -ыв, как «отзЫв», «призЫв».",
  "сирОты": "Во множественном числе ударение переходит на корень. В единственном числе (сиротА) оно стоит на окончании — ударение здесь подвижное.",
  "сиротА": "В единственном числе ударение на окончании. Во множественном числе (сирОты) оно перемещается на корень — ударение здесь подвижное.",
  "прИбыл": "В мужском роде прошедшего времени ударение уходит на приставку — исключение из общей модели «инфинитив = корень, женский род = окончание».",
  "прИбыли": "Во множественном числе прошедшего времени ударение, как и в мужском роде, стоит на приставке.",
  "прИнял": "В мужском роде прошедшего времени ударение уходит на приставку — та же модель, что у «прИбыл».",
  "прИняли": "Во множественном числе прошедшего времени ударение стоит на приставке, как и в мужском роде.",
  "положИл": "В мужском роде прошедшего времени этот глагол сохраняет то же ударение на окончании, что и в инфинитиве «положИть» — женский род сюда не смещает ударение на корень.",
  "освЕдомиться": "Исключение из модели глаголов на -ить: ударение остаётся на корне во всех формах, не переходя на окончание, как у «звонИть».",
  "освЕдомится": "Та же модель, что у «освЕдомиться»: ударение на корне сохраняется и в личной форме.",
  "прозорлИва": "Исключение: краткая форма женского рода здесь не смещает ударение на окончание, в отличие от «вернА», «ловкА» — стоит на том же слоге, что и в полной форме.",
  "оклЕить": "Ударение на корне сохраняется во всех формах, инфинитив не смещает его на окончание.",
  "опОшлить": "Ударение на корне сохраняется во всех формах — частая ошибка произносить «опошлИть».",
  "откУпорить": "Ударение на корне сохраняется во всех формах, как у «отковырять»-подобных приставочных глаголов.",
  "плодоносИть": "Ударение на суффиксе -и- закреплено во всех формах инфинитива.",
  "пломбировАть": "Глаголы на -ировать в этой группе сохраняют ударение на суффиксе -ова-/-ирова-.",
  "углубИть": "Ударение на окончании закреплено во всех формах — частая ошибка произносить «углУбить».",
  "чЕрпать": "Ударение на корне сохраняется во всех формах — частая ошибка произносить «черпАть».",
  "заселенА": "Краткая форма женского рода причастия «заселённый»: ударение переходит на окончание, как у «занятА».",
  "зАнятый": "В полной форме и в мужском/среднем роде, множественном числе ударение на корне. В краткой форме женского рода (занятА) оно уходит на окончание.",
  "зАгнутый": "Ударение на корне сохраняется во всех формах причастия.",
  "зАпертый": "Ударение на корне в полной форме, как у «зАнятый» — в краткой женской форме той же модели оно сместилось бы на окончание.",
  "тУфля": "Словарная норма, ударение на первом слоге — частая ошибка говорить «туфлЯ».",
  "стАтуя": "Словарная норма, ударение на первом слоге.",
  "столЯр": "Словарная норма, ударение на последнем слоге, как у «малЯр».",
  "тамОжня": "Словарная норма, ударение на втором слоге.",
  "цЕнтнер": "Словарная норма, ударение на первом слоге.",
  "цепОчка": "Словарная норма, ударение на втором слоге.",
  "пОручни": "Словарная норма, ударение на первом слоге.",
  "придАное": "Словарная норма, ударение на втором слоге — частая ошибка говорить «приданнОе».",
  "Отрочество": "Словарная норма, ударение на первом слоге, как у «Отрок».",
  "сосредотОчение": "Словарная норма, ударение на четвёртом слоге — частая ошибка говорить «сосредоточЕние».",
  "знАчимый": "Словарная норма, ударение на первом слоге.",
  "кУхонный": "Словарная норма, ударение на первом слоге — частая ошибка говорить «кухОнный».",
  "мозаИчный": "Словарная норма, ударение на третьем слоге.",
  "оптОвый": "Словарная норма, ударение на втором слоге — частая ошибка говорить «Оптовый».",
  "прозорлИвый": "Словарная норма, ударение на третьем слоге.",
  "слИвовый": "Словарная норма, ударение на первом слоге — частая ошибка говорить «сливОвый».",
  "красИвый": "Ударение на корне сохраняется во всех степенях сравнения этого прилагательного.",
  "вЕрный": "Полная форма сохраняет ударение на корне; в краткой форме женского рода (вернА) оно уходит на окончание.",
  "лОвкий": "Полная форма сохраняет ударение на корне; в краткой форме женского рода (ловкА) оно уходит на окончание."
};
Object.keys(OVERRIDES).forEach((w) => (EXPLANATIONS[w] = OVERRIDES[w]));

const VOWELS = "аеёиоуыэюя";

function parseWord(raw) {
  const upperMatch = raw.match(/[А-ЯЁ]/);
  return { raw, display: raw.toLowerCase(), stressIndex: upperMatch.index, explain: EXPLANATIONS[raw] || R_LEXICAL };
}

const WORD_BANK = RAW_WORDS.map(parseWord);
const TOTAL = WORD_BANK.length;

export const TRAINER_LIST = [
  { id: "stress", title: "Тренажёр ударений", sub: "Орфоэпический словник ЕГЭ — выбери ударную гласную", useSubject: "russian" },
  { id: "paronyms", title: "Паронимы", sub: "Словник ЕГЭ — выбери слово по смыслу контекста", useSubject: "russian" },
  { id: "pronouns", title: "Разряды местоимений", sub: "Личные, возвратное, притяжательные и другие разряды — выбери уровень", useSubject: "russian" },
  { id: "adverbs", title: "Разряды наречий", sub: "Указательные, вопросительные, относительные и другие разряды — выбери уровень", useSubject: "russian" },
  { id: "conjunctions", title: "Разряды союзов", sub: "Сочинительные, подчинительные и другие союзы — выбери уровень", useSubject: "russian" },
  { id: "prepositions", title: "Разряды предлогов", sub: "По структуре, производности и значению — выбери уровень", useSubject: "russian" },
  { id: "particles", title: "Разряды частиц", sub: "Смысловые и формообразующие частицы — выбери уровень", useSubject: "russian" },
  { id: "roots", title: "Корни", sub: "Чередующиеся корни гер/гор, бер/бир и другие — введи пропущенную букву", useSubject: "russian" },
  { id: "speech-styles", title: "Стили речи", sub: "Определи стиль по цели, ситуации и языковым признакам", useSubject: "russian" },
  { id: "prepri", title: "Правописание ПРЕ- и ПРИ-", sub: "Словник задания 10 — введи пропущенную приставку", useSubject: "russian" },
  { id: "inf-task2", title: "Таблицы истинности", sub: "Задание 2 ЕГЭ — восстанови столбцы по фрагменту таблицы", useSubject: "informatics" },
];

export function Stat({ label, value, tint }) {
  const { t } = useTheme();
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "8px 6px",
        borderRadius: 14,
        background: t.raised,
        border: `1px solid ${tint ? tint : t.border}`,
        opacity: tint ? 1 : undefined,
      }}
    >
      <span style={{ color: tint || t.sub, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <span style={{ color: t.text, fontSize: 18, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

export default function StressTrainer() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { slug } = useParams();
  const trainer = TRAINER_LIST.find((t) => t.id === slug) || TRAINER_LIST[0];
  const queueRef = useRef([]);
  const wrongWordsRef = useRef(new Set());
  const [current, setCurrent] = useState(null);
  const [mistakes, setMistakes] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [locked, setLocked] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setQuizActive(!done);
    return () => setQuizActive(false);
  }, [done]);

  const next = () => {
    const q = queueRef.current;
    setLocked(false);
    setVerdict(null);
    if (q.length === 0) {
      setCurrent(null);
      setDone(true);
      return;
    }
    setCurrent(q.shift());
  };

  const start = () => {
    queueRef.current = shuffle(WORD_BANK);
    wrongWordsRef.current = new Set();
    setMistakes(0);
    setStreak(0);
    setBestStreak(0);
    setDone(false);
    next();
  };

  useEffect(() => {
    if (!queueRef.current.length) start();
  }, []);

  const answer = (idx) => {
    if (locked || done || !current) return;
    setLocked(true);
    const correct = idx === current.stressIndex;
    if (correct) {
      sfx.correct();
      const ns = streak + 1;
      setStreak(ns);
      setBestStreak((b) => Math.max(b, ns));
    } else {
      sfx.wrong();
      setStreak(0);
      setMistakes((m) => m + 1);
      wrongWordsRef.current.add(current.raw);
      const q = queueRef.current;
      const pos1 = Math.min(q.length, 3 + Math.floor(Math.random() * 3));
      const pos2 = Math.min(q.length, 6 + Math.floor(Math.random() * 4));
      q.splice(pos1, 0, current);
      q.splice(Math.min(pos2 + 1, q.length), 0, current);
    }
    setVerdict({ correct, explain: current.explain, pickedIdx: idx });
  };

  if (!current && !done) return null;

  const remaining = queueRef.current.length;
  const progress = done ? 1 : Math.min(1, Math.max(0, 1 - remaining / TOTAL));

  const letterStyle = (ch, idx) => {
    const isCorrectSpot = verdict && current.stressIndex === idx;
    let color = t.text;
    let border = "transparent";
    let bg = "transparent";
    if (isCorrectSpot) {
      bg = t.successTint;
      border = t.success;
      color = t.success;
    }
    if (verdict && !verdict.correct && idx === verdict.pickedIdx) {
      border = t.danger;
      color = t.danger;
      bg = t.dangerTint;
    }
    return { color, border, bg };
  };

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Stat label="Серия" value={streak} tint={t.success} />
        <Stat label="Осталось" value={remaining} />
        <Stat label="Ошибки" value={mistakes} tint={t.danger} />
      </div>
      <ProgressBar value={progress} />

      {done ? (
        <TrainerDone
          mistakes={mistakes}
          total={`${TOTAL}/${TOTAL}`}
          secondLabel="Лучшая серия"
          secondValue={bestStreak}
          scoreLabel="все слова пройдены"
          wrongItems={[...wrongWordsRef.current].map((w) => ({ key: w, label: w.toLowerCase(), badge: "повторить" }))}
          emptyMsg="Орфоэпические нормы усвоены уверенно."
          onRetry={start}
          onBack={trainer.useSubject ? () => navigate(`/use/${trainer.useSubject}`) : null}
          backLabel="Вернуться к ЕГЭ"
        />
      ) : (
        <div style={{ padding: "32px 20px", borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, textAlign: "center" }}>
          {!verdict && (
            <div style={{ color: t.sub, fontSize: 13, marginBottom: 18 }}>
              Нажми на гласную, на которую падает ударение
            </div>
          )}
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 0, minHeight: 48, display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
            {current.display.split("").map((ch, idx) => {
              const isVowel = VOWELS.includes(ch);
              const slot = {
                width: 28,
                height: 46,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 700,
                lineHeight: 1,
              };
              if (!isVowel) {
                return <span key={idx} style={{ ...slot, color: t.sub }}>{ch}</span>;
              }
              const s = letterStyle(ch, idx);
              return (
                <button
                  key={idx}
                  type="button"
                  className={verdict ? undefined : "press"}
                  onClick={() => answer(idx)}
                  disabled={locked}
                  style={{
                    ...slot,
                    border: "none",
                    boxShadow: s.border === "transparent" ? undefined : `inset 0 -2.5px 0 ${s.border}`,
                    background: s.bg,
                    color: s.color,
                    fontFamily: "inherit",
                    padding: 0,
                    borderRadius: 3,
                    cursor: verdict ? "default" : "pointer",
                    transition: "background .15s, color .15s, box-shadow .15s",
                    boxSizing: "border-box",
                  }}
                >
                  {ch}
                </button>
              );
            })}
          </div>
          {verdict && (
            <div className="swap">
              <div
                style={{
                  color: verdict.correct ? t.success : t.danger,
                  fontSize: 15,
                  fontWeight: 700,
                  marginTop: 14,
                }}
              >
                {verdict.correct ? "Верно." : "Неверно. Слово вернётся ещё дважды."}
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