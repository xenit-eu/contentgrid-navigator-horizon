import type { ProblemAlertProps } from "../../problem-details";

/** Opens a related entity item; navigation is left to the caller. */
export type RelationItemClickHandler = (profileEntityName: string, itemId: string) => void;

/** Starts creating an item of a relation's target entity; navigation is left to the caller. */
export type RelationItemCreateHandler = (profileEntityName: string) => void;

/** Callbacks for the actionable problems a failed relation mutation can return. */
export type RelationProblemHandlers = Pick<
  ProblemAlertProps,
  "onMissingRelationTargetClick" | "onBlindRelationOverwriteClick" | "onRequiredRelationClick"
>;

/** How a relation section presents itself; every field is optional and keeps today's default. */
export interface RelationSectionDisplayProps {
  /** `"card"` (default): a standalone card. `"row"`: a flat row in a list inside one card. */
  readonly variant?: "card" | "row";
  /** Controls whether the section is expanded; omit to let the section manage it. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}
