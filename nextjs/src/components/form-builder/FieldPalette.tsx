/**
 * VeilForms - Field Palette Component
 */

"use client";

import { useDraggable } from "@dnd-kit/core";

interface FieldPaletteProps {
  onAddField: (fieldType: string) => void;
}

const FIELD_TYPES = [
  { type: "text", label: "Text", icon: "T" },
  { type: "email", label: "Email", icon: "@" },
  { type: "textarea", label: "Text Area", icon: "P" },
  { type: "number", label: "Number", icon: "#" },
  { type: "phone", label: "Phone", icon: "P" },
  { type: "select", label: "Dropdown", icon: "v" },
  { type: "checkbox", label: "Checkbox", icon: "x" },
  { type: "radio", label: "Radio", icon: "o" },
  { type: "date", label: "Date", icon: "D" },
  { type: "url", label: "URL", icon: "/" },
  { type: "hidden", label: "Hidden", icon: "-" },
  { type: "heading", label: "Heading", icon: "H" },
  { type: "paragraph", label: "Paragraph", icon: "=" },
  { type: "divider", label: "Divider", icon: "_" },
];

export function FieldPalette({ onAddField }: FieldPaletteProps) {
  return (
    <aside className="field-palette">
      <h3 className="palette-title">Fields</h3>
      <div className="field-types">
        {FIELD_TYPES.map((field) => (
          <DraggableFieldButton
            key={field.type}
            type={field.type}
            label={field.label}
            onClick={() => onAddField(field.type)}
          />
        ))}
      </div>
    </aside>
  );
}

interface DraggableFieldButtonProps {
  type: string;
  label: string;
  onClick: () => void;
}

function DraggableFieldButton({ type, label, onClick }: DraggableFieldButtonProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
  });

  return (
    <button
      ref={setNodeRef}
      className={`field-type-btn ${isDragging ? "dragging" : ""}`}
      onClick={onClick}
      {...listeners}
      {...attributes}
    >
      <FieldIcon type={type} />
      <span>{label}</span>
    </button>
  );
}

function FieldIcon({ type }: { type: string }) {
  switch (type) {
    case "text":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M4 7V4h16v3"></path>
          <path d="M9 20h6"></path>
          <path d="M12 4v16"></path>
        </svg>
      );
    case "email":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
      );
    case "textarea":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
      );
    case "number":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <line x1="4" y1="9" x2="20" y2="9"></line>
          <line x1="4" y1="15" x2="20" y2="15"></line>
          <line x1="10" y1="3" x2="8" y2="21"></line>
          <line x1="16" y1="3" x2="14" y2="21"></line>
        </svg>
      );
    case "phone":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
      );
    case "select":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M6 9l6 6 6-6"></path>
        </svg>
      );
    case "checkbox":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <polyline points="9 11 12 14 22 4"></polyline>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
      );
    case "radio":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="4" fill="currentColor"></circle>
        </svg>
      );
    case "date":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      );
    case "url":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
      );
    case "hidden":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      );
    case "heading":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M6 4v16"></path>
          <path d="M18 4v16"></path>
          <path d="M6 12h12"></path>
        </svg>
      );
    case "paragraph":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <line x1="17" y1="10" x2="3" y2="10"></line>
          <line x1="21" y1="6" x2="3" y2="6"></line>
          <line x1="21" y1="14" x2="3" y2="14"></line>
          <line x1="17" y1="18" x2="3" y2="18"></line>
        </svg>
      );
    case "divider":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <line x1="3" y1="12" x2="21" y2="12"></line>
        </svg>
      );
    default:
      return null;
  }
}
