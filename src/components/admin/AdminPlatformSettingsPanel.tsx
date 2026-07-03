import { useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import type { RegistrationMode } from '../types/admin';
import { fetchPlatformSettings, updatePlatformSettings } from '../api/adminPlatform';

const MODE_OPTIONS: Array<{
  id: RegistrationMode;
  title: string;
  description: string;
}> = [
  {
    id: 'beta',
    title: 'Бета',
    description:
      'Новые пользователи подтверждают email, затем ждут одобрения администратора. Доступ открывается после вашего решения.',
  },
  {
    id: 'normal',
    title: 'Обычный режим',
    description:
      'После подтверждения email пользователь сразу может войти — без ручного одобрения.',
  },
];

interface AdminPlatformSettingsPanelProps {
  initialMode?: RegistrationMode;
  pendingRegistrations?: number;
  onModeChange?: (mode: RegistrationMode) => void;
}

export function AdminPlatformSettingsPanel({
  initialMode,
  pendingRegistrations = 0,
  onModeChange,
}: AdminPlatformSettingsPanelProps) {
  const [mode, setMode] = useState<RegistrationMode>(initialMode ?? 'beta');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
      return;
    }
    void fetchPlatformSettings()
      .then((settings) => setMode(settings.registrationMode))
      .catch(() => setError('Не удалось загрузить настройки платформы'));
  }, [initialMode]);

  const handleSelect = async (next: RegistrationMode) => {
    if (next === mode || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updatePlatformSettings({ registrationMode: next });
      setMode(updated.registrationMode);
      onModeChange?.(updated.registrationMode);
      setNotice('Режим работы сохранён');
    } catch {
      setError('Не удалось сохранить режим');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gold/15 bg-surface/60 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Settings2 size={18} className="text-gold" />
            Режим работы приложения
          </h2>
          <p className="mt-1 text-sm text-muted">
            Как обрабатываются новые регистрации на сайте
            {pendingRegistrations > 0 ? (
              <span className="text-amber-200">
                {' '}
                · {pendingRegistrations} заявок ждут одобрения
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {MODE_OPTIONS.map((option) => {
          const active = mode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={saving}
              onClick={() => void handleSelect(option.id)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                active
                  ? 'border-gold/40 bg-gold/10'
                  : 'border-gold/10 bg-background/30 hover:border-gold/25'
              } disabled:opacity-60`}
            >
              <p className="font-medium text-white">{option.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{option.description}</p>
            </button>
          );
        })}
      </div>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-emerald-300">{notice}</p> : null}
    </section>
  );
}
