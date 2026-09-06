import { BookOpen, Library, Settings2, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { TAB_ROOTS, tabOf, resumeTab } from "../nav";
import Segmented from "./Segmented";

const TAB_META = [
  { label: "Предметы", icon: BookOpen },
  { label: "Библиотека", icon: Library },
  { label: "Настройки", icon: Settings2 },
  { label: "Аккаунт", icon: User },
];

const options = TAB_ROOTS.map((v, i) => ({ v, ...TAB_META[i] }));

export default function BottomNav({ confirmLeave }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Во время теста прячем табы — уход только через «назад» / свайп с confirm
  if (/\/quiz(\/|$)/.test(location.pathname)) return null;

  return (
    <div style={{ padding: "8px 18px calc(8px + env(safe-area-inset-bottom)) 18px", flexShrink: 0 }}>
      <Segmented
        options={options}
        value={tabOf(location.pathname)}
        onChange={async (v) => {
          if (confirmLeave && !(await confirmLeave())) return;
          navigate(v === tabOf(location.pathname) ? v : resumeTab(v));
        }}
        labelStyle={{ fontSize: 12 }}
      />
    </div>
  );
}
