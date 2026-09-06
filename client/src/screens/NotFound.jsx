import { useNavigate } from "react-router-dom";
import { useTheme } from "../theme/ThemeContext";
import Button from "../components/Button";

export default function NotFound() {
  const { t } = useTheme();
  const navigate = useNavigate();
  return (
    <div style={{ paddingTop: 96, textAlign: "center", animation: "fadeUp 500ms cubic-bezier(0.16,1,0.3,1) both" }}>
      <div style={{ color: t.text, fontSize: 72, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>404</div>
      <div style={{ color: t.sub, fontSize: 15, marginTop: 12 }}>Такой страницы нет</div>
      <div style={{ marginTop: 28, maxWidth: 240, marginLeft: "auto", marginRight: "auto" }}>
        <Button onClick={() => navigate("/")}>На главную</Button>
      </div>
    </div>
  );
}