import { useEffect, useRef, useState } from "react";
import { useTheme } from "../theme/ThemeContext";

export default function Segmented({ options, value, onChange, style, labelStyle }) {
  const { t } = useTheme();
  const trackRef = useRef(null);
  const [cellW, setCellW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.v === value));

  useEffect(() => {
    const measure = () => {
      const el = trackRef.current;
      if (el) setCellW((el.clientWidth - 6) / options.length);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [options.length]);

  return (
    <div
      ref={trackRef}
      style={{
        position: "relative",
        display: "flex",
        borderRadius: 999,
        background: t.raised,
        border: `1px solid ${t.border}`,
        padding: 3,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          bottom: 3,
          left: 3,
          width: cellW,
          borderRadius: 999,
          background: t.invBg,
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          transform: `translateX(${idx * cellW}px)`,
          transition: "transform 280ms cubic-bezier(0.16,1,0.3,1)",
        }}
      />
      {options.map(({ v, label, icon: Icon, badge }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className="press"
            aria-label={label}
            style={{
              flex: 1,
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              padding: "7px 6px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              color: active ? t.inv : t.sub,
            }}
          >
            {Icon && <Icon size={17} strokeWidth={2} color={active ? t.inv : t.sub} />}
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 600, color: active ? t.inv : t.sub, transition: "color 250ms ease", ...labelStyle }}>
              {label}
              {badge > 0 && (
                <span
                  style={{
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    borderRadius: 999,
                    background: active ? t.inv : t.invBg,
                    color: active ? t.invBg : t.inv,
                    fontSize: 11,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}