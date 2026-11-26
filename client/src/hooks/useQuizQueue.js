import { useRef, useState } from "react";
import { shuffle } from "../utils";
import { sfx } from "../sfx";
import { repeatWrong } from "../utils/quizQueue.js";

/** Общая очередь тренажёра: перемешивание, серия, ошибки и повтор слабых слов. */
export default function useQuizQueue(items, wrongLabel) {
  const queueRef = useRef([]);
  const wrongRef = useRef(new Set());
  const [current, setCurrent] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);

  const next = () => {
    setVerdict(null);
    const q = queueRef.current;
    if (!q.length) {
      setCurrent(null);
      setDone(true);
      return;
    }
    setCurrent(q.shift());
  };

  const start = () => {
    queueRef.current = shuffle(items);
    wrongRef.current = new Set();
    setStreak(0);
    setBestStreak(0);
    setMistakes(0);
    setDone(false);
    next();
  };

  const grade = (correct, picked, extra) => {
    if (correct) {
      sfx.correct();
      const ns = streak + 1;
      setStreak(ns);
      setBestStreak((b) => Math.max(b, ns));
    } else {
      sfx.wrong();
      setStreak(0);
      setMistakes((m) => m + 1);
      if (current) wrongRef.current.add(wrongLabel ? wrongLabel(current) : "");
      repeatWrong(queueRef.current, current);
    }
    setVerdict({ correct, picked, ...extra });
  };

  return {
    current, verdict, setVerdict, streak, bestStreak, mistakes, done,
    remaining: queueRef.current.length,
    wrongItems: [...wrongRef.current],
    next, start, grade,
  };
}
