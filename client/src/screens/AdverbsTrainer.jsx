import RanksTrainer from "./RanksTrainer";
import { ADVERB_AMBIGUOUS, ADVERB_CATEGORIES, ADVERB_CATEGORY_NAMES } from "../data/adverbs";

const LABELS = {
  plural: "наречия",
  singular: "наречие",
  wordPlaceholder: "так, там, сюда…",
  categoryPlaceholder: "указательные",
  empty: "Разряды наречий усвоены уверенно.",
  backTo: "/use/russian",
};

export default function AdverbsTrainer({ level }) {
  return <RanksTrainer level={level} categories={ADVERB_CATEGORIES} ambiguous={ADVERB_AMBIGUOUS} categoryNames={ADVERB_CATEGORY_NAMES} slug="adverbs" labels={LABELS} />;
}
