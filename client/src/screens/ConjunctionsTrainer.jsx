import RanksTrainer from "./RanksTrainer";
import ConjunctionsTheory from "./ConjunctionsTheory";
import { CONJUNCTION_AMBIGUOUS, CONJUNCTION_CATEGORIES, CONJUNCTION_CATEGORY_NAMES } from "../data/conjunctions";

const LABELS = {
  plural: "союзы",
  singular: "союз",
  wordPlaceholder: "и, но, или…",
  categoryPlaceholder: "сочинительные",
  typedTitle: "По функции",
  typedSub: "Напиши союзы, относящиеся к указанной функции",
  hideType: true,
  empty: "Разряды союзов усвоены уверенно.",
  backTo: "/use/russian",
};

export default function ConjunctionsTrainer({ level }) {
  return <RanksTrainer level={level} categories={CONJUNCTION_CATEGORIES} ambiguous={CONJUNCTION_AMBIGUOUS} categoryNames={CONJUNCTION_CATEGORY_NAMES} slug="conjunctions" labels={LABELS} theory={<ConjunctionsTheory />} />;
}
