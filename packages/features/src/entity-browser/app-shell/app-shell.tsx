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
    <header className="flex h-14 shrink-0 items-center justify-between bg-primary px-6 text-primary-foreground">
      {/* Left: logo glyph + wordmark */}
      <div className="flex items-center gap-2.5">
        <div className="flex size-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-white">
          {/* ContentGrid logo mark (placeholder per mockup; matches the Home welcome glyph) */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M6 6 L14 14 M18 14 L26 6 M6 26 L14 18 M18 18 L26 26 M14 14 L14 18 L18 18 L18 14 Z"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="square"
              fill="none"
            />
          </svg>
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight text-white">contentgrid</span>
          <span className="mt-0.5 text-[11px] font-medium tracking-[0.22em] text-[#B1CFE7]">
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
            <AvatarFallback className="bg-white/12 text-[11px] font-semibold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden flex-col text-left sm:flex">
            <span className="text-[13px] font-medium leading-none">{name}</span>
            {email && (
              <span className="mt-0.5 text-[11px] leading-none text-[#B1CFE7]">{email}</span>
            )}
          </span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-70" />
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
        return (
          <Link
            key={entity.name}
            to="/$collection"
            params={{ collection: entity.name }}
            search={{ cursor: undefined, sort: undefined }}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-[var(--cg-color-midnight)] hover:bg-muted ${
              isActive ? "bg-muted font-medium shadow-[inset_2px_0_0_var(--cg-color-ocean)]" : ""
            }`}
          >
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
      <Button className="mb-3.5 h-auto w-full justify-start gap-2.5 rounded-lg bg-primary px-3 py-2.5 text-[13px] font-medium text-primary-foreground hover:bg-[var(--cg-color-ocean-700)]">
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
      {/* Full-width ocean header across the very top */}
      <ShellHeader />

      {/* Below the header: sidebar | main content */}
      <div className="flex min-h-0 flex-1">
        <ShellSidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-auto">{children}</main>
      </div>
    </div>
  );
}
