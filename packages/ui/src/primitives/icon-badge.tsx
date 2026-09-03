import * as React from "react";
import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "../lib/utils";

const iconBadgeVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        sm: "p-1.5 [&_svg:not([class*='size-'])]:size-4",
        default: "p-2 [&_svg:not([class*='size-'])]:size-5",
        lg: "p-2.5 [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface IconBadgeProps extends VariantProps<typeof iconBadgeVariants> {
  /** The icon element to render, e.g. a Phosphor icon. Sized automatically by `variant`
   * unless the icon already carries its own `size-*` class. */
  icon: React.ReactNode;
  /** Background color. Falls back to the theme's `muted-foreground` color when not
   * provided. Applied as a soft color-mix fill when `muted` is true, or solid otherwise. */
  color?: string;
  /** Blends `color` (or the `muted-foreground` default) into a soft, semi-transparent
   * fill instead of a solid background, and switches the icon to white for contrast. */
  muted?: boolean;
  /** Renders the badge as a `<button>` with a hover/focus affordance instead of a plain
   * `<span>`. Omitted entirely when not provided. */
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;
}

function IconBadge({
  icon,
  color,
  muted = false,
  variant = "default",
  onClick,
  className,
  "aria-label": ariaLabel,
}: Readonly<IconBadgeProps>) {
  const backgroundColor = color ?? "var(--muted-foreground)";
  const style = {
    backgroundColor: muted
      ? `color-mix(in oklch, ${backgroundColor} 30%, transparent)`
      : `color-mix(in oklch, ${backgroundColor} 65%, transparent)`,
  };
  const sharedProps = {
    "data-slot": "icon-badge",
    "data-variant": variant,
    "aria-label": ariaLabel,
    className: cn(
      iconBadgeVariants({ variant }),
      !muted && "text-white",
      onClick &&
        "cursor-pointer transition-[filter,background-color] hover:bg-accent hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      className,
    ),
    style,
  };

  if (onClick) {
    return (
      <button type="button" onClick={onClick} {...sharedProps}>
        {icon}
      </button>
    );
  }

  return <span {...sharedProps}>{icon}</span>;
}

export { IconBadge, iconBadgeVariants };
