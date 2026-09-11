import Avatar from "./Avatar";

export default function AuthorBar({ name, photoUrl, uid, label, from, t, navigate }) {
  if (!name) return null;
  return (
    <button
      type="button"
      className="rowpress"
      onClick={() => uid && navigate(`/user/${uid}`, { state: { from } })}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        marginBottom: 14,
        borderRadius: 16,
        border: uid ? `1px solid ${t.border}` : "none",
        background: t.surface,
        cursor: uid ? "pointer" : "default",
        fontFamily: "inherit",
        textAlign: "left",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <Avatar name={name} src={photoUrl || ""} size={34} />
      <div style={{ minWidth: 0 }}>
        <div style={{ color: t.text, fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </div>
        <div style={{ color: t.sub, fontSize: 12, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}{uid ? " · нажми, чтобы открыть профиль" : ""}
        </div>
      </div>
    </button>
  );
}