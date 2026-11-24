import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Eye, MousePointerClick, Info } from 'lucide-react';
import { Button } from '../Button';
import { Modal } from '../Modal';
import type { TrackedEmailOpenEvent } from '../../types/admin';
import { openEngagementLabel, shortenUserAgent } from './trackedEmailEngagementUtils';

export interface TrackedEmailEngagementItem {
  kind: 'broadcast' | 'drip';
  subject: string;
  stepTitle?: string;
  sentAt: string;
  deliveryStatus: 'sent' | 'failed' | 'pending';
  deliveryError: string | null;
  openCount: number;
  openedAt: string | null;
  lastOpenedAt: string | null;
  clickCount: number;
  clickedAt: string | null;
  opens: TrackedEmailOpenEvent[];
  clicks: Array<{ url: string; clickedAt: string; userAgent?: string | null }>;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'd MMM yyyy, HH:mm', { locale: ru });
  } catch {
    return iso;
  }
}

export function TrackedEmailEngagementBadges({
  item,
  onDetails,
}: {
  item: TrackedEmailEngagementItem;
  onDetails: () => void;
}) {
  const open = openEngagementLabel(item.openCount, item.lastOpenedAt ?? item.openedAt);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
          open.tone === 'none'
            ? 'bg-white/5 text-muted'
            : open.tone === 'recent'
              ? 'bg-sky-500/20 text-sky-200'
              : 'bg-sky-500/10 text-sky-300'
        }`}
      >
        <Eye size={12} />
        {open.text}
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
          item.clickCount > 0 ? 'bg-amber-500/15 text-amber-200' : 'bg-white/5 text-muted'
        }`}
      >
        <MousePointerClick size={12} />
        {item.clickCount > 0 ? `Клики · ${item.clickCount}` : 'Без кликов'}
      </span>
      <Button variant="ghost" className="!px-2 !py-0.5 text-xs" onClick={onDetails}>
        Подробнее
      </Button>
    </div>
  );
}

export function AdminTrackedEmailEngagementModal({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item: TrackedEmailEngagementItem | null;
}) {
  if (!item) return null;

  const openLabel = openEngagementLabel(item.openCount, item.lastOpenedAt ?? item.openedAt);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Статистика письма"
      wide
      footer={
        <Button variant="secondary" onClick={onClose}>
          Закрыть
        </Button>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-xl border border-gold/15 bg-surface/30 p-3">
          <p className="text-white">{item.subject}</p>
          {item.stepTitle ? <p className="text-xs text-muted">Шаг: {item.stepTitle}</p> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Тип" value={item.kind === 'drip' ? 'Цепочка' : 'Рассылка'} />
          <Stat
            label="Доставка"
            value={
              item.deliveryStatus === 'sent'
                ? 'Отправлено'
                : item.deliveryStatus === 'failed'
                  ? `Ошибка${item.deliveryError ? `: ${item.deliveryError}` : ''}`
                  : 'Ожидание'
            }
          />
          <Stat label="Отправлено" value={formatWhen(item.sentAt)} />
          <Stat label="Открытия" value={openLabel.text} />
          <Stat label="Первое открытие" value={formatWhen(item.openedAt)} />
          <Stat label="Последнее открытие" value={formatWhen(item.lastOpenedAt ?? item.openedAt)} />
          <Stat label="Клики" value={item.clickCount > 0 ? String(item.clickCount) : '—'} />
          <Stat label="Последний клик" value={formatWhen(item.clickedAt)} />
        </div>

        <p className="flex gap-2 rounded-lg border border-gold/10 bg-black/20 p-3 text-xs text-muted">
          <Info size={14} className="mt-0.5 shrink-0 text-gold/80" />
          Пиксель видит загрузку картинки в почтовом клиенте, а не «письмо открыто прямо сейчас».
          Надёжнее смотреть клики по ссылкам. Apple Mail и др. могут давать лишние открытия.
        </p>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            История открытий ({item.opens.length || item.openCount})
          </h3>
          {item.opens.length === 0 ? (
            <p className="text-muted">Нет зарегистрированных открытий.</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-gold/10 p-3">
              {item.opens.map((ev, index) => (
                <li key={`${ev.openedAt}-${index}`} className="text-xs">
                  <span className="text-sky-200">{formatWhen(ev.openedAt)}</span>
                  <span className="mt-0.5 block text-muted">{shortenUserAgent(ev.userAgent)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Клики по ссылкам ({item.clicks.length})
          </h3>
          {item.clicks.length === 0 ? (
            <p className="text-muted">Кликов не было.</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-gold/10 p-3">
              {item.clicks.map((click, index) => (
                <li key={`${click.clickedAt}-${index}`} className="text-xs">
                  <a
                    href={click.url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-amber-200 underline-offset-2 hover:underline"
                  >
                    {click.url}
                  </a>
                  <span className="mt-0.5 block text-muted">{formatWhen(click.clickedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gold/10 bg-surface/40 px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-white">{value}</p>
    </div>
  );
}