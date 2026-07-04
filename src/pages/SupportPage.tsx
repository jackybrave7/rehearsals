import { useState } from 'react';
import { LifeBuoy, CheckCircle2 } from 'lucide-react';
import { createSupportTicket } from '../api/support';
import { Button } from '../components/Button';
import { Input, Select, Textarea } from '../components/FormFields';
import { SUPPORT_TICKET_CATEGORIES, getSupportCategoryLabel, type SupportTicketCategory } from '../types/support';
import { pageTitleClass } from '../utils/pageLayout';

const categoryOptions = SUPPORT_TICKET_CATEGORIES.map(({ value, label }) => ({ value, label }));

const errorMessages: Record<string, string> = {
  MESSAGE_REQUIRED: 'Введите текст обращения.',
  MESSAGE_TOO_LONG: 'Сообщение слишком длинное (максимум 10 000 символов).',
  INVALID_CATEGORY: 'Выберите категорию обращения.',
  INVALID_REQUEST: 'Проверьте заполнение формы.',
  UNAUTHORIZED: 'Войдите в аккаунт, чтобы отправить обращение.',
};

export function SupportPage() {
  const [category, setCategory] = useState<SupportTicketCategory>('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ticketNumber: string; mailSent: boolean; category: SupportTicketCategory } | null>(
    null
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { ticket, mailSent } = await createSupportTicket({
        category,
        subject: subject.trim() || undefined,
        message,
      });
      setResult({ ticketNumber: ticket.ticketNumber, mailSent, category: ticket.category });
      setSubject('');
      setMessage('');
    } catch (submitError) {
      const code = submitError instanceof Error ? submitError.message : 'UNKNOWN';
      setError(errorMessages[code] ?? 'Не удалось отправить обращение. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-6">
        <header>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gold-light">
            <LifeBuoy size={14} />
            Поддержка
          </div>
          <h1 className={pageTitleClass}>Обращение отправлено</h1>
        </header>

        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={24} />
            <div className="space-y-3">
              <p className="text-white">
                Ваше обращение зарегистрировано под номером{' '}
                <span className="font-mono font-semibold text-gold-light">{result.ticketNumber}</span>.
              </p>
              <p className="text-sm text-muted">
                Категория: {getSupportCategoryLabel(result.category)}
              </p>
              {result.mailSent ? (
                <p className="text-sm text-muted">
                  Копия обращения отправлена на ваш email. Сохраните номер — он понадобится при переписке.
                </p>
              ) : (
                <p className="text-sm text-amber-200/90">
                  Письмо с подтверждением не отправлено (почта не настроена на сервере). Запишите номер обращения.
                </p>
              )}
              <Button type="button" variant="secondary" onClick={() => setResult(null)}>
                Отправить ещё одно обращение
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gold-light">
          <LifeBuoy size={14} />
          Поддержка
        </div>
        <h1 className={pageTitleClass}>Поддержка</h1>
        <p className="mt-1 text-muted">
          Опишите проблему или предложение — мы ответим на email вашего аккаунта.
        </p>
      </header>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-5 rounded-2xl border border-gold/10 bg-surface/40 p-4 sm:p-6"
      >
        <Select
          label="Категория"
          value={category}
          onChange={(event) => setCategory(event.target.value as SupportTicketCategory)}
          options={categoryOptions}
          required
        />

        <Input
          label="Тема (необязательно)"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Кратко, о чём обращение"
          maxLength={200}
        />

        <Textarea
          label="Сообщение"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Опишите ситуацию подробнее: что делали, что ожидали, что произошло"
          rows={6}
          required
          maxLength={10000}
        />

        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={submitting || !message.trim()}>
          {submitting ? 'Отправка…' : 'Отправить обращение'}
        </Button>
      </form>
    </div>
  );
}
