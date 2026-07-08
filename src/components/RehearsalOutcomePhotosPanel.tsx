import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import type { Rehearsal } from '../types';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useSubscription } from '../hooks/useSubscription';
import { UpgradePrompt } from './UpgradePrompt';
import { Button } from './Button';
import {
  MAX_OUTCOME_PHOTOS_PER_REHEARSAL,
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
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);

  const photos = rehearsal.outcomePhotoUrls ?? [];
  const slotsLeft = MAX_OUTCOME_PHOTOS_PER_REHEARSAL - photos.length;
  const atLimit = slotsLeft <= 0;
  const viewerOpen = viewerIndex !== null && photos[viewerIndex] !== undefined;
  const viewerUrl = viewerOpen ? photos[viewerIndex]! : null;

  const closeViewer = () => {
    setViewerIndex(null);
    setIsFullscreen(false);
  };

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setIsFullscreen(false);
  };

  const showPrev = () => {
    if (viewerIndex === null || photos.length === 0) return;
    setViewerIndex((viewerIndex - 1 + photos.length) % photos.length);
    setIsFullscreen(false);
  };

  const showNext = () => {
    if (viewerIndex === null || photos.length === 0) return;
    setViewerIndex((viewerIndex + 1) % photos.length);
    setIsFullscreen(false);
  };

  useEffect(() => {
    if (!viewerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (isFullscreen) setIsFullscreen(false);
        else closeViewer();
        return;
      }
      if (isFullscreen) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showPrev();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        showNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewerOpen, isFullscreen, viewerIndex, photos.length]);

  const updatePhotos = (outcomePhotoUrls: string[]) => {
    dispatch({
      type: 'UPDATE_REHEARSAL',
      payload: { ...rehearsal, outcomePhotoUrls },
    });
  };

  const handleUploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    if (atLimit) {
      setError(`Достигнут лимит: ${MAX_OUTCOME_PHOTOS_PER_REHEARSAL} фото на репетицию.`);
      return;
    }

    const allowedCount = Math.min(files.length, slotsLeft);
    const filesToUpload = files.slice(0, allowedCount);
    if (files.length > allowedCount) {
      setError(
        `Выбрано ${files.length} фото — загрузим ${allowedCount} (лимит ${MAX_OUTCOME_PHOTOS_PER_REHEARSAL}).`
      );
    } else {
      setError(null);
    }

    setUploading(true);
    let nextUrls = [...photos];
    let firstError: string | null = null;

    for (let index = 0; index < filesToUpload.length; index += 1) {
      const file = filesToUpload[index]!;
      setUploadProgress({ current: index + 1, total: filesToUpload.length });

      const validationError = validateOutcomePhotoFile(file);
      if (validationError) {
        firstError = `${file.name}: ${validationError}`;
        continue;
      }

      try {
        const uploaded = await uploadRehearsalOutcomePhoto(rehearsal.id, file);
        if (!nextUrls.includes(uploaded.url)) {
          nextUrls = [...nextUrls, uploaded.url];
          updatePhotos(nextUrls);
        }
      } catch (uploadError) {
        firstError = formatOutcomePhotoUploadError(uploadError);
        break;
      }
    }

    if (firstError) setError(firstError);
    setUploading(false);
    setUploadProgress(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDelete = async (url: string, index: number) => {
    setDeletingUrl(url);
    setError(null);
    try {
      await deleteRehearsalOutcomePhoto(rehearsal.id, url);
      const nextPhotos = photos.filter((item) => item !== url);
      updatePhotos(nextPhotos);

      if (viewerIndex !== null) {
        if (nextPhotos.length === 0) closeViewer();
        else if (index === viewerIndex) {
          setViewerIndex(Math.min(viewerIndex, nextPhotos.length - 1));
        } else if (index < viewerIndex) {
          setViewerIndex(viewerIndex - 1);
        }
      }
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
          <p className="mt-1 text-xs text-muted">
            {photos.length} / {MAX_OUTCOME_PHOTOS_PER_REHEARSAL}
            {uploadProgress
              ? ` · загрузка ${uploadProgress.current} из ${uploadProgress.total}`
              : photos.length > 0
                ? ' · листайте, клик — просмотр'
                : ' · до 10 МБ, пакетом'}
          </p>
        </div>
        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="sr-only"
              onChange={(event) => {
                const files = event.target.files;
                if (files && files.length > 0) void handleUploadFiles(files);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              disabled={uploading || atLimit}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              {uploading
                ? uploadProgress
                  ? `${uploadProgress.current}/${uploadProgress.total}`
                  : '…'
                : atLimit
                  ? 'Лимит'
                  : 'Добавить'}
            </Button>
          </>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      {photos.length === 0 ? (
        <p className="text-sm text-muted">Пока нет фото итога репетиции.</p>
      ) : (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scroll-smooth snap-x snap-mandatory">
          {photos.map((url, index) => (
            <div key={url} className="group relative shrink-0 snap-start">
              <button
                type="button"
                className="block overflow-hidden rounded-lg border border-gold/15 bg-black/20 transition hover:border-gold/35"
                onClick={() => openViewer(index)}
              >
                <img
                  src={url}
                  alt={`Итог репетиции ${index + 1}`}
                  className="h-16 w-24 object-cover sm:h-20 sm:w-28"
                  loading="lazy"
                />
              </button>
              {!readOnly && (
                <button
                  type="button"
                  disabled={deletingUrl === url}
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleDelete(url, index);
                  }}
                  className="absolute right-1 top-1 rounded-md bg-black/75 p-1 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100 disabled:opacity-60"
                  aria-label="Удалить фото"
                >
                  {deletingUrl === url ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {viewerOpen && viewerUrl && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center ${
            isFullscreen ? 'bg-black' : 'bg-black/85 p-4'
          }`}
          onClick={() => {
            if (isFullscreen) setIsFullscreen(false);
            else closeViewer();
          }}
        >
          {!isFullscreen && (
            <>
              <button
                type="button"
                className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                onClick={(event) => {
                  event.stopPropagation();
                  closeViewer();
                }}
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>

              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 sm:left-4"
                    onClick={(event) => {
                      event.stopPropagation();
                      showPrev();
                    }}
                    aria-label="Предыдущее фото"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 sm:right-4"
                    onClick={(event) => {
                      event.stopPropagation();
                      showNext();
                    }}
                    aria-label="Следующее фото"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}

              <p className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/90">
                {(viewerIndex ?? 0) + 1} / {photos.length}
                <span className="ml-2 text-white/60">Esc — закрыть · клик — на весь экран</span>
              </p>
            </>
          )}

          {isFullscreen && (
            <button
              type="button"
              className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              onClick={(event) => {
                event.stopPropagation();
                setIsFullscreen(false);
              }}
              aria-label="Выйти из полноэкранного режима"
            >
              <X size={20} />
            </button>
          )}

          <img
            src={viewerUrl}
            alt={`Итог репетиции ${(viewerIndex ?? 0) + 1}`}
            className={
              isFullscreen
                ? 'h-full w-full cursor-zoom-out object-contain'
                : 'max-h-[85vh] max-w-full cursor-zoom-in rounded-xl object-contain'
            }
            onClick={(event) => {
              event.stopPropagation();
              if (isFullscreen) setIsFullscreen(false);
              else setIsFullscreen(true);
            }}
          />
        </div>
      )}
    </section>
  );
}
