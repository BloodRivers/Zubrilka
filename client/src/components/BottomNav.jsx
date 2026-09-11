import { BookOpen, Library, Settings2, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { TAB_ROOTS, tabOf, resumeTab } from "../nav";
import Segmented from "./Segmented";

const FULL_TAB_META = [
  { label: "Главная", icon: BookOpen },
  { label: "Библиотека", icon: Library },
  { label: "Настройки", icon: Settings2 },
  { label: "Аккаунт", icon: User },
];

const GUEST_TAB_META = [
  { label: "Главная", icon: BookOpen },
  { label: "Библиотека", icon: Library },
  { label: "Настройки", icon: Settings2 },
  { label: "Гость", icon: User },
];

const GUEST_TAB_ROOTS = ["/", "/library", "/settings", "/account"];

export default function BottomNav({ confirmLeave }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isGuest = !!auth.currentUser?.isAnonymous;

  if (/\/quiz(\/|$)/.test(location.pathname) || /^\/trainer\//.test(location.pathname)) return null;

  const roots = isGuest ? GUEST_TAB_ROOTS : TAB_ROOTS;
  const meta = isGuest ? GUEST_TAB_META : FULL_TAB_META;
  const options = roots.map((v, i) => ({ v, ...meta[i] }));

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
