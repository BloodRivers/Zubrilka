import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import ListRow from "../components/ListRow";
import Accordion from "../components/Accordion";
import { Brain } from "lucide-react";
import { TRAINER_LIST } from "./StressTrainer";

const EGE_TASK_GROUPS = [
  { task: "1", title: "Части речи", ids: ["pronouns", "adverbs", "conjunctions", "prepositions", "particles"] },
  { task: "3", title: "Стили речи", ids: ["speech-styles"] },
  { task: "4", title: "Ударения", ids: ["stress"] },
  { task: "5", title: "Паронимы", ids: ["paronyms"] },
  { task: "9", title: "Корни", ids: ["roots"] },
  { task: "10", title: "Приставки ПРЕ- и ПРИ-", ids: ["prepri"] },
];

export const EGE_SUBJECTS = [
  { id: "russian", title: "Русский язык", sub: "Задания по русскому языку" },
];

export default function EgeHub() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { slug } = useParams();
  const [openGroup, setOpenGroup] = useState(null);
  const subject = EGE_SUBJECTS.find((s) => s.id === slug);
  const list = TRAINER_LIST.filter((x) => x.egeSubject === slug);
  const groups = EGE_TASK_GROUPS.map((group) => ({
    ...group,
    items: list.filter((x) => group.ids.includes(x.id)),
  })).filter((group) => group.items.length > 0);

  return (
    <div>
      {subject ? (
        groups.map((group, groupIndex) => (
          <Accordion
            key={group.task}
            title={`Задание ${group.task}: ${group.title}`}
            open={openGroup === groupIndex}
            onToggle={() => setOpenGroup(openGroup === groupIndex ? null : groupIndex)}
          >
            {group.items.map((x, i) => (
              <ListRow
                key={x.id}
                idx={i}
                borderless={i === group.items.length - 1}
                icon={<Brain size={20} color={t.text} strokeWidth={2} />}
                title={x.title}
                sub={x.sub}
                onClick={() => navigate(`/trainer/${x.id}`, { state: { from: `/ege/${slug}` } })}
              />
            ))}
          </Accordion>
        ))
      ) : (
        <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>Предмет не найден.</div>
      )}
    </div>
  );
}
