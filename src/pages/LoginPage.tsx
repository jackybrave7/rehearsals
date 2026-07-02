import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { AppLogo } from '../components/AppLogo';
import { useAuth } from '../store/AuthContext';
import { fetchAuthConfig, requestPasswordReset, resendEmailVerification } from '../api/auth';
import { Button } from '../components/Button';
import { LEGAL_DOCUMENTS } from '../content/legalOperator';

export function LoginPage() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mailConfigured, setMailConfigured] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/app';

  useEffect(() => {
    void fetchAuthConfig().then((config) => setMailConfigured(config.mailConfigured));
  }, []);

  useEffect(() => {
    if (searchParams.get('verified') === '1') {
      setInfo('Email подтверждён. Теперь можно войти.');
      setMode('login');
    }
  }, [searchParams]);

  if (!loading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setInfo(null);
    setShowResendVerification(false);
    try {
      if (mode === 'forgot') {
        const message = await requestPasswordReset(email);
        setInfo(message);
        return;
      }
      if (mode === 'login') {
        await login(email, password);
        navigate(redirectTo, { replace: true });
        return;
      }
      if (!acceptTerms) {
        setError('Примите пользовательское соглашение и политику конфиденциальности');
        return;
      }
      const result = await register(email, password, name, acceptTerms);
      setInfo(result.message);
      setMode('login');
      setPassword('');
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : 'Ошибка входа';
      setError(message);
      if (message.includes('Подтвердите email')) {
        setShowResendVerification(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setError('Укажите email, на который регистрировались');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const message = await resendEmailVerification(email);
      setInfo(message);
      setShowResendVerification(false);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Не удалось отправить письмо');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next: 'login' | 'register' | 'forgot') => {
    setMode(next);
    setError(null);
    setInfo(null);
    setShowResendVerification(false);
    setShowPassword(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-gold/15 bg-surface/60 p-8 shadow-2xl">
          <div className="mb-8 flex items-center gap-3">
            <AppLogo size="lg" />
            <div>
              <h1 className="text-2xl font-bold text-gold-light">Репетиции</h1>
              <p className="text-sm text-muted">Вход в планировщик постановки</p>
            </div>
          </div>

          {mode !== 'forgot' ? (
            <div className="mb-6 flex gap-2 rounded-xl bg-black/20 p-1">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                  mode === 'login' ? 'bg-gold/20 text-white' : 'text-muted hover:text-white'
                }`}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`flex-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                  mode === 'register' ? 'bg-gold/20 text-white' : 'text-muted hover:text-white'
                }`}
              >
                Регистрация
              </button>
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="text-lg font-medium text-white">Восстановление пароля</h2>
              <p className="mt-1 text-sm text-muted">
                Отправим одноразовый пароль на email. После входа смените его в Настройках.
              </p>
            </div>
          )}

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

            {mode !== 'forgot' && (
              <label className="block">
                <span className="mb-1 block text-sm text-muted">Пароль</span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={mode === 'register' ? 8 : undefined}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-gold/15 bg-black/20 py-3 pl-4 pr-11 text-white outline-none focus:border-gold/40"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted transition-colors hover:text-white"
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {mode === 'register' && (
                  <span className="mt-1 block text-xs text-muted">Минимум 8 символов</span>
                )}
              </label>
            )}

            {mode === 'register' && (
              <label className="flex items-start gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(event) => setAcceptTerms(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gold/30 accent-gold"
                />
                <span>
                  Я принимаю{' '}
                  <Link to={LEGAL_DOCUMENTS.terms.path} className="text-gold-light hover:underline" target="_blank">
                    пользовательское соглашение
                  </Link>
                  ,{' '}
                  <Link to={LEGAL_DOCUMENTS.privacy.path} className="text-gold-light hover:underline" target="_blank">
                    политику конфиденциальности
                  </Link>{' '}
                  и{' '}
                  <Link to={LEGAL_DOCUMENTS.offer.path} className="text-gold-light hover:underline" target="_blank">
                    публичную оферту
                  </Link>
                </span>
              </label>
            )}

            {mode === 'login' && mailConfigured && (
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-sm text-gold-light hover:underline"
              >
                Забыли пароль?
              </button>
            )}

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-sm text-muted hover:text-white"
              >
                ← Назад ко входу
              </button>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                {error}
                {showResendVerification && (
                  <button
                    type="button"
                    onClick={() => void handleResendVerification()}
                    className="mt-2 block text-gold-light hover:underline"
                    disabled={submitting}
                  >
                    Отправить письмо повторно
                  </button>
                )}
              </div>
            )}

            {info && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
                {info}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting
                ? 'Подождите…'
                : mode === 'login'
                  ? 'Войти'
                  : mode === 'register'
                    ? 'Создать аккаунт'
                    : 'Отправить пароль на почту'}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted">
            <Link to="/" className="text-gold-light hover:underline">
              На главную
            </Link>
          </p>
        </div>
      </div>

      <footer className="border-t border-gold/10 px-4 py-6 text-center text-xs text-muted">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link to={LEGAL_DOCUMENTS.terms.path} className="hover:text-gold-light">
            {LEGAL_DOCUMENTS.terms.title}
          </Link>
          <Link to={LEGAL_DOCUMENTS.privacy.path} className="hover:text-gold-light">
            {LEGAL_DOCUMENTS.privacy.title}
          </Link>
          <Link to={LEGAL_DOCUMENTS.offer.path} className="hover:text-gold-light">
            {LEGAL_DOCUMENTS.offer.title}
          </Link>
        </div>
      </footer>
    </div>
  );
}
