import { FunnelIcon } from "@phosphor-icons/react";
import { Badge, Button } from "@contentgrid/ui";

export interface FiltersButtonProps {
  /** Number of filters applied; shown as a badge when above zero. */
  readonly activeFilterCount: number;
  /** Opens the filters dialog. */
  readonly onClick: () => void;
}

/** "Filters" button that opens the filters dialog, with the active filter count. */
export function FiltersButton({ activeFilterCount, onClick }: Readonly<FiltersButtonProps>) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <FunnelIcon aria-hidden />
      Filters
      {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
    </Button>
  );
}
