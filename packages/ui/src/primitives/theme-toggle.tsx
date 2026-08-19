import { MoonIcon as Moon, SunIcon as Sun } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "../lib/utils";

export interface ThemeToggleProps {
  /** Extra class names applied to the toggle track */
  className?: string;
}

export function ThemeToggle({ className }: Readonly<ThemeToggleProps>) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <SwitchPrimitive.Root
      data-slot="theme-toggle"
      checked={isDark}
      onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-white/20 bg-white/10 shadow-inner transition-colors outline-none data-[state=checked]:border-black/20 data-[state=checked]:bg-black/30",
        className,
      )}
    >
      <SwitchPrimitive.Thumb
        data-slot="theme-toggle-thumb"
        className="pointer-events-none flex size-5 translate-x-0.5 items-center justify-center rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[calc(100%-2px)]"
      >
        {isDark ? (
          <Moon className="size-3 text-slate-700" />
        ) : (
          <Sun className="size-3 text-amber-500" />
        )}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}
