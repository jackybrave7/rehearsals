import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ArrowLeft,
  CalendarDays,
  Film,
  RefreshCw,
  Shield,
  Trash2,
  Users,
  HardDrive,
} from 'lucide-react';
import { AdminNav } from '../components/admin/AdminNav';
import { AdminErrorBanner, StatCard, formatBytes } from '../components/admin/adminUi';
import { deleteAdminUser, fetchAdminUserDetail, updateAdminUserSubscription, approveAdminUserRegistration, resendAdminUserVerification, verifyAdminUserEmail } from '../api/adminUsers';
import type { AdminUserDetail } from '../types/admin';
import { appPaths } from '../navigation/appPaths';
import { THEATER_ROLE_LABELS } from '../types/auth';
import { formatAdminSubscriptionLabel } from '../utils/subscription';
import { useAuth } from '../store/AuthContext';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import { Button } from '../components/Button';

function authLabel(detail: AdminUserDetail): string {
  const methods: string[] = [];
  if (detail.authMethods.password) methods.push('пароль');
  return methods.length > 0 ? methods.join(' · ') : '—';
}

export function AdminUserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, refreshSession } = useAuth();
  const { confirmDelete } = useConfirmDialog();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planNotice, setPlanNotice] = useState<string | null>(null);
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null);
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [planChoice, setPlanChoice] = useState<'free' | 'pro'>('free');
  const [proDuration, setProDuration] = useState<'unlimited' | '1m' | '3m' | '12m' | 'custom'>(
    'unlimited'
  );
  const [proCustomDate, setProCustomDate] = useState('');
  const isSelf = Boolean(userId && currentUser?.id === userId);

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

  useEffect(() => {
    if (!detail) return;
    setPlanChoice(detail.subscriptionPlanStored === 'pro' ? 'pro' : 'free');
    if (detail.subscriptionProExpiresAt) {
      setProDuration('custom');
      setProCustomDate(detail.subscriptionProExpiresAt.slice(0, 10));
    } else if (detail.subscriptionPlanStored === 'pro') {
      setProDuration('unlimited');
      setProCustomDate('');
    } else {
      setProDuration('unlimited');
      setProCustomDate('');
    }
  }, [detail]);

  const handleApplyPlan = async () => {
    if (!detail || !userId || planSaving) return;
    if (planChoice === 'pro' && proDuration === 'custom' && !proCustomDate.trim()) {
      setError('Укажите дату окончания Pro');
      return;
    }
    setPlanSaving(true);
    setError(null);
    setPlanNotice(null);
    try {
      const result = await updateAdminUserSubscription(userId, {
        plan: planChoice,
        ...(planChoice === 'pro'
          ? {
              proDuration,
              ...(proDuration === 'custom' ? { proExpiresAt: proCustomDate } : {}),
            }
          : {}),
      });
      if (isSelf) {
        await refreshSession();
      }
      await load();
      if (planChoice === 'pro' && result.mailSent === true) {
        setPlanNotice('Тариф Pro подключён, пользователю отправлено письмо.');
      } else if (planChoice === 'pro' && result.mailSent === false) {
        setPlanNotice(
          'Тариф Pro подключён, но письмо не отправлено. Проверьте SMTP на сервере.'
        );
      } else if (planChoice === 'pro') {
        setPlanNotice('Тариф Pro сохранён.');
      } else {
        setPlanNotice('Тариф Free сохранён.');
      }
    } catch {
      setError('Не удалось обновить тариф');
    } finally {
      setPlanSaving(false);
    }
  };

  const handleApproveRegistration = async () => {
    if (!detail || !userId || approvalSaving) return;
    setApprovalSaving(true);
    setApprovalNotice(null);
    setError(null);
    try {
      const result = await approveAdminUserRegistration(userId);
      await load();
      if (result.alreadyApproved) {
        setApprovalNotice('Регистрация уже была одобрена ранее.');
      } else if (result.mailSent === true) {
        setApprovalNotice('Доступ открыт, пользователю отправлено письмо.');
      } else if (result.mailSent === false) {
        setApprovalNotice(
          'Доступ открыт, но письмо не отправлено. Добавьте SMTP_* в /var/www/rehearsals/.env на сервере и выполните: docker restart rehearsals-api'
        );
      }
    } catch (approveError) {
      const code = approveError instanceof Error ? approveError.message : '';
      if (code === 'EMAIL_NOT_VERIFIED') {
        setError('Сначала пользователь должен подтвердить email.');
      } else {
        setError('Не удалось одобрить регистрацию');
      }
    } finally {
      setApprovalSaving(false);
    }
  };

  const handleResendVerification = async () => {
    if (!detail || !userId || verificationSaving) return;
    setVerificationSaving(true);
    setVerificationNotice(null);
    setVerifyUrl(null);
    setError(null);
    try {
      const result = await resendAdminUserVerification(userId);
      if (result.alreadyVerified) {
        setVerificationNotice('Email уже подтверждён.');
        await load();
        return;
      }
      setVerifyUrl(result.verifyUrl);
      if (result.mailSent) {
        setVerificationNotice(
          'Письмо отправлено повторно. Если на mail.ru не приходит — проверьте «Спам» или передайте ссылку вручную.'
        );
      } else {
        setVerificationNotice('Письмо не ушло. Скопируйте ссылку ниже и передайте пользователю вручную.');
      }
    } catch {
      setError('Не удалось отправить письмо повторно');
    } finally {
      setVerificationSaving(false);
    }
  };

  const handleVerifyEmailManually = async () => {
    if (!detail || !userId || verificationSaving) return;
    setVerificationSaving(true);
    setVerificationNotice(null);
    setError(null);
    try {
      const result = await verifyAdminUserEmail(userId);
      setVerifyUrl(null);
      if (result.alreadyVerified) {
        setVerificationNotice('Email уже был подтверждён.');
      } else {
        setVerificationNotice('Email подтверждён вручную. Теперь можно одобрить регистрацию.');
      }
      await load();
    } catch {
      setError('Не удалось подтвердить email');
    } finally {
      setVerificationSaving(false);
    }
  };

  const handleCopyVerifyUrl = async () => {
    if (!verifyUrl) return;
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setVerificationNotice('Ссылка скопирована в буфер обмена.');
    } catch {
      setVerificationNotice('Не удалось скопировать ссылку — выделите её вручную.');
    }
  };

  const handleDeleteUser = async () => {
    if (!detail || !userId || isSelf || deleting) return;

    const ownedCount = detail.ownedTheaterCount;
    const memberOnlyCount = detail.theaterCount - ownedCount;
    const parts = [
      'Аккаунт, сессии и настройки будут удалены без возможности восстановления.',
      ownedCount > 0
        ? `${ownedCount} театр(ов) во владении и весь их контент (постановки, репетиции, участники).`
        : null,
      memberOnlyCount > 0
        ? `Доступ к ${memberOnlyCount} театр(ам), где пользователь не владелец, будет отозван — сами театры останутся.`
        : null,
      detail.filesCount > 0 ? `${detail.filesCount} загруженных файлов.` : null,
    ].filter(Boolean);

    const confirmed = await confirmDelete({
      title: `Удалить пользователя «${detail.name}»?`,
      message: parts.join(' '),
      confirmLabel: 'Удалить пользователя',
    });
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAdminUser(userId);
      navigate(appPaths.adminUsers, { replace: true });
    } catch (deleteUserError) {
      const code = deleteUserError instanceof Error ? deleteUserError.message : 'DELETE_USER_FAILED';
      if (code === 'CANNOT_DELETE_SELF') {
        setDeleteError('Нельзя удалить свой аккаунт из админки');
      } else if (code === 'NOT_FOUND') {
        setDeleteError('Пользователь уже удалён');
      } else {
        setDeleteError('Не удалось удалить пользователя');
      }
    } finally {
      setDeleting(false);
    }
  };

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
      <AdminErrorBanner error={deleteError} />

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
            <h2 className="mb-2 text-lg font-semibold text-white">Email</h2>
            <p className="mb-4 text-sm text-muted">
              Статус:{' '}
              <strong className={detail.emailVerified ? 'text-emerald-300' : 'text-amber-200'}>
                {detail.emailVerified ? 'подтверждён' : 'не подтверждён'}
              </strong>
              {detail.emailVerifiedAt ? (
                <span>
                  {' '}
                  · {format(parseISO(detail.emailVerifiedAt), 'd MMM yyyy, HH:mm', { locale: ru })}
                </span>
              ) : null}
            </p>
            {!detail.emailVerified ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={verificationSaving}
                  onClick={() => void handleResendVerification()}
                >
                  {verificationSaving ? 'Отправка…' : 'Отправить письмо повторно'}
                </Button>
                <Button disabled={verificationSaving} onClick={() => void handleVerifyEmailManually()}>
                  Подтвердить вручную
                </Button>
              </div>
            ) : null}
            {verificationNotice ? <p className="mt-3 text-sm text-emerald-300">{verificationNotice}</p> : null}
            {verifyUrl ? (
              <div className="mt-3 rounded-xl border border-gold/15 bg-surface/80 p-3">
                <p className="mb-2 text-xs text-muted">
                  Ссылка для подтверждения (передайте пользователю, если письмо не пришло):
                </p>
                <p className="break-all text-sm text-gold-light">{verifyUrl}</p>
                <Button variant="secondary" className="mt-3" onClick={() => void handleCopyVerifyUrl()}>
                  Скопировать ссылку
                </Button>
              </div>
            ) : null}
          </section>

          {detail.registrationStatus !== 'approved' ? (
            <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <h2 className="mb-2 text-lg font-semibold text-white">Регистрация</h2>
              <p className="mb-4 text-sm text-muted">
                {detail.registrationStatus === 'pending_email'
                  ? 'Сначала подтвердите email в блоке выше.'
                  : 'Email подтверждён. Можно открыть доступ к сервису.'}
              </p>
              <Button
                disabled={
                  approvalSaving ||
                  detail.registrationStatus !== 'pending_approval'
                }
                onClick={() => void handleApproveRegistration()}
              >
                {approvalSaving ? 'Сохранение…' : 'Одобрить регистрацию'}
              </Button>
              {approvalNotice ? <p className="mt-3 text-sm text-emerald-300">{approvalNotice}</p> : null}
            </section>
          ) : null}

          <section className="rounded-2xl border border-gold/10 bg-surface/60 p-5">
            <h2 className="mb-2 text-lg font-semibold text-white">Тариф</h2>
            <p className="mb-4 text-sm text-muted">
              Сейчас:{' '}
              <strong className="text-white">
                {formatAdminSubscriptionLabel(detail.subscriptionPlan, {
                  storedPlan: detail.subscriptionPlanStored,
                  expiresAt: detail.subscriptionProExpiresAt,
                })}
              </strong>
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                variant={planChoice === 'free' ? 'primary' : 'secondary'}
                disabled={planSaving}
                onClick={() => setPlanChoice('free')}
              >
                Free
              </Button>
              <Button
                variant={planChoice === 'pro' ? 'primary' : 'secondary'}
                disabled={planSaving}
                onClick={() => setPlanChoice('pro')}
              >
                Pro
              </Button>
            </div>
            {planChoice === 'pro' ? (
              <div className="space-y-3 rounded-xl border border-gold/10 bg-black/10 p-4">
                <p className="text-sm text-muted">Срок действия Pro</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['unlimited', 'Без срока'],
                      ['1m', '1 мес'],
                      ['3m', '3 мес'],
                      ['12m', '12 мес'],
                      ['custom', 'До даты'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={planSaving}
                      onClick={() => setProDuration(value)}
                      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        proDuration === value
                          ? 'bg-gold/20 text-gold-light'
                          : 'bg-white/5 text-muted hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {proDuration === 'custom' ? (
                  <input
                    type="date"
                    value={proCustomDate}
                    onChange={(event) => setProCustomDate(event.target.value)}
                    disabled={planSaving}
                    className="rounded-xl border border-gold/15 bg-surface/60 px-3 py-2 text-sm text-white"
                  />
                ) : null}
              </div>
            ) : null}
            <Button className="mt-4" disabled={planSaving} onClick={() => void handleApplyPlan()}>
              {planSaving ? 'Сохранение…' : 'Сохранить тариф'}
            </Button>
            {planNotice && <p className="mt-3 text-sm text-emerald-300">{planNotice}</p>}
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

          <section className="rounded-2xl border border-red-500/20 bg-red-950/10 p-5">
            <h2 className="text-lg font-semibold text-red-200">Опасная зона</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Полное удаление аккаунта и всех связанных данных. Действие необратимо.
            </p>
            {isSelf ? (
              <p className="mt-3 text-sm text-amber-200">
                Нельзя удалить свой аккаунт из админки — используйте другой администраторский вход.
              </p>
            ) : (
              <Button
                variant="danger"
                className="mt-4"
                disabled={deleting}
                onClick={() => void handleDeleteUser()}
              >
                <Trash2 size={16} />
                {deleting ? 'Удаление…' : 'Удалить пользователя'}
              </Button>
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
