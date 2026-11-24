import { useTheme } from "../theme/ThemeContext";

const rand = (i, seed) => {
  const x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const FLAKES = Array.from({ length: 40 }, (_, i) => ({
  left: `${(rand(i, 1) * 100).toFixed(2)}%`,
  size: 3 + rand(i, 2) * 4,
  duration: 8 + rand(i, 3) * 9,
  delay: -rand(i, 4) * 17,
  drift: `${((rand(i, 5) - 0.5) * 120).toFixed(0)}px`,
  opacity: 0.25 + rand(i, 6) * 0.5,
}));

export default function Snow() {
  const { theme } = useTheme();
  const color = theme === "dark" ? "#FFFFFF" : "#7E93A8";

  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 2 }}>
      {FLAKES.map((flake, i) => (
        <span
          key={i}
          className="snowflake"
          style={{
            position: "absolute",
            top: 0,
            left: flake.left,
            width: flake.size,
            height: flake.size,
            borderRadius: "50%",
            background: color,
            opacity: flake.opacity,
            animation: `snowfall ${flake.duration}s linear ${flake.delay}s infinite`,
            "--snow-drift": flake.drift,
          }}
        />
      ))}
    </div>
  );
}
