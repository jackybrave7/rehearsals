import { Check, Palette, Sparkles, Drama, AlertTriangle, LogOut, Clock, Bell, BarChart3, Send, Building2, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useDesign, type AppDesign } from '../store/DesignContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useAuth } from '../store/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { SUBSCRIPTION_PLAN_LABELS } from '../utils/subscription';
import { supportMailto } from '../content/pricing';
import { getShowRehearsalWarnings, getActiveTheater } from '../store/selectors';
import { TheaterMembersPanel } from '../components/TheaterMembersPanel';
import { GuideContextHelp } from '../components/guide/GuideContextHelp';
import { Input, Select } from '../components/FormFields';
import { Button } from '../components/Button';
import {
  fetchTelegramStatus,
  sendTelegramTestMessage,
  type TelegramStatus,
} from '../api/telegram';
import {
  DEFAULT_THEATER_REMINDER_SETTINGS,
  REMINDER_TYPE_LABELS,
  REMINDER_TYPES,
  resolveTheaterReminderSettings,
  type ReminderType,
} from '../utils/reminders';
import {
  DEFAULT_SCENE_TIMING_SETTINGS,
  resolveSceneTimingSettings,
} from '../utils/sceneTiming';
import { appPaths } from '../navigation/appPaths';
import { pageTitleClass } from '../utils/pageLayout';
import {
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
  resolveTheaterTimezone,
} from '../utils/timezone';

const options: Array<{
  id: AppDesign;
  title: string;
  description: string;
  preview: string;
}> = [
  {
    id: 'theater',
    title: 'Театр-театр',
    description: 'Классический тёмный интерфейс с боковым меню и полным обзором данных.',
    preview: 'Тёмный · золото · sidebar',
  },
  {
    id: 'zen',
    title: 'Дзен',
    description:
      'Светлый минимализм: в центре только актуальное, остальное — в контекстном меню. Плавные анимации.',
    preview: 'Светлый · воздух · фокус',
  },
];

type SettingsTab = 'general' | 'theater';

