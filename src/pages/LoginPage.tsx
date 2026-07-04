import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { AppLogo } from '../components/AppLogo';
import { useAuth } from '../store/AuthContext';
import { fetchAuthConfig, requestPasswordReset, resendEmailVerification } from '../api/auth';
import { Button } from '../components/Button';
import { LEGAL_DOCUMENTS } from '../content/legalOperator';

const inputClass = 'auth-input';

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
  const [registrationMode, setRegistrationMode] = useState<'normal' | 'beta'>('normal');
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/app';

  useEffect(() => {
    void fetchAuthConfig().then((config) => {
      setMailConfigured(config.mailConfigured);
      setRegistrationMode(config.registrationMode);
    });
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
    <div className="auth-page flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="auth-card w-full max-w-md p-8">
          <div className="mb-8 flex items-center gap-3">
            <AppLogo size="lg" variant="zen" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Репетиции</h1>
              <p className="text-sm text-muted">Вход в планировщик постановки</p>
            </div>
          </div>

          {mode !== 'forgot' ? (
            <div className="auth-segment mb-6" role="tablist" aria-label="Режим входа">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                data-active={mode === 'login'}
                onClick={() => switchMode('login')}
                className="auth-segment-btn"
              >
                Вход
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                data-active={mode === 'register'}
                onClick={() => switchMode('register')}
                className="auth-segment-btn"
              >
                Регистрация
              </button>
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="text-lg font-medium text-foreground">Восстановление пароля</h2>
              <p className="mt-1 text-sm text-muted">
                Отправим одноразовый пароль на email. После входа смените его в Настройках.
              </p>
            </div>
          )}

          {mode === 'register' && registrationMode === 'beta' ? (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
              Сервис работает в режиме бета-тестирования. После регистрации и подтверждения email
              заявка будет рассмотрена администратором — мы сообщим на почту, когда доступ откроется.
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground/90">Имя</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={inputClass}
                  placeholder="Как к вам обращаться"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground/90">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>

            {mode !== 'forgot' && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground/90">Пароль</span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={mode === 'register' ? 8 : undefined}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={`${inputClass} pr-11`}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted transition-colors hover:text-foreground"
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
                  className="mt-1 h-4 w-4 rounded border-gold/40 accent-gold"
                />
                <span>
                  Я принимаю{' '}
                  <Link to={LEGAL_DOCUMENTS.terms.path} className="text-accent hover:underline" target="_blank">
                    пользовательское соглашение
                  </Link>
                  ,{' '}
                  <Link to={LEGAL_DOCUMENTS.privacy.path} className="text-accent hover:underline" target="_blank">
                    политику конфиденциальности
                  </Link>{' '}
                  и{' '}
                  <Link to={LEGAL_DOCUMENTS.offer.path} className="text-accent hover:underline" target="_blank">
                    публичную оферту
                  </Link>
                </span>
              </label>
            )}

            {mode === 'login' && mailConfigured && (
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-sm text-accent hover:underline"
              >
                Забыли пароль?
              </button>
            )}

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-sm text-muted hover:text-foreground"
              >
                ← Назад ко входу
              </button>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/35 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
                {showResendVerification && (
                  <button
                    type="button"
                    onClick={() => void handleResendVerification()}
                    className="mt-2 block text-accent hover:underline"
                    disabled={submitting}
                  >
                    Отправить письмо повторно
                  </button>
                )}
              </div>
            )}

            {info && (
              <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
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
            <Link to="/" className="text-accent hover:underline">
              На главную
            </Link>
          </p>
        </div>
      </div>

      <footer className="border-t border-gold/10 px-4 py-6 text-center text-xs text-muted">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link to={LEGAL_DOCUMENTS.terms.path} className="hover:text-accent">
            {LEGAL_DOCUMENTS.terms.title}
          </Link>
          <Link to={LEGAL_DOCUMENTS.privacy.path} className="hover:text-accent">
            {LEGAL_DOCUMENTS.privacy.title}
          </Link>
          <Link to={LEGAL_DOCUMENTS.offer.path} className="hover:text-accent">
            {LEGAL_DOCUMENTS.offer.title}
          </Link>
        </div>
      </footer>
    </div>
  );
}
