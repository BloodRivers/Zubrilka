import { useTheme } from "../theme/ThemeContext";

export default function Button({ children, variant = "primary", onClick, disabled, style, ...rest }) {
  const { t } = useTheme();

  const base = {
    width: "100%",
    padding: "16px",
    borderRadius: 999,
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "transform 150ms ease",
    ...style,
  };

  const variants = {
    primary: { border: "none", background: t.invBg, color: t.inv },
    dashed: { border: `1px dashed ${t.border}`, background: "none", color: t.sub },
  };

  return (
    <button className={variant === "dashed" ? undefined : "press"} onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant] }} {...rest}>
      {children}
    </button>
  );
}
