import RanksTrainer from "./RanksTrainer";
import { PARTICLE_AMBIGUOUS, PARTICLE_CATEGORIES, PARTICLE_CATEGORY_NAMES } from "../data/particles";

const LABELS = {
  plural: "частицы",
  singular: "частица",
  wordPlaceholder: "вот, только, даже…",
  categoryPlaceholder: "указательные",
  empty: "Разряды частиц усвоены уверенно.",
  backTo: "/use/russian",
};

export default function ParticlesTrainer({ level }) {
  return <RanksTrainer level={level} categories={PARTICLE_CATEGORIES} ambiguous={PARTICLE_AMBIGUOUS} categoryNames={PARTICLE_CATEGORY_NAMES} slug="particles" labels={LABELS} />;
}
