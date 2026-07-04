import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronDown, ChevronUp, LifeBuoy, RefreshCw, Shield } from 'lucide-react';
import { fetchAdminSupportTickets, updateAdminSupportTicketStatus } from '../api/adminSupport';
import { AdminNav } from '../components/admin/AdminNav';
import { AdminErrorBanner } from '../components/admin/adminUi';
import { Select } from '../components/FormFields';
import {
  SUPPORT_TICKET_STATUS_LABELS,
  getSupportCategoryLabel,
  type SupportTicket,
  type SupportTicketStatus,
} from '../types/support';
import { appPaths } from '../navigation/appPaths';

const statusFilterOptions = [
  { value: 'all', label: 'Все статусы' },
  { value: 'open', label: 'Новые' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'closed', label: 'Закрытые' },
];

const statusUpdateOptions = (
  Object.entries(SUPPORT_TICKET_STATUS_LABELS) as Array<[SupportTicketStatus, string]>
).map(([value, label]) => ({ value, label }));

function statusBadgeClass(status: SupportTicketStatus): string {
  if (status === 'open') return 'bg-amber-500/15 text-amber-200';
  if (status === 'in_progress') return 'bg-sky-500/15 text-sky-200';
  return 'bg-emerald-500/15 text-emerald-200';
}

function TicketRow({
  ticket,
  expanded,
  onToggle,
  onStatusChange,
  updating,
}: {
  ticket: SupportTicket;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (status: SupportTicketStatus) => void;
  updating: boolean;
}) {
  const subjectPreview = ticket.subject?.trim() || ticket.message.slice(0, 80);

  return (
    <>
      <tr className="border-b border-gold/5 hover:bg-surface/30">
        <td className="px-3 py-3 font-mono text-sm text-gold-light">{ticket.ticketNumber}</td>
        <td className="px-3 py-3 text-muted">
          {format(parseISO(ticket.createdAt), 'd MMM yyyy, HH:mm', { locale: ru })}
        </td>
        <td className="px-3 py-3">
          <div className="text-white">{ticket.userName}</div>
          <div className="text-xs text-muted">{ticket.userEmail}</div>
        </td>
        <td className="px-3 py-3 text-muted">{getSupportCategoryLabel(ticket.category)}</td>
        <td className="max-w-[12rem] truncate px-3 py-3 text-muted" title={subjectPreview}>
          {subjectPreview}
        </td>
        <td className="px-3 py-3">
          <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(ticket.status)}`}>
            {SUPPORT_TICKET_STATUS_LABELS[ticket.status]}
          </span>
        </td>
        <td className="px-3 py-3">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1 text-sm text-gold-light hover:underline"
          >
            {expanded ? (
              <>
                Скрыть <ChevronUp size={14} />
              </>
            ) : (
              <>
                Открыть <ChevronDown size={14} />
              </>
            )}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-gold/10 bg-surface/20">
          <td colSpan={7} className="px-3 py-4">
            <div className="space-y-4">
              {ticket.subject ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Тема</p>
                  <p className="mt-1 text-white">{ticket.subject}</p>
                </div>
              ) : null}
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Сообщение</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                  {ticket.message}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <Select
                  label="Статус"
                  value={ticket.status}
                  onChange={(event) => onStatusChange(event.target.value as SupportTicketStatus)}
                  options={statusUpdateOptions}
                  disabled={updating}
                  className="max-w-xs"
                />
                <Link
                  to={appPaths.adminUser(ticket.userId)}
                  className="text-sm text-gold-light hover:underline"
                >
                  Профиль пользователя →
                </Link>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | SupportTicketStatus>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminSupportTickets({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 200,
      });
      setTickets(result.tickets);
      setOpenCount(result.openCount);
    } catch (loadError) {
      setTickets([]);
      setOpenCount(0);
      setError(loadError instanceof Error ? loadError.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredCount = useMemo(() => tickets.length, [tickets]);

  const handleStatusChange = async (ticketId: string, status: SupportTicketStatus) => {
    setUpdatingId(ticketId);
    setError(null);
    try {
      const updated = await updateAdminSupportTicketStatus(ticketId, status);
      setTickets((prev) => prev.map((entry) => (entry.id === ticketId ? updated : entry)));
      if (statusFilter !== 'all' && updated.status !== statusFilter) {
        setTickets((prev) => prev.filter((entry) => entry.id !== ticketId));
      }
      const result = await fetchAdminSupportTickets({ limit: 1 });
      setOpenCount(result.openCount);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Не удалось обновить статус');
    } finally {
      setUpdatingId(null);
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
            <h1 className="text-3xl font-bold text-white">Обращения в поддержку</h1>
            <p className="mt-1 text-muted">
              {openCount > 0
                ? `${openCount} новых обращений ждут обработки`
                : 'Новых обращений нет'}
              {filteredCount > 0 ? ` · показано ${filteredCount}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-gold/20 bg-surface/80 px-4 py-2 text-sm text-gold-light transition-colors hover:border-gold/35 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Обновить
          </button>
        </div>
        <AdminNav />
      </header>

      <AdminErrorBanner error={error} />

      <div className="flex flex-wrap items-end gap-4">
        <Select
          label="Фильтр по статусу"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'all' | SupportTicketStatus)}
          options={statusFilterOptions}
          className="max-w-xs"
        />
      </div>

      {loading && tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-10 text-center text-muted">
          Загрузка обращений…
        </div>
      ) : null}

      {!loading && tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-10 text-center">
          <LifeBuoy className="mx-auto mb-3 text-muted" size={32} />
          <p className="text-muted">Обращений пока нет</p>
        </div>
      ) : null}

      {tickets.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-gold/10 bg-surface/30">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gold/10 text-muted">
                <th className="px-3 py-2 font-medium">Номер</th>
                <th className="px-3 py-2 font-medium">Дата</th>
                <th className="px-3 py-2 font-medium">Пользователь</th>
                <th className="px-3 py-2 font-medium">Категория</th>
                <th className="px-3 py-2 font-medium">Тема / превью</th>
                <th className="px-3 py-2 font-medium">Статус</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  expanded={expandedId === ticket.id}
                  onToggle={() => setExpandedId((prev) => (prev === ticket.id ? null : ticket.id))}
                  onStatusChange={(status) => void handleStatusChange(ticket.id, status)}
                  updating={updatingId === ticket.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
