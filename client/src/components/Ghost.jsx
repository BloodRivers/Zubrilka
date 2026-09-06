import { useEffect, useRef, useState } from "react";
import { useTheme } from "../theme/ThemeContext";

/** Держит skeleton минимум minMs мс, чтобы не мелькал. */
export function useGhostHold(loading, minMs = 450) {
  const [held, setHeld] = useState(Boolean(loading));
  const started = useRef(Date.now());

  useEffect(() => {
    if (loading) {
      started.current = Date.now();
      setHeld(true);
      return undefined;
    }
    const left = minMs - (Date.now() - started.current);
    if (left <= 0) {
      setHeld(false);
      return undefined;
    }
    const id = setTimeout(() => setHeld(false), left);
    return () => clearTimeout(id);
  }, [loading, minMs]);

  return held;
}

/** Базовый «призрак» с shimmer. */
export function Bone({ width = "100%", height = 14, radius = 8, style }) {
  const { theme } = useTheme();
  return (
    <div
      aria-hidden
      className="ghost-bone"
      style={{
        width,
        height,
        borderRadius: radius,
        background: theme === "dark" ? "#2A2A2A" : "#E6E6E6",
        border: `1px solid ${theme === "dark" ? "#333" : "#DADADA"}`,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

function RowShell({ children, style }) {
  const { t } = useTheme();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "20px 0",
        borderBottom: `1px solid ${t.border}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Список предметов / строк как ListRow. */
export function GhostList({ count = 5 }) {
  return (
    <div aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: count }, (_, i) => (
        <RowShell key={i}>
          <Bone width={44} height={44} radius={14} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Bone width={`${58 + (i % 3) * 10}%`} height={16} radius={8} />
            <Bone width={`${34 + (i % 2) * 12}%`} height={12} radius={6} style={{ marginTop: 10 }} />
          </div>
          <Bone width={18} height={18} radius={6} />
        </RowShell>
      ))}
    </div>
  );
}

/** Карточки конспектов. */
export function GhostCards({ count = 4 }) {
  const { t } = useTheme();
  return (
    <div aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            padding: "16px 18px",
            marginBottom: 12,
            borderRadius: 20,
            background: t.surface,
            border: `1px solid ${t.border}`,
          }}
        >
          <Bone width={`${50 + (i % 3) * 12}%`} height={16} radius={8} />
          <Bone width={`${70 - (i % 2) * 10}%`} height={12} radius={6} style={{ marginTop: 12 }} />
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Bone width={64} height={24} radius={999} />
            <Bone width={52} height={24} radius={999} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Строки библиотеки. */
export function GhostLibrary({ count = 6 }) {
  const { t } = useTheme();
  return (
    <div aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 16px",
            marginBottom: 10,
            borderRadius: 18,
            border: `1px solid ${t.border}`,
            background: t.surface,
          }}
        >
          <Bone width={40} height={40} radius={12} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Bone width={`${55 + (i % 3) * 12}%`} height={14} radius={7} />
            <Bone width={`${30 + (i % 2) * 10}%`} height={11} radius={6} style={{ marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Деталь конспекта. */
export function GhostNote() {
  return (
    <div aria-busy="true" aria-label="Загрузка" style={{ paddingTop: 8 }}>
      <Bone width="72%" height={28} radius={10} />
      <Bone width="42%" height={12} radius={6} style={{ marginTop: 12 }} />
      <Bone width="100%" height={12} radius={6} style={{ marginTop: 28 }} />
      <Bone width="94%" height={12} radius={6} style={{ marginTop: 10 }} />
      <Bone width="88%" height={12} radius={6} style={{ marginTop: 10 }} />
      <Bone width="100%" height={120} radius={16} style={{ marginTop: 24 }} />
      <Bone width="100%" height={88} radius={16} style={{ marginTop: 12 }} />
      <Bone width="100%" height={48} radius={999} style={{ marginTop: 28 }} />
    </div>
  );
}

/** Аккаунт. */
export function GhostAccount() {
  const { t } = useTheme();
  return (
    <div aria-busy="true" aria-label="Загрузка">
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "4px 2px 2px" }}>
        <Bone width={58} height={58} radius={999} />
        <div style={{ flex: 1 }}>
          <Bone width="55%" height={20} radius={8} />
          <Bone width="40%" height={12} radius={6} style={{ marginTop: 10 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              padding: "14px 12px",
              borderRadius: 16,
              background: t.surface,
              border: `1px solid ${t.border}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Bone width={36} height={22} radius={8} />
            <Bone width={48} height={10} radius={6} />
          </div>
        ))}
      </div>
      <Bone width={80} height={12} radius={6} style={{ margin: "28px 0 12px 4px" }} />
      <Bone width="100%" height={52} radius={18} />
      <Bone width="100%" height={52} radius={18} style={{ marginTop: 8 }} />
    </div>
  );
}

/** Экран теста / ожидание бандла. */
export function GhostQuiz() {
  return (
    <div aria-busy="true" aria-label="Загрузка" style={{ paddingTop: 12 }}>
      <Bone width="40%" height={10} radius={6} />
      <Bone width="100%" height={8} radius={999} style={{ marginTop: 16 }} />
      <Bone width="88%" height={22} radius={10} style={{ marginTop: 28 }} />
      <Bone width="100%" height={56} radius={16} style={{ marginTop: 20 }} />
      <Bone width="100%" height={56} radius={16} style={{ marginTop: 10 }} />
      <Bone width="100%" height={56} radius={16} style={{ marginTop: 10 }} />
      <Bone width="100%" height={56} radius={16} style={{ marginTop: 10 }} />
    </div>
  );
}

/** Короткий плейсхолдер для inline (баланс и т.п.). */
export function GhostInline({ width = 72 }) {
  return <Bone width={width} height={14} radius={7} />;
}
