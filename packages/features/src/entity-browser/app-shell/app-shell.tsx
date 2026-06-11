import type { ReactNode } from "react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { ChevronDownIcon, LayersIcon, LogOutIcon, PlusIcon } from "lucide-react";
import { useAppAuth, useProfile } from "@contentgrid/navigator-data";
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
} from "@contentgrid/ui";
import { LogomarkDiap } from "@contentgrid/ui";
import { getEntityVisuals } from "../entity-visuals";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

// ---------------------------------------------------------------------------
// Shell header
// ---------------------------------------------------------------------------

function ShellHeader() {
  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between px-6 text-primary-foreground shadow-[inset_0_-3px_0_var(--cg-color-sky)]"
      style={{ background: "var(--cg-gradient-header)" }}
    >
      {/* Left: logomark + wordmark */}
      <div className="flex items-center gap-2.5">
        <LogomarkDiap size={38} />
        <div className="flex flex-col leading-none">
          <span
            className="text-[16px] font-bold leading-none tracking-[-0.01em]"
            style={{ color: "#fff" }}
          >
            <span style={{ color: "#2FB9F0" }}>content</span>grid
          </span>
          <span
            className="mt-[3px] block text-[9px] font-semibold"
            style={{ letterSpacing: "0.26em", color: "var(--cg-color-header-dim)" }}
          >
            BY AMEXIO
          </span>
        </div>
      </div>

      {/* Right: user menu */}
      <UserMenu />
    </header>
  );
}

// ---------------------------------------------------------------------------
// User menu
// ---------------------------------------------------------------------------

function UserMenu() {
  const { auth } = useAppAuth();
  const profile = auth.user?.profile;

  const name: string = profile?.name ?? profile?.preferred_username ?? profile?.email ?? "User";
  const email: string = profile?.email ?? "";
  const initials = getInitials(name);

  function handleSignOut() {
    auth.signoutRedirect().catch(() => auth.removeUser());
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-primary-foreground hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <Avatar className="size-[30px]">
            <AvatarFallback
              className="text-[11px] font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, var(--cg-color-sky), #026CA0)",
              }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden flex-col text-left sm:flex">
            <span className="text-[13px] font-medium leading-none">{name}</span>
            {email && (
              <span
                className="mt-0.5 text-[11px] leading-none"
                style={{ color: "var(--cg-color-header-dim)" }}
              >
                {email}
              </span>
            )}
          </span>
          <ChevronDownIcon
            className="size-3.5 shrink-0"
            style={{ color: "var(--cg-color-header-dim)" }}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{name}</p>
          {email && <p className="text-muted-foreground text-xs">{email}</p>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          <LogOutIcon className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Sidebar nav items (entity list)
// ---------------------------------------------------------------------------

function EntityNavItems() {
  const profile = useProfile();
  const matchRoute = useMatchRoute();

  if (profile.isPending) {
    return (
      <>
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
      </>
    );
  }

  if (profile.isError || !profile.data) {
    return null;
  }

  return (
    <>
      {profile.data.map((entity) => {
        const isActive = !!matchRoute({
          to: "/$collection",
          params: { collection: entity.name },
        });
        const { icon: Icon, accent } = getEntityVisuals(entity);

        // Map accent to icon color CSS variable
        const iconColorVar = `var(--cg-ic-${accent === "breeze" ? "sky" : accent})`;

        return (
          <Link
            key={entity.name}
            to="/$collection"
            params={{ collection: entity.name }}
            search={{ cursor: undefined, sort: undefined }}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-[var(--cg-color-midnight)] hover:bg-muted ${
              isActive
                ? "bg-[rgba(1,155,227,0.12)] font-medium text-[var(--cg-color-ocean)] shadow-[inset_2px_0_0_var(--cg-color-sky)]"
                : ""
            }`}
          >
            <Icon
              size={15}
              strokeWidth={1.8}
              className="shrink-0"
              style={{ color: isActive ? "var(--cg-color-ocean)" : iconColorVar }}
            />
            <span className="min-w-0 flex-1 truncate">{entity.title}</span>
          </Link>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function ShellSidebar() {
  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-r border-border bg-card px-3 py-[18px]">
      {/*
        "Create" button — global sidebar affordance.
        RBAC note: this button is always shown because it opens a context-picker
        and there is no cheap global signal for whether ANY entity allows create.
        Once the user selects an entity, the create form will gate on canCreate
        from that entity's schema.  TODO(HZN-7.4): hide when no entity at all
        exposes a create-form template.
      */}
      <Button
        className="mb-3.5 h-auto w-full justify-start gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white shadow-[0_2px_6px_-2px_rgba(8,71,114,.4)] hover:brightness-110"
        style={{ background: "var(--cg-gradient-create)" }}
      >
        <PlusIcon className="size-[17px] shrink-0" />
        Create
      </Button>

      {/* "Entities" section label */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cg-color-text-dim)]">
        <LayersIcon className="size-3.5 text-muted-foreground" />
        Entities
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1">
        <EntityNavItems />
      </nav>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

export interface AppShellProps {
  children?: ReactNode;
}

export function AppShell({ children }: Readonly<AppShellProps>) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Full-width gradient header across the very top */}
      <ShellHeader />

      {/* Below the header: sidebar | main content */}
      <div className="flex min-h-0 flex-1">
        <ShellSidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-auto">{children}</main>
      </div>
    </div>
  );
}
