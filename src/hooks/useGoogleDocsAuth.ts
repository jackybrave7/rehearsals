import { useCallback, useEffect, useState } from 'react';

const TOKEN_STORAGE_KEY = 'rehearsals-google-docs-token';
const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const DOCS_READONLY_SCOPE = 'https://www.googleapis.com/auth/documents.readonly';

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

function readStoredToken(): StoredToken | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredToken(accessToken: string, expiresInSeconds: number) {
  const payload: StoredToken = {
    accessToken,
    expiresAt: Date.now() + Math.max(expiresInSeconds - 60, 0) * 1000,
  };
  sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(payload));
}

let gsiScriptPromise: Promise<void> | null = null;

function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('NO_WINDOW'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  if (gsiScriptPromise) return gsiScriptPromise;

  gsiScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('GSI_LOAD_FAILED')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GSI_LOAD_FAILED'));
    document.head.appendChild(script);
  });

  return gsiScriptPromise;
}

function getAuthErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('invalid_client') || lower.includes('oauth client was not found')) {
    return 'OAuth Client ID не найден в Google Cloud. Создайте клиент типа «Web application», добавьте origin этой страницы в Authorized JavaScript origins и укажите новый ID в .env (VITE_GOOGLE_CLIENT_ID). После изменения .env перезапустите npm run dev.';
  }
  if (lower.includes('access_denied')) {
    return 'Доступ отклонён. Разрешите приложению доступ к Google Docs.';
  }
  if (lower.includes('popup')) {
    return 'Не удалось открыть окно входа. Разрешите всплывающие окна для localhost.';
  }
  return raw;
}

export function useGoogleDocsAuth() {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  const [accessToken, setAccessToken] = useState<string | null>(() => readStoredToken()?.accessToken ?? null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStoredToken();
    if (stored) setAccessToken(stored.accessToken);
  }, []);

  const signIn = useCallback(async () => {
    if (!clientId) {
      setError('Не задан VITE_GOOGLE_CLIENT_ID');
      return null;
    }

    setIsRequesting(true);
    setError(null);

    try {
      await loadGsiScript();

      const token = await new Promise<string>((resolve, reject) => {
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DOCS_READONLY_SCOPE,
          callback: (response) => {
            if (response.error || !response.access_token) {
              reject(
                new Error(
                  getAuthErrorMessage(
                    response.error_description ?? response.error ?? 'AUTH_FAILED'
                  )
                )
              );
              return;
            }
            writeStoredToken(response.access_token, response.expires_in);
            resolve(response.access_token);
          },
          error_callback: (authError) => {
            reject(new Error(getAuthErrorMessage(authError.message ?? authError.type)));
          },
        });

        tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
      });

      setAccessToken(token);
      return token;
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : 'AUTH_FAILED';
      setError(message);
      return null;
    } finally {
      setIsRequesting(false);
    }
  }, [accessToken, clientId]);

  const signOut = useCallback(() => {
    if (accessToken && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(accessToken);
    }
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setAccessToken(null);
  }, [accessToken]);

  const getAccessToken = useCallback(async () => {
    const stored = readStoredToken();
    if (stored?.accessToken) return stored.accessToken;
    if (accessToken) return accessToken;
    return signIn();
  }, [accessToken, signIn]);

  return {
    clientId,
    isConfigured: Boolean(clientId),
    accessToken,
    isRequesting,
    error,
    signIn,
    signOut,
    getAccessToken,
  };
}
