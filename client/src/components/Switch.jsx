import { useTheme } from "../theme/ThemeContext";
import { EASE } from "../theme/theme";

/** Compact iOS-like switch with clear on/off contrast. */
export default function Switch({ on, disabled }) {
  const { t, theme } = useTheme();
  const trackOn = t.invBg;
  const trackOff = theme === "dark" ? "#3A3A3A" : "#D8D8D8";
  // Шарик всегда контрастен к треку
  const knob = on ? t.inv : theme === "dark" ? "#F5F5F5" : "#FFFFFF";

  return (
    <span
      aria-hidden
      style={{
        flexShrink: 0,
        width: 46,
        height: 28,
        borderRadius: 999,
        background: on ? trackOn : trackOff,
        border: "none",
        position: "relative",
        opacity: disabled ? 0.5 : 1,
        transition: "background 180ms ease",
        boxShadow: on ? "none" : `inset 0 0 0 1px ${t.border}`,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 21 : 3,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: knob,
          boxShadow: "0 1px 3px rgba(0,0,0,0.28)",
          transition: `left 180ms ${EASE}, background 180ms ease`,
        }}
      />
    </span>
  );
}
