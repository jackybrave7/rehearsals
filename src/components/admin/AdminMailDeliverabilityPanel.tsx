import { useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw, ExternalLink } from 'lucide-react';
import { fetchMailDeliverability } from '../../api/adminMail';

export function AdminMailDeliverabilityPanel() {
  const [report, setReport] = useState<Awaited<ReturnType<typeof fetchMailDeliverability>> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await fetchMailDeliverability());
    } catch {
      setError('Не удалось проверить DNS почты');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-2xl border border-gold/15 bg-surface/60 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Mail size={18} className="text-gold" />
            Доставка на Mail.ru
          </h2>
          <p className="mt-1 text-sm text-muted">
            SPF, DKIM, DMARC и настройки SMTP для регистрации и сброса пароля
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gold/20 px-3 py-2 text-sm text-gold-light hover:bg-gold/10 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Проверить
        </button>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {report ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Домен: <span className="text-white">{report.domain}</span>
            {report.fromAddress ? ` · от ${report.fromAddress}` : ''}
            {report.readyForMailRu ? (
              <span className="ml-2 text-emerald-300">готово к отправке</span>
            ) : (
              <span className="ml-2 text-amber-200">нужны правки</span>
            )}
          </p>
          <ul className="space-y-2 text-sm">
            {report.checks.map((check) => (
              <li
                key={check.id}
                className={`rounded-lg border px-3 py-2 ${
                  check.ok ? 'border-emerald-500/20 bg-emerald-950/20' : 'border-amber-500/25 bg-amber-950/15'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-white">{check.label}</span>
                  <span className={check.ok ? 'text-emerald-300' : 'text-amber-200'}>
                    {check.ok ? 'OK' : 'Проблема'}
                  </span>
                </div>
                <p className="mt-1 text-muted">{check.detail}</p>
                {check.fix ? <p className="mt-1 text-xs text-gold-light/90">{check.fix}</p> : null}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 text-sm">
            <a
              href={report.postmasterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-gold-light hover:underline"
            >
              Постмастер Mail.ru <ExternalLink size={14} />
            </a>
            <a
              href={report.mailRuVerificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-gold-light hover:underline"
            >
              Файл верификации <ExternalLink size={14} />
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}
