/** Базовый URL API. В dev Vite проксирует /api → localhost:3001, на сервере — тот же origin. */
export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim().replace(/\/$/, '') || '/api';
