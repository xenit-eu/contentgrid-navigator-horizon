import type * as React from "react";
import { useState } from "react";

/**
 * Drag-and-drop handlers for dropping a single file onto an element. Pass `null` to disable
 * dropping (e.g. while an upload is in flight).
 */
export function useFileDrop(onDrop: ((file: File) => void) | null) {
  const [isDragActive, setIsDragActive] = useState(false);

  const dropProps = {
    onDragOver: (e: React.DragEvent<HTMLElement>) => {
      if (!onDrop) return;
      e.preventDefault();
      setIsDragActive(true);
    },
    onDragLeave: (e: React.DragEvent<HTMLElement>) => {
      // Moving onto a child element also fires dragleave on the parent — ignore that.
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragActive(false);
    },
    onDrop: (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      setIsDragActive(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped && onDrop) onDrop(dropped);
    },
  };

  return { isDragActive: isDragActive && onDrop !== null, dropProps };
}
