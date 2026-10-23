import type { ReactNode } from "react";
import {
  CalendarIcon,
  CalendarPlusIcon,
  CheckCircleIcon,
  ClockIcon,
  EqualsIcon,
  HashIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  PenIcon,
  TextAaIcon,
  ToggleLeftIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { ProfileAttributeSearchType } from "@contentgrid/navigator-data";
import type { SearchValueKind } from "../util/types";

/**
 * Presentation map: which icon stands for a search type, an audit role or a boolean value.
 * Boolean icons and the "modified" pen match the entity item attribute renderers
 * (`../../entity-item/attributes/renderers/`), so a value looks the same everywhere. "Created"
 * uses a calendar-plus rather than the renderer's plain calendar, so it stays distinguishable
 * from an ordinary date quick filter next to it.
 */

const ICON_SIZE = 14;

/** Icon for a search parameter's type indicator (FR-008). */
export function searchTypeIcon(
  valueKind: SearchValueKind,
  searchType?: ProfileAttributeSearchType,
): ReactNode {
  switch (valueKind) {
    case "text":
      if (searchType === ProfileAttributeSearchType.prefixMatch) {
        return <TextAaIcon size={ICON_SIZE} aria-hidden />;
      }
      if (searchType === ProfileAttributeSearchType.fullText) {
        return <MagnifyingGlassIcon size={ICON_SIZE} aria-hidden />;
      }
      return <EqualsIcon size={ICON_SIZE} aria-hidden />;
    case "allowed-values":
      return <ListChecksIcon size={ICON_SIZE} aria-hidden />;
    case "integer":
    case "decimal":
      return <HashIcon size={ICON_SIZE} aria-hidden />;
    case "date":
      return <CalendarIcon size={ICON_SIZE} aria-hidden />;
    case "datetime":
      return <ClockIcon size={ICON_SIZE} aria-hidden />;
    case "boolean":
      return <ToggleLeftIcon size={ICON_SIZE} aria-hidden />;
  }
}

/** Dedicated icons of the created / modified audit dates (FR-027). */
export function auditRoleIcon(role: "created" | "modified"): ReactNode {
  return role === "created" ? (
    <CalendarPlusIcon size={ICON_SIZE} aria-hidden />
  ) : (
    <PenIcon size={ICON_SIZE} aria-hidden />
  );
}

/** The true / false icons boolean values use elsewhere in the product (FR-028). */
export function booleanValueIcon(value: boolean): ReactNode {
  return value ? (
    <CheckCircleIcon size={ICON_SIZE} aria-hidden />
  ) : (
    <XCircleIcon size={ICON_SIZE} aria-hidden />
  );
}
