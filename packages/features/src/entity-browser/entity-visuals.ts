/**
 * entity-visuals.ts — maps an entity name/title to a visual identity:
 * a Lucide icon and an accent tint color.
 *
 * Rules:
 * - Keyword-based matching for common nouns (case-insensitive, substring match).
 * - DETERMINISTIC fallback for unknown entities: stable djb2 hash of the
 *   singular name picks from a fixed icon set and accent list, so a given
 *   model always renders the same icon/tint across renders and sessions.
 * - packages/ui must never import this module — keep entity semantics in
 *   packages/features only (per CLAUDE.md boundary rule).
 */
import {
  Building2,
  FileText,
  Globe,
  type LucideIcon,
  Package,
  ScrollText,
  ShoppingCart,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type EntityAccent = "sky" | "ocean" | "breeze" | "sand" | "amber" | "steel";

export interface EntityVisuals {
  /** Lucide icon component — pass directly as <Icon /> */
  icon: LucideIcon;
  /** Tint accent color name — maps to --cg-tint-<accent>-{bg,fg} tokens */
  accent: EntityAccent;
}

// ---------------------------------------------------------------------------
// Keyword table — order matters (first match wins)
// ---------------------------------------------------------------------------

interface KeywordEntry {
  keywords: string[];
  icon: LucideIcon;
  accent: EntityAccent;
}

const KEYWORD_TABLE: KeywordEntry[] = [
  // Documents / files / invoices
  {
    keywords: ["invoice", "bill", "receipt", "document", "doc", "file", "attachment", "report"],
    icon: FileText,
    accent: "sky",
  },
  // Contracts / agreements / scrolls
  {
    keywords: ["contract", "agreement", "policy", "terms", "lease", "license"],
    icon: ScrollText,
    accent: "amber",
  },
  // People / users / customers / contacts
  {
    keywords: ["supplier", "vendor", "provider", "partner"],
    icon: Building2,
    accent: "steel",
  },
  // Products / items / packages / inventory
  {
    keywords: ["product", "item", "sku", "inventory", "stock", "package", "part"],
    icon: Package,
    accent: "sand",
  },
  // Orders / shopping / purchases
  {
    keywords: ["order", "purchase", "cart", "basket", "requisition", "request", "booking"],
    icon: ShoppingCart,
    accent: "ocean",
  },
  // Companies / organisations / globals
  {
    keywords: [
      "company",
      "organisation",
      "organization",
      "firm",
      "agency",
      "client",
      "customer",
      "tenant",
    ],
    icon: Globe,
    accent: "breeze",
  },
  // Buildings / offices / locations
  {
    keywords: ["office", "branch", "location", "site", "building", "department", "division"],
    icon: Building2,
    accent: "ocean",
  },
];

// Fallback sets (deterministic rotation)
const FALLBACK_ICONS: LucideIcon[] = [
  FileText,
  ScrollText,
  Building2,
  Package,
  ShoppingCart,
  Globe,
];
const FALLBACK_ACCENTS: EntityAccent[] = ["sky", "amber", "steel", "sand", "ocean", "breeze"];

// ---------------------------------------------------------------------------
// djb2 hash — stable across runtimes, no crypto needed
// ---------------------------------------------------------------------------

function djb2(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) ^ s.charCodeAt(i);
  }
  return Math.abs(hash);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the visual identity (icon + accent) for an entity given its
 * singular name (e.g. "invoice") and/or its human-readable title
 * (e.g. "Invoices").  Both are optional; pass whatever is available.
 *
 * Matching is keyword-based (case-insensitive substring) over the combined
 * `name + " " + title` string.  Unknown entities fall back to a deterministic
 * assignment based on the name hash so they always render the same.
 *
 * @example
 *   const { icon: Icon, accent } = getEntityVisuals({ name: "invoice" });
 *   // Icon === FileText, accent === "sky"
 */
export function getEntityVisuals(entity: { name: string; title?: string }): EntityVisuals {
  const haystack = `${entity.name} ${entity.title ?? ""}`.toLowerCase();

  for (const entry of KEYWORD_TABLE) {
    if (entry.keywords.some((kw) => haystack.includes(kw))) {
      return { icon: entry.icon, accent: entry.accent };
    }
  }

  // Deterministic fallback
  const h = djb2(entity.name);
  return {
    icon: FALLBACK_ICONS[h % FALLBACK_ICONS.length]!,
    accent: FALLBACK_ACCENTS[h % FALLBACK_ACCENTS.length]!,
  };
}
