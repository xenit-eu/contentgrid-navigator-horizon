import { Fragment, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FieldDescriptor } from "../../../entity-item-create";
import { type LayoutRow, applyLayoutDrop, rowsFromFieldNameRows } from "./apply-layout-drop";

export interface CreateFormLayoutEditorProps {
  readonly fields: readonly FieldDescriptor[];
  /** Seeds this editor's local row state once, on mount — see the `rows` state doc comment. */
  readonly initialRows: readonly (readonly string[])[];
  readonly onLayoutChange: (rows: readonly (readonly string[])[]) => void;
}

/**
 * Drag-and-drop editor for a create form's field layout. Built on `useDraggable`/`useDroppable`
 * directly rather than `@dnd-kit/sortable`'s list abstraction — a drop here can change a row's
 * *shape* (merge two rows into a two-up row, or split one back apart — see `apply-layout-drop.ts`),
 * not just reorder a flat list, so `SortableContext` doesn't fit. Uses `pointerWithin` collision
 * detection so the thin gap-between-rows drop targets and the much larger row drop targets don't
 * fight over ambiguous "closest" matches.
 */
export function CreateFormLayoutEditor({
  fields,
  initialRows,
  onLayoutChange,
}: Readonly<CreateFormLayoutEditorProps>) {
  const fieldsByName = new Map(fields.map((field) => [field.name, field] as const));
  // Seeded once from `initialRows`, then this editor's own drag state is authoritative — the
  // caller (`EntityCreateFormPreview`) re-derives `initialRows` from the persisted preference on
  // every render, including right after this editor's own `onLayoutChange` call persists it; re-
  // seeding on every such change would just fight the next drag with stale-looking state.
  const [rows, setRows] = useState<readonly LayoutRow[]>(() => rowsFromFieldNameRows(initialRows));
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const next = applyLayoutDrop(rows, String(active.id), String(over.id));
    if (next === rows) return;
    setRows(next);
    onLayoutChange(next.map((r) => r.fieldNames));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
      <div className="space-y-2 rounded-md border p-3">
        <RowGap index={0} />
        {rows.map((row, index) => (
          <Fragment key={row.id}>
            <RowDropZone row={row} fieldsByName={fieldsByName} />
            <RowGap index={index + 1} />
          </Fragment>
        ))}
      </div>
    </DndContext>
  );
}

function FieldChip({
  field,
  isFullWidth,
}: Readonly<{ field: FieldDescriptor; isFullWidth: boolean }>) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `field:${field.name}`,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Translate.toString(transform),
        position: "relative",
        zIndex: isDragging ? 10 : undefined,
      }}
      className={`cursor-grab rounded-md border bg-card px-3 py-3 text-sm select-none ${
        isFullWidth ? "col-span-2" : "col-span-1"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <span className="font-medium">{field.label}</span>
      {field.required && (
        <span className="text-destructive" aria-hidden="true">
          {" "}
          *
        </span>
      )}
    </div>
  );
}

function RowDropZone({
  row,
  fieldsByName,
}: Readonly<{ row: LayoutRow; fieldsByName: Map<string, FieldDescriptor> }>) {
  const { setNodeRef, isOver } = useDroppable({ id: `row:${row.id}` });
  const isFull = row.fieldNames.length >= 2;

  return (
    <div
      ref={setNodeRef}
      className={`grid grid-cols-2 gap-2 rounded-md p-1 ring-2 transition-colors ${
        isOver && !isFull ? "bg-accent/60 ring-primary" : "ring-transparent"
      }`}
    >
      {row.fieldNames.map((name) => {
        const field = fieldsByName.get(name);
        if (!field) return null;
        return <FieldChip key={name} field={field} isFullWidth={row.fieldNames.length === 1} />;
      })}
    </div>
  );
}

function RowGap({ index }: Readonly<{ index: number }>) {
  const { setNodeRef, isOver } = useDroppable({ id: `gap:${index}` });

  return (
    <div
      ref={setNodeRef}
      className={`h-2 rounded-full transition-colors ${isOver ? "bg-primary" : "bg-transparent"}`}
    />
  );
}
