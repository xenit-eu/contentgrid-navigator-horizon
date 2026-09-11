import {
  CaretDownIcon as CaretDown,
  GearIcon as Gear,
  SignOutIcon as SignOut,
} from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { Avatar, AvatarFallback } from "../../primitives/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../primitives/dropdown-menu";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UserMenuProps {
  /** Full display name of the signed-in user */
  name: string;
  /** Email address of the signed-in user */
  email: string;
  /** Called when "Settings" is selected */
  onSettingsClick?: () => void;
  /** Called when "Log out" is selected */
  onLogOut?: () => void;
  /** Extra class names applied to the trigger button */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function UserMenu({
  name,
  email,
  onSettingsClick,
  onLogOut,
  className,
}: Readonly<UserMenuProps>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-w-0 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent p-1 text-left text-white outline-none",
            className,
          )}
        >
          <Avatar>
            <AvatarFallback>{getInitials(name)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col leading-none">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="truncate text-xs text-white/70">{email}</span>
          </div>
          <CaretDown className="size-4 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => onSettingsClick?.()}>
          <Gear />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onLogOut?.()}>
          <SignOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
