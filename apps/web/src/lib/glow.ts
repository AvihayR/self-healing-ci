import { useEffect } from "react";

/**
 * A soft glow that follows the cursor across glass surfaces.
 *
 * One document listener rather than one per panel, coalesced into a single
 * animation frame. Panels come and go as monitors are added, filtered and
 * removed, so per-element listeners would have to be attached and torn down on
 * every render; `closest()` from the event target costs nothing and is always
 * correct.
 *
 * The glow rides on the panel's own `background-image` rather than an overlay
 * element, so it paints behind text without any stacking-order work and cannot
 * intercept a click.
 */
export function useCursorGlow(): void {
  useEffect(() => {
    let frame = 0;
    let lit: HTMLElement | null = null;
    let pending: { target: HTMLElement | null; x: number; y: number } | null = null;

    function paint() {
      frame = 0;
      if (pending === null) return;
      const { target, x, y } = pending;

      if (lit !== null && lit !== target) {
        lit.removeAttribute("data-lit");
      }

      if (target !== null) {
        const box = target.getBoundingClientRect();
        target.style.setProperty("--mx", `${((x - box.left) / box.width) * 100}%`);
        target.style.setProperty("--my", `${((y - box.top) / box.height) * 100}%`);
        target.setAttribute("data-lit", "true");
      }

      lit = target;
    }

    function onMove(event: PointerEvent) {
      // Touch has no hover, so a cursor glow would only ever flash on tap.
      if (event.pointerType !== "mouse") return;
      const node = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-glass]") : null;
      pending = { target: node, x: event.clientX, y: event.clientY };
      if (frame === 0) frame = requestAnimationFrame(paint);
    }

    function onLeave() {
      pending = { target: null, x: 0, y: 0 };
      if (frame === 0) frame = requestAnimationFrame(paint);
    }

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (frame !== 0) cancelAnimationFrame(frame);
      lit?.removeAttribute("data-lit");
    };
  }, []);
}
