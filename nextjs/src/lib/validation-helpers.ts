/**
 * VeilForms - Validation Helper Utilities
 * DRY helper for handling validation results in routes
 */

import { NextResponse } from "next/server";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Convert a validation result to either validated data or an error response
 *
 * Usage:
 * ```typescript
 * const { data, error } = validateOrError<string>(name, validateFormName);
 * if (error) return error;
 * // Use data here - TypeScript knows it's a string
 * ```
 *
 * @param value - The value to validate
 * @param validator - Function that returns ValidationResult
 * @returns Either { data: T } or { error: NextResponse }
 */
export function validateOrError<T>(
  value: unknown,
  validator: (v: unknown) => ValidationResult
): { data: T } | { error: NextResponse } {
  const result = validator(value);

  if (!result.valid) {
    return {
      error: NextResponse.json(
        { error: result.error || "Validation failed" },
        { status: 400 }
      )
    };
  }

  return { data: value as T };
}

/**
 * Validate multiple values at once
 * Returns the first error encountered, or an object with all validated data
 *
 * Usage:
 * ```typescript
 * const result = validateMultiple({
 *   name: [name, validateFormName],
 *   email: [email, validateEmail],
 * });
 * if (result.error) return result.error;
 * const { name, email } = result.data;
 * ```
 */
export function validateMultiple<T extends Record<string, unknown>>(
  validations: Record<keyof T, [unknown, (v: unknown) => ValidationResult]>
): { data: T } | { error: NextResponse } {
  const data = {} as T;

  for (const [key, [value, validator]] of Object.entries(validations)) {
    const result = validator(value);

    if (!result.valid) {
      return {
        error: NextResponse.json(
          { error: result.error || `Validation failed for ${String(key)}` },
          { status: 400 }
        )
      };
    }

    data[key as keyof T] = value as T[keyof T];
  }

  return { data };
}
