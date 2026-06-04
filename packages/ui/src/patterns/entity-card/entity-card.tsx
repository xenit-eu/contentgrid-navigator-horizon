import { Database, FileText, Plus } from "lucide-react";
import { Button } from "../../primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../primitives/card";

export interface EntityCardProps {
  /** Unique identifier / URL-safe name for this entity (used in callback) */
  name: string;
  /** Human-readable title */
  title: string;
  /** Total item count; shown as "—" when undefined */
  count?: number;
  /** Optional description shown below the title */
  description?: string;
  /** When true a FileText icon is shown, otherwise a Database icon */
  hasContent?: boolean;
  /** Called when the user clicks the create-action button */
  onCreateClick?: (entityName: string) => void;
  /** Called when the user clicks the card title / entity link */
  onTitleClick?: (entityName: string) => void;
}

export function EntityCard({
  name,
  title,
  count,
  description,
  hasContent,
  onCreateClick,
  onTitleClick,
}: EntityCardProps) {
  return (
    <Card className="group relative transition-colors hover:border-primary/50">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-lg">
            <button
              type="button"
              className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md text-left after:absolute after:inset-0 after:content-['']"
              onClick={() => onTitleClick?.(name)}
            >
              {hasContent ? (
                <FileText className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Database className="h-5 w-5 text-muted-foreground" />
              )}
              {title}
            </button>
          </CardTitle>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{description}</p>
          )}
        </div>
        <div className="relative z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onCreateClick?.(name);
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Create {title}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{count != null ? count : "—"}</div>
        <p className="text-xs text-muted-foreground">items</p>
      </CardContent>
    </Card>
  );
}
