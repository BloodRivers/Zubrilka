import RanksTrainer from "./RanksTrainer";
import { PRONOUN_AMBIGUOUS, PRONOUN_CATEGORIES, PRONOUN_CATEGORY_NAMES } from "../data/pronouns";

const LABELS = {
  plural: "местоимения",
  singular: "местоимение",
  wordPlaceholder: "мой, твой, наш…",
  categoryPlaceholder: "притяжательные",
  empty: "Разряды местоимений усвоены уверенно.",
  backTo: "/ege/russian",
};

export default function PronounsTrainer({ level }) {
  return <RanksTrainer level={level} categories={PRONOUN_CATEGORIES} ambiguous={PRONOUN_AMBIGUOUS} categoryNames={PRONOUN_CATEGORY_NAMES} slug="pronouns" labels={LABELS} />;
}
