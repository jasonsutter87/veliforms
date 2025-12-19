/**
 * VeilForms - Condition Builder Component
 * UI for building conditional logic rules
 */

"use client";

import { memo, useMemo } from "react";
import type { FormField } from "@/store/dashboard";
import type {
  FieldCondition,
  ConditionOperator,
  ConditionalLogic,
} from "@/lib/conditional-logic";
import {
  OPERATOR_LABELS,
  getAvailableOperators,
  operatorRequiresValue,
  getReferencableFields,
} from "@/lib/conditional-logic";

interface ConditionBuilderProps {
  field: FormField;
  allFields: FormField[];
  onUpdate: (logic: ConditionalLogic) => void;
}

export const ConditionBuilder = memo(function ConditionBuilder({
  field,
  allFields,
  onUpdate,
}: ConditionBuilderProps) {
  const logic = field.conditionalLogic || {
    enabled: false,
    action: "show" as const,
    conditions: [],
    logicType: "all" as const,
  };

  const referencableFields = useMemo(
    () => getReferencableFields(allFields, field.id),
    [allFields, field.id]
  );

  const handleToggle = (enabled: boolean) => {
    onUpdate({
      ...logic,
      enabled,
      conditions: enabled && logic.conditions.length === 0
        ? [createNewCondition(referencableFields)]
        : logic.conditions,
    });
  };

  const handleActionChange = (action: "show" | "hide") => {
    onUpdate({ ...logic, action });
  };

  const handleLogicTypeChange = (logicType: "all" | "any") => {
    onUpdate({ ...logic, logicType });
  };

  const handleAddCondition = () => {
    onUpdate({
      ...logic,
      conditions: [...logic.conditions, createNewCondition(referencableFields)],
    });
  };

  const handleUpdateCondition = (index: number, updates: Partial<FieldCondition>) => {
    const newConditions = [...logic.conditions];
    newConditions[index] = { ...newConditions[index], ...updates } as FieldCondition;
    onUpdate({ ...logic, conditions: newConditions });
  };

  const handleRemoveCondition = (index: number) => {
    const newConditions = logic.conditions.filter((_, i) => i !== index);
    onUpdate({
      ...logic,
      conditions: newConditions,
      enabled: newConditions.length > 0 ? logic.enabled : false,
    });
  };

  if (!logic.enabled) {
    return (
      <div className="condition-builder">
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={false}
              onChange={(e) => handleToggle(e.target.checked)}
            />
            Enable conditional logic
          </label>
          <small>Show or hide this field based on other field values</small>
        </div>
      </div>
    );
  }

  if (referencableFields.length === 0) {
    return (
      <div className="condition-builder">
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={false}
              onChange={(e) => handleToggle(e.target.checked)}
              disabled
            />
            Enable conditional logic
          </label>
          <small style={{ color: "var(--color-warning, #f59e0b)" }}>
            No fields available to reference. Add fields above this one first.
          </small>
        </div>
      </div>
    );
  }

  return (
    <div className="condition-builder">
      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={true}
            onChange={(e) => handleToggle(e.target.checked)}
          />
          Enable conditional logic
        </label>
      </div>

      <div className="form-group">
        <label>Action</label>
        <select
          value={logic.action}
          onChange={(e) => handleActionChange(e.target.value as "show" | "hide")}
          className="form-control"
        >
          <option value="show">Show this field</option>
          <option value="hide">Hide this field</option>
        </select>
      </div>

      <div className="form-group">
        <label>When</label>
        {logic.conditions.length > 1 && (
          <select
            value={logic.logicType}
            onChange={(e) => handleLogicTypeChange(e.target.value as "all" | "any")}
            className="form-control"
            style={{ marginBottom: "0.5rem" }}
          >
            <option value="all">All conditions match</option>
            <option value="any">Any condition matches</option>
          </select>
        )}
      </div>

      <div className="conditions-list">
        {logic.conditions.map((condition, index) => (
          <ConditionRow
            key={index}
            condition={condition}
            index={index}
            referencableFields={referencableFields}
            allFields={allFields}
            onUpdate={(updates) => handleUpdateCondition(index, updates)}
            onRemove={() => handleRemoveCondition(index)}
            showLogicType={logic.conditions.length > 1}
            logicType={logic.logicType}
          />
        ))}
      </div>

      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={handleAddCondition}
        style={{ marginTop: "0.5rem" }}
      >
        + Add Condition
      </button>
    </div>
  );
});

interface ConditionRowProps {
  condition: FieldCondition;
  index: number;
  referencableFields: FormField[];
  allFields: FormField[];
  onUpdate: (updates: Partial<FieldCondition>) => void;
  onRemove: () => void;
  showLogicType: boolean;
  logicType: "all" | "any";
}

const ConditionRow = memo(function ConditionRow({
  condition,
  index,
  referencableFields,
  allFields,
  onUpdate,
  onRemove,
  showLogicType,
  logicType,
}: ConditionRowProps) {
  const selectedField = allFields.find((f) => f.id === condition.fieldId);
  const availableOperators = selectedField
    ? getAvailableOperators(selectedField.type)
    : (["equals", "not_equals"] as ConditionOperator[]);

  const needsValue = operatorRequiresValue(condition.operator);

  const handleFieldChange = (fieldId: string) => {
    const field = allFields.find((f) => f.id === fieldId);
    const operators = field ? getAvailableOperators(field.type) : (["equals"] as ConditionOperator[]);

    // Reset operator if current one isn't valid for new field type
    const newOperator = operators.includes(condition.operator)
      ? condition.operator
      : operators[0];

    onUpdate({
      fieldId,
      operator: newOperator as ConditionOperator,
      value: "",
    });
  };

  return (
    <div className="condition-row">
      {showLogicType && index > 0 && (
        <div className="condition-logic-label">
          {logicType === "all" ? "AND" : "OR"}
        </div>
      )}

      <div className="condition-fields">
        <select
          value={condition.fieldId}
          onChange={(e) => handleFieldChange(e.target.value)}
          className="form-control"
        >
          <option value="">Select field...</option>
          {referencableFields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label || f.name}
            </option>
          ))}
        </select>

        <select
          value={condition.operator}
          onChange={(e) => onUpdate({ operator: e.target.value as ConditionOperator })}
          className="form-control"
        >
          {availableOperators.map((op) => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </option>
          ))}
        </select>

        {needsValue && (
          <>
            {selectedField?.type === "select" || selectedField?.type === "radio" ? (
              <select
                value={condition.value?.toString() || ""}
                onChange={(e) => onUpdate({ value: e.target.value })}
                className="form-control"
              >
                <option value="">Select value...</option>
                {selectedField.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : selectedField?.type === "number" ? (
              <input
                type="number"
                value={condition.value?.toString() || ""}
                onChange={(e) => onUpdate({ value: Number(e.target.value) })}
                className="form-control"
                placeholder="Value"
              />
            ) : (
              <input
                type="text"
                value={condition.value?.toString() || ""}
                onChange={(e) => onUpdate({ value: e.target.value })}
                className="form-control"
                placeholder="Value"
              />
            )}
          </>
        )}

        <button
          type="button"
          onClick={onRemove}
          className="condition-remove"
          aria-label="Remove condition"
        >
          &times;
        </button>
      </div>
    </div>
  );
});

function createNewCondition(referencableFields: FormField[]): FieldCondition {
  const firstField = referencableFields[0];
  return {
    fieldId: firstField?.id || "",
    operator: "equals",
    value: "",
  };
}
