import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import type { Rehearsal } from '../types';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useSubscription } from '../hooks/useSubscription';
import { UpgradePrompt } from './UpgradePrompt';
import { Button } from './Button';
import {
  deleteRehearsalOutcomePhoto,
  formatOutcomePhotoUploadError,
  uploadRehearsalOutcomePhoto,
  validateOutcomePhotoFile,
} from '../api/rehearsalOutcomePhotos';

interface RehearsalOutcomePhotosPanelProps {
  rehearsal: Rehearsal;
  readOnly?: boolean;
}

export function RehearsalOutcomePhotosPanel({
  rehearsal,
  readOnly = false,
}: RehearsalOutcomePhotosPanelProps) {
  const { dispatch } = useRehearsalStore();
  const { isPro } = useSubscription();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);

  const photos = rehearsal.outcomePhotoUrls ?? [];

  const updatePhotos = (outcomePhotoUrls: string[]) => {
    dispatch({
      type: 'UPDATE_REHEARSAL',
      payload: { ...rehearsal, outcomePhotoUrls },
    });
  };

  const handleUpload = async (file: File) => {
    const validationError = validateOutcomePhotoFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadRehearsalOutcomePhoto(rehearsal.id, file);
      updatePhotos([...photos, uploaded.url]);
    } catch (uploadError) {
      setError(formatOutcomePhotoUploadError(uploadError));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (url: string) => {
    setDeletingUrl(url);
    setError(null);
    try {
      await deleteRehearsalOutcomePhoto(rehearsal.id, url);
      updatePhotos(photos.filter((item) => item !== url));
    } catch (deleteError) {
      setError(formatOutcomePhotoUploadError(deleteError));
    } finally {
      setDeletingUrl(null);
    }
  };

  if (!isPro) {
    return (
      <section className="rounded-2xl border border-gold/10 bg-surface/40 p-5">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Итог репетиции
        </h2>
        <UpgradePrompt
          compact
          title="Фото итога — Pro"
          description="Сохраняйте фото с репетиции: сжимаются автоматически и хранятся в облаке."
        />
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gold/10 bg-surface/40 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Итог репетиции
          </h2>
          <p className="mt-1 text-xs text-muted">Фото до 10 МБ, сжимаются при загрузке</p>
        </div>
        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              {uploading ? 'Загрузка…' : 'Добавить фото'}
            </Button>
          </>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      {photos.length === 0 ? (
        <p className="text-sm text-muted">Пока нет фото итога репетиции.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((url) => (
            <div
              key={url}
              className="group relative overflow-hidden rounded-xl border border-gold/15 bg-black/20"
            >
              <button
                type="button"
                className="block w-full"
                onClick={() => setPreviewUrl(url)}
              >
                <img
                  src={url}
                  alt="Итог репетиции"
                  className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]"
                  loading="lazy"
                />
              </button>
              {!readOnly && (
                <button
                  type="button"
                  disabled={deletingUrl === url}
                  onClick={() => void handleDelete(url)}
                  className="absolute right-2 top-2 rounded-lg bg-black/70 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100 disabled:opacity-60"
                  aria-label="Удалить фото"
                >
                  {deletingUrl === url ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white"
            onClick={() => setPreviewUrl(null)}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
          <img
            src={previewUrl}
            alt="Итог репетиции"
            className="max-h-[90vh] max-w-full rounded-xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
