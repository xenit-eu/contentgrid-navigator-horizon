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
