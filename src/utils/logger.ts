/**
 * Logger Utility
 *
 * Structured logging for consistent output across handlers.
 * In production, this would integrate with CloudWatch/DataDog/etc.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  handler?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
}

/**
 * Creates a structured logger instance
 */
export function createLogger(defaultContext: LogContext = {}): Logger {
  const log = (level: LogLevel, message: string, context: LogContext = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...defaultContext,
      ...context,
    };

    // In production, use JSON for CloudWatch parsing
    if (process.env.NODE_ENV === 'production') {
      console[level === 'debug' ? 'log' : level](JSON.stringify(entry));
    } else {
      // In dev, use readable format
      const prefix = `[${entry.timestamp}] ${level.toUpperCase()}`;
      const ctx = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
      console[level === 'debug' ? 'log' : level](`${prefix}: ${message}${ctx}`);
    }
  };

  return {
    debug: (message, context) => log('debug', message, context),
    info: (message, context) => log('info', message, context),
    warn: (message, context) => log('warn', message, context),
    error: (message, error, context) => {
      log('error', message, {
        ...context,
        error: error ? { name: error.name, message: error.message, stack: error.stack } : undefined,
      });
    },
  };
}

/**
 * Default logger instance for convenience
 */
export const logger = createLogger();
