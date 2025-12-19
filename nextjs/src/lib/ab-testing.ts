/**
 * VeilForms - A/B Testing Library
 * Provides variant assignment, statistical analysis, and experiment management
 */

import { createHash } from "crypto";
import type { FormField, FormSettings } from "./storage";

// Type definitions
export interface ABTest {
  id: string;
  formId: string;
  name: string;
  description?: string;
  status: "draft" | "running" | "paused" | "completed";
  variants: Variant[];
  metrics: string[];
  trafficAllocation: number; // 0-100 percentage of traffic to include
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  createdBy: string;
}

export interface Variant {
  id: string;
  name: string;
  description?: string;
  weight: number; // 0-100 percentage of test traffic
  formSnapshot: FormConfig;
  impressions: number; // How many times shown
  conversions: number; // How many completed submissions
}

export interface FormConfig {
  fields?: FormField[];
  settings?: Partial<FormSettings>;
}

export interface VariantAssignment {
  testId: string;
  variantId: string;
  userId: string; // Anonymous user ID or session ID
  assignedAt: number;
}

export interface ABTestResults {
  testId: string;
  variants: VariantResults[];
  winner?: string; // Variant ID of statistically significant winner
  confidence: number; // 0-1, typically looking for >0.95
  recommendation: string;
}

export interface VariantResults {
  variantId: string;
  name: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  confidenceInterval: [number, number];
}

export interface ChiSquaredResult {
  chiSquared: number;
  pValue: number;
  degreesOfFreedom: number;
  isSignificant: boolean; // p < 0.05
}

/**
 * Assign a user to a variant using deterministic hashing
 * This ensures the same user always gets the same variant
 */
export function assignVariant(
  test: ABTest,
  userId: string
): { variantId: string | null; inTest: boolean } {
  // Check if user should be in the test based on traffic allocation
  const trafficHash = hashString(`${test.id}:traffic:${userId}`);
  const trafficBucket = trafficHash % 100;

  if (trafficBucket >= test.trafficAllocation) {
    return { variantId: null, inTest: false };
  }

  // User is in the test, assign to a variant
  const variantHash = hashString(`${test.id}:variant:${userId}`);

  // Build cumulative weight distribution
  let cumulativeWeight = 0;
  const totalWeight = test.variants.reduce((sum, v) => sum + v.weight, 0);

  // Normalize to 100 if weights don't sum to 100
  const normalizedBucket = (variantHash % 100) * (totalWeight / 100);

  for (const variant of test.variants) {
    cumulativeWeight += variant.weight;
    if (normalizedBucket < cumulativeWeight) {
      return { variantId: variant.id, inTest: true };
    }
  }

  // Fallback to first variant (shouldn't happen if weights are properly set)
  return { variantId: test.variants[0]?.id || null, inTest: true };
}

/**
 * Hash a string to a number for deterministic bucketing
 */
function hashString(input: string): number {
  const hash = createHash("sha256").update(input).digest("hex");
  // Take first 8 hex chars and convert to number
  return parseInt(hash.substring(0, 8), 16);
}

/**
 * Calculate conversion rate with confidence intervals
 * Uses Wilson score interval for binomial proportions
 */
export function calculateConversionRate(
  conversions: number,
  impressions: number,
  confidenceLevel = 0.95
): { rate: number; confidenceInterval: [number, number] } {
  if (impressions === 0) {
    return { rate: 0, confidenceInterval: [0, 0] };
  }

  const rate = conversions / impressions;

  // Z-score for confidence level (1.96 for 95%)
  const z = getZScore(confidenceLevel);

  // Wilson score interval
  const denominator = 1 + (z * z) / impressions;
  const center = (rate + (z * z) / (2 * impressions)) / denominator;
  const margin =
    (z * Math.sqrt((rate * (1 - rate)) / impressions + (z * z) / (4 * impressions * impressions))) /
    denominator;

  return {
    rate,
    confidenceInterval: [
      Math.max(0, center - margin),
      Math.min(1, center + margin),
    ],
  };
}

/**
 * Get Z-score for confidence level
 */
function getZScore(confidenceLevel: number): number {
  // Common confidence levels
  const zScores: Record<number, number> = {
    0.9: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };
  return zScores[confidenceLevel] || 1.96;
}

/**
 * Calculate chi-squared test for variant comparison
 * Tests if differences in conversion rates are statistically significant
 */
