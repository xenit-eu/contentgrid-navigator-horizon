import type { ReactNode } from "react";
import { SignOutIcon as SignOut } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { cn } from "../../lib/utils";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../../primitives/sidebar";
import { AccountIdentity, AppearanceControl } from "../user-menu/account-parts";

export interface PhoneMenuAccountProps {
  /** Full display name of the signed-in user */
  name: string;
  /** Email address of the signed-in user */
  email: string;
  /** Called when "Log out" is selected */
  onLogOut?: () => void;
  /** Rows between the Light / Dark / System control and Log out — the Settings row. */
  children?: ReactNode;
  /** Extra class names applied to the footer block */
  className?: string;
}

/**
 * Footer of the phone navigation drawer, below a top border: the avatar with name and e-mail, the
 * Light / Dark / System control, the rows given as children (Settings) and a red Log out row.
 * Pass it to `Sidebar` as `mobileFooter`. The header's avatar menu offers the same on desktop.
 */
export function PhoneMenuAccount({
  name,
  email,
  onLogOut,
  children,
  className,
}: Readonly<PhoneMenuAccountProps>) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      data-slot="phone-menu-account"
      className={cn(
        "border-sidebar-border flex shrink-0 flex-col gap-1 border-t px-3 pt-2.5 pb-3",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-2.5 py-1">
        <AccountIdentity name={name} email={email} />
      </div>
      <div className="px-2.5 py-1">
        <AppearanceControl value={theme ?? "system"} onValueChange={setTheme} />
      </div>
      <SidebarMenu>
        {children}
        <SidebarMenuItem>
          <SidebarMenuButton className="text-destructive" onClick={() => onLogOut?.()}>
            <SignOut aria-hidden />
            <span>Log out</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  );
}
