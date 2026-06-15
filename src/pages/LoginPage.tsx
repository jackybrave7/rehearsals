import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Film } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { Button } from '../components/Button';

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();

  return new Promise((resolve, reject) => {
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
}

export function LoginPage() {
  const { user, loading, login, register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/app';

  useEffect(() => {
    if (!clientId || !googleButtonRef.current || loading || user) return;

    let cancelled = false;
    void loadGsiScript()
      .then(() => {
        if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            setSubmitting(true);
            setError(null);
            void googleLogin(response.credential)
              .then(() => navigate(redirectTo, { replace: true }))
              .catch((authError) => {
                setError(authError instanceof Error ? authError.message : 'Ошибка входа через Google');
              })
              .finally(() => setSubmitting(false));
          },
        });
        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: mode === 'login' ? 'signin_with' : 'signup_with',
        });
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить Google Sign-In');
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, googleLogin, loading, mode, navigate, redirectTo, user]);

  if (!loading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      navigate(redirectTo, { replace: true });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Ошибка входа');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-gold/15 bg-surface/60 p-8 shadow-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/20 text-gold">
            <Film size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gold-light">Репетиции</h1>
            <p className="text-sm text-muted">Вход в планировщик постановки</p>
          </div>
        </div>

        <div className="mb-6 flex gap-2 rounded-xl bg-black/20 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
              mode === 'login' ? 'bg-gold/20 text-white' : 'text-muted hover:text-white'
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
              mode === 'register' ? 'bg-gold/20 text-white' : 'text-muted hover:text-white'
            }`}
          >
            Регистрация
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Имя</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-gold/15 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40"
                placeholder="Как к вам обращаться"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-sm text-muted">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-gold/15 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40"
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-muted">Пароль</span>
            <input
              type="password"
              required
              minLength={mode === 'register' ? 8 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-gold/15 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'register' && (
              <span className="mt-1 block text-xs text-muted">Минимум 8 символов</span>
            )}
          </label>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </Button>
        </form>

        {clientId ? (
          <div className="mt-6 space-y-3">
            <div className="text-center text-xs uppercase tracking-wide text-muted">или</div>
            <div ref={googleButtonRef} className="flex justify-center" />
          </div>
        ) : (
          <p className="mt-6 text-center text-xs text-muted">
            Google Sign-In: задайте VITE_GOOGLE_CLIENT_ID в .env
          </p>
        )}

        <p className="mt-8 text-center text-sm text-muted">
          <Link to="/" className="text-gold-light hover:underline">
            На главную
          </Link>
        </p>
      </div>
    </div>
  );
}
