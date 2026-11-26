import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import ListRow from "../components/ListRow";
import Accordion from "../components/Accordion";
import Segmented from "../components/Segmented";
import { Brain } from "lucide-react";
import { TRAINER_LIST } from "./StressTrainer";
import { ORAL_TASKS } from "../useOral";
import { TASK_ICONS } from "./OralBank";

const USE_TASK_GROUPS = [
  { task: "1", title: "Части речи", ids: ["pronouns", "adverbs", "conjunctions", "prepositions", "particles"] },
  { task: "2", title: "Таблицы истинности", ids: ["inf-task2"] },
  { task: "3", title: "Стили речи", ids: ["speech-styles"] },
  { task: "4", title: "Ударения", ids: ["stress"] },
  { task: "5", title: "Паронимы", ids: ["paronyms"] },
  { task: "9", title: "Корни", ids: ["roots"] },
  { task: "10", title: "Приставки ПРЕ- и ПРИ-", ids: ["prepri"] },
  { task: "15", title: "Н и НН", ids: ["n-nn"] },
];

export const USE_SUBJECTS = [
  { id: "russian", title: "Русский язык", sub: "Задания по русскому языку" },
  { id: "informatics", title: "Информатика", sub: "Задания по информатике" },
  {
    id: "english",
    title: "Английский язык",
    sub: "Задания по английскому языку",
    tabs: [
      { v: "written", label: "Письменная часть" },
      { v: "oral", label: "Устная часть" },
    ],
  },
];

export default function UseHub() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { slug } = useParams();
  const [openGroup, setOpenGroup] = useState(null);
  const subject = USE_SUBJECTS.find((s) => s.id === slug);
  const [tab, setTab] = useState(subject?.tabs?.[0]?.v ?? null);
  const list = TRAINER_LIST.filter((x) => x.useSubject === slug);
  const groups = USE_TASK_GROUPS.map((group) => ({
    ...group,
    items: list.filter((x) => group.ids.includes(x.id)),
  })).filter((group) => group.items.length > 0);

  return (
    <div>
      {subject ? (
        subject.tabs ? (
          <>
            <Segmented options={subject.tabs} value={tab} onChange={setTab} style={{ marginBottom: 12 }} />
            {tab === "oral" ? (
              ORAL_TASKS.map((taskRow, i) => {
                const Icon = TASK_ICONS[taskRow.task] || Brain;
                return (
                  <ListRow
                    key={taskRow.task}
                    idx={i}
                    borderless={i === ORAL_TASKS.length - 1}
                    icon={<Icon size={20} color={t.text} strokeWidth={2} />}
                    title={`Задание ${taskRow.task}. ${taskRow.title}`}
                    sub={taskRow.sub}
                    onClick={() => navigate(`/use/english/oral/${taskRow.task}`, { state: { from: "/use/english" } })}
                  />
                );
              })
            ) : (
              <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>
                {subject.tabs.find((x) => x.v === tab)?.label} — раздел скоро появится.
              </div>
            )}
          </>
        ) : (
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
                  onClick={() => navigate(`/trainer/${x.id}`, { state: { from: `/use/${slug}` } })}
                />
              ))}
            </Accordion>
          ))
        )
      ) : (
        <div style={{ color: t.sub, fontSize: 14, padding: "10px 0" }}>Предмет не найден.</div>
      )}
    </div>
  );
}
