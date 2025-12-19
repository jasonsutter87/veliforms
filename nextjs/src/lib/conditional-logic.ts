/**
 * VeilForms - Conditional Logic Evaluation
 * Handles show/hide field logic based on other field values
 */

import type { FormField } from "@/store/dashboard";

/**
 * Supported comparison operators for field conditions
 */
export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty"
  | "greater_than"
  | "less_than";

/**
 * A single condition that checks a field's value
 */
export interface FieldCondition {
  fieldId: string;
  operator: ConditionOperator;
  value: string | number;
}

/**
 * Complete conditional logic configuration for a field
 */
export interface ConditionalLogic {
  enabled: boolean;
  action: "show" | "hide";
  conditions: FieldCondition[];
  logicType: "all" | "any";
}

/**
 * Operator display labels for UI
 */
export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  not_contains: "does not contain",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  greater_than: "is greater than",
  less_than: "is less than",
};

/**
 * Get operators that make sense for a given field type
 */
export function getAvailableOperators(fieldType: string): ConditionOperator[] {
  const baseOperators: ConditionOperator[] = [
    "equals",
    "not_equals",
    "is_empty",
    "is_not_empty",
  ];

  switch (fieldType) {
    case "text":
    case "email":
    case "textarea":
    case "url":
    case "phone":
      return [...baseOperators, "contains", "not_contains"];

    case "number":
    case "date":
      return [...baseOperators, "greater_than", "less_than"];

    case "select":
    case "radio":
    case "checkbox":
      return baseOperators;

    default:
      return baseOperators;
  }
}

/**
 * Check if an operator requires a value input
 */
export function operatorRequiresValue(operator: ConditionOperator): boolean {
  return !["is_empty", "is_not_empty"].includes(operator);
}

/**
 * Evaluate a single condition against a form value
 */
function evaluateCondition(
  condition: FieldCondition,
  fieldValue: unknown
): boolean {
  const { operator, value: conditionValue } = condition;

  // Convert field value to comparable format
  const stringValue = fieldValue?.toString() || "";
  const isEmpty = stringValue === "" || fieldValue === null || fieldValue === undefined;

  switch (operator) {
    case "is_empty":
      return isEmpty;

    case "is_not_empty":
      return !isEmpty;

    case "equals":
      // Handle arrays (checkboxes) and strings
      if (Array.isArray(fieldValue)) {
        return fieldValue.some(v => v?.toString() === conditionValue?.toString());
      }
      return stringValue === conditionValue?.toString();

    case "not_equals":
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some(v => v?.toString() === conditionValue?.toString());
      }
      return stringValue !== conditionValue?.toString();

    case "contains":
      if (Array.isArray(fieldValue)) {
        return fieldValue.some(v =>
          v?.toString().toLowerCase().includes(conditionValue?.toString().toLowerCase())
        );
      }
      return stringValue.toLowerCase().includes(conditionValue?.toString().toLowerCase());

    case "not_contains":
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some(v =>
          v?.toString().toLowerCase().includes(conditionValue?.toString().toLowerCase())
        );
      }
      return !stringValue.toLowerCase().includes(conditionValue?.toString().toLowerCase());

    case "greater_than": {
      const numValue = Number(fieldValue);
      const numCondition = Number(conditionValue);
      return !isNaN(numValue) && !isNaN(numCondition) && numValue > numCondition;
    }

    case "less_than": {
      const numValue = Number(fieldValue);
      const numCondition = Number(conditionValue);
      return !isNaN(numValue) && !isNaN(numCondition) && numValue < numCondition;
    }

    default:
      return false;
  }
}

/**
 * Evaluate all conditions for a field and determine if it should be visible
 *
 * @param field - The field with conditional logic
 * @param formValues - Current form values as { fieldId: value }
 * @returns true if field should be visible, false if hidden
 */
export function evaluateFieldVisibility(
  field: FormField & { conditionalLogic?: ConditionalLogic },
  formValues: Record<string, unknown>
): boolean {
  const { conditionalLogic } = field;

  // If no conditional logic or disabled, field is always visible
  if (!conditionalLogic || !conditionalLogic.enabled || !conditionalLogic.conditions.length) {
    return true;
  }

  const { conditions, logicType, action } = conditionalLogic;

  // Evaluate each condition
  const results = conditions.map((condition) => {
    const fieldValue = formValues[condition.fieldId];
    return evaluateCondition(condition, fieldValue);
  });

  // Determine if conditions are met
  const conditionsMet =
    logicType === "all"
      ? results.every((r) => r === true)
      : results.some((r) => r === true);

  // Apply action
  if (action === "show") {
    return conditionsMet; // Show only if conditions met
  } else {
    return !conditionsMet; // Hide if conditions met (show if not met)
  }
}

/**
 * Get all fields that can be referenced by a given field (fields that come before it)
 * This prevents circular references and ensures logical ordering
 */
export function getReferencableFields(
  allFields: FormField[],
  currentFieldId: string
): FormField[] {
  const currentIndex = allFields.findIndex((f) => f.id === currentFieldId);
  if (currentIndex === -1) return [];

  // Only return fields before the current one, excluding non-interactive fields
  const nonInteractiveTypes = ["heading", "paragraph", "divider"];
  return allFields
    .slice(0, currentIndex)
    .filter((f) => !nonInteractiveTypes.includes(f.type));
}

/**
 * Validate conditional logic configuration
 * Returns array of error messages, empty if valid
 */
export function validateConditionalLogic(
  field: FormField & { conditionalLogic?: ConditionalLogic },
  allFields: FormField[]
): string[] {
  const errors: string[] = [];
  const { conditionalLogic } = field;

  if (!conditionalLogic || !conditionalLogic.enabled) {
    return errors;
  }

  if (!conditionalLogic.conditions.length) {
    errors.push("At least one condition is required");
    return errors;
  }

  const referencableFieldIds = getReferencableFields(allFields, field.id).map((f) => f.id);

  conditionalLogic.conditions.forEach((condition, index) => {
    // Check if referenced field exists
    const referencedField = allFields.find((f) => f.id === condition.fieldId);
    if (!referencedField) {
      errors.push(`Condition ${index + 1}: Referenced field not found`);
      return;
    }

    // Check if field can be referenced
    if (!referencableFieldIds.includes(condition.fieldId)) {
      errors.push(`Condition ${index + 1}: Cannot reference fields that come after this field`);
    }

    // Check if value is provided when required
    if (operatorRequiresValue(condition.operator)) {
      if (condition.value === "" || condition.value === null || condition.value === undefined) {
        errors.push(`Condition ${index + 1}: Value is required for this operator`);
      }
    }
  });

  return errors;
}

/**
 * Clean up conditional logic when a field is deleted
 * Removes conditions that reference the deleted field
 */
export function cleanupDeletedFieldReferences(
  fields: FormField[],
  deletedFieldId: string
): FormField[] {
  return fields.map((field) => {
    const typedField = field as FormField & { conditionalLogic?: ConditionalLogic };
    if (!typedField.conditionalLogic?.enabled) {
      return field;
    }

    // Filter out conditions referencing the deleted field
    const updatedConditions = typedField.conditionalLogic.conditions.filter(
      (c) => c.fieldId !== deletedFieldId
    );

    // If no conditions remain, disable conditional logic
    if (updatedConditions.length === 0) {
      return {
        ...field,
        conditionalLogic: {
          ...typedField.conditionalLogic,
          enabled: false,
          conditions: [],
        },
      };
    }

    return {
      ...field,
      conditionalLogic: {
        ...typedField.conditionalLogic,
        conditions: updatedConditions,
      },
    };
  });
}
