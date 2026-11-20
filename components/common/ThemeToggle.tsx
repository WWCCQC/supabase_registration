"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { readStoredTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Light/dark switch. Mounting it opts the current page into theming; unmounting returns the document to light. */
export default function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme | null>(null);

  React.useEffect(() => {
    const root = document.documentElement;
    const apply = (t: Theme) => {
      root.setAttribute("data-theme", t);
      setTheme(t);
    };
    apply(readStoredTheme() ?? systemTheme());

    // Follow the OS setting until the user picks a theme explicitly.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (!readStoredTheme()) apply(systemTheme());
    };
    media.addEventListener("change", onSystemChange);
    return () => {
      media.removeEventListener("change", onSystemChange);
      root.removeAttribute("data-theme");
    };
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice still applies for this visit.
    }
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  };

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="topbar-theme-toggle"
      onClick={toggle}
      aria-label={isDark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
      title={isDark ? "โหมดสว่าง" : "โหมดมืด"}
      disabled={theme === null}
    >
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
