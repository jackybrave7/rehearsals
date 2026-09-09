import { useCallback, useEffect, useState, Fragment } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Mail, RefreshCw, Send, Shield, Users, ChevronDown, ChevronRight, MousePointerClick, Eye, CalendarClock, X } from 'lucide-react';
import { AdminNav } from '../components/admin/AdminNav';
import { AdminErrorBanner } from '../components/admin/adminUi';
import { Button } from '../components/Button';
import { Input, Select, Textarea } from '../components/FormFields';
import {
  defaultBroadcastFilters,
  cancelAdminBroadcast,
  fetchAdminBroadcastDetail,
  fetchAdminBroadcastHistory,
  previewAdminBroadcast,
  scheduleAdminBroadcast,
  sendAdminBroadcast,
} from '../api/adminBroadcast';
import type {
  BroadcastDetail,
  BroadcastFilters,
  BroadcastHistoryItem,
  BroadcastPreview,
  BroadcastStatus,
} from '../types/admin';
import { formatAdminSubscriptionLabel } from '../utils/subscription';

const triStateOptions = [
  { value: 'all', label: 'Все' },
  { value: 'yes', label: 'Да' },
  { value: 'no', label: 'Нет' },
];

function filtersSummary(filters: BroadcastFilters): string {
  const parts: string[] = [];
  if (filters.registeredFrom || filters.registeredTo) {
    parts.push(
      `регистрация ${filters.registeredFrom ?? '…'} — ${filters.registeredTo ?? '…'}`
    );
  }
  if (filters.subscriptionPlan !== 'all') {
    parts.push(formatAdminSubscriptionLabel(filters.subscriptionPlan));
  }
  if (filters.registrationStatus !== 'all') {
    parts.push(`статус: ${filters.registrationStatus}`);
  }
  if (filters.emailVerified !== 'all') {
    parts.push(`email ${filters.emailVerified === 'yes' ? 'подтверждён' : 'не подтверждён'}`);
  }
  if (filters.hasTheater !== 'all') {
    parts.push(filters.hasTheater === 'yes' ? 'есть театр' : 'без театра');
  }
  if (filters.isTheaterOwner !== 'all') {
    parts.push(filters.isTheaterOwner === 'yes' ? 'владельцы' : 'не владельцы');
  }
  if (filters.minActiveSessions > 0) {
    parts.push(`сессий ≥ ${filters.minActiveSessions}`);
  }
  if (filters.excludePlatformAdmins) {
    parts.push('без админов');
  }
  return parts.length > 0 ? parts.join(' · ') : 'без фильтров';
}

function formatEngagementRate(count: number, ratePercent: number): string {
  return `${count} (${ratePercent}%)`;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return format(parseISO(value), 'd MMM yyyy, HH:mm', { locale: ru });
}

function defaultScheduleLocalValue(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function broadcastStatusLabel(status: BroadcastStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Запланирована';
    case 'sending':
      return 'Отправляется';
    case 'sent':
      return 'Отправлена';
    case 'cancelled':
      return 'Отменена';
    case 'failed':
      return 'Ошибка';
    default:
      return status;
  }
}

function historyPrimaryDate(item: BroadcastHistoryItem): string {
  if (item.status === 'scheduled' && item.scheduledAt) {
    return formatDateTime(item.scheduledAt);
  }
  return formatDateTime(item.sentAt ?? item.createdAt);
}

