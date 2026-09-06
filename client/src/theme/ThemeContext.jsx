import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { THEMES } from "./theme";

const ThemeContext = createContext();
const STORAGE_KEY = "zubrilka:theme";
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }) {
  const [pref, setPref] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [sysDark, setSysDark] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = (e) => setSysDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, pref);
  }, [pref]);

  const theme = pref === "system" ? (sysDark ? "dark" : "light") : pref;
  const value = useMemo(
    () => ({ pref, theme, setPref, t: THEMES[theme] }),
    [pref, theme]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}