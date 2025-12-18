/**
 * VeilForms - Structured Logging with Pino
 * Provides contextual loggers for different parts of the application
 */

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  // Disable logging in tests unless explicitly enabled
  enabled: !isTest || process.env.ENABLE_TEST_LOGS === 'true',

  formatters: {
    level: (label) => ({ level: label }),
  },

  // Pretty print in development
  ...(!isProduction && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});

/**
 * Create a child logger with a specific context
 */
export const createLogger = (context: string) => logger.child({ context });

// Pre-configured loggers for common contexts
export const authLogger = createLogger('auth');
export const storageLogger = createLogger('storage');
export const apiLogger = createLogger('api');
export const webhookLogger = createLogger('webhook');
export const billingLogger = createLogger('billing');