export function SettingsPage() {
  const { design, setDesign } = useDesign();
  const { state, dispatch, readOnly } = useRehearsalStore();
  const { user, logout, isPlatformAdmin, updateProfile } = useAuth();
  const { plan, isPro } = useSubscription();
  const showRehearsalWarnings = getShowRehearsalWarnings(state);
  const sceneTiming = resolveSceneTimingSettings(state.appMeta);
  const activeTheater = getActiveTheater(state);
  const theaterReminders = resolveTheaterReminderSettings(activeTheater ?? {}, state.appMeta);
  const theaterTimezone = resolveTheaterTimezone(activeTheater);
  const [tab, setTab] = useState<SettingsTab>('general');
  const [adminRevealOpen, setAdminRevealOpen] = useState(false);
  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [telegramChatInput, setTelegramChatInput] = useState('');
  const [telegramTestPending, setTelegramTestPending] = useState(false);
  const [telegramTestMessage, setTelegramTestMessage] = useState<string | null>(null);

  useEffect(() => {
    setProfileName(user?.name ?? '');
  }, [user?.name]);

  useEffect(() => {
    if (!state.activeTheaterId) {
      setTelegramStatus(null);
      return;
    }
    void fetchTelegramStatus(state.activeTheaterId).then(setTelegramStatus);
  }, [state.activeTheaterId, activeTheater?.telegramChatId]);

  useEffect(() => {
    setTelegramChatInput(activeTheater?.telegramChatId ?? '');
  }, [activeTheater?.id, activeTheater?.telegramChatId]);

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMessage(null);
    setProfileError(null);
    try {
      const payload: { name?: string; currentPassword?: string; newPassword?: string } = {};
      const trimmedName = profileName.trim();
      if (trimmedName && trimmedName !== user?.name) {
        payload.name = trimmedName;
      }
      if (newPassword) {
        payload.newPassword = newPassword;
        if (user?.hasPassword) {
          payload.currentPassword = currentPassword;
        }
      }
      if (!payload.name && !payload.newPassword) {
        setProfileError('Нет изменений для сохранения');
        return;
      }
      await updateProfile(payload);
      setCurrentPassword('');
      setNewPassword('');
      setProfileMessage('Профиль обновлён');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Не удалось сохранить');
    } finally {
      setProfileSaving(false);
    }
  };

  const updateTheaterReminders = (patch: Partial<typeof theaterReminders>) => {
    if (!activeTheater || readOnly) return;
    if (!isPro && patch.enabled) return;
    dispatch({
      type: 'UPDATE_THEATER',
      payload: {
        ...activeTheater,
        reminderSettings: {
          ...theaterReminders,
          ...patch,
        },
      },
    });
  };

  const toggleReminderType = (type: ReminderType) => {
    const isOn = theaterReminders.types.includes(type);
    if (isOn && theaterReminders.types.length === 1) return;
    const next = isOn
      ? theaterReminders.types.filter((value) => value !== type)
      : [...theaterReminders.types, type];
    updateTheaterReminders({
      types: REMINDER_TYPES.filter((item) => next.includes(item)),
    });
  };

  const saveTelegramChat = () => {
    if (!activeTheater || readOnly) return;
    dispatch({
      type: 'UPDATE_THEATER',
      payload: {
        ...activeTheater,
        telegramChatId: telegramChatInput.trim() || undefined,
      },
    });
    setTelegramTestMessage('Chat ID сохранён');
    window.setTimeout(() => setTelegramTestMessage(null), 2500);
  };

  const testTelegramChat = async () => {
    if (!state.activeTheaterId || readOnly || !activeTheater) return;
    const chatId = telegramChatInput.trim();
    if (!chatId) {
      setTelegramTestMessage('Укажите Chat ID');
      return;
    }
    setTelegramTestPending(true);
    setTelegramTestMessage(null);
    try {
      await sendTelegramTestMessage(state.activeTheaterId, chatId);
      dispatch({
        type: 'UPDATE_THEATER',
        payload: { ...activeTheater, telegramChatId: chatId },
      });
      setTelegramTestMessage('Тестовое сообщение отправлено в группу');
    } catch (error) {
      setTelegramTestMessage(error instanceof Error ? error.message : 'Не удалось отправить');
    } finally {
      setTelegramTestPending(false);
    }
  };

  const updateTheaterTimezone = (timezone: string) => {
    if (!activeTheater || readOnly) return;
    dispatch({
      type: 'UPDATE_THEATER',
      payload: { ...activeTheater, timezone },
    });
  };

  const updateSceneTiming = (patch: Partial<typeof sceneTiming>) => {
    dispatch({
      type: 'UPDATE_APP_META',
      payload: {
        sceneTiming: {
          ...state.appMeta?.sceneTiming,
          ...sceneTiming,
          ...patch,
        },
      },
    });
  };

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div>
          <h1 className={pageTitleClass}>Настройки</h1>
          <p className="mt-1 text-muted">
            {tab === 'general'
              ? 'Оформление, аккаунт и общие параметры приложения'
              : activeTheater
                ? `Параметры театра «${activeTheater.name}»`
                : 'Выберите театр в меню слева'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 rounded-xl bg-black/20 p-1">
          <button
            type="button"
            onClick={() => setTab('general')}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors sm:flex-none ${
              tab === 'general' ? 'bg-gold/20 text-white' : 'text-muted hover:text-white'
            }`}
          >
            <Settings2 size={16} />
            Общие
          </button>
          <button
            type="button"
            onClick={() => setTab('theater')}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors sm:flex-none ${
              tab === 'theater' ? 'bg-gold/20 text-white' : 'text-muted hover:text-white'
            }`}
          >
            <Building2 size={16} />
            {activeTheater ? `Театр: ${activeTheater.name}` : 'Театр'}
          </button>
        </div>
      </header>

      {tab === 'general' ? (
        <>
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <BarChart3 size={16} />
          Тариф
        </div>
        <div className="rounded-2xl border border-gold/10 bg-surface/40 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-2xl font-bold text-white">{SUBSCRIPTION_PLAN_LABELS[plan]}</p>
              <p className="mt-1 text-sm text-muted">
                {isPro
                  ? 'Без лимита постановок, шаблоны, серии и авто-напоминания в Telegram.'
                  : 'Одна активная постановка и один театр. Ручная рассылка в Telegram доступна.'}
              </p>
            </div>
            {!isPro && (
              <div className="flex flex-wrap gap-2">
                <Link to={appPaths.pricing} className="zen-primary-btn rounded-lg px-4 py-2 text-sm font-semibold">
                  Тарифы
                </Link>
                <a
                  href={supportMailto('Подключение Pro')}
                  className="rounded-lg border border-gold/20 px-4 py-2 text-sm text-muted hover:text-white"
                >
                  Запросить Pro
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <Palette size={16} />
          Оформление
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {options.map((option) => {
            const selected = design === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setDesign(option.id)}
                className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
                  selected
                    ? 'border-gold/40 bg-gold/10 ring-1 ring-gold/20'
                    : 'border-gold/10 bg-surface/40 hover:border-gold/25'
                }`}
              >
                <div
                  className={`mb-4 h-24 rounded-xl border transition-transform duration-300 group-hover:scale-[1.02] ${
                    option.id === 'theater'
                      ? 'border-gold/20 bg-gradient-to-br from-[#1a1212] to-[#0f0a0a]'
                      : 'border-black/5 bg-gradient-to-br from-[#ffffff] to-[#f3f4f6] shadow-inner'
                  }`}
                >
                  <div className="flex h-full items-end justify-between p-3">
                    {option.id === 'theater' ? (
                      <Drama size={28} className="text-gold-light/70" aria-hidden />
                    ) : (
                      <span />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        option.id === 'theater' ? 'text-gold-light/80' : 'text-black/45'
                      }`}
                    >
                      {option.preview}
                    </span>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                      {option.id === 'theater' && <Drama size={18} className="text-gold" />}
                      {option.id === 'zen' && <Sparkles size={18} className="text-gold" />}
                      {option.title}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{option.description}</p>
                  </div>
                  {selected && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold-light">
                      <Check size={16} />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted/80">
          Выбор сохраняется на этом устройстве. Переключение применяется сразу, без перезагрузки.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <LogOut size={16} />
          Аккаунт
        </div>
        <div className="space-y-4 rounded-2xl border border-gold/10 bg-surface/40 p-5">
          <div>
            <p className="text-sm text-muted">Вы вошли как</p>
            <p className="text-sm text-muted">{user?.email}</p>
          </div>
          <Input
            label="Имя"
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
            placeholder="Как к вам обращаться"
          />
          {user?.hasPassword ? (
            <Input
              label="Текущий пароль"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
          ) : (
            <p className="text-sm text-muted">Задайте пароль для входа по email.</p>
          )}
          <Input
            label={user?.hasPassword ? 'Новый пароль' : 'Пароль для входа по email'}
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Минимум 8 символов"
          />
          {profileError ? <p className="text-sm text-amber-200">{profileError}</p> : null}
          {profileMessage ? <p className="text-sm text-emerald-300/90">{profileMessage}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void saveProfile()} disabled={profileSaving}>
              {profileSaving ? 'Сохранение…' : 'Сохранить профиль'}
            </Button>
            <button
              type="button"
              onClick={() => void logout().then(() => {
                window.location.href = '/login';
              })}
              className="rounded-xl border border-gold/20 px-4 py-2 text-sm text-gold-light transition-colors hover:bg-gold/10"
            >
              Выйти
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <Clock size={16} />
          Часовой пояс
        </div>
        <div className="space-y-4 rounded-2xl border border-gold/10 bg-surface/40 p-5">
          {!activeTheater ? (
            <p className="text-sm text-muted">Выберите театр в меню, чтобы задать часовой пояс.</p>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-muted">
                Время репетиций и авто-напоминания в Telegram считаются в этом поясе. По умолчанию — Москва.
              </p>
              <Select
                label="Часовой пояс театра"
                value={theaterTimezone}
                disabled={readOnly}
                onChange={(event) => updateTheaterTimezone(event.target.value)}
                options={TIMEZONE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
              {theaterTimezone === DEFAULT_TIMEZONE && !activeTheater.timezone ? (
                <p className="text-xs text-muted/80">Используется значение по умолчанию: Москва (UTC+3).</p>
              ) : null}
            </>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <Clock size={16} />
          Хронометраж сцен
        </div>
        <div className="space-y-4 rounded-2xl border border-gold/10 bg-surface/40 p-5">
          <p className="text-sm leading-relaxed text-muted">
            Прогноз по печатным знакам с пробелами. Если у сцены есть текст из Google Docs — он
            точнее описания. По умолчанию: 1 авторский лист ={' '}
            {DEFAULT_SCENE_TIMING_SETTINGS.charsPerAuthorPage.toLocaleString('ru-RU')} зн.
          </p>
          {readOnly ? (
            <p className="text-xs text-muted/80">
              Это личные настройки вашего аккаунта: как вы видите хронометраж. На расписание театра
              они не влияют.
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Знаков в авторском листе"
              type="number"
              min={500}
              step={100}
              value={sceneTiming.charsPerAuthorPage}
              onChange={(event) =>
                updateSceneTiming({
                  charsPerAuthorPage: Number(event.target.value) || DEFAULT_SCENE_TIMING_SETTINGS.charsPerAuthorPage,
                })
              }
            />
            <Input
              label="Минут спектакля на 1 а.л."
              type="number"
              min={0.5}
              step={0.5}
              value={sceneTiming.performanceMinutesPerAuthorPage}
              onChange={(event) =>
                updateSceneTiming({
                  performanceMinutesPerAuthorPage:
                    Number(event.target.value) ||
                    DEFAULT_SCENE_TIMING_SETTINGS.performanceMinutesPerAuthorPage,
                })
              }
            />
            <Input
              label="Множитель для репетиции"
              type="number"
              min={1}
              step={0.5}
              value={sceneTiming.rehearsalMultiplier}
              onChange={(event) =>
                updateSceneTiming({
                  rehearsalMultiplier:
                    Number(event.target.value) || DEFAULT_SCENE_TIMING_SETTINGS.rehearsalMultiplier,
                })
              }
            />
          </div>
          <label className="flex cursor-pointer items-start gap-4 rounded-xl border border-gold/10 bg-black/20 p-4">
            <input
              type="checkbox"
              checked={sceneTiming.autoFillRehearsalMinutes}
              onChange={(event) =>
                updateSceneTiming({ autoFillRehearsalMinutes: event.target.checked })
              }
              className="mt-1 h-4 w-4 rounded border-gold/30 accent-gold"
            />
            <span className="min-w-0 text-sm text-muted">
              При подсчёте знаков из Google Docs автоматически подставлять «На репетицию (мин)»
            </span>
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <AlertTriangle size={16} />
          Репетиции
        </div>

        <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-gold/10 bg-surface/40 p-5 transition-colors hover:border-gold/20">
          <input
            type="checkbox"
            checked={showRehearsalWarnings}
            onChange={(event) =>
              dispatch({
                type: 'UPDATE_APP_META',
                payload: { showRehearsalWarnings: event.target.checked },
              })
            }
            className="mt-1 h-4 w-4 rounded border-gold/30 accent-gold"
          />
          <span className="min-w-0">
            <span className="block text-base font-medium text-white">
              Предупреждения перед репетицией
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-muted">
              Автоматически показывать уведомления на обзоре и в карточке репетиции: пустой план,
              участники без Telegram, давно не репетировавшиеся сцены, открытые задачи и конфликты
              в календаре.
            </span>
          </span>
        </label>
      </section>
        </>
      ) : (
        <>
      {!activeTheater ? (
        <div className="rounded-2xl border border-dashed border-gold/20 bg-surface/40 p-8 text-center text-sm text-muted">
          Сначала выберите или создайте театр в боковом меню.
        </div>
      ) : (
        <>
          <TheaterMembersPanel />

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
              <Send size={16} />
              Telegram чат театра
              <GuideContextHelp anchor="доступ-роли-telegram" label="Справка: доступ и Telegram" />
            </div>

            {!telegramStatus?.botConfigured ? (
              <div className="rounded-2xl border border-dashed border-gold/20 bg-surface/40 p-5 text-sm text-muted">
                Бот сервиса пока не настроен на сервере. Администратору нужно задать{' '}
                <code className="text-gold-light">TELEGRAM_BOT_TOKEN</code> в <code>.env</code>.
              </div>
            ) : (
              <div className="space-y-4 rounded-2xl border border-gold/10 bg-surface/40 p-5">
                <p className="text-sm leading-relaxed text-muted">
                  Добавьте бота{' '}
                  {telegramStatus.botUsername ? (
                    <code className="text-gold-light">@{telegramStatus.botUsername}</code>
                  ) : (
                    'Репетиции'
                  )}{' '}
                  в рабочую группу театра — для <strong className="text-white/80">ручной</strong> рассылки плана
                  с карточки репетиции. Авто-напоминания участникам идут в личку, не сюда.
                </p>
                <p className="text-sm text-muted">
                  Напишите в группу после добавления бота, затем откройте{' '}
                  <code className="text-gold-light/80">getUpdates</code> и скопируйте{' '}
                  <code className="text-gold-light/80">chat.id</code>. Если группа стала супергруппой, id
                  обычно начинается с <code className="text-gold-light/80">-100</code> (старый id перестаёт
                  работать).
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <Input
                    label="Chat ID"
                    value={telegramChatInput}
                    disabled={readOnly}
                    onChange={(event) => setTelegramChatInput(event.target.value)}
                    placeholder="-1001234567890"
                    className="min-w-[14rem] flex-1"
                  />
                  {!readOnly && (
                    <>
                      <Button variant="secondary" onClick={saveTelegramChat}>
                        Сохранить
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void testTelegramChat()}
                        disabled={telegramTestPending || !telegramChatInput.trim()}
                      >
                        {telegramTestPending ? 'Отправка…' : 'Проверить'}
                      </Button>
                    </>
                  )}
                </div>
                {telegramStatus.chatConfigured ? (
                  <p className="text-sm text-emerald-300/90">Чат подключён — можно отправлять напоминания</p>
                ) : (
                  <p className="text-sm text-muted">Укажите Chat ID и нажмите «Проверить»</p>
                )}
                {telegramTestMessage ? (
                  <p
                    className={`text-sm ${
                      telegramTestMessage.includes('отправлено')
                        ? 'text-gold-light'
                        : 'text-amber-200'
                    }`}
                  >
                    {telegramTestMessage}
                  </p>
                ) : null}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
              <Bell size={16} />
              Напоминания
            </div>

            {!isPro ? (
              <UpgradePrompt
                title="Личные авто-напоминания — в Pro"
                description="Бот сам отправит план репетиции каждому участнику в личку Telegram. На Free — ручная рассылка в чат театра."
              />
            ) : !telegramStatus?.botConfigured ? (
              <div className="space-y-3 rounded-2xl border border-amber-500/25 bg-amber-950/20 p-5 text-sm">
                {theaterReminders.enabled ? (
                  <p className="text-amber-100">
                    <strong className="font-medium">Напоминания включены в настройках театра</strong>, но планировщик
                    на сервере не работает — сообщения не уйдут, пока не настроен бот.
                  </p>
                ) : null}
                <p className="text-muted">
                  Задайте <code className="text-gold-light">TELEGRAM_BOT_TOKEN</code> в <code>.env</code> и перезапустите
                  API (<code>restart.bat</code>). Без перезапуска планировщик остаётся выключенным, даже если токен уже
                  в файле.
                </p>
              </div>
            ) : (
              <div className="space-y-4 rounded-2xl border border-gold/10 bg-surface/40 p-5">
                {theaterReminders.enabled && telegramStatus.remindersSchedulerActive ? (
                  <p className="text-sm text-emerald-300/90">
                    Планировщик активен — проверка каждые {telegramStatus.reminderTickMinutes} мин, окно отправки{' '}
                    {telegramStatus.reminderWindowMinutes} мин
                    {telegramStatus.botUsername ? (
                      <>
                        {' '}
                        · бот{' '}
                        <a
                          href={`https://t.me/${telegramStatus.botUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold-light underline-offset-2 hover:underline"
                        >
                          @{telegramStatus.botUsername}
                        </a>
                      </>
                    ) : null}
                    .
                  </p>
                ) : null}
                <label className="flex cursor-pointer items-start gap-4">
                  <input
                    type="checkbox"
                    checked={theaterReminders.enabled}
                    disabled={readOnly}
                    onChange={(event) => updateTheaterReminders({ enabled: event.target.checked })}
                    className="mt-1 h-4 w-4 rounded border-gold/30 accent-gold"
                  />
                  <span className="min-w-0">
                    <span className="block text-base font-medium text-white">
                      Личные напоминания участникам
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted">
                      Бот отправит план репетиции в личку каждому участнику, у кого подключён Telegram.
                      Общий чат театра выше — только для ручной рассылки.
                    </span>
                  </span>
                </label>

                <div className="space-y-2">
                  <p className="text-sm text-muted">Когда напоминать</p>
                  <div className="flex flex-wrap gap-2">
                    {REMINDER_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        disabled={readOnly}
                        onClick={() => toggleReminderType(type)}
                        className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                          theaterReminders.types.includes(type)
                            ? 'bg-gold/20 text-gold-light'
                            : 'bg-white/5 text-muted hover:bg-white/10'
                        }`}
                      >
                        {REMINDER_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                  {theaterReminders.types.includes('morning_of') ? (
                    <p className="text-xs text-muted">
                      «Утром» — около {theaterReminders.morningHour ?? DEFAULT_THEATER_REMINDER_SETTINGS.morningHour}:00
                      по времени театра (UTC+3, настраивается на сервере).
                    </p>
                  ) : null}
                </div>

                <p className="text-sm text-muted">
                  Участники подключают бота в карточке участника → «Подключить Telegram».
                </p>
              </div>
            )}
          </section>
        </>
      )}
        </>
      )}

      {isPlatformAdmin ? (
        <section className="mt-4 border-t border-gold/10 pt-6">
          <button
            type="button"
            onClick={() => setAdminRevealOpen((open) => !open)}
            aria-expanded={adminRevealOpen}
            aria-label={adminRevealOpen ? 'Свернуть' : 'Дополнительные параметры'}
            className="w-full rounded-xl border border-dashed border-gold/20 bg-surface/20 px-4 py-3 text-center text-sm text-muted/40 transition-colors hover:border-gold/30 hover:bg-surface/40 hover:text-muted/70"
          >
            {adminRevealOpen ? (
              <span className="text-muted/70">Свернуть</span>
            ) : (
              <span aria-hidden>···</span>
            )}
          </button>
          {adminRevealOpen ? (
            <div className="mt-2 rounded-xl border border-dashed border-gold/25 bg-surface/30 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-2 text-sm font-medium text-gold-light">
                    <BarChart3 size={16} />
                    Администрирование платформы
                  </div>
                  <p className="text-xs text-muted">Статистика по всем театрам и пользователям</p>
                </div>
                <Link
                  to={appPaths.admin}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-surface/80 px-4 py-2 text-sm text-gold-light transition-colors hover:border-gold/40"
                >
                  Открыть админку
                </Link>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