export function calculateChiSquared(variants: Variant[]): ChiSquaredResult {
  if (variants.length < 2) {
    return {
      chiSquared: 0,
      pValue: 1,
      degreesOfFreedom: 0,
      isSignificant: false,
    };
  }

  // Calculate expected values under null hypothesis (no difference)
  const totalImpressions = variants.reduce((sum, v) => sum + v.impressions, 0);
  const totalConversions = variants.reduce((sum, v) => sum + v.conversions, 0);

  if (totalImpressions === 0) {
    return {
      chiSquared: 0,
      pValue: 1,
      degreesOfFreedom: 0,
      isSignificant: false,
    };
  }

  const overallConversionRate = totalConversions / totalImpressions;

  // Calculate chi-squared statistic
  let chiSquared = 0;
  for (const variant of variants) {
    const expectedConversions = variant.impressions * overallConversionRate;
    const expectedNonConversions =
      variant.impressions * (1 - overallConversionRate);

    // Observed values
    const observedConversions = variant.conversions;
    const observedNonConversions = variant.impressions - variant.conversions;

    // Add to chi-squared (avoid division by zero)
    if (expectedConversions > 0) {
      chiSquared +=
        Math.pow(observedConversions - expectedConversions, 2) /
        expectedConversions;
    }
    if (expectedNonConversions > 0) {
      chiSquared +=
        Math.pow(observedNonConversions - expectedNonConversions, 2) /
        expectedNonConversions;
    }
  }

  const degreesOfFreedom = variants.length - 1;
  const pValue = chiSquaredToPValue(chiSquared, degreesOfFreedom);

  return {
    chiSquared,
    pValue,
    degreesOfFreedom,
    isSignificant: pValue < 0.05,
  };
}

/**
 * Convert chi-squared statistic to p-value
 * Uses approximation for degrees of freedom > 30, otherwise uses lookup table
 */
function chiSquaredToPValue(chiSquared: number, df: number): number {
  // For small chi-squared values, return high p-value
  if (chiSquared === 0) return 1;

  // Critical values for df=1 (most common case for A/B tests)
  // chi-squared > 3.841 => p < 0.05 (significant)
  // chi-squared > 6.635 => p < 0.01 (highly significant)
  if (df === 1) {
    if (chiSquared < 3.841) return 0.05; // Not significant
    if (chiSquared < 6.635) return 0.025;
    return 0.01; // Highly significant
  }

  // For df > 1, use approximation
  // This is a simplified lookup - in production you'd want a more accurate method
  if (chiSquared > df + 2 * Math.sqrt(2 * df)) {
    return 0.01; // Very likely significant
  } else if (chiSquared > df + Math.sqrt(2 * df)) {
    return 0.05;
  }
  return 0.1; // Not significant
}

/**
 * Analyze A/B test results and determine winner
 */
export function analyzeTestResults(test: ABTest): ABTestResults {
  const variantResults: VariantResults[] = test.variants.map((variant) => {
    const { rate, confidenceInterval } = calculateConversionRate(
      variant.conversions,
      variant.impressions
    );

    return {
      variantId: variant.id,
      name: variant.name,
      impressions: variant.impressions,
      conversions: variant.conversions,
      conversionRate: rate,
      confidenceInterval,
    };
  });

  // Find variant with highest conversion rate
  const sortedVariants = [...variantResults].sort(
    (a, b) => b.conversionRate - a.conversionRate
  );
  const topVariant = sortedVariants[0];

  // Calculate statistical significance
  const chiSquaredResult = calculateChiSquared(test.variants);
  const confidence = 1 - chiSquaredResult.pValue;

  let winner: string | undefined;
  let recommendation: string;

  if (chiSquaredResult.isSignificant && topVariant) {
    winner = topVariant.variantId;
    recommendation = `Variant "${topVariant.name}" is the winner with ${(topVariant.conversionRate * 100).toFixed(2)}% conversion rate (${confidence.toFixed(0)}% confidence).`;
  } else if (topVariant) {
    recommendation = `Variant "${topVariant.name}" is leading with ${(topVariant.conversionRate * 100).toFixed(2)}% conversion rate, but the difference is not statistically significant yet. Continue the test to gather more data.`;
  } else {
    recommendation = "Not enough data to make a recommendation. Continue the test.";
  }

  return {
    testId: test.id,
    variants: variantResults,
    winner,
    confidence,
    recommendation,
  };
}

/**
 * Validate A/B test configuration
 */
export function validateABTest(test: Partial<ABTest>): {
  valid: boolean;
  error?: string;
} {
  if (!test.name || test.name.trim().length === 0) {
    return { valid: false, error: "Test name is required" };
  }

  if (!test.formId) {
    return { valid: false, error: "Form ID is required" };
  }

  if (!test.variants || test.variants.length < 2) {
    return { valid: false, error: "At least 2 variants are required" };
  }

  if (test.variants.length > 10) {
    return { valid: false, error: "Maximum 10 variants allowed" };
  }

  // Validate variant weights sum to 100
  const totalWeight = test.variants.reduce((sum, v) => sum + (v.weight || 0), 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    return {
      valid: false,
      error: `Variant weights must sum to 100 (currently ${totalWeight})`,
    };
  }

  // Validate traffic allocation
  if (
    test.trafficAllocation === undefined ||
    test.trafficAllocation < 0 ||
    test.trafficAllocation > 100
  ) {
    return {
      valid: false,
      error: "Traffic allocation must be between 0 and 100",
    };
  }

  // Validate variant IDs are unique
  const variantIds = new Set(test.variants.map((v) => v.id));
  if (variantIds.size !== test.variants.length) {
    return { valid: false, error: "Variant IDs must be unique" };
  }

  return { valid: true };
}

/**
 * Generate a unique test ID
 */
export function generateTestId(): string {
  return (
    "abtest_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).substring(2, 8)
  );
}

/**
 * Generate a unique variant ID
 */
export function generateVariantId(): string {
  return (
    "var_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).substring(2, 8)
  );
}
