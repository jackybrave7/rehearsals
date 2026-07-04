import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { AppLogo } from '../components/AppLogo';
import { verifyEmail } from '../api/auth';
import { Button } from '../components/Button';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [betaPendingApproval, setBetaPendingApproval] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    void verifyEmail(token)
      .then((result) => {
        setBetaPendingApproval(Boolean(result.betaPendingApproval));
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="auth-page flex min-h-screen items-center justify-center px-4 py-10">
      <div className="auth-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-6">
          <AppLogo size="lg" className="justify-center" />
        </div>

        {status === 'loading' && (
          <>
            <h1 className="text-xl font-bold text-foreground">Подтверждаем email…</h1>
            <p className="mt-2 text-sm text-muted">Подождите несколько секунд.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
            <h1 className="mt-4 text-xl font-bold text-foreground">Email подтверждён</h1>
            <p className="mt-2 text-sm text-muted">
              {betaPendingApproval
                ? 'Заявка отправлена администратору. Мы сообщим на почту, когда доступ к сервису откроется.'
                : 'Теперь можно войти в аккаунт.'}
            </p>
            {!betaPendingApproval ? (
              <Link to="/login" className="mt-6 inline-block">
                <Button>Войти</Button>
              </Link>
            ) : (
              <Link to="/login" className="mt-6 inline-block">
                <Button variant="secondary">Ко входу</Button>
              </Link>
            )}
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={40} className="mx-auto text-red-300" />
            <h1 className="mt-4 text-xl font-bold text-foreground">Ссылка недействительна</h1>
            <p className="mt-2 text-sm text-muted">
              Срок действия истёк или ссылка уже использована. Запросите новое письмо при входе.
            </p>
            <Link to="/login" className="mt-6 inline-block">
              <Button variant="secondary">Ко входу</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
