import { useEffect, useState } from 'react';
import { LogOut, Trash2, UserCircle } from 'lucide-react';
import { fetchActorSelf, patchActorProfile } from '../api/actorSelf';
import { deleteAuthAccount } from '../api/auth';
import { ImageCropField } from '../components/ImageCropField';
import { uploadFile } from '../api/files';
import { ActorAvatar } from '../components/ActorAvatar';
import { Button } from '../components/Button';
import { DesignThemePicker } from '../components/DesignThemePicker';
import { Input, Textarea } from '../components/FormFields';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import { useAuth } from '../store/AuthContext';
import { useDesign } from '../store/DesignContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { pageHeaderClass, pageTitleClass } from '../utils/pageLayout';

export function ActorSettingsPage() {
  const { user, logout, updateProfile } = useAuth();
  const { isZen } = useDesign();
  const { state, dispatch } = useRehearsalStore();
  const { confirmDelete } = useConfirmDialog();
  const theaterId = state.activeTheaterId;

  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [linkedActorId, setLinkedActorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');

  useEffect(() => {
    setProfileName(user?.name ?? '');
  }, [user?.name]);

  useEffect(() => {
    if (!theaterId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchActorSelf(theaterId)
      .then((profile) => {
        if (profile.linked) {
          setLinkedActorId(profile.linked.id);
          setPhotoUrl(profile.linked.photoUrl ?? undefined);
          setNotes(profile.linked.notes ?? '');
        } else {
          setLinkedActorId(null);
        }
      })
      .catch(() => setError('Не удалось загрузить профиль участника'))
      .finally(() => setLoading(false));
  }, [theaterId]);

  const sectionClass = isZen
    ? 'rounded-2xl border border-border/60 bg-surface/80 p-4 sm:p-5'
    : 'rounded-2xl border border-gold/10 bg-surface/40 p-4 sm:p-5';

  const handlePhotoCropped = async (file: File) => {
    try {
      const uploaded = await uploadFile(file);
      setPhotoUrl(uploaded.url);
      setError(null);
    } catch {
      setError('Не удалось загрузить фото');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const trimmedName = profileName.trim();
      if (!trimmedName) {
        setError('Укажите имя');
        return;
      }

      if (trimmedName !== user?.name) {
        await updateProfile({ name: trimmedName });
      }

      if (theaterId && linkedActorId) {
        const updated = await patchActorProfile(theaterId, {
          name: trimmedName,
          photoUrl: photoUrl ?? null,
          notes: notes.trim(),
        });
        dispatch({
          type: 'UPDATE_ACTOR',
          payload: {
            id: linkedActorId,
            theaterId,
            name: updated.name,
            status: 'active',
            photoUrl: updated.photoUrl ?? undefined,
            notes: updated.notes ?? undefined,
            email: updated.email ?? undefined,
            phone: updated.phone ?? undefined,
          },
        });
      }

      setMessage('Сохранено');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    void logout().then(() => {
      window.location.href = '/login';
    });
  };

  const handleDeleteAccount = async () => {
    const confirmed = await confirmDelete({
      title: 'Удалить аккаунт навсегда?',
      message:
        'Все ваши данные в приложении будут удалены без возможности восстановления. Если вы владелец театра, удалятся и его данные.',
      confirmLabel: 'Удалить аккаунт',
    });
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteAuthAccount(user?.hasPassword ? deletePassword : undefined);
      window.location.href = '/';
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить аккаунт');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Настройки</h1>
      </header>

      <section className={sectionClass}>
        <div className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <UserCircle size={16} />
          Профиль
        </div>

        {loading ? (
          <p className="text-sm text-muted">Загрузка…</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Вход: <span className="text-foreground">{user?.email}</span>
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <ActorAvatar name={profileName || user?.name || '?'} photoUrl={photoUrl} size="lg" />
              <ImageCropField
                title="Фото участника"
                className="cursor-pointer"
                onCropped={handlePhotoCropped}
                onPickError={(message) => setError(message)}
              >
                <span className="inline-flex rounded-xl border border-gold/20 px-4 py-2 text-sm text-gold-light transition-colors hover:bg-gold/10">
                  Загрузить фото
                </span>
              </ImageCropField>
            </div>

            <Input
              label="Имя"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Как к вам обращаться в театре"
            />

            <div>
              <Textarea
                label="О себе"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Опыт, рост, сильные стороны, предпочтения по репетициям…"
              />
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Актёрам: кратко опишите опыт и особенности — режиссёр увидит это в вашей карточке
                участника. Например: «3-й курс ГИТИС, комфортно с классикой, предпочитаю утренние
                репетиции».
              </p>
            </div>

            {!linkedActorId && (
              <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                Карточка участника в этом театре не найдена — фото и «О себе» сохранятся после
                привязки email режиссёром.
              </p>
            )}

            {error ? <p className="text-sm text-amber-200">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-300/90">{message}</p> : null}

            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        )}
      </section>

      <div className={sectionClass}>
        <DesignThemePicker />
      </div>

      <section className={sectionClass}>
        <div className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <LogOut size={16} />
          Сессия
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-xl border border-gold/20 px-4 py-2 text-sm text-gold-light transition-colors hover:bg-gold/10"
        >
          Выйти из аккаунта
        </button>
      </section>

      <section className={`${sectionClass} border-rose-500/20`}>
        <div className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-rose-300">
          <Trash2 size={16} />
          Удаление аккаунта
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Аккаунт и все связанные данные будут удалены без возможности восстановления.
        </p>
        {user?.hasPassword ? (
          <Input
            label="Пароль для подтверждения"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            autoComplete="current-password"
            className="mt-4"
          />
        ) : null}
        <Button
          variant="danger"
          className="mt-4"
          disabled={deleting || (user?.hasPassword && !deletePassword)}
          onClick={() => void handleDeleteAccount()}
        >
          {deleting ? 'Удаление…' : 'Удалить аккаунт'}
        </Button>
      </section>
    </div>
  );
}
