import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Film, CheckCircle2, XCircle } from 'lucide-react';
import { verifyEmail } from '../api/auth';
import { Button } from '../components/Button';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    void verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-gold/15 bg-surface/60 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/20 text-gold">
          <Film size={26} />
        </div>

        {status === 'loading' && (
          <>
            <h1 className="text-xl font-bold text-white">Подтверждаем email…</h1>
            <p className="mt-2 text-sm text-muted">Подождите несколько секунд.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
            <h1 className="mt-4 text-xl font-bold text-white">Email подтверждён</h1>
            <p className="mt-2 text-sm text-muted">Теперь можно войти в аккаунт.</p>
            <Link to="/login" className="mt-6 inline-block">
              <Button>Войти</Button>
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={40} className="mx-auto text-red-300" />
            <h1 className="mt-4 text-xl font-bold text-white">Ссылка недействительна</h1>
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
