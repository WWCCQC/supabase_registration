// Dark mode is opt-in per page: only pages that render <ThemeToggle /> get a data-theme attribute.
// Pages without it keep the light token values from :root in globals.css.
export const THEME_STORAGE_KEY = "theme";
export const THEMED_PATHS = ["/"];

export type Theme = "light" | "dark";

export function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

/** Runs before first paint on themed paths so the page does not flash light before switching to dark. */
export const themeInitScript = `(function(){try{
if(${JSON.stringify(THEMED_PATHS)}.indexOf(location.pathname)<0)return;
var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
document.documentElement.setAttribute("data-theme",t);
}catch(e){}})();`;
