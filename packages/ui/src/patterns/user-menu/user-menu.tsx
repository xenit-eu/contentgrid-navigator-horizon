import { GearIcon as Gear, SignOutIcon as SignOut } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { cn } from "../../lib/utils";
import { Avatar, AvatarFallback } from "../../primitives/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../primitives/dropdown-menu";
import {
  APPEARANCE_OPTIONS,
  AVATAR_FALLBACK_CLASS,
  AccountIdentity,
  SEGMENT_CLASS,
  getInitials,
} from "./account-parts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface UserMenuProps {
  /** Full display name of the signed-in user */
  name: string;
  /** Email address of the signed-in user */
  email: string;
  /** A settings page is open: the Settings item shows the "current" (sky tint) state. */
  settingsCurrent?: boolean;
  /** Called when "Settings" is selected */
  onSettingsClick?: () => void;
  /** Called when "Log out" is selected */
  onLogOut?: () => void;
  /** Start with the menu open (stories and visual snapshots). */
  defaultOpen?: boolean;
  /** Extra class names applied to the trigger button */
  className?: string;
}

const ITEM_CLASS = "h-[34px] gap-2.5 rounded-md px-2.5 py-0 text-[13.5px]";

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function UserMenu({
  name,
  email,
  settingsCurrent = false,
  onSettingsClick,
  onLogOut,
  defaultOpen,
  className,
}: Readonly<UserMenuProps>) {
  const initials = getInitials(name);
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu, ${name}`}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg border-0 bg-white/15 p-1 text-white outline-none hover:bg-white/20 focus-visible:ring-[3px] focus-visible:ring-white/50 data-[state=open]:bg-white/20",
            className,
          )}
        >
          <Avatar className="size-[30px]">
            <AvatarFallback className={cn("text-xs", AVATAR_FALLBACK_CLASS)}>
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="flex w-[264px] flex-col gap-0.5 rounded-[10px] p-1.5 shadow-[0_12px_32px_rgba(14,36,54,0.15)]"
      >
        <DropdownMenuLabel className="flex items-center gap-3 px-2.5 py-2">
          <AccountIdentity name={name} email={email} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mx-0 my-1" />
        <DropdownMenuLabel className="text-muted-foreground px-2.5 pt-2 pb-1 text-[11px] font-bold tracking-widest uppercase">
          Appearance
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          aria-label="Appearance"
          value={theme ?? "system"}
          onValueChange={setTheme}
          className="flex px-2.5 pb-1.5"
        >
          {APPEARANCE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className={SEGMENT_CLASS}
              // Keep the menu open so the change is visible straight away.
              onSelect={(event) => event.preventDefault()}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className="mx-0 my-1" />
        <DropdownMenuItem
          className={cn(
            ITEM_CLASS,
            "data-[current=true]:bg-accent data-[current=true]:font-semibold",
          )}
          data-current={settingsCurrent}
          aria-current={settingsCurrent ? "page" : undefined}
          onSelect={() => onSettingsClick?.()}
        >
          <Gear />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator className="mx-0 my-1" />
        <DropdownMenuItem
          className={ITEM_CLASS}
          variant="destructive"
          onSelect={() => onLogOut?.()}
        >
          <SignOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
