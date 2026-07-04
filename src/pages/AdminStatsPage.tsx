import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  BarChart3,
  CalendarDays,
  Database,
  Film,
  LifeBuoy,
  RefreshCw,
  Shield,
  Users,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import { fetchPlatformStats } from '../api/admin';
import { fetchAdminSupportTickets } from '../api/adminSupport';
import type { PlatformStats } from '../types/admin';
import { AdminNav } from '../components/admin/AdminNav';
import { AdminPlatformSettingsPanel } from '../components/admin/AdminPlatformSettingsPanel';
import { AdminErrorBanner, StatCard, formatBytes } from '../components/admin/adminUi';
import { appPaths } from '../navigation/appPaths';

function formatMonthLabel(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  if (!year || !mon) return month;
  return format(new Date(year, mon - 1, 1), 'LLL yyyy', { locale: ru });
}

export function AdminStatsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [openSupportTickets, setOpenSupportTickets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [platformStats, supportData] = await Promise.all([
        fetchPlatformStats(),
        fetchAdminSupportTickets({ limit: 1 }).catch(() => ({ tickets: [], openCount: 0 })),
      ]);
      setStats(platformStats);
      setOpenSupportTickets(supportData.openCount);
    } catch (loadError) {
      setStats(null);
      setOpenSupportTickets(0);
      setError(loadError instanceof Error ? loadError.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxSignup = Math.max(1, ...(stats?.signupsByMonth.map((entry) => entry.count) ?? [1]));

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gold-light">
              <Shield size={14} />
              Админка
            </div>
            <h1 className="text-3xl font-bold text-white">Статистика платформы</h1>
            <p className="mt-1 text-muted">
              Агрегированные данные по всем театрам и пользователям
              {stats ? ` · обновлено ${format(parseISO(stats.generatedAt), 'd MMM, HH:mm', { locale: ru })}` : ''}
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

      {stats && stats.pendingRegistrations > 0 ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          В режиме бета {stats.pendingRegistrations} пользователей подтвердили email и ждут вашего одобрения.{' '}
          <Link to={`${appPaths.adminUsers}?filter=pending`} className="font-medium text-gold-light hover:underline">
            Открыть список →
          </Link>
        </div>
      ) : null}

      {openSupportTickets > 0 ? (
        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 px-5 py-4 text-sm text-sky-100">
          <span className="inline-flex items-center gap-2">
            <LifeBuoy size={16} />
            {openSupportTickets} новых обращений в поддержку.
          </span>{' '}
          <Link to={appPaths.adminSupport} className="font-medium text-gold-light hover:underline">
            Открыть список →
          </Link>
        </div>
      ) : null}

      {stats ? (
        <AdminPlatformSettingsPanel
          initialMode={stats.registrationMode}
          pendingRegistrations={stats.pendingRegistrations}
        />
      ) : null}

      {loading && !stats ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-10 text-center text-muted">
          Загрузка статистики…
        </div>
      ) : null}

      {stats ? (
        <>
          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">Пользователи и сессии</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Пользователей" value={stats.users.total} sub={`+${stats.users.newLast30Days} за 30 дн.`} icon={Users} />
              <StatCard label="Активных сессий" value={stats.sessions.active} sub={`${stats.sessions.activeUsers} пользователей`} icon={UserPlus} />
              <StatCard label="Вход по паролю" value={stats.users.withPassword} icon={Users} />
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">Контент и активность</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Театров" value={stats.theaters.total} icon={BarChart3} />
              <StatCard label="Постановок" value={stats.content.plays} icon={Film} />
              <StatCard label="Сцен" value={stats.content.scenes} icon={Film} />
              <StatCard label="Участников" value={stats.content.actors} icon={Users} />
              <StatCard
                label="Репетиций"
                value={stats.content.rehearsals}
                sub={`${stats.activity.rehearsalsUpcoming} впереди`}
                icon={CalendarDays}
              />
              <StatCard
                label="Репетиций за 30 дн."
                value={stats.activity.rehearsalsLast30Days}
                sub={`${stats.activity.rehearsalsPast} в прошлом`}
                icon={CalendarDays}
              />
              <StatCard
                label="Задач"
                value={stats.content.tasks}
                sub={`${stats.activity.openTasks} открытых`}
                icon={BarChart3}
              />
              <StatCard label="Блоков в планах" value={stats.content.scheduleBlocks} icon={CalendarDays} />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gold/10 bg-surface/60 p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">Регистрации по месяцам</h2>
              {stats.signupsByMonth.length === 0 ? (
                <p className="text-sm text-muted">Пока нет данных</p>
              ) : (
                <div className="space-y-3">
                  {stats.signupsByMonth.map((entry) => (
                    <div key={entry.month}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-muted">{formatMonthLabel(entry.month)}</span>
                        <span className="font-medium text-white">{entry.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-gold/70"
                          style={{ width: `${Math.max(8, (entry.count / maxSignup) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gold/10 bg-surface/60 p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">Хранилище и интеграции</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted">База SQLite</dt>
                  <dd className="font-medium text-white">{formatBytes(stats.storage.dbSizeBytes)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted">Загруженные файлы</dt>
                  <dd className="font-medium text-white">
                    {stats.storage.fileCount} · {formatBytes(stats.storage.totalBytes)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted">Резервные копии</dt>
                  <dd className="font-medium text-white">{stats.storage.backupCount}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted">Google Docs в постановках</dt>
                  <dd className="font-medium text-white">{stats.integrations.playsWithGoogleDocs}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted">Telegram у участников</dt>
                  <dd className="font-medium text-white">{stats.integrations.actorsWithTelegram}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted">Роли в театрах</dt>
                  <dd className="font-medium text-white">
                    {stats.theaters.membersByRole.owner} влад. · {stats.theaters.membersByRole.editor} ред. ·{' '}
                    {stats.theaters.membersByRole.observer} набл.
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="rounded-2xl border border-gold/10 bg-surface/60 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Database size={18} className="text-gold/70" />
              <h2 className="text-lg font-semibold text-white">Театры</h2>
            </div>
            {stats.theatersOverview.length === 0 ? (
              <p className="text-sm text-muted">Театров пока нет</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gold/10 text-muted">
                      <th className="px-3 py-2 font-medium">Название</th>
                      <th className="px-3 py-2 font-medium">Постановки</th>
                      <th className="px-3 py-2 font-medium">Репетиции</th>
                      <th className="px-3 py-2 font-medium">Участники</th>
                      <th className="px-3 py-2 font-medium">Доступ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.theatersOverview.map((theater) => (
                      <tr key={theater.id} className="border-b border-gold/5 text-foreground/90">
                        <td className="px-3 py-2 font-medium text-white">{theater.name}</td>
                        <td className="px-3 py-2">{theater.plays}</td>
                        <td className="px-3 py-2">{theater.rehearsals}</td>
                        <td className="px-3 py-2">{theater.actors}</td>
                        <td className="px-3 py-2">{theater.members}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gold/10 bg-surface/60 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Недавние регистрации</h2>
              <Link
                to={appPaths.adminUsers}
                className="inline-flex items-center gap-1 text-sm text-gold hover:underline"
              >
                Все пользователи
                <ArrowRight size={14} />
              </Link>
            </div>
            {stats.recentUsers.length === 0 ? (
              <p className="text-sm text-muted">Пользователей пока нет</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gold/10 text-muted">
                      <th className="px-3 py-2 font-medium">Имя</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Дата</th>
                      <th className="px-3 py-2 font-medium">Театров</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentUsers.map((entry) => (
                      <tr key={entry.id} className="border-b border-gold/5">
                        <td className="px-3 py-2 text-white">{entry.name}</td>
                        <td className="px-3 py-2 text-muted">{entry.email}</td>
                        <td className="px-3 py-2 text-muted">
                          {format(parseISO(entry.createdAt), 'd MMM yyyy', { locale: ru })}
                        </td>
                        <td className="px-3 py-2">{entry.theaterCount}</td>
                        <td className="px-3 py-2">
                          <Link to={appPaths.adminUser(entry.id)} className="text-gold hover:underline">
                            Статистика
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
