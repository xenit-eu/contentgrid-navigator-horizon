import { DatabaseIcon, type Icon } from "@phosphor-icons/react";
import { resolveEntityIcon } from "@contentgrid/ui";

/**
 * Resolves `preferences.icon` to its icon component. `preferences.icon` is always populated
 * — `ProfileEntity.getDefaultPreferences()` already seeds a content-vs-database heuristic
 * default — so this only guards against a name that no longer resolves (e.g. a stale user
 * override left over from before a future change to the curated icon set).
 */
export function resolveEntityCardIcon(iconName: string | undefined): Icon {
  return resolveEntityIcon(iconName) ?? DatabaseIcon;
}
