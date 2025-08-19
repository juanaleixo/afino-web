"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const ThemeSwitch = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  // When mounted on client, now we can show the UI
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" className="h-9 w-9 animate-pulse">
        <div className="h-4 w-4 bg-muted rounded" />
      </Button>
    );
  }

  const isDark = theme === "dark" || resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="h-9 w-9 relative overflow-hidden transition-all duration-300 hover:scale-105 hover:bg-accent"
      aria-label={`Mudar para tema ${isDark ? 'claro' : 'escuro'}`}
      title={`Mudar para tema ${isDark ? 'claro' : 'escuro'}`}
    >
      <div className="relative h-4 w-4">
        <Sun 
          className={`h-4 w-4 absolute transition-all duration-500 ${
            isDark 
              ? 'rotate-90 scale-0 opacity-0' 
              : 'rotate-0 scale-100 opacity-100'
          }`}
        />
        <Moon 
          className={`h-4 w-4 absolute transition-all duration-500 ${
            isDark 
              ? 'rotate-0 scale-100 opacity-100' 
              : '-rotate-90 scale-0 opacity-0'
          }`}
        />
      </div>
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
};

export default ThemeSwitch;
