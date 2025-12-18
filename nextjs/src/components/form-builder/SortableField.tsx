/**
 * VeilForms - Sortable Field Component
 */

"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FormField } from "@/store/dashboard";

interface SortableFieldProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function SortableField({
  field,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: SortableFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`field-item ${isSelected ? "selected" : ""} ${isDragging ? "dragging" : ""}`}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      <div className="field-drag-handle" {...attributes} {...listeners}>
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
          <circle cx="9" cy="6" r="1.5"></circle>
          <circle cx="15" cy="6" r="1.5"></circle>
          <circle cx="9" cy="12" r="1.5"></circle>
          <circle cx="15" cy="12" r="1.5"></circle>
          <circle cx="9" cy="18" r="1.5"></circle>
          <circle cx="15" cy="18" r="1.5"></circle>
        </svg>
      </div>

      {/* Field Preview */}
      <div className="field-preview">
        <FieldPreview field={field} />
      </div>

      {/* Field Actions */}
      <div className="field-actions">
        <button
          className="field-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          title="Duplicate"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button
          className="field-action-btn delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  );
}

function FieldPreview({ field }: { field: FormField }) {
  switch (field.type) {
    case "heading":
      return <h3 className="preview-heading">{field.label}</h3>;

    case "paragraph":
      return <p className="preview-paragraph">{field.label}</p>;

    case "divider":
      return <hr className="preview-divider" />;

    case "hidden":
      return (
        <div className="preview-hidden">
          <span className="hidden-icon">H</span>
          <span>{field.label}</span>
          <span className="hidden-name">{field.name}</span>
        </div>
      );

    case "checkbox":
      return (
        <div className="preview-field">
          <label className="preview-checkbox-label">
            <input type="checkbox" disabled />
            <span>{field.label}</span>
            {field.required && <span className="required">*</span>}
          </label>
        </div>
      );

    case "radio":
      return (
        <div className="preview-field">
          <span className="preview-label">
            {field.label}
            {field.required && <span className="required">*</span>}
          </span>
          <div className="preview-radio-group">
            {(field.options || ["Option 1", "Option 2"]).slice(0, 3).map((opt, i) => (
              <label key={i} className="preview-radio-label">
                <input type="radio" disabled name={field.name} />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>
      );

    case "select":
      return (
        <div className="preview-field">
          <span className="preview-label">
            {field.label}
            {field.required && <span className="required">*</span>}
          </span>
          <select disabled className="preview-select">
            <option>Select an option...</option>
          </select>
        </div>
      );

    case "textarea":
      return (
        <div className="preview-field">
          <span className="preview-label">
            {field.label}
            {field.required && <span className="required">*</span>}
          </span>
          <textarea
            disabled
            placeholder={field.placeholder}
            className="preview-textarea"
            rows={3}
          />
        </div>
      );

    default:
      return (
        <div className="preview-field">
          <span className="preview-label">
            {field.label}
            {field.required && <span className="required">*</span>}
          </span>
          <input
            type={field.type}
            disabled
            placeholder={field.placeholder}
            className="preview-input"
          />
        </div>
      );
  }
}
