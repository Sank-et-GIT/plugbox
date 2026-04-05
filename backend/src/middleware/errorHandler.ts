import { Request, Response, NextFunction } from 'express';
import { logError } from '../lib/logger';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const statusCode = err?.statusCode || 500;

  logError('http_unhandled_error', {
    category: 'error',
    method: req.method,
    path: req.originalUrl,
    statusCode,
    errorMessage: err?.message || 'Internal Server Error',
    stack: err?.stack,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  res.status(statusCode).json({
    success: false,
    message: err?.message || 'Internal Server Error',
  });
}