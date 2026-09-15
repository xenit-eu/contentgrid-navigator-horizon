import type { ReactNode } from "react";
import { LinkIcon as Link, PlusIcon as Plus } from "@phosphor-icons/react";
import { Button } from "../../primitives/button";
import { Card, CardContent, CardHeader } from "../../primitives/card";
import { RequiredMarker } from "../form-renderers/field-shell";

export interface RelationSectionProps {
  /** Human-readable relation title, e.g. "Invoices" */
  title: string;
  /** Renders a destructive-styled required marker next to the title, matching FieldShell/BooleanRenderer. */
  required?: boolean;
  /**
   * Called when the user clicks the "Link" action. Presence-driven, like the rest of this
   * codebase's permission convention: omit entirely to hide the action (e.g. read-only), rather
   * than passing a `disabled` flag.
   */
  onLink?: () => void;
  /**
   * The relation's own content — however the caller wants to display its linked item(s) (a
   * compact card, a table, a bare list, a loading skeleton, an error message — this component has
   * no opinion and does none of that rendering itself). Omit entirely (rather than passing an
   * empty list/table) to show the built-in "nothing linked yet" prompt instead.
   */
  children?: ReactNode;
}

/**
 * Generic "linked relation" card: a title, an optional "Link" action, and whatever content the
 * caller passes as `children`. Deliberately just chrome — like `Card` itself, it has no knowledge
 * of relation items, columns, cardinality, or unlink permissions. Callers (the to-one/to-many
 * field renderers) own building their own preview content and pass it in, so this stays a single,
 * reusable wrapper instead of baking one specific data shape into a shared component.
 */
export function RelationSection({
  title,
  required,
  onLink,
  children,
}: Readonly<RelationSectionProps>) {
  return (
    <Card className="py-4 gap-4">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {title}
            {required && <RequiredMarker />}
          </h3>
          {children && onLink && (
            <Button type="button" variant="outline" size="sm" onClick={onLink}>
              <Plus className="size-4" />
              Link {title}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {children ?? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-10">
            <div className="bg-muted rounded-full p-3">
              <Link className="text-muted-foreground size-6" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">No {title.toLowerCase()} linked</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Link one or more {title.toLowerCase()} to this item
              </p>
            </div>
            {onLink && (
              <Button type="button" variant="outline" size="sm" onClick={onLink}>
                <Plus className="size-4" />
                Link {title}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
