import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ArrowRight, RefreshCw, Search, Shield } from 'lucide-react';
import { AdminNav } from '../components/admin/AdminNav';
import { AdminErrorBanner } from '../components/admin/adminUi';
import { fetchAdminUsers } from '../api/adminUsers';
import type { AdminUserSummary } from '../types/admin';
import { appPaths } from '../navigation/appPaths';
import { THEATER_ROLE_LABELS } from '../types/auth';
import { formatAdminSubscriptionLabel } from '../utils/subscription';
import { verifyAdminUserEmail, approveAdminUserRegistration } from '../api/adminUsers';

function authLabel(user: AdminUserSummary): string {
  const methods: string[] = [];
  if (user.authMethods.password) methods.push('пароль');
  return methods.length > 0 ? methods.join(' · ') : '—';
}

function registrationStatusLabel(status: AdminUserSummary['registrationStatus']): string {
  if (status === 'pending_email') return 'Email не подтверждён';
  if (status === 'pending_approval') return 'Ждёт одобрения';
  return 'Доступ открыт';
}

function registrationStatusClass(status: AdminUserSummary['registrationStatus']): string {
  if (status === 'pending_email') return 'bg-amber-500/15 text-amber-200';
  if (status === 'pending_approval') return 'bg-orange-500/15 text-orange-200';
  return 'bg-emerald-500/15 text-emerald-200';
}

function emailVerifiedLabel(verified: boolean): string {
  return verified ? 'Подтверждён' : 'Не подтверждён';
}

function emailVerifiedClass(verified: boolean): string {
  return verified ? 'bg-emerald-500/15 text-emerald-200' : 'bg-red-500/15 text-red-200';
}

