import { useParams } from "react-router-dom";
import StressTrainer from "./StressTrainer";
import ParonymsTrainer from "./ParonymsTrainer";

export default function Trainer() {
  const { slug } = useParams();
  if (slug === "paronyms") return <ParonymsTrainer />;
  return <StressTrainer />;
}