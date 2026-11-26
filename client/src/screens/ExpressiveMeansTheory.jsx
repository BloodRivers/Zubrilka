import { useTheme } from "../theme/ThemeContext";
import BackToTop from "../components/BackToTop";
import TheoryCard from "../components/TheoryCard";
import { EXPRESSIVE_MEANS_THEORY } from "../data/expressiveMeans";

export default function ExpressiveMeansTheory() {
  const { t } = useTheme();

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        {EXPRESSIVE_MEANS_THEORY.map((group) => (
          <TheoryCard key={group.title} group={group} />
        ))}
      </div>
      <BackToTop />
    </div>
  );
}
