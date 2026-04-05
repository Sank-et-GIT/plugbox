import { AsyncLocalStorage } from 'node:async_hooks';

type RequestStore = {
  requestId?: string;
  userId?: string;
  method?: string;
  route?: string;
};

export const requestContext = new AsyncLocalStorage<RequestStore>();

export function getRequestContext(): RequestStore {
  return requestContext.getStore() || {};
}