import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err) {
    console.error("Fatal:", err);
  }
  render() {
    if (this.state.err)
      return (
        <div
          style={{
            height: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 32,
            background: "#141414",
            color: "#FAFAFA",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700 }}>Что-то пошло не так</div>
          <div style={{ fontSize: 13, opacity: 0.7, fontFamily: "monospace", wordBreak: "break-all" }}>
            {String(this.state.err?.message || this.state.err)}
          </div>
          <button
            className="press"
            onClick={() => location.reload()}
            style={{
              padding: "12px 26px",
              borderRadius: 999,
              border: "none",
              background: "#FAFAFA",
              color: "#141414",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Перезагрузить
          </button>
        </div>
      );
    return this.props.children;
  }
}