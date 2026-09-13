import { useParams } from "react-router-dom";
import StressTrainer from "./StressTrainer";
import ParonymsTrainer from "./ParonymsTrainer";
import PronounsTrainer from "./PronounsTrainer";
import RootsTrainer from "./RootsTrainer";

export default function Trainer() {
  const { slug, level } = useParams();
  if (slug === "paronyms") return <ParonymsTrainer />;
  if (slug === "pronouns") return <PronounsTrainer level={level} />;
  if (slug === "roots") return <RootsTrainer />;
  return <StressTrainer />;
}