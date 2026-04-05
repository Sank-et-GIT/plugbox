import fs from 'node:fs';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { getRequestContext } from './requestContext';
import { sanitizeLog } from './sanitizeLog';

const logDir = process.env.LOG_DIR || './logs';
const logLevel = process.env.LOG_LEVEL || 'debug';
const nodeEnv = process.env.NODE_ENV || 'development';

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const addContext = winston.format((info) => {
  const ctx = getRequestContext();

  info.timestamp = new Date().toISOString();
  info.env = nodeEnv;

  if (ctx.requestId && !info.requestId) info.requestId = ctx.requestId;
  if (ctx.userId && !info.userId) info.userId = ctx.userId;
  if (ctx.method && !info.method) info.method = ctx.method;
  if (ctx.route && !info.route) info.route = ctx.route;

  return info;
});

const sanitize = winston.format((info) => sanitizeLog(info));

const consoleFormat = winston.format.printf((info) => {
  const { timestamp, level, message, category, requestId, userId, ...rest } = info;
  const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
  return `${timestamp} ${level} [${category || 'app'}]${requestId ? ` [${requestId}]` : ''}${userId ? ` [user:${userId}]` : ''} ${message}${extra}`;
});

export const logger = winston.createLogger({
  level: logLevel,
  transports: [
    new winston.transports.Console({
  format: winston.format.combine(
    addContext(),
    sanitize(),
    consoleFormat
  ),
}),

    new DailyRotateFile({
      dirname: logDir,
      filename: 'application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
      format: winston.format.combine(
        addContext(),
        sanitize(),
        winston.format.json()
      ),
    }),

    new DailyRotateFile({
      dirname: logDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
      format: winston.format.combine(
        addContext(),
        sanitize(),
        winston.format.json()
      ),
    }),
  ],
});

export function logInfo(message: string, meta: Record<string, any> = {}) {
  logger.info(message, meta);
}

export function logWarn(message: string, meta: Record<string, any> = {}) {
  logger.warn(message, meta);
}

export function logError(message: string, meta: Record<string, any> = {}) {
  logger.error(message, meta);
}

export function logDebug(message: string, meta: Record<string, any> = {}) {
  logger.debug(message, meta);
}