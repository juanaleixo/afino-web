"use client";

import { useEffect, useState } from "react";
import { useTheme as useNextTheme } from "next-themes";

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : false;
  const isLight = mounted ? resolvedTheme === "light" : false;
  const isSystem = mounted ? theme === "system" : false;

  return {
    theme,
    setTheme,
    resolvedTheme,
    isDark,
    isLight,
    isSystem,
    mounted,
  };
}