import { useCallback, useRef, useState } from "react";

/**
 * Track an element's content width so SVG charts render at 1:1 pixels.
 * A callback ref, so it also measures elements that only appear once data has loaded.
 */
export function useWidth<T extends HTMLElement>(initial = 600) {
  const [width, setWidth] = useState(initial);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    setWidth(Math.floor(el.getBoundingClientRect().width));
    observer.current = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.current.observe(el);
  }, []);
  return [ref, width] as const;
}

/**
 * Pointer x inside an element, in the element's own CSS pixels. The phone app scales the
 * page (CSS zoom), and then clientX / getBoundingClientRect are in scaled screen pixels
 * while the chart draws in unscaled ones; offsetWidth vs rect width undoes that.
 */
export function localX(e: { clientX: number; currentTarget: HTMLElement }): number {
  const r = e.currentTarget.getBoundingClientRect();
  return ((e.clientX - r.left) * e.currentTarget.offsetWidth) / (r.width || 1);
}
