import RanksTrainer from "./RanksTrainer";
import { PREPOSITION_AMBIGUOUS, PREPOSITION_CATEGORIES, PREPOSITION_CATEGORY_NAMES } from "../data/prepositions";

const LABELS = {
  plural: "предлоги",
  singular: "предлог",
  wordPlaceholder: "в, на, для…",
  categoryPlaceholder: "временные",
  empty: "Разряды предлогов усвоены уверенно.",
  backTo: "/use/russian",
};

export default function PrepositionsTrainer({ level }) {
  return <RanksTrainer level={level} categories={PREPOSITION_CATEGORIES} ambiguous={PREPOSITION_AMBIGUOUS} categoryNames={PREPOSITION_CATEGORY_NAMES} slug="prepositions" labels={LABELS} />;
}
