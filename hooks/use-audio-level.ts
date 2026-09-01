"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Heuristic thresholds on the 0-255 byte-frequency scale. Ambient
 * room noise and mic self-noise alone rarely average above ~5-6 even with
 * nothing said; sustained readings below this for several seconds almost
 * always mean a muted/wrong/dead input device rather than a quiet pause
 * in conversation. Tune after real-world usage if false positives show up.
 */
const SILENCE_THRESHOLD = 8;
const SILENCE_WARNING_MS = 6000;

export interface AudioLevelState {
  /** Current average level, 0-255. */
  level: number;
  /** True once the level has stayed at/below SILENCE_THRESHOLD for SILENCE_WARNING_MS straight. */
  isSilent: boolean;
}

/**
 * Live mic-input health for the recorder — lets the UI warn the moment a
 * dead mic or wrong input device is picking up nothing, instead of only
 * finding out after the recording is over.
 */
export function useAudioLevel(stream: MediaStream | null, active: boolean): AudioLevelState {
  const [level, setLevel] = useState(0);
  const [isSilent, setIsSilent] = useState(false);
  const silenceStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !active) {
      setLevel(0);
      setIsSilent(false);
      silenceStartRef.current = null;
      return;
    }

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let frameId: number;

    function tick() {
      frameId = requestAnimationFrame(tick);
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      setLevel(avg);

      const now = Date.now();
      if (avg <= SILENCE_THRESHOLD) {
        if (silenceStartRef.current === null) silenceStartRef.current = now;
        setIsSilent(now - silenceStartRef.current >= SILENCE_WARNING_MS);
      } else {
        silenceStartRef.current = null;
        setIsSilent(false);
      }
    }

    tick();

    return () => {
      cancelAnimationFrame(frameId);
      source.disconnect();
      analyser.disconnect();
      audioContext.close();
    };
  }, [stream, active]);

  return { level, isSilent };
}
