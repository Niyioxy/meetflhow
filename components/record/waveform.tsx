"use client";

import { useEffect, useRef } from "react";

export function Waveform({ stream, active }: { stream: MediaStream | null; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!stream || !active || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let frameId: number;

    function draw() {
      frameId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const { width, height } = canvas;
      ctx!.clearRect(0, 0, width, height);

      const barCount = 40;
      const barWidth = width / barCount - 2;
      let x = 0;

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[Math.floor((i / barCount) * bufferLength)] ?? 0;
        const barHeight = Math.max(2, (value / 255) * height);
        ctx!.fillStyle = "#60A5FA";
        ctx!.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 2;
      }
    }

    draw();

    return () => {
      cancelAnimationFrame(frameId);
      source.disconnect();
      analyser.disconnect();
      audioContext.close();
    };
  }, [stream, active]);

  return <canvas ref={canvasRef} width={300} height={60} className="h-[60px] w-[300px]" />;
}
