import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import ProgressBar from "../components/ProgressBar";
import TrainerDone from "../components/TrainerDone";
import Button from "../components/Button";
import Segmented from "../components/Segmented";
import BackToTop from "../components/BackToTop";
import TheoryCard from "../components/TheoryCard";
import Stat from "../components/Stat";
import { TRAINER_LIST } from "../data/trainers";
import useQuizQueue from "../hooks/useQuizQueue";
import { setQuizActive } from "../nav";
import { NN_ITEMS, NN_THEORY } from "../data/nn";

const TOTAL = NN_ITEMS.length;

export default function NnTrainer() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { slug } = useParams();
  const trainer = TRAINER_LIST.find((x) => x.id === slug);
  const [tab, setTab] = useState("theory");
  const { current, verdict, streak, bestStreak, mistakes, done, remaining, wrongItems, next, start, grade } = useQuizQueue(
    NN_ITEMS,
    (item) => item.text.replace("•", item.answer)
  );

  useEffect(() => {
    setQuizActive(tab === "train" && !done);
    return () => setQuizActive(false);
  }, [tab, done]);

  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answer = (value) => {
    if (verdict || done || !current) return;
    grade(value === current.answer, value);
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
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {NN_THEORY.map((group) => (
            <TheoryCard key={group.title} group={group} />
          ))}
        </div>
        <BackToTop />
      </div>
    );
  }

  const progress = done ? 1 : Math.min(1, Math.max(0, 1 - remaining / TOTAL));
  const [before, after] = current ? current.text.split("•") : ["", ""];
  const filled = verdict ? verdict.picked : null;

  const choiceStyle = (value) => {
    let bg = t.raised;
    let border = t.border;
    let color = t.text;
    if (verdict && value === current.answer) {
      bg = t.successTint;
      border = t.success;
      color = t.success;
    } else if (verdict && value === verdict.picked) {
      bg = t.dangerTint;
      border = t.danger;
      color = t.danger;
    }
    return { background: bg, border: `2px solid ${border}`, color };
  };

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
          emptyMsg="Все слова пройдены верно."
          onRetry={start}
          onBack={trainer?.useSubject ? () => navigate(`/use/${trainer.useSubject}`) : null}
          backLabel="Вернуться к ЕГЭ"
        />
      ) : current ? (
        <div style={{ padding: "32px 20px", borderRadius: 20, border: `1px solid ${t.border}`, background: t.surface, textAlign: "center" }}>
          {!verdict && (
            <div style={{ color: t.sub, fontSize: 13, marginBottom: 18 }}>
              Выбери Н или НН — пропуск заменит нужные буквы
            </div>
          )}
          <div style={{ fontSize: 28, fontWeight: 700, minHeight: 48, display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", color: t.text }}>
            {before}
            <span
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minWidth: filled === "нн" ? 60 : 40, height: 46, borderRadius: 3,
                background: verdict ? (verdict.correct ? t.successTint : t.dangerTint) : "transparent",
                color: verdict ? (verdict.correct ? t.success : t.danger) : t.text,
                boxShadow: `inset 0 -2.5px 0 ${verdict ? (verdict.correct ? t.success : t.danger) : t.invBg}`,
                transition: "background .15s, color .15s, box-shadow .15s",
              }}
            >
              {filled || "\u00A0"}
            </span>
            {after}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
            {["н", "нн"].map((value) => (
              <button
                key={value}
                type="button"
                className={verdict ? undefined : "press"}
                disabled={!!verdict}
                onClick={() => answer(value)}
                style={{
                  flex: 1, padding: "16px 0", borderRadius: 16, cursor: verdict ? "default" : "pointer",
                  fontSize: 22, fontWeight: 700, fontFamily: "inherit", transition: "background .15s, border-color .15s, color .15s",
                  ...choiceStyle(value),
                }}
              >
                {value.toUpperCase()}
              </button>
            ))}
          </div>
          {verdict && (
            <div className="swap">
              <div style={{ color: verdict.correct ? t.success : t.danger, fontSize: 15, fontWeight: 700, marginTop: 18 }}>
                {verdict.correct ? "Верно." : `Неверно. Правильно: ${current.answer.toUpperCase()}.`}
              </div>
              <div style={{ color: t.text, fontSize: 13, lineHeight: 1.55, marginTop: 8, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
                {current.explanation}
              </div>
              {!verdict.correct && <div style={{ color: t.sub, fontSize: 12, marginTop: 6 }}>Слово вернётся ещё дважды.</div>}
              <div style={{ marginTop: 16 }}>
                <Button onClick={next}>Далее</Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
