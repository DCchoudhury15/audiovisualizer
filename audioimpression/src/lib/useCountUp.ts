"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 → `target` over `duration` ms using rAF.
 * Re-runs whenever `target` changes (e.g. when a new prediction arrives).
 */
export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  const frame = useRef<number | null>(null);
  const startTs = useRef<number | null>(null);

  useEffect(() => {
    startTs.current = null;
    const tick = (ts: number) => {
      startTs.current ??= ts;
      const elapsed = ts - startTs.current;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [target, duration]);

  return value;
}