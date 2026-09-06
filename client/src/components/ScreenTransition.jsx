import { EASE, DURATION } from "../theme/theme";

export default function ScreenTransition({ animKey, entered, dir, children }) {
  return (
    <div
      key={animKey}
      className="scrollarea"
      style={{
        flex: 1,
        overflowY: "auto",
        padding:
          "8px calc(22px + env(safe-area-inset-left)) calc(28px + env(safe-area-inset-bottom)) calc(22px + env(safe-area-inset-right))",
        transform: entered ? "translateX(0)" : dir === "fwd" ? "translateX(28px)" : "translateX(-28px)",
        opacity: entered ? 1 : 0,
        transition: `transform ${DURATION}ms ${EASE}, opacity 380ms ease-out`,
      }}
    >
      {children}
    </div>
  );
}