export function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('filter') === 'pending' ? 'pending' : 'all';
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await fetchAdminUsers());
    } catch (loadError) {
      setUsers([]);
      setError(loadError instanceof Error ? loadError.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(
    () => users.filter((user) => user.registrationStatus === 'pending_approval').length,
    [users]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let result = users;
    if (statusFilter === 'pending') {
      result = result.filter(
        (user) =>
          user.registrationStatus === 'pending_approval' ||
          user.registrationStatus === 'pending_email'
      );
    }
    if (!needle) return result;
    return result.filter(
      (user) =>
        user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle)
    );
  }, [query, statusFilter, users]);

  const handleVerifyEmail = async (user: AdminUserSummary) => {
    if (user.emailVerified || verifyingUserId) return;
    setVerifyingUserId(user.id);
    setError(null);
    try {
      await verifyAdminUserEmail(user.id);
      await load();
    } catch {
      setError('Не удалось подтвердить email');
    } finally {
      setVerifyingUserId(null);
    }
  };

  const handleApproveRegistration = async (user: AdminUserSummary) => {
    if (user.registrationStatus !== 'pending_approval' || approvingUserId) return;
    setApprovingUserId(user.id);
    setError(null);
    try {
      await approveAdminUserRegistration(user.id);
      await load();
    } catch (approveError) {
      const code = approveError instanceof Error ? approveError.message : '';
      if (code === 'EMAIL_NOT_VERIFIED') {
        setError('Сначала подтвердите email пользователя');
      } else {
        setError('Не удалось одобрить регистрацию');
      }
    } finally {
      setApprovingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gold-light">
              <Shield size={14} />
              Админка
            </div>
            <h1 className="text-3xl font-bold text-white">Пользователи</h1>
            <p className="mt-1 text-muted">
              {users.length} аккаунтов · статистика по доступным театрам
              {pendingCount > 0 ? (
                <span className="text-amber-200"> · {pendingCount} ждут одобрения</span>
              ) : null}
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

      {pendingCount > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">
          <span className="text-amber-100">
            {pendingCount} заявок ждут одобрения (режим бета)
          </span>
          <button
            type="button"
            onClick={() =>
              setSearchParams(statusFilter === 'pending' ? {} : { filter: 'pending' })
            }
            className="text-gold-light hover:underline"
          >
            {statusFilter === 'pending' ? 'Показать всех' : 'Только ожидающие →'}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSearchParams({})}
          className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
            statusFilter === 'all'
              ? 'bg-gold/15 text-gold-light'
              : 'text-muted hover:bg-white/5 hover:text-white'
          }`}
        >
          Все ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setSearchParams({ filter: 'pending' })}
          className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
            statusFilter === 'pending'
              ? 'bg-amber-500/15 text-amber-200'
              : 'text-muted hover:bg-white/5 hover:text-white'
          }`}
        >
          Ждут одобрения ({pendingCount})
        </button>
      </div>

      <AdminErrorBanner error={error} />

      <div className="relative max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по имени или email"
          className="w-full rounded-xl border border-gold/15 bg-surface/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-muted focus:border-gold/35 focus:outline-none"
        />
      </div>

      {loading && users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-10 text-center text-muted">
          Загрузка пользователей…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-10 text-center text-muted">
          {query ? 'Никого не найдено' : 'Пользователей пока нет'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gold/10 bg-surface/60">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gold/10 text-muted">
                <th className="px-4 py-3 font-medium">Пользователь</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Регистрация</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Вход</th>
                <th className="px-4 py-3 font-medium">Тариф</th>
                <th className="px-4 py-3 font-medium">Театры</th>
                <th className="px-4 py-3 font-medium">Контент</th>
                <th className="px-4 py-3 font-medium">Активность</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="border-b border-gold/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{user.name}</p>
                    <p className="text-muted">{user.email}</p>
                    {user.activeSessions > 0 ? (
                      <p className="mt-1 text-xs text-emerald-300/90">
                        онлайн · {user.activeSessions} сесс.
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${emailVerifiedClass(user.emailVerified)}`}
                      >
                        {emailVerifiedLabel(user.emailVerified)}
                      </span>
                      {!user.emailVerified ? (
                        <button
                          type="button"
                          disabled={verifyingUserId === user.id}
                          onClick={() => void handleVerifyEmail(user)}
                          className="text-xs text-gold hover:underline disabled:opacity-60"
                        >
                          {verifyingUserId === user.id ? 'Подтверждение…' : 'Подтвердить'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {format(parseISO(user.createdAt), 'd MMM yyyy', { locale: ru })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${registrationStatusClass(user.registrationStatus)}`}
                      >
                        {registrationStatusLabel(user.registrationStatus)}
                      </span>
                      {user.registrationStatus === 'pending_approval' ? (
                        <button
                          type="button"
                          disabled={approvingUserId === user.id}
                          onClick={() => void handleApproveRegistration(user)}
                          className="text-xs font-medium text-gold hover:underline disabled:opacity-60"
                        >
                          {approvingUserId === user.id ? 'Одобрение…' : 'Одобрить'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{authLabel(user)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.subscriptionPlan === 'pro'
                          ? 'bg-accent/15 text-accent'
                          : 'bg-white/5 text-muted'
                      }`}
                    >
                      {formatAdminSubscriptionLabel(user.subscriptionPlan, {
                        storedPlan: user.subscriptionPlanStored,
                        expiresAt: user.subscriptionProExpiresAt,
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p>{user.theaterCount}</p>
                    {user.ownedTheaterCount > 0 ? (
                      <p className="text-xs text-muted">{user.ownedTheaterCount} владелец</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {user.content.plays} пост. · {user.content.rehearsals} реп. · {user.content.actors} уч.
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {user.activity.rehearsalsUpcoming} впереди · {user.activity.openTasks} задач
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={appPaths.adminUser(user.id)}
                      className="inline-flex items-center gap-1 text-gold hover:underline"
                    >
                      Подробнее
                      <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {users.some((user) => user.filesCount > 0) ? (
        <p className="text-xs text-muted">
          Файлы считаются по владельцу загрузки. Контент театра — по доступу пользователя (
          {THEATER_ROLE_LABELS.owner}, {THEATER_ROLE_LABELS.editor}, {THEATER_ROLE_LABELS.observer}).
        </p>
      ) : null}
    </div>
  );
}
