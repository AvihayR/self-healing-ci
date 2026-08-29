import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const KEY = "canary-theme";

function initial(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Private browsing, or site data blocked. Fall through to the system value.
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Not fatal: the choice simply will not survive a reload.
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((current) => (current === "dark" ? "light" : "dark")), []);
  return [theme, toggle];
}
