import { v4 as uuidv4 } from 'uuid';

/** Secure context (HTTPS/localhost) has crypto.randomUUID; plain HTTP on IP does not. */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return uuidv4();
}
