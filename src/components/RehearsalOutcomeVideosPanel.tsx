import { useEffect, useRef, useState } from 'react';
import { Film, Link2, Loader2, Trash2, X } from 'lucide-react';
import type { Rehearsal } from '../types';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useSubscription } from '../hooks/useSubscription';
import { UpgradePrompt } from './UpgradePrompt';
import { Button } from './Button';
import { OutcomeGalleryLightbox } from './OutcomeGalleryLightbox';
import { OutcomeVideoThumbnail } from './OutcomeVideoThumbnail';
import {
  MAX_OUTCOME_VIDEOS_PER_REHEARSAL,
  addRehearsalOutcomeVideoLink,
  deleteRehearsalOutcomeVideo,
  formatOutcomeVideoUploadError,
  uploadRehearsalOutcomeVideo,
  validateOutcomeVideoFile,
} from '../api/rehearsalOutcomeVideos';
import {
  outcomeVideoProviderLabel,
  parseEmbeddableVideoLink,
} from '../../shared/outcomeVideoEmbed';
import type { GalleryMediaEntry } from '../utils/rehearsalOutcomeGallery';

interface RehearsalOutcomeVideosPanelProps {
  rehearsal: Rehearsal;
  readOnly?: boolean;
}

export function RehearsalOutcomeVideosPanel({
  rehearsal,
  readOnly = false,
}: RehearsalOutcomeVideosPanelProps) {
  const { dispatch } = useRehearsalStore();
  const { isPro } = useSubscription();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const videos = rehearsal.outcomeVideoUrls ?? [];
  const slotsLeft = MAX_OUTCOME_VIDEOS_PER_REHEARSAL - videos.length;
  const atLimit = slotsLeft <= 0;

  const viewerItems: GalleryMediaEntry[] = videos.map((url) => ({
    kind: 'video',
    url,
    rehearsalId: rehearsal.id,
    rehearsalDate: rehearsal.date,
  }));

  const updateVideos = (outcomeVideoUrls: string[]) => {
    dispatch({
      type: 'UPDATE_REHEARSAL',
      payload: { ...rehearsal, outcomeVideoUrls },
    });
  };

  const handleUploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    if (atLimit) {
      setError(`Достигнут лимит: ${MAX_OUTCOME_VIDEOS_PER_REHEARSAL} видео на репетицию.`);
      return;
    }

    const allowedCount = Math.min(files.length, slotsLeft);
    const filesToUpload = files.slice(0, allowedCount);
    if (files.length > allowedCount) {
      setError(
        `Выбрано ${files.length} файлов — загрузим ${allowedCount} (лимит ${MAX_OUTCOME_VIDEOS_PER_REHEARSAL}).`
      );
    } else {
      setError(null);
    }

    setUploading(true);
    let nextUrls = [...videos];
    let firstError: string | null = null;

    for (let index = 0; index < filesToUpload.length; index += 1) {
      const file = filesToUpload[index]!;
      setUploadProgress({ current: index + 1, total: filesToUpload.length });

      const validationError = validateOutcomeVideoFile(file);
      if (validationError) {
        firstError = `${file.name}: ${validationError}`;
        continue;
      }

      try {
        const uploaded = await uploadRehearsalOutcomeVideo(rehearsal.id, file);
        if (!nextUrls.includes(uploaded.url)) {
          nextUrls = [...nextUrls, uploaded.url];
          updateVideos(nextUrls);
        }
      } catch (uploadError) {
        firstError = formatOutcomeVideoUploadError(uploadError);
        break;
      }
    }

    if (firstError) setError(firstError);
    setUploading(false);
    setUploadProgress(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleAddLink = async () => {
    const trimmed = linkDraft.trim();
    if (!trimmed) {
      setError('Вставьте ссылку на видео.');
      return;
    }
    if (!parseEmbeddableVideoLink(trimmed)) {
      setError('Поддерживаются YouTube, Rutube, Vimeo и VK Видео.');
      return;
    }
    if (atLimit) {
      setError(`Достигнут лимит: ${MAX_OUTCOME_VIDEOS_PER_REHEARSAL} видео на репетицию.`);
      return;
    }

    setAddingLink(true);
    setError(null);
    try {
      const added = await addRehearsalOutcomeVideoLink(rehearsal.id, trimmed);
      if (!videos.includes(added.url)) {
        updateVideos([...videos, added.url]);
      }
      setLinkDraft('');
      setShowLinkForm(false);
    } catch (linkError) {
      setError(formatOutcomeVideoUploadError(linkError));
    } finally {
      setAddingLink(false);
    }
  };

  const handleDelete = async (url: string, index: number) => {
    setDeletingUrl(url);
    setError(null);
    try {
      await deleteRehearsalOutcomeVideo(rehearsal.id, url);
      const nextVideos = videos.filter((item) => item !== url);
      updateVideos(nextVideos);

      if (viewerIndex !== null) {
        if (nextVideos.length === 0) setViewerIndex(null);
        else if (index === viewerIndex) {
          setViewerIndex(Math.min(viewerIndex, nextVideos.length - 1));
        } else if (index < viewerIndex) {
          setViewerIndex(viewerIndex - 1);
        }
      }
    } catch (deleteError) {
      setError(formatOutcomeVideoUploadError(deleteError));
    } finally {
      setDeletingUrl(null);
    }
  };

  useEffect(() => {
    if (viewerIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setViewerIndex(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewerIndex]);

  if (!isPro) {
    return (
      <section className="rounded-2xl border border-gold/10 bg-surface/40 p-5">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Видео итога
        </h2>
        <UpgradePrompt
          compact
          title="Видео итога — Pro"
          description="До 10 роликов: загрузка до 30 МБ или ссылка с YouTube, Rutube, Vimeo и VK."
        />
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gold/10 bg-surface/40 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Видео итога</h2>
          <p className="mt-1 text-xs text-muted">
            {videos.length} / {MAX_OUTCOME_VIDEOS_PER_REHEARSAL}
            {uploadProgress
              ? ` · загрузка ${uploadProgress.current} из ${uploadProgress.total}`
              : ' · файл до 30 МБ или ссылка с хостинга'}
          </p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
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
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}
              {uploading
                ? uploadProgress
                  ? `${uploadProgress.current}/${uploadProgress.total}`
                  : '…'
                : 'Файл'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              disabled={addingLink || atLimit}
              onClick={() => {
                setShowLinkForm((value) => !value);
                setError(null);
              }}
            >
              <Link2 size={16} />
              Ссылка
            </Button>
          </div>
        )}
      </div>

      {!readOnly && showLinkForm && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={linkDraft}
            onChange={(event) => setLinkDraft(event.target.value)}
            placeholder="https://youtube.com/… или rutube.ru/video/…"
            className="min-w-0 flex-1 rounded-lg border border-gold/15 bg-background/50 px-3 py-2 text-sm"
            disabled={addingLink || atLimit}
          />
          <Button
            type="button"
            variant="primary"
            disabled={addingLink || atLimit}
            onClick={() => void handleAddLink()}
          >
            {addingLink ? <Loader2 size={16} className="animate-spin" /> : 'Добавить'}
          </Button>
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      {videos.length === 0 ? (
        <p className="text-sm text-muted">Пока нет видео итога репетиции.</p>
      ) : (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scroll-smooth snap-x snap-mandatory">
          {videos.map((url, index) => {
            const label = outcomeVideoProviderLabel(url);
            return (
              <div key={url} className="group relative shrink-0 snap-start">
                <button
                  type="button"
                  className="relative block h-20 w-32 overflow-hidden rounded-lg border border-gold/15 sm:h-24 sm:w-40"
                  onClick={() => setViewerIndex(index)}
                >
                  <OutcomeVideoThumbnail url={url} className="h-full w-full" />
                  {label && (
                    <span className="absolute bottom-1 left-1 z-[1] rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white/90">
                      {label}
                    </span>
                  )}
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
                    aria-label="Удалить видео"
                  >
                    {deletingUrl === url ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewerIndex !== null && viewerItems[viewerIndex] && (
        <OutcomeGalleryLightbox
          items={viewerItems}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
          footer={
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white"
              onClick={() => setViewerIndex(null)}
            >
              <X size={14} />
              Закрыть
            </button>
          }
        />
      )}
    </section>
  );
}
