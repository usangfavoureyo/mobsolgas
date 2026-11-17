"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type ThemePreference = "system" | "light" | "dark";
type ThemeContextValue = { preference: ThemePreference; setPreference: (value: ThemePreference) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);
const storageKey = "mobsol-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setState] = useState<ThemePreference>("system");

  const apply = useCallback((value: ThemePreference) => {
    const dark = value === "dark" || (value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    const initial: ThemePreference = stored === "light" || stored === "dark" ? stored : "system";
    setState(initial);
    apply(initial);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const current = window.localStorage.getItem(storageKey);
      if (current !== "light" && current !== "dark") apply("system");
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [apply]);

  const setPreference = (value: ThemePreference) => {
    setState(value);
    window.localStorage.setItem(storageKey, value);
    apply(value);
  };

  return <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useThemePreference must be used inside ThemeProvider");
  return value;
}
