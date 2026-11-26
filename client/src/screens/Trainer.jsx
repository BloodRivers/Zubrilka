import { useParams } from "react-router-dom";
import StressTrainer from "./StressTrainer";
import ParonymsTrainer from "./ParonymsTrainer";
import PronounsTrainer from "./PronounsTrainer";
import AdverbsTrainer from "./AdverbsTrainer";
import ConjunctionsTrainer from "./ConjunctionsTrainer";
import PrepositionsTrainer from "./PrepositionsTrainer";
import ParticlesTrainer from "./ParticlesTrainer";
import RootsTrainer from "./RootsTrainer";
import SpeechStylesTrainer from "./SpeechStylesTrainer";
import PrePriTrainer from "./PrePriTrainer";
import NnTrainer from "./NnTrainer";
import InformaticsTask2Trainer from "./InformaticsTask2Trainer";

export default function Trainer() {
  const { slug, level } = useParams();
  if (slug === "paronyms") return <ParonymsTrainer />;
  if (slug === "pronouns") return <PronounsTrainer level={level} />;
  if (slug === "adverbs") return <AdverbsTrainer level={level} />;
  if (slug === "conjunctions") return <ConjunctionsTrainer level={level} />;
  if (slug === "prepositions") return <PrepositionsTrainer level={level} />;
  if (slug === "particles") return <ParticlesTrainer level={level} />;
  if (slug === "roots") return <RootsTrainer />;
  if (slug === "speech-styles") return <SpeechStylesTrainer />;
  if (slug === "prepri") return <PrePriTrainer />;
  if (slug === "n-nn") return <NnTrainer />;
  if (slug === "inf-task2") return <InformaticsTask2Trainer />;
  return <StressTrainer />;
}
