import { useEffect, useState } from "react";

/**
 * True only for the first committed render, false forever after.
 *
 * The draw animation is meant to be one authored moment when the instrument
 * first comes up. Without this it restarts on every state change, so selecting
 * a row makes the whole table redraw itself — scattered effects instead of one
 * deliberate one.
 */
export function useFirstPaint(): boolean {
  const [first, setFirst] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setFirst(false), 900);
    return () => window.clearTimeout(id);
  }, []);
  return first;
}
