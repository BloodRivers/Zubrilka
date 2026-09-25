export default function FieldLabel({ children, t, style }) {
  return (
    <div style={{ color: t.sub, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 8px 2px", ...style }}>
      {children}
    </div>
  );
}