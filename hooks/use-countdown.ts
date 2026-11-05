"use client";

import { useEffect, useState } from "react";

/** Whole seconds left, ticking down to 0 */
export function useCountdown() {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  return { left, start: setLeft };
}
