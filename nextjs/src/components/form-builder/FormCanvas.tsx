/**
 * VeilForms - Form Canvas Component
 */

"use client";

import { memo } from "react";
import { SortableField } from "./SortableField";
import type { FormField } from "@/store/dashboard";

interface FormCanvasProps {
  fields: FormField[];
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onDeleteField: (id: string) => void;
  onDuplicateField: (id: string) => void;
}

export const FormCanvas = memo(function FormCanvas({
  fields,
  selectedFieldId,
  onSelectField,
  onDeleteField,
  onDuplicateField,
}: FormCanvasProps) {
  return (
    <div className="canvas-fields">
      {fields.map((field) => (
        <SortableField
          key={field.id}
          field={field}
          isSelected={selectedFieldId === field.id}
          onSelect={() => onSelectField(field.id)}
          onDelete={() => onDeleteField(field.id)}
          onDuplicate={() => onDuplicateField(field.id)}
        />
      ))}
    </div>
  );
});
