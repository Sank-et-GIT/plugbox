import { Request, Response, NextFunction } from 'express';
import { logDebug, logInfo, logWarn, logError } from '../lib/logger';
import { requestContext } from '../lib/requestContext';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  const userId =
    (req as any).user?.id ||
    (req as any).user?.userId ||
    (req.headers['x-user-id'] as string) ||
    undefined;

  const current = requestContext.getStore() || {};

  requestContext.enterWith({
    ...current,
    userId: typeof userId === 'string' ? userId : undefined,
    method: req.method,
    route: req.originalUrl,
  });

  logDebug('http_request_started', {
    category: 'http',
    method: req.method,
    path: req.originalUrl,
    query: req.query,
    params: req.params,
    body: req.body,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.on('finish', () => {
    const durationMs = Date.now() - start;

    const meta = {
      category: 'http',
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userId: typeof userId === 'string' ? userId : undefined,
    };

    if (durationMs > 5000) {
      logError('http_request_slow', meta);
    } else if (durationMs > 1000) {
      logWarn('http_request_slow', meta);
    } else {
      logInfo('http_request_completed', meta);
    }
  });

  next();
}