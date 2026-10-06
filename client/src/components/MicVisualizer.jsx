import { useEffect, useRef } from "react";
import { useTheme } from "../theme/ThemeContext";

const BARS = 28;

export default function MicVisualizer({ stream, height = 56, radius = 6 }) {
  const { t } = useTheme();
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!stream) return undefined;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return undefined;
    let raf = 0;
    let audioCtx;
    try {
      audioCtx = new AC();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const ctx = canvasRef.current.getContext("2d");

      const draw = () => {
        raf = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(data);
        const W = canvasRef.current.width;
        const H = canvasRef.current.height;
        ctx.clearRect(0, 0, W, H);
        const usable = data.length * 0.33;
        const bw = W / BARS;
        for (let i = 0; i < BARS; i++) {
          const v = data[Math.floor((i / BARS) * usable)] / 255;
          const h = Math.max(radius, v * H * 0.92);
          const r = Math.min(bw * 0.64, h) / 2;
          ctx.fillStyle = t.invBg;
          ctx.beginPath();
          ctx.roundRect(i * bw + bw * 0.18, H / 2 - h / 2, bw * 0.64, h, r);
          ctx.fill();
        }
      };
      draw();
    } catch {
      return undefined;
    }
    return () => {
      cancelAnimationFrame(raf);
      audioCtx.close().catch(() => {});
    };
  }, [stream, t.invBg, radius]);

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={height}
      style={{ width: "100%", height, display: "block" }}
    />
  );
}