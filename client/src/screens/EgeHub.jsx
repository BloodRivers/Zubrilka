import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import ListRow from "../components/ListRow";
import { Brain } from "lucide-react";
import { TRAINER_LIST } from "./StressTrainer";

export const EGE_SUBJECTS = [
  { id: "russian", title: "Русский язык", sub: "Задания по русскому языку" },
];

export default function EgeHub() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { slug } = useParams();
  const subject = EGE_SUBJECTS.find((s) => s.id === slug);
  const list = TRAINER_LIST.filter((x) => x.egeSubject === slug);

  return (
    <div>
      {subject ? (
        list.map((x, i) => (
          <ListRow
            key={x.id}
            idx={i}
            icon={<Brain size={20} color={t.text} strokeWidth={2} />}
            title={x.title}
            sub={x.sub}
            onClick={() => navigate(`/trainer/${x.id}`, { state: { from: `/ege/${slug}` } })}
          />
        ))
      ) : (
        <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>Предмет не найден.</div>
      )}
    </div>
  );
}