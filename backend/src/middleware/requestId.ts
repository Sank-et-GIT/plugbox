import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requestContext } from '../lib/requestContext';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();

  res.setHeader('x-request-id', requestId);

  requestContext.run(
    {
      requestId,
      method: req.method,
      route: req.originalUrl,
    },
    () => next()
  );
}