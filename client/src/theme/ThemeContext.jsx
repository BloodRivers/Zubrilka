import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { THEMES } from "./theme";

const ThemeContext = createContext();
const STORAGE_KEY = "zubrilka:theme";
const STYLE_KEY = "zubrilka:note-style";
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export function ThemeProvider({ children }) {
  const [pref, setPref] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [noteStyle, setNoteStyleRaw] = useState(() => {
    const saved = localStorage.getItem(STYLE_KEY);
    return saved === "headings" ? "headings" : "accordion";
  });
  const [sysDark, setSysDark] = useState(systemDark);
  const animTimer = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = (e) => setSysDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, pref);
  }, [pref]);

  const setNoteStyle = useCallback((next) => {
    localStorage.setItem(STYLE_KEY, next);
    setNoteStyleRaw(next);
  }, []);

  const changePref = useCallback((next) => {
    document.documentElement.classList.add("theme-anim");
    void document.body.offsetWidth;
    setPref(next);
    if (animTimer.current) clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => {
      document.documentElement.classList.remove("theme-anim");
    }, 450);
  }, []);

  const theme = pref === "system" ? (sysDark ? "dark" : "light") : pref;
  const value = useMemo(
    () => ({ pref, theme, setPref: changePref, noteStyle, setNoteStyle, t: THEMES[theme] }),
    [pref, theme, changePref, noteStyle, setNoteStyle]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}