export function AdminBroadcastPage() {
  const [filters, setFilters] = useState<BroadcastFilters>(defaultBroadcastFilters);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [preview, setPreview] = useState<BroadcastPreview | null>(null);
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [scheduledAtLocal, setScheduledAtLocal] = useState(defaultScheduleLocalValue);
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<BroadcastDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await fetchAdminBroadcastHistory());
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handlePreview = async () => {
    setPreviewLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await previewAdminBroadcast(filters);
      setPreview(result);
    } catch (previewError) {
      setPreview(null);
      setError(previewError instanceof Error ? previewError.message : 'Ошибка предпросмотра');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!confirmSend) {
      setError('Подтвердите отправку галочкой ниже');
      return;
    }
    if (!subject.trim() || !bodyText.trim()) {
      setError('Заполните тему и текст письма');
      return;
    }
    if (sendMode === 'schedule' && !scheduledAtLocal) {
      setError('Укажите дату и время отправки');
      return;
    }

    setSendLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (!preview) {
        const nextPreview = await previewAdminBroadcast(filters);
        setPreview(nextPreview);
        if (nextPreview.recipientCount === 0) {
          setError('По выбранным фильтрам нет получателей');
          return;
        }
      } else if (preview.recipientCount === 0) {
        setError('По выбранным фильтрам нет получателей');
        return;
      }

      if (sendMode === 'schedule') {
        const scheduledAt = new Date(scheduledAtLocal).toISOString();
        const result = await scheduleAdminBroadcast({
          filters,
          subject: subject.trim(),
          bodyText: bodyText.trim(),
          scheduledAt,
          confirm: true,
        });
        setNotice(
          `Рассылка запланирована на ${formatDateTime(result.scheduledAt)} · получателей: ${result.recipientCount}`
        );
      } else {
        const result = await sendAdminBroadcast({
          filters,
          subject: subject.trim(),
          bodyText: bodyText.trim(),
          confirm: true,
        });
        setNotice(
          `Отправлено ${result.sentCount} из ${result.recipientCount}` +
            (result.failedCount > 0 ? ` · ошибок: ${result.failedCount}` : '')
        );
      }

      setConfirmSend(false);
      setPreview(null);
      await loadHistory();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'SUBMIT_FAILED';
      if (message === 'MAIL_NOT_CONFIGURED') {
        setError('SMTP не настроен на сервере — рассылка недоступна');
      } else if (message === 'NO_RECIPIENTS') {
        setError('По выбранным фильтрам нет получателей');
      } else if (message === 'SCHEDULE_TOO_SOON') {
        setError('Время отправки должно быть минимум через 1 минуту от текущего');
      } else if (message === 'INVALID_SCHEDULE_TIME') {
        setError('Некорректная дата и время отправки');
      } else if (sendMode === 'schedule') {
        setError('Не удалось запланировать рассылку');
      } else {
        setError('Не удалось отправить рассылку');
      }
    } finally {
      setSendLoading(false);
    }
  };

  const handleCancelScheduled = async (broadcastId: string) => {
    setCancelLoadingId(broadcastId);
    setError(null);
    try {
      await cancelAdminBroadcast(broadcastId);
      setNotice('Запланированная рассылка отменена');
      if (expandedId === broadcastId) {
        setExpandedId(null);
        setExpandedDetail(null);
      }
      await loadHistory();
    } catch {
      setError('Не удалось отменить рассылку');
    } finally {
      setCancelLoadingId(null);
    }
  };

  const updateFilter = <K extends keyof BroadcastFilters>(key: K, value: BroadcastFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPreview(null);
  };

  const toggleBroadcastDetail = async (broadcastId: string) => {
    if (expandedId === broadcastId) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }

    setExpandedId(broadcastId);
    setExpandedDetail(null);
    setDetailLoading(true);
    try {
      setExpandedDetail(await fetchAdminBroadcastDetail(broadcastId));
    } catch {
      setExpandedDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gold-light">
              <Shield size={14} />
              Админка
            </div>
            <h1 className="text-3xl font-bold text-white">Рассылка пользователям</h1>
            <p className="mt-1 text-sm text-muted">
              Email-рассылка по подписчикам с фильтрами. Отслеживаются открытия (пиксель) и клики по ссылкам.
            </p>
          </div>
        </div>
        <AdminNav />
      </header>

      <AdminErrorBanner error={error} />
      {notice && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="space-y-6 rounded-2xl border border-gold/15 bg-surface/60 p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <Users size={18} className="text-gold" />
              Фильтры получателей
            </h2>
            <p className="mt-1 text-sm text-muted">
              По умолчанию — только пользователи с подтверждённым email и открытым доступом.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Регистрация с"
              type="date"
              value={filters.registeredFrom ?? ''}
              onChange={(event) =>
                updateFilter('registeredFrom', event.target.value || undefined)
              }
            />
            <Input
              label="Регистрация по"
              type="date"
              value={filters.registeredTo ?? ''}
              onChange={(event) => updateFilter('registeredTo', event.target.value || undefined)}
            />
            <Select
              label="Подписка"
              value={filters.subscriptionPlan}
              onChange={(event) =>
                updateFilter(
                  'subscriptionPlan',
                  event.target.value as BroadcastFilters['subscriptionPlan']
                )
              }
              options={[
                { value: 'all', label: 'Все' },
                { value: 'free', label: 'Free' },
                { value: 'pro', label: 'Pro' },
              ]}
            />
            <Select
              label="Статус регистрации"
              value={filters.registrationStatus}
              onChange={(event) =>
                updateFilter(
                  'registrationStatus',
                  event.target.value as BroadcastFilters['registrationStatus']
                )
              }
              options={[
                { value: 'all', label: 'Все' },
                { value: 'approved', label: 'Доступ открыт' },
                { value: 'pending_approval', label: 'Ждёт одобрения' },
                { value: 'pending_email', label: 'Email не подтверждён' },
              ]}
            />
            <Select
              label="Email подтверждён"
              value={filters.emailVerified}
              onChange={(event) =>
                updateFilter('emailVerified', event.target.value as BroadcastFilters['emailVerified'])
              }
              options={triStateOptions}
            />
            <Select
              label="Есть театр"
              value={filters.hasTheater}
              onChange={(event) =>
                updateFilter('hasTheater', event.target.value as BroadcastFilters['hasTheater'])
              }
              options={triStateOptions}
            />
            <Select
              label="Владелец театра"
              value={filters.isTheaterOwner}
              onChange={(event) =>
                updateFilter('isTheaterOwner', event.target.value as BroadcastFilters['isTheaterOwner'])
              }
              options={triStateOptions}
            />
            <Input
              label="Мин. активных сессий"
              type="number"
              min={0}
              value={String(filters.minActiveSessions)}
              onChange={(event) =>
                updateFilter('minActiveSessions', Math.max(0, Number(event.target.value) || 0))
              }
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gold/10 bg-background/30 p-4">
            <input
              type="checkbox"
              checked={filters.excludePlatformAdmins}
              onChange={(event) => updateFilter('excludePlatformAdmins', event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gold/30 bg-background text-gold focus:ring-gold/40"
            />
            <span>
              <span className="block font-medium text-white">Не включать админов платформы</span>
              <span className="mt-1 block text-sm text-muted">
                Адреса из `ADMIN_EMAILS` не попадут в рассылку.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void handlePreview()} disabled={previewLoading}>
              {previewLoading ? <RefreshCw size={16} className="animate-spin" /> : <Users size={16} />}
              Показать получателей
            </Button>
          </div>

          {preview && (
            <div className="rounded-xl border border-gold/10 bg-background/30 p-4">
              <p className="text-sm text-white">
                Получателей: <strong>{preview.recipientCount}</strong>
              </p>
              <p className="mt-1 text-xs text-muted">{filtersSummary(preview.filters)}</p>
              {preview.sample.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-muted">
                  {preview.sample.map((recipient) => (
                    <li key={recipient.id}>
                      {recipient.name} · {recipient.email} ·{' '}
                      {formatAdminSubscriptionLabel(recipient.subscriptionPlan)}
                    </li>
                  ))}
                  {preview.recipientCount > preview.sample.length && (
                    <li>…и ещё {preview.recipientCount - preview.sample.length}</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-gold/15 bg-surface/60 p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <Mail size={18} className="text-gold" />
              Письмо
            </h2>
            <p className="mt-1 text-sm text-muted">
              Обращение «Здравствуйте, …» и подпись сервиса добавятся автоматически.
            </p>
          </div>

          <Input
            label="Тема"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Новости сервиса «Репетиции»"
          />
          <Textarea
            label="Текст"
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
            placeholder={'Здравствуйте!\n\nКоротко о том, что изменилось…'}
          />

          <div className="space-y-3 rounded-xl border border-gold/10 bg-background/30 p-4">
            <p className="text-sm font-medium text-white">Когда отправить</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={sendMode === 'now' ? 'primary' : 'secondary'}
                disabled={sendLoading}
                onClick={() => setSendMode('now')}
              >
                <Send size={16} />
                Сейчас
              </Button>
              <Button
                type="button"
                variant={sendMode === 'schedule' ? 'primary' : 'secondary'}
                disabled={sendLoading}
                onClick={() => setSendMode('schedule')}
              >
                <CalendarClock size={16} />
                Запланировать
              </Button>
            </div>
            {sendMode === 'schedule' ? (
              <div>
                <Input
                  label="Дата и время"
                  type="datetime-local"
                  value={scheduledAtLocal}
                  min={defaultScheduleLocalValue()}
                  onChange={(event) => setScheduledAtLocal(event.target.value)}
                />
                <p className="mt-2 text-xs text-muted">
                  Время — по часовому поясу вашего браузера. Получатели определяются в момент отправки по сохранённым фильтрам.
                </p>
              </div>
            ) : null}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-950/20 p-4">
            <input
              type="checkbox"
              checked={confirmSend}
              onChange={(event) => setConfirmSend(event.target.checked)}
              disabled={sendLoading}
              className="mt-1 h-4 w-4 rounded border-amber-500/30 bg-background text-amber-400 focus:ring-amber-400/40"
            />
            <span>
              <span className="block font-medium text-amber-100">
                {sendMode === 'schedule'
                  ? 'Понимаю: рассылка будет поставлена в очередь на указанное время'
                  : 'Понимаю: письмо уйдёт всем получателям по фильтрам'}
              </span>
              <span className="mt-1 block text-sm text-amber-100/80">
                Сначала нажмите «Показать получателей» и проверьте список.
              </span>
            </span>
          </label>

          <Button onClick={() => void handleSubmit()} disabled={sendLoading || !confirmSend}>
            {sendLoading ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : sendMode === 'schedule' ? (
              <CalendarClock size={16} />
            ) : (
              <Send size={16} />
            )}
            {sendMode === 'schedule' ? 'Запланировать рассылку' : 'Отправить рассылку'}
          </Button>
        </section>
      </div>

      <section className="rounded-2xl border border-gold/15 bg-surface/60 p-5">
        <h2 className="text-lg font-semibold text-white">История рассылок</h2>
        {historyLoading ? (
          <p className="mt-3 text-sm text-muted">Загрузка…</p>
        ) : history.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Рассылок пока не было.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2">Дата</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2">Тема</th>
                  <th className="px-3 py-2">Получатели</th>
                  <th className="px-3 py-2">Успешно</th>
                  <th className="px-3 py-2">Ошибки</th>
                  <th className="px-3 py-2">Открыли</th>
                  <th className="px-3 py-2">Клики</th>
                  <th className="px-3 py-2">Кто отправил</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <Fragment key={item.id}>
                    <tr
                      className="cursor-pointer border-t border-gold/10 hover:bg-gold/5"
                      onClick={() => void toggleBroadcastDetail(item.id)}
                    >
                      <td className="px-3 py-3 text-muted">
                        {expandedId === item.id ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </td>
                      <td className="px-3 py-3 text-muted">
                        {historyPrimaryDate(item)}
                        {item.status === 'scheduled' ? (
                          <span className="mt-1 block text-xs text-violet-300">запланировано</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            item.status === 'scheduled'
                              ? 'text-violet-300'
                              : item.status === 'sent'
                                ? 'text-emerald-300'
                                : item.status === 'failed'
                                  ? 'text-red-300'
                                  : item.status === 'cancelled'
                                    ? 'text-muted'
                                    : 'text-amber-200'
                          }
                        >
                          {broadcastStatusLabel(item.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-white">{item.subject}</td>
                      <td className="px-3 py-3">{item.recipientCount}</td>
                      <td className="px-3 py-3 text-emerald-300">
                        {item.status === 'scheduled' || item.status === 'cancelled' ? '—' : item.successCount}
                      </td>
                      <td className="px-3 py-3 text-red-300">
                        {item.status === 'scheduled' || item.status === 'cancelled' ? '—' : item.failureCount}
                      </td>
                      <td className="px-3 py-3 text-sky-300">
                        {item.status === 'sent' || item.status === 'sending' || item.status === 'failed'
                          ? formatEngagementRate(item.openedCount, item.openRatePercent)
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-amber-200">
                        {item.status === 'sent' || item.status === 'sending' || item.status === 'failed'
                          ? formatEngagementRate(item.clickedCount, item.clickRatePercent)
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-muted">{item.sentByEmail || '—'}</td>
                      <td className="px-3 py-3">
                        {item.status === 'scheduled' ? (
                          <Button
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            disabled={cancelLoadingId === item.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleCancelScheduled(item.id);
                            }}
                          >
                            {cancelLoadingId === item.id ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <X size={14} />
                            )}
                            Отменить
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                    {expandedId === item.id ? (
                      <tr key={`${item.id}-detail`} className="border-t border-gold/10 bg-background/20">
                        <td colSpan={11} className="px-3 py-4">
                          {item.status === 'scheduled' ? (
                            <div className="space-y-2 text-sm">
                              <p className="text-white">
                                Отправка запланирована на{' '}
                                <strong>{formatDateTime(item.scheduledAt)}</strong>
                              </p>
                              <p className="text-muted">
                                Ожидаемых получателей: {item.recipientCount} · {filtersSummary(item.filters)}
                              </p>
                              <p className="text-xs text-muted">
                                Фактический список получателей будет определён в момент отправки.
                              </p>
                            </div>
                          ) : detailLoading ? (
                            <p className="text-sm text-muted">Загрузка статистики…</p>
                          ) : expandedDetail && expandedDetail.id === item.id ? (
                            <div className="space-y-4">
                              <div className="flex flex-wrap gap-4 text-sm">
                                <span className="inline-flex items-center gap-1 text-sky-300">
                                  <Eye size={14} />
                                  Открыли: {expandedDetail.stats.openedCount} из{' '}
                                  {expandedDetail.stats.sentCount} ({expandedDetail.stats.openRatePercent}%)
                                </span>
                                <span className="inline-flex items-center gap-1 text-amber-200">
                                  <MousePointerClick size={14} />
                                  Кликнули: {expandedDetail.stats.clickedCount} из{' '}
                                  {expandedDetail.stats.sentCount} ({expandedDetail.stats.clickRatePercent}%)
                                </span>
                              </div>
                              <p className="text-xs text-muted">
                                Открытия могут завышаться из‑за предзагрузки в Apple Mail и других клиентах.
                                Клики по ссылкам надёжнее.
                              </p>
                              {expandedDetail.recipients.length === 0 ? (
                                <p className="text-sm text-muted">Нет данных по получателям.</p>
                              ) : (
                                <div className="overflow-x-auto rounded-xl border border-gold/10">
                                  <table className="min-w-full text-sm">
                                    <thead className="text-left text-xs uppercase tracking-wide text-muted">
                                      <tr>
                                        <th className="px-3 py-2">Пользователь</th>
                                        <th className="px-3 py-2">Email</th>
                                        <th className="px-3 py-2">Доставка</th>
                                        <th className="px-3 py-2">Открыто</th>
                                        <th className="px-3 py-2">Клики</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {expandedDetail.recipients.map((recipient) => (
                                        <tr key={recipient.id} className="border-t border-gold/10">
                                          <td className="px-3 py-2 text-white">{recipient.name}</td>
                                          <td className="px-3 py-2 text-muted">{recipient.email}</td>
                                          <td className="px-3 py-2">
                                            {recipient.deliveryStatus === 'sent' ? (
                                              <span className="text-emerald-300">отправлено</span>
                                            ) : recipient.deliveryStatus === 'failed' ? (
                                              <span className="text-red-300" title={recipient.deliveryError ?? undefined}>
                                                ошибка
                                              </span>
                                            ) : (
                                              <span className="text-muted">ожидание</span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-sky-300">
                                            {recipient.openCount > 0
                                              ? `${recipient.openCount} · ${formatDateTime(recipient.openedAt)}`
                                              : '—'}
                                          </td>
                                          <td className="px-3 py-2 text-amber-200">
                                            {recipient.clickCount > 0
                                              ? `${recipient.clickCount} · ${formatDateTime(recipient.clickedAt)}`
                                              : '—'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted">Не удалось загрузить детали рассылки.</p>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
