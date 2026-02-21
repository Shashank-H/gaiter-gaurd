// Logger utility for structured logging

const LogLevels = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  DEBUG: 'DEBUG',
} as const;

type LogLevel = keyof typeof LogLevels;

function formatMessage(level: LogLevel, message: string, context?: any) {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] ${level}: ${message}${contextStr}`;
}

export const logger = {
  info: (message: string, context?: any) => {
    console.log(formatMessage('INFO', message, context));
  },
  warn: (message: string, context?: any) => {
    console.warn(formatMessage('WARN', message, context));
  },
  error: (message: string, context?: any) => {
    console.error(formatMessage('ERROR', message, context));
  },
  debug: (message: string, context?: any) => {
    if (process.env.DEBUG) {
      console.debug(formatMessage('DEBUG', message, context));
    }
  },
};
