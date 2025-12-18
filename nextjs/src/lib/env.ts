/**
 * VeilForms - Environment Variable Validation
 * Validate required environment variables at startup
 */

/**
 * Validate required environment variables
 * Throws error in production if any required variables are missing
 */
export function validateEnv() {
  const required = [
    'JWT_SECRET',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Warn in development
  if (missing.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(`[ENV WARNING] Missing environment variables: ${missing.join(', ')}`);
    console.warn('[ENV WARNING] These are required in production');
  }
}
