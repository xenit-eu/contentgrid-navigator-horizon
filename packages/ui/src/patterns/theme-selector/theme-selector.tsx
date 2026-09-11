import { useState } from "react";
import { PaletteIcon as Palette } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/popover";
import { ENTITY_COLOR_SWATCHES } from "../color-picker";

// ---------------------------------------------------------------------------
// Curated themes
// ---------------------------------------------------------------------------

export interface ThemeOption {
  readonly name: string;
  /** Ordered palette — consumers assign these to a list of items, cycling (duplicates allowed). */
  readonly colors: readonly string[];
}

function swatchColors(labels: readonly string[]): readonly string[] {
  return labels.map((label) => {
    const swatch = ENTITY_COLOR_SWATCHES.find((candidate) => candidate.label === label);
    if (!swatch) throw new Error(`Unknown color swatch label: ${label}`);
    return swatch.value;
  });
}

/**
 * Curated color themes, drawing from the same swatches as `ColorPicker` for consistency
 * (Monochrome adds a couple of extra neutral shades not otherwise offered as swatches).
 */
export const ENTITY_COLOR_THEMES: readonly ThemeOption[] = [
  {
    name: "Vibrant",
    colors: swatchColors(["Green", "Orange", "Purple", "Blue", "Pink", "Teal"]),
  },
  {
    name: "Warm",
    colors: swatchColors(["Red", "Orange", "Yellow", "Pink"]),
  },
  {
    name: "Cool",
    colors: swatchColors(["Blue", "Cyan", "Teal", "Indigo", "Green"]),
  },
  {
    name: "Nature",
    colors: swatchColors(["Green", "Lime", "Teal", "Yellow"]),
  },
  {
    name: "Jewel",
    colors: swatchColors(["Purple", "Indigo", "Pink", "Blue"]),
  },
  {
    name: "Monochrome",
    colors: ["oklch(0.30 0.02 260)", "oklch(0.45 0.02 260)", "oklch(0.65 0.02 260)"],
  },
];

// ---------------------------------------------------------------------------
// ThemeSelector
// ---------------------------------------------------------------------------

export interface ThemeSelectorProps {
  readonly themes: readonly ThemeOption[];
  /** Selected theme's `name`, or `undefined` if none selected. */
  readonly value: string | undefined;
  readonly onValueChange: (name: string) => void;
  /** Called when "Apply theme" is clicked — the component only exposes selection; assigning
   * the theme's colors to whatever the caller manages (e.g. one color per entity) is the
   * caller's responsibility. */
  readonly onApply: () => void;
  readonly applyDisabled?: boolean;
  readonly className?: string;
}

export function ThemeSelector({
  themes,
  value,
  onValueChange,
  onApply,
  applyDisabled,
  className,
}: Readonly<ThemeSelectorProps>) {
  const [open, setOpen] = useState(false);

  function handleApply() {
    onApply();
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("justify-start gap-2", className)}>
          <Palette className="size-4 shrink-0" aria-hidden />
          <span>Theme</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div role="radiogroup" aria-label="Color theme" className="flex flex-col gap-1">
          {themes.map((theme) => (
            <button
              key={theme.name}
              type="button"
              role="radio"
              aria-checked={value === theme.name}
              onClick={() => onValueChange(theme.name)}
              className={cn(
                "flex items-center gap-2 rounded-md border p-2 hover:bg-accent",
                value === theme.name ? "border-primary bg-accent" : "border-transparent",
              )}
            >
              <span className="flex -space-x-1">
                {theme.colors.slice(0, 5).map((color, index) => (
                  <span
                    key={`${color}-${index}`}
                    className="size-4 rounded-full border border-background"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                ))}
              </span>
              <span className="text-sm">{theme.name}</span>
            </button>
          ))}
        </div>
        <Button
          type="button"
          className="w-full"
          onClick={handleApply}
          disabled={applyDisabled || !value}
        >
          Apply theme
        </Button>
      </PopoverContent>
    </Popover>
  );
}
