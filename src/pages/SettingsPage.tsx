import { Check, Palette, Sparkles, AlertTriangle, LogOut, Clock, Bell, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useDesign, type AppDesign } from '../store/DesignContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useAuth } from '../store/AuthContext';
import { getShowRehearsalWarnings } from '../store/selectors';
import { TheaterMembersPanel } from '../components/TheaterMembersPanel';
import { Input } from '../components/FormFields';
import { fetchTelegramConfigured } from '../api/telegram';
import {
  DEFAULT_REMINDER_SETTINGS,
  resolveReminderSettings,
} from '../utils/reminders';
import {
  DEFAULT_SCENE_TIMING_SETTINGS,
  resolveSceneTimingSettings,
} from '../utils/sceneTiming';
import { appPaths } from '../navigation/appPaths';

const options: Array<{
  id: AppDesign;
  title: string;
  description: string;
  preview: string;
}> = [
  {
    id: 'theater',
    title: 'Театр',
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

export function SettingsPage() {
  const { design, setDesign } = useDesign();
  const { state, dispatch, readOnly } = useRehearsalStore();
  const { user, logout, isPlatformAdmin } = useAuth();
  const showRehearsalWarnings = getShowRehearsalWarnings(state);
  const sceneTiming = resolveSceneTimingSettings(state.appMeta);
  const reminders = resolveReminderSettings(state.appMeta);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [customOffset, setCustomOffset] = useState('');

  useEffect(() => {
    void fetchTelegramConfigured().then(setTelegramConfigured);
  }, []);

  const updateReminders = (patch: Partial<typeof reminders>) => {
    dispatch({
      type: 'UPDATE_APP_META',
      payload: {
        reminders: {
          ...reminders,
          ...patch,
        },
      },
    });
  };

  const toggleOffset = (hours: number) => {
    const next = reminders.offsetsHours.includes(hours)
      ? reminders.offsetsHours.filter((value) => value !== hours)
      : [...reminders.offsetsHours, hours];
    updateReminders({
      offsetsHours: next.length > 0 ? [...next].sort((a, b) => b - a) : DEFAULT_REMINDER_SETTINGS.offsetsHours,
    });
  };

  const addCustomOffset = () => {
    const hours = Number(customOffset);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 168) return;
    if (reminders.offsetsHours.includes(hours)) {
      setCustomOffset('');
      return;
    }
    updateReminders({
      offsetsHours: [...reminders.offsetsHours, hours].sort((a, b) => b - a),
    });
    setCustomOffset('');
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
      <header>
        <h1 className="text-3xl font-bold text-white">Настройки</h1>
        <p className="mt-1 text-muted">Общие параметры приложения</p>
      </header>

      {isPlatformAdmin ? (
        <section className="rounded-2xl border border-gold/20 bg-gold/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-gold-light">
                <BarChart3 size={16} />
                Администрирование
              </div>
              <p className="text-sm text-muted">Статистика использования платформы по всем театрам</p>
            </div>
            <Link
              to={appPaths.admin}
              className="rounded-xl border border-gold/25 bg-surface/80 px-4 py-2 text-sm text-gold-light transition-colors hover:border-gold/40"
            >
              Открыть админку
            </Link>
          </div>
        </section>
      ) : null}

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
                  <div className="flex h-full items-end p-3">
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
        <div className="rounded-2xl border border-gold/10 bg-surface/40 p-5">
          <p className="text-sm text-muted">Вы вошли как</p>
          <p className="mt-1 text-lg font-medium text-white">{user?.name || user?.email}</p>
          <p className="text-sm text-muted">{user?.email}</p>
          <button
            type="button"
            onClick={() => void logout().then(() => {
              window.location.href = '/login';
            })}
            className="mt-4 rounded-xl border border-gold/20 px-4 py-2 text-sm text-gold-light transition-colors hover:bg-gold/10"
          >
            Выйти
          </button>
        </div>
      </section>

      <TheaterMembersPanel />

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <Clock size={16} />
          Хронометраж сцен
        </div>
        <div className="rounded-2xl border border-gold/10 bg-surface/40 p-5 space-y-4">
          <p className="text-sm leading-relaxed text-muted">
            Прогноз по печатным знакам с пробелами. Если у сцены есть текст из Google Docs — он
            точнее описания. По умолчанию: 1 авторский лист ={' '}
            {DEFAULT_SCENE_TIMING_SETTINGS.charsPerAuthorPage.toLocaleString('ru-RU')} зн.
          </p>
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
          <Bell size={16} />
          Напоминания
        </div>

        {!telegramConfigured ? (
          <div className="rounded-2xl border border-dashed border-gold/20 bg-surface/40 p-5 text-sm text-muted">
            Подключите бота: задайте <code className="text-gold-light">TELEGRAM_BOT_TOKEN</code> и{' '}
            <code className="text-gold-light">TELEGRAM_CHAT_ID</code> в <code>.env</code> и перезапустите API.
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-gold/10 bg-surface/40 p-5">
            <label className="flex cursor-pointer items-start gap-4">
              <input
                type="checkbox"
                checked={reminders.enabled}
                disabled={readOnly}
                onChange={(event) => updateReminders({ enabled: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-gold/30 accent-gold"
              />
              <span className="min-w-0">
                <span className="block text-base font-medium text-white">
                  Авто-напоминания в Telegram
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">
                  Бот отправит план репетиции за выбранное время до начала. Часовой пояс театра —
                  UTC+3 (Москва), настраивается через{' '}
                  <code className="text-gold-light/80">REHEARSAL_UTC_OFFSET_HOURS</code> на сервере.
                </span>
              </span>
            </label>

            <div className="space-y-2">
              <p className="text-sm text-muted">За сколько часов напоминать</p>
              <div className="flex flex-wrap gap-2">
                {[24, 2].map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggleOffset(hours)}
                    className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                      reminders.offsetsHours.includes(hours)
                        ? 'bg-gold/20 text-gold-light'
                        : 'bg-white/5 text-muted hover:bg-white/10'
                    }`}
                  >
                    за {hours} ч
                  </button>
                ))}
                {reminders.offsetsHours
                  .filter((hours) => hours !== 24 && hours !== 2)
                  .map((hours) => (
                    <button
                      key={hours}
                      type="button"
                      disabled={readOnly}
                      onClick={() => toggleOffset(hours)}
                      className="rounded-full bg-gold/20 px-3 py-1.5 text-sm text-gold-light"
                    >
                      за {hours} ч ×
                    </button>
                  ))}
              </div>
              {!readOnly && (
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    label="Свой интервал (часы)"
                    type="number"
                    min={1}
                    max={168}
                    value={customOffset}
                    onChange={(event) => setCustomOffset(event.target.value)}
                    className="max-w-[10rem]"
                  />
                  <button
                    type="button"
                    onClick={addCustomOffset}
                    className="rounded-xl border border-gold/20 px-4 py-2.5 text-sm text-gold-light hover:bg-gold/10"
                  >
                    Добавить
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
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
    </div>
  );
}
