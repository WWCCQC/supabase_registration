"use client";

import { useEffect, useState } from "react";

/**
 * Current value of <html data-theme> ("light" | "dark" | null when the page is not themed).
 * For canvas / WebGL drawings that cannot use CSS variables directly: add it to the draw
 * effect's deps and read colours with cssVar() so they redraw on theme change.
 */
export function useThemeName(): string | null {
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.getAttribute("data-theme"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

/** Resolved value of a CSS custom property, e.g. cssVar("--border"). */
export function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
