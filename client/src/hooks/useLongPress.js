import { useRef } from "react";

export default function useLongPress({ onClick, onLongPress, delay = 450 }) {
  const timer = useRef(null);
  const fired = useRef(false);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const handlePointerDown = () => {
    if (!onLongPressRef.current) return;
    fired.current = false;
    clear();
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPressRef.current();
    }, delay);
  };

  const handleClickCapture = (e) => {
    if (fired.current) {
      e.preventDefault();
      e.stopPropagation();
      fired.current = false;
      return;
    }
    onClickRef.current?.(e);
  };

  return {
    onClickCapture: handleClickCapture,
    onPointerDown: handlePointerDown,
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (e) => fired.current && e.preventDefault(),
  };
}