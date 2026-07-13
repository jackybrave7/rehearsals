import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Input } from '../FormFields';
import { fetchPlatformSettings, updatePlatformSettings } from '../../api/adminPlatform';

export function AdminNotificationsPanel() {
  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void fetchPlatformSettings()
      .then((settings) => {
        setEnabled(settings.registrationNotify.enabled);
        setEmail(settings.registrationNotify.email);
      })
      .catch(() => setError('Не удалось загрузить настройки уведомлений'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (enabled && !email.trim()) {
      setError('Укажите email для уведомлений');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updatePlatformSettings({
        registrationNotifyEnabled: enabled,
        registrationNotifyEmail: email.trim().toLowerCase(),
      });
      setEnabled(updated.registrationNotify.enabled);
      setEmail(updated.registrationNotify.email);
      setNotice('Настройки уведомлений сохранены');
    } catch {
      setError('Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gold/15 bg-surface/60 p-5">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Bell size={18} className="text-gold" />
          Уведомления
        </h2>
        <p className="mt-1 text-sm text-muted">
          Письмо администратору при регистрации нового пользователя на сайте
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Загрузка…</p>
      ) : (
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gold/10 bg-background/30 p-4">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              disabled={saving}
              className="mt-1 h-4 w-4 rounded border-gold/30 bg-background text-gold focus:ring-gold/40"
            />
            <span>
              <span className="block font-medium text-white">Уведомлять о новых регистрациях</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted">
                Когда включено, на указанный email приходит письмо с именем, адресом и ссылкой на карточку
                пользователя в админке.
              </span>
            </span>
          </label>

          <Input
            label="Email для уведомлений"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@example.com"
            disabled={!enabled || saving}
            autoComplete="email"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading}
              className="rounded-xl border border-gold/25 bg-gold/15 px-4 py-2 text-sm font-medium text-gold-light transition-colors hover:border-gold/40 disabled:opacity-60"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
            {!enabled ? (
              <p className="text-sm text-muted">Сейчас уведомления отключены</p>
            ) : null}
          </div>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-emerald-300">{notice}</p> : null}
    </section>
  );
}
