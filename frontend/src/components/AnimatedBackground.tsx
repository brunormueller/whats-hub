"use client";

import { useEffect, useRef } from "react";

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame: number;
    let time = 0;

    const lines = 20;
    const lineWeight = 50;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const { width, height } = canvas;

      time++;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      // ctx.fillStyle = "black";
      // ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "screen";
      ctx.lineWidth = lineWeight;
      ctx.lineCap = "round";

      for (let i = 0; i < lines; i++) {
        const r =
          30 + 30 * Math.sin(0.4 - i * 0.1 + time * 0.05);

        const g =
          150 + 80 * Math.sin(i * 0.1 + time * 0.1);

        const b =
          220 + 35 * Math.sin(time * 0.1);

        const a =
          100 * Math.sin((Math.PI * i) / lines);



        const p1y =
          height * 0.5 -
          10 *
          Math.pow(
            (height * (i + 3)) / lines,
            0.5
          ) +
          2 *
          Math.pow(
            (height * 0.5 * (lines - i)) / lines,
            Math.sin((time - 20) * 0.02 + 0.2)
          );
        //         const p1x =
        //           -i - i * Math.cos(time * 0.05);
        //         const p2x =
        //           width / 2 +
        //           width *
        //           (0.4 * Math.cos(i * 0.01 + time * 0.05));
        //  const p3x =
        //           width +
        //           5 +
        //           5 * Math.sin(time * 0.02 - Math.PI * 0.4);

        const SPEED = 0.01;

        const p1x =
          -i - i * Math.cos(time * SPEED);

        const p2x =
          width / 2 +
          width * (0.4 * Math.cos(i * 0.01 + time * SPEED));

        const p3x =
          width +
          5 +
          5 * Math.sin(time * SPEED * 0.5 - Math.PI * 0.4);

        const p3y =
          height -
          Math.pow(
            (height * (i + lines * 0.2)) / lines,
            0.7 + 0.3 * Math.sin(time * SPEED * 0.7 + 0.3)
          );

        const p2y =
          height *
          (0.5 +
            0.5 *
            Math.sin(
              Math.PI * 0.5 +
              (i * Math.PI) / lines
            )) -
          500 *
          Math.pow(
            Math.sin(i / lines + Math.PI),
            6
          ) +
          2 *
          Math.pow(
            (height * 0.5 * (lines - i)) / lines,
            Math.sin((time - 15) * 0.02 + 0.2)
          );



        // const p3y =
        //   height -
        //   Math.pow(
        //     (height * (i + lines * 0.2)) / lines,
        //     0.7 + 0.3 * Math.sin(time * 0.03 + 0.3)
        //   );

        ctx.strokeStyle = `rgba(0, 255, 100, ${a / 100})`;

        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.quadraticCurveTo(
          p2x,
          p2y,
          p3x,
          p3y
        );
        ctx.stroke();
      }

      animationFrame = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute right-0 top-20 w-[10%] h-[10%]"
    />
  );
}