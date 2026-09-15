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
}

/**
 * Generic "collapsible card" wrapper: a `Card` containing a single-item `Accordion` (title +
 * expand/collapse) with an optional header actions slot. Deliberately just chrome — like `Card`
 * itself, it has no domain knowledge of relations, permissions, or mutations. Callers compose
 * their own header content (counts, badges) into `title` and their own buttons/dialogs into
 * `actions`, so this stays a simple, reusable import wherever a collapsible section is needed,
 * instead of every caller re-implementing the Card+Accordion boilerplate from scratch.
 */
export function RelationAccordion({ title, actions, children }: Readonly<RelationAccordionProps>) {
  return (
    <Card className="py-4 gap-4">
      <Accordion type="single" collapsible defaultValue="relation">
        <AccordionItem value="relation" className="border-none">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between gap-2">
              <AccordionTrigger className="flex-none gap-2 p-0 hover:no-underline [&_svg]:size-4">
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
