import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../theme/ThemeContext";
import { EASE } from "../theme/theme";
import { ArrowUp } from "lucide-react";

/** Кнопка «Наверх» над прокручиваемой областью приложения. */
export default function BackToTop() {
  const { t } = useTheme();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let last = document.querySelector(".scrollarea")?.scrollTop || 0;
    // Скролл не всплывает, поэтому ловим его в фазе захвата: узел .scrollarea
    // заменяется при смене маршрута, и подписка на старый узел отвалилась бы.
    const update = () => {
      const top = document.querySelector(".scrollarea")?.scrollTop || 0;
      const delta = top - last;
      if (delta < -1) {
        setShow(top > 8);
        last = top;
      } else if (delta > 1) {
        setShow(false);
        last = top;
      }
    };
    document.addEventListener("scroll", update, true);
    return () => document.removeEventListener("scroll", update, true);
  }, []);

  return createPortal(
    <button
      type="button"
      className="press"
      aria-label="Наверх"
      tabIndex={show ? 0 : -1}
      onClick={() => document.querySelector(".scrollarea")?.scrollTo({ top: 0, behavior: "smooth" })}
      style={{
        position: "fixed",
        right: 18,
        bottom: "calc(84px + env(safe-area-inset-bottom, 0px))",
        zIndex: 150,
        width: 46,
        height: 46,
        display: "grid",
        placeItems: "center",
        borderRadius: 999,
        border: `1px solid ${t.border}`,
        background: "transparent",
        color: t.text,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
        cursor: "pointer",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0) scale(1)" : "translateY(8px) scale(0.9)",
        pointerEvents: show ? "auto" : "none",
        transition: `opacity 200ms ease, transform 240ms ${EASE}`,
      }}
    >
      <ArrowUp size={20} />
    </button>,
    document.body
  );
}
