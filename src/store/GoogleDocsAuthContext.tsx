import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const TOKEN_STORAGE_KEY = 'rehearsals-google-docs-token';
const LEGACY_TOKEN_STORAGE_KEY = 'rehearsals-google-docs-token';
const CONSENT_FLAG_KEY = 'rehearsals-google-docs-consent';
const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const DOCS_READONLY_SCOPE = 'https://www.googleapis.com/auth/documents.readonly';

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

interface GoogleDocsAuthContextValue {
  clientId: string | undefined;
  isConfigured: boolean;
  accessToken: string | null;
  isRequesting: boolean;
  isRestoring: boolean;
  error: string | null;
  signIn: () => Promise<string | null>;
  signOut: () => void;
  getAccessToken: (options?: { interactive?: boolean }) => Promise<string | null>;
}

const GoogleDocsAuthContext = createContext<GoogleDocsAuthContextValue | null>(null);

function readStoredToken(): StoredToken | null {
  try {
    const raw =
      localStorage.getItem(TOKEN_STORAGE_KEY) ??
      sessionStorage.getItem(LEGACY_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
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
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(payload));
  sessionStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
  localStorage.setItem(CONSENT_FLAG_KEY, '1');
}

function clearStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
  localStorage.removeItem(CONSENT_FLAG_KEY);
}

function hasStoredConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_FLAG_KEY) === '1';
  } catch {
    return false;
  }
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
  if (lower.includes('disabled_client') || lower.includes('oauth client was disabled')) {
    return 'OAuth-клиент отключён в Google Cloud. Включите клиент в Credentials или укажите актуальный VITE_GOOGLE_CLIENT_ID на сервере и пересоберите сайт (npm run build).';
  }
  if (lower.includes('invalid_client') || lower.includes('oauth client was not found')) {
    return 'OAuth Client ID не найден в Google Cloud. Создайте клиент типа «Web application», добавьте origin этой страницы в Authorized JavaScript origins и укажите новый ID в .env (VITE_GOOGLE_CLIENT_ID). После изменения .env перезапустите npm run dev.';
  }
  if (lower.includes('access_denied')) {
    return 'Доступ отклонён. Разрешите приложению доступ к Google Docs.';
  }
  if (lower.includes('popup') || lower.includes('popup_closed')) {
    return 'Не удалось открыть окно входа. Разрешите всплывающие окна для этого сайта.';
  }
  return raw;
}

async function requestAccessTokenFromGoogle(
  clientId: string,
  prompt: '' | 'consent'
): Promise<{ accessToken: string; expiresIn: number }> {
  await loadGsiScript();

  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DOCS_READONLY_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(
            new Error(
              getAuthErrorMessage(response.error_description ?? response.error ?? 'AUTH_FAILED')
            )
          );
          return;
        }
        resolve({
          accessToken: response.access_token,
          expiresIn: response.expires_in ?? 3600,
        });
      },
      error_callback: (authError) => {
        reject(new Error(getAuthErrorMessage(authError.message ?? authError.type)));
      },
    });

    tokenClient.requestAccessToken({ prompt });
  });
}

/** Только валидный токен из localStorage — без всплывающего окна Google. */
function readValidStoredAccessToken(): string | null {
  return readStoredToken()?.accessToken ?? null;
}

export function GoogleDocsAuthProvider({ children }: { children: ReactNode }) {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  const [accessToken, setAccessToken] = useState<string | null>(() => readValidStoredAccessToken());
  const [isRequesting, setIsRequesting] = useState(false);
  const isRestoring = false;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    const stored = readValidStoredAccessToken();
    if (stored) setAccessToken(stored);
  }, [clientId]);

  const signIn = useCallback(async () => {
    if (!clientId) {
      setError('Не задан VITE_GOOGLE_CLIENT_ID');
      return null;
    }

    setIsRequesting(true);
    setError(null);

    try {
      const prompt = hasStoredConsent() ? '' : 'consent';
      const { accessToken: token, expiresIn } = await requestAccessTokenFromGoogle(clientId, prompt);
      writeStoredToken(token, expiresIn);
      setAccessToken(token);
      return token;
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : 'AUTH_FAILED';
      setError(message);
      return null;
    } finally {
      setIsRequesting(false);
    }
  }, [clientId]);

  const signOut = useCallback(() => {
    if (accessToken && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(accessToken);
    }
    clearStoredToken();
    setAccessToken(null);
    setError(null);
  }, [accessToken]);

  const getAccessToken = useCallback(
    async (options?: { interactive?: boolean }) => {
      const stored = readValidStoredAccessToken();
      if (stored) {
        setAccessToken(stored);
        return stored;
      }
      if (accessToken) return accessToken;

      if (!clientId) {
        setError('Не задан VITE_GOOGLE_CLIENT_ID');
        return null;
      }

      if (!options?.interactive) {
        return null;
      }

      return signIn();
    },
    [accessToken, clientId, signIn]
  );

  const value = useMemo(
    () => ({
      clientId,
      isConfigured: Boolean(clientId),
      accessToken,
      isRequesting,
      isRestoring,
      error,
      signIn,
      signOut,
      getAccessToken,
    }),
    [accessToken, clientId, error, getAccessToken, isRequesting, isRestoring, signIn, signOut]
  );

  return <GoogleDocsAuthContext.Provider value={value}>{children}</GoogleDocsAuthContext.Provider>;
}

export function useGoogleDocsAuth(): GoogleDocsAuthContextValue {
  const context = useContext(GoogleDocsAuthContext);
  if (!context) {
    throw new Error('useGoogleDocsAuth must be used within GoogleDocsAuthProvider');
  }
  return context;
}
