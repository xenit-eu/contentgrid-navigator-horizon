import { cn } from "../../lib/utils";
import { Avatar, AvatarFallback } from "../../primitives/avatar";

// Pieces of the account UI shared by the header's user menu and the phone navigation drawer.

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const AVATAR_FALLBACK_CLASS =
  "border border-[var(--sky-tint-line)] bg-[var(--sky-50)] font-bold text-[var(--ocean)]";

export const APPEARANCE_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export type AppearanceValue = (typeof APPEARANCE_OPTIONS)[number]["value"];

/**
 * The signed-in user as a 36px initials avatar next to the name and e-mail (both truncate).
 * Renders a fragment, so the caller's flex container (a menu label, a drawer row) lays it out.
 */
export function AccountIdentity({ name, email }: Readonly<{ name: string; email: string }>) {
  return (
    <>
      <Avatar className="size-9">
        <AvatarFallback className={cn("text-sm", AVATAR_FALLBACK_CLASS)}>
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13.5px] leading-tight font-bold">{name}</span>
        <span className="text-muted-foreground truncate text-[13px] leading-tight font-normal">
          {email}
        </span>
      </div>
    </>
  );
}

const SEGMENT_BASE_CLASS =
  "border-input bg-popover text-popover-foreground -ml-px h-8 flex-none justify-center rounded-none border px-3.5 py-0 text-[13px] font-semibold first:ml-0 first:rounded-l-lg last:rounded-r-lg";

/** Segment styling for the dropdown's radio items (they hide the check-mark span themselves). */
export const SEGMENT_CLASS = `${SEGMENT_BASE_CLASS} [&>span:first-child]:hidden data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:focus:bg-primary data-[state=checked]:focus:text-primary-foreground dark:data-[state=checked]:text-background dark:data-[state=checked]:focus:text-background`;

/**
 * The Light / Dark / System segmented control for places that are not a dropdown menu (the phone
 * drawer). A radio group with a roving tab stop: arrow keys move and select, as in a native one.
 */
export function AppearanceControl({
  value,
  onValueChange,
  className,
}: Readonly<{
  value: string;
  onValueChange: (value: AppearanceValue) => void;
  className?: string;
}>) {
  const selected = APPEARANCE_OPTIONS.some((option) => option.value === value) ? value : "system";

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = (index + step + APPEARANCE_OPTIONS.length) % APPEARANCE_OPTIONS.length;
    onValueChange(APPEARANCE_OPTIONS[next].value);
    const buttons = event.currentTarget.parentElement?.querySelectorAll("button");
    buttons?.[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label="Appearance" className={cn("flex", className)}>
      {APPEARANCE_OPTIONS.map((option, index) => {
        const checked = option.value === selected;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              SEGMENT_BASE_CLASS,
              "focus-visible:ring-ring cursor-pointer outline-hidden focus-visible:z-10 focus-visible:ring-[3px]",
              checked && "border-primary bg-primary text-primary-foreground dark:text-background",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
