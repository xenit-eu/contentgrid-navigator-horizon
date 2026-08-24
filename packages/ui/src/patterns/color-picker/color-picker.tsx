import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";
import { Input } from "../../primitives/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/popover";

// ---------------------------------------------------------------------------
// Curated swatches
// ---------------------------------------------------------------------------

export interface ColorSwatch {
  readonly label: string;
  readonly value: string;
}

/**
 * Curated preset swatches, matching the accent hues of
 * `@contentgrid/navigator-data`'s theme `COLOR_PRESETS` for visual consistency
 * (kept as an independent literal here — `packages/ui` must not import
 * `navigator-data`, per its forbidden-imports rule).
 */
export const ENTITY_COLOR_SWATCHES: readonly ColorSwatch[] = [
  { label: "Green", value: "oklch(0.55 0.17 155)" },
  { label: "Lime", value: "oklch(0.65 0.17 125)" },
  { label: "Yellow", value: "oklch(0.75 0.15 95)" },
  { label: "Orange", value: "oklch(0.65 0.18 55)" },
  { label: "Red", value: "oklch(0.55 0.20 25)" },
  { label: "Pink", value: "oklch(0.60 0.20 340)" },
  { label: "Purple", value: "oklch(0.55 0.18 290)" },
  { label: "Indigo", value: "oklch(0.50 0.20 280)" },
  { label: "Blue", value: "oklch(0.55 0.18 250)" },
  { label: "Cyan", value: "oklch(0.60 0.13 220)" },
  { label: "Teal", value: "oklch(0.58 0.14 190)" },
  { label: "Slate", value: "oklch(0.45 0.02 260)" },
];

// ---------------------------------------------------------------------------
// ColorPicker
// ---------------------------------------------------------------------------

export interface ColorPickerProps {
  /** Currently selected CSS color (any valid `color` value), or `undefined` if unset. */
  readonly value: string | undefined;
  /** Called with the new CSS color, from a preset swatch or the custom input. */
  readonly onChange: (color: string) => void;
  readonly className?: string;
}

export function ColorPicker({ value, onChange, className }: Readonly<ColorPickerProps>) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          aria-label={value ? `Color: ${value}` : "Choose color"}
          className={cn("rounded-full p-0", className)}
        >
          <span
            className="size-4 rounded-full border"
            style={{ backgroundColor: value }}
            aria-hidden
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <div className="grid grid-cols-6 gap-2">
          {ENTITY_COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch.value}
              type="button"
              title={swatch.label}
              aria-label={swatch.label}
              aria-pressed={value === swatch.value}
              onClick={() => onChange(swatch.value)}
              className={cn(
                "size-7 rounded-full border-2",
                value === swatch.value ? "border-foreground" : "border-transparent",
              )}
              style={{ backgroundColor: swatch.value }}
            />
          ))}
        </div>
        <Input
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Custom color (hex, oklch, …)"
          aria-label="Custom color value"
        />
      </PopoverContent>
    </Popover>
  );
}
