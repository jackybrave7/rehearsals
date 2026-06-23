import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ArrowLeft,
  CalendarDays,
  Film,
  RefreshCw,
  Shield,
  Users,
  HardDrive,
} from 'lucide-react';
import { AdminNav } from '../components/admin/AdminNav';
import { AdminErrorBanner, StatCard, formatBytes } from '../components/admin/adminUi';
import { fetchAdminUserDetail } from '../api/adminUsers';
import type { AdminUserDetail } from '../types/admin';
import { appPaths } from '../navigation/appPaths';
import { THEATER_ROLE_LABELS } from '../types/auth';

function authLabel(detail: AdminUserDetail): string {
  const methods: string[] = [];
  if (detail.authMethods.password) methods.push('пароль');
  if (detail.authMethods.google) methods.push('Google');
  return methods.length > 0 ? methods.join(' · ') : '—';
}

export function AdminUserDetailPage() {
  const { userId } = useParams();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchAdminUserDetail(userId));
    } catch (loadError) {
      setDetail(null);
      setError(loadError instanceof Error ? loadError.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!userId) {
    return <NavigateToUsers />;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <Link
          to={appPaths.adminUsers}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-gold"
        >
          <ArrowLeft size={16} />
          К списку пользователей
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gold-light">
              <Shield size={14} />
              Админка
            </div>
            <h1 className="text-3xl font-bold text-white">{detail?.name ?? 'Пользователь'}</h1>
            {detail ? (
              <p className="mt-1 text-muted">
                {detail.email} · зарегистрирован{' '}
                {format(parseISO(detail.createdAt), 'd MMMM yyyy', { locale: ru })} · вход: {authLabel(detail)}
                {detail.activeSessions > 0 ? ` · ${detail.activeSessions} активных сессий` : ''}
              </p>
            ) : (
              <p className="mt-1 text-muted">Загрузка профиля…</p>
            )}
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

      {loading && !detail ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-10 text-center text-muted">
          Загрузка статистики…
        </div>
      ) : null}

      {detail ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Театров" value={detail.theaterCount} sub={`${detail.ownedTheaterCount} владелец`} icon={Users} />
            <StatCard label="Постановок" value={detail.content.plays} icon={Film} />
            <StatCard label="Репетиций" value={detail.content.rehearsals} sub={`${detail.activity.rehearsalsUpcoming} впереди`} icon={CalendarDays} />
            <StatCard label="Участников" value={detail.content.actors} icon={Users} />
            <StatCard label="Сцен" value={detail.content.scenes} icon={Film} />
            <StatCard label="Задач" value={detail.content.tasks} sub={`${detail.activity.openTasks} открытых`} icon={CalendarDays} />
            <StatCard label="Площадок" value={detail.content.venues} icon={CalendarDays} />
            <StatCard
              label="Файлы"
              value={detail.filesCount}
              sub={formatBytes(detail.filesBytes)}
              icon={HardDrive}
            />
          </section>

          <section className="rounded-2xl border border-gold/10 bg-surface/60 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Театры пользователя</h2>
            {detail.theaters.length === 0 ? (
              <p className="text-sm text-muted">Нет доступа к театрам</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gold/10 text-muted">
                      <th className="px-3 py-2 font-medium">Театр</th>
                      <th className="px-3 py-2 font-medium">Роль</th>
                      <th className="px-3 py-2 font-medium">Постановки</th>
                      <th className="px-3 py-2 font-medium">Сцены</th>
                      <th className="px-3 py-2 font-medium">Репетиции</th>
                      <th className="px-3 py-2 font-medium">Участники</th>
                      <th className="px-3 py-2 font-medium">Задачи</th>
                      <th className="px-3 py-2 font-medium">Доступ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.theaters.map((theater) => (
                      <tr key={theater.id} className="border-b border-gold/5">
                        <td className="px-3 py-2 font-medium text-white">{theater.name}</td>
                        <td className="px-3 py-2 text-muted">
                          {THEATER_ROLE_LABELS[theater.role]}
                          {theater.isOwner && theater.role !== 'owner' ? ' · владелец' : ''}
                        </td>
                        <td className="px-3 py-2">{theater.plays}</td>
                        <td className="px-3 py-2">{theater.scenes}</td>
                        <td className="px-3 py-2">
                          {theater.rehearsals}
                          {theater.rehearsalsUpcoming > 0 ? (
                            <span className="text-xs text-muted"> ({theater.rehearsalsUpcoming} впереди)</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{theater.actors}</td>
                        <td className="px-3 py-2">{theater.tasks}</td>
                        <td className="px-3 py-2">{theater.members}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-xs text-muted">
            Обновлено {format(parseISO(detail.generatedAt), 'd MMM yyyy, HH:mm', { locale: ru })}
          </p>
        </>
      ) : null}
    </div>
  );
}

function NavigateToUsers() {
  return (
    <div className="text-muted">
      <Link to={appPaths.adminUsers} className="text-gold hover:underline">
        Вернуться к списку пользователей
      </Link>
    </div>
  );
}
