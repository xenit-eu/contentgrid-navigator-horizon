import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../primitives/accordion";
import { Card, CardContent, CardHeader } from "../../primitives/card";

export interface RelationAccordionProps {
  /** Header title, rendered as the accordion trigger's label — pass a fragment to include a badge/marker next to it. */
  title: ReactNode;
  /** Extra content rendered in the header, right-aligned, outside the collapsible trigger — e.g. Link/Unlink-all buttons. The caller owns these actions entirely; this component has no opinion on what they are. */
  actions?: ReactNode;
  /** The section's own content (table, list, loading/error state), shown when expanded */
  children: ReactNode;
  /** Controls expanded state. Omit to let the accordion manage its own state, expanded by default. */
  open?: boolean;
  /** Called with the new expanded state on trigger click. Required when `open` is provided. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Generic "collapsible card" wrapper: a `Card` containing a single-item `Accordion` (title +
 * expand/collapse) with an optional header actions slot. Deliberately just chrome — like `Card`
 * itself, it has no domain knowledge of relations, permissions, or mutations. Callers compose
 * their own header content (counts, badges) into `title` and their own buttons/dialogs into
 * `actions`, so this stays a simple, reusable import wherever a collapsible section is needed,
 * instead of every caller re-implementing the Card+Accordion boilerplate from scratch.
 */
export function RelationAccordion({
  title,
  actions,
  children,
  open,
  onOpenChange,
}: Readonly<RelationAccordionProps>) {
  const controlledProps =
    open === undefined
      ? { defaultValue: "relation" }
      : {
          value: open ? "relation" : "",
          onValueChange: (value: string) => onOpenChange?.(value === "relation"),
        };
  return (
    <Card className="py-4 gap-4">
      <Accordion type="single" collapsible {...controlledProps}>
        <AccordionItem value="relation" className="border-none">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between gap-2">
              <AccordionTrigger className="flex-none gap-2 p-0 hover:no-underline [&_svg]:size-4 [&_svg]:box-content [&_svg]:rounded-full [&_svg]:p-1 [&_svg]:-m-1 [&_svg]:transition-colors [&:hover_svg]:bg-accent">
                <span className="text-sm font-semibold">{title}</span>
              </AccordionTrigger>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
          </CardHeader>
          <AccordionContent>
            <CardContent>{children}</CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
