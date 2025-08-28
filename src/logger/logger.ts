// Logger module using pino
// Provides a shared logger instance across the application.
// IMPORTANT: We use logger.debug extensively for troubleshooting as per requirements.

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'debug', // default to debug for easier troubleshooting
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          // pretty output in development
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' }
        }
      : undefined
});

export default logger;
