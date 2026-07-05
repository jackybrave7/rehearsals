import { useEffect, useState } from 'react';
import { BookOpen, Pencil, ExternalLink, FileText, Upload, Plus, Archive, ArchiveRestore } from 'lucide-react';
import { DeleteButton } from '../components/DeleteButton';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useAuth } from '../store/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { generateId } from '../utils/id';
import { formatFileSize } from '../utils/file';
import { ImageCropField } from '../components/ImageCropField';
import { uploadFile } from '../api/files';
import { resolvePlayScriptUrl, resolveAssetUrl } from '../utils/fileUrls';
import type { Play } from '../types';
import { enrichPlayDocumentMeta } from '../utils/googleDocs';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import { Input, Textarea } from '../components/FormFields';
import { CastDistributionPanel } from '../components/CastDistributionPanel';
import { PlayIcon } from '../components/PlayIcon';
import { ArchivedPlaysMenu } from '../components/ArchivedPlaysMenu';
import {
  getActiveTheaterPlays,
  getArchivedTheaterPlays,
  getTheaterPlays,
} from '../store/selectors';
import { useHashScroll } from '../hooks/useHashScroll';
import { pageHeaderClass, pageTitleClass } from '../utils/pageLayout';
import {
  canCreateActivePlay,
  countOwnedActivePlays,
  getOwnedTheaterIdsFromAccess,
  isPlayReadOnly,
} from '../utils/subscription';

const emptyPlay = (): Omit<Play, 'id'> => ({
  title: '',
  author: '',
  description: '',
  coverUrl: undefined,
  iconUrl: undefined,
  iconColor: undefined,
  year: undefined,
  documentUrl: '',
  scriptFileName: undefined,
  scriptFileUrl: undefined,
  scriptFileDataUrl: undefined,
  scriptFileMimeType: undefined,
  scriptFileSize: undefined,
});

export function PlayPage() {
  const { state, dispatch } = useRehearsalStore();
  const { theaters: accessTheaters } = useAuth();
  const { isPro } = useSubscription();
  const { confirmDelete, alert } = useConfirmDialog();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPlay());
  const [fileError, setFileError] = useState<string | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [viewingPlayId, setViewingPlayId] = useState<string | null>(null);
  const theaterPlays = getTheaterPlays(state);
  const activePlays = getActiveTheaterPlays(state);
  const archivedPlays = getArchivedTheaterPlays(state);
  const ownedTheaterIds = getOwnedTheaterIdsFromAccess(accessTheaters);
  const ownedActivePlayCount = countOwnedActivePlays(state, ownedTheaterIds);

  const openCreate = async () => {
    if (!canCreateActivePlay(ownedActivePlayCount, isPro)) {
      await alert({
        title: 'Лимит тарифа Free',
        message:
          'На бесплатном тарифе доступна одна активная постановка. Архивируйте текущую или перейдите на Pro.',
        okLabel: 'Понятно',
      });
      return;
    }
    setEditingId(null);
    setForm(emptyPlay());
    setFileError(null);
    setIconError(null);
    setCoverError(null);
    setModalOpen(true);
  };

  const openEdit = (play: Play) => {
    setEditingId(play.id);
    setForm({
      ...play,
      documentUrl: play.documentUrl ?? '',
    });
    setFileError(null);
    setIconError(null);
    setCoverError(null);
    setModalOpen(true);
  };

  const handleIconCropped = async (file: File) => {
    setIconError(null);
    try {
      const uploaded = await uploadFile(file);
      setForm((current) => ({
        ...current,
        iconUrl: uploaded.url,
      }));
    } catch (error) {
      setIconError(
        error instanceof Error && error.message === 'FILE_TOO_LARGE'
          ? 'Файл слишком большой. Максимум — 5 МБ.'
          : 'Не удалось загрузить изображение.'
      );
    }
  };

  const removeIcon = () => {
    setForm((current) => ({
      ...current,
      iconUrl: undefined,
    }));
    setIconError(null);
  };

  const handleCoverCropped = async (file: File) => {
    setCoverError(null);
    try {
      const uploaded = await uploadFile(file);
      setForm((current) => ({
        ...current,
        coverUrl: uploaded.url,
      }));
    } catch (error) {
      setCoverError(
        error instanceof Error && error.message === 'FILE_TOO_LARGE'
          ? 'Файл слишком большой. Максимум — 5 МБ.'
          : 'Не удалось загрузить обложку.'
      );
    }
  };

  const removeCover = () => {
    setForm((current) => ({
      ...current,
      coverUrl: undefined,
    }));
    setCoverError(null);
  };

  const handleScriptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    try {
      const uploaded = await uploadFile(file);
      setForm((f) => ({
        ...f,
        scriptFileName: file.name,
        scriptFileUrl: uploaded.url,
        scriptFileDataUrl: undefined,
        scriptFileMimeType: uploaded.mimeType || file.type || undefined,
        scriptFileSize: uploaded.size,
      }));
    } catch (error) {
      setFileError(
        error instanceof Error && error.message === 'FILE_TOO_LARGE'
          ? 'Файл слишком большой. Максимум — 5 МБ.'
          : 'Не удалось загрузить файл. Проверьте подключение к API.'
      );
    }
    e.target.value = '';
  };

  const removeScriptFile = () => {
    setForm((f) => ({
      ...f,
      scriptFileName: undefined,
      scriptFileUrl: undefined,
      scriptFileDataUrl: undefined,
      scriptFileMimeType: undefined,
      scriptFileSize: undefined,
    }));
    setFileError(null);
  };

  const toggleArchive = (play: Play) => {
    const archiving = !play.archivedAt;
    if (archiving && !isPro) {
      const otherActive = state.plays.filter(
        (item) =>
          item.id !== play.id &&
          item.theaterId &&
          ownedTheaterIds.has(item.theaterId) &&
          !item.archivedAt
      ).length;
      if (otherActive > 0) return;
    }
    if (!archiving && !canCreateActivePlay(ownedActivePlayCount, isPro)) {
      void alert({
        title: 'Лимит тарифа Free',
        message: 'Сначала архивируйте активную постановку или перейдите на Pro.',
        okLabel: 'Понятно',
      });
      return;
    }
    dispatch({
      type: 'UPDATE_PLAY',
      payload: {
        ...play,
        archivedAt: archiving ? new Date().toISOString() : undefined,
      },
    });
    if (archiving && viewingPlayId === play.id) {
      setViewingPlayId(null);
    }
    if (!archiving) {
      setViewingPlayId(null);
      dispatch({ type: 'SET_ACTIVE_PLAY', payload: play.id });
    }
  };

  const handleSave = () => {
    if (!form.title.trim() || !form.author.trim()) return;
    const play: Play = enrichPlayDocumentMeta({
      id: editingId ?? generateId(),
      ...form,
      theaterId: form.theaterId ?? state.activeTheaterId ?? undefined,
      year: form.year ? Number(form.year) : undefined,
      documentUrl: form.documentUrl?.trim() || undefined,
    });
    if (editingId) {
      dispatch({ type: 'UPDATE_PLAY', payload: play });
    } else {
      dispatch({ type: 'ADD_PLAY', payload: play });
    }
    setModalOpen(false);
  };

  const handleDelete = async (play: Play) => {
    const confirmed = await confirmDelete({
      title: `Удалить постановку «${play.title}»?`,
      message: 'Постановка и все её сцены будут удалены без возможности восстановления.',
      confirmLabel: 'Удалить постановку',
    });
    if (!confirmed) return;
    dispatch({ type: 'DELETE_PLAY', payload: play.id });
  };

  const displayedPlayId =
    viewingPlayId && theaterPlays.some((play) => play.id === viewingPlayId)
      ? viewingPlayId
      : state.activePlayId && theaterPlays.some((play) => play.id === state.activePlayId)
        ? state.activePlayId
        : (activePlays[0]?.id ?? theaterPlays[0]?.id ?? null);

  const selectedPlay = theaterPlays.find((play) => play.id === displayedPlayId) ?? null;

  useHashScroll([displayedPlayId]);

  useEffect(() => {
    if (activePlays.length === 0) return;
    const isActiveValid =
      state.activePlayId !== null && activePlays.some((play) => play.id === state.activePlayId);
    if (!isActiveValid) {
      dispatch({ type: 'SET_ACTIVE_PLAY', payload: activePlays[0].id });
    }
  }, [activePlays, state.activePlayId, dispatch]);

  useEffect(() => {
    if (!viewingPlayId) return;
    if (!archivedPlays.some((play) => play.id === viewingPlayId)) {
      setViewingPlayId(null);
    }
  }, [archivedPlays, viewingPlayId]);

  const selectActivePlay = (playId: string) => {
    setViewingPlayId(null);
    dispatch({ type: 'SET_ACTIVE_PLAY', payload: playId });
  };

  const selectArchivedPlay = (playId: string) => {
    setViewingPlayId(playId);
  };

  return (
    <div className="space-y-6">
      <header className={pageHeaderClass}>
        <div>
          <h1 className={pageTitleClass}>Постановки</h1>
          <p className="mt-1 text-muted">
            {isPro ? 'Несколько спектаклей в работе одновременно' : 'На Free — одна активная постановка'}
          </p>
        </div>
        <Button onClick={() => void openCreate()}>
          <Plus size={18} />
          Добавить постановку
        </Button>
      </header>

      {!isPro && (
        <UpgradePrompt
          compact
          title="Нужен второй спектакль?"
          description="На Pro — без лимита постановок и театров, плюс шаблоны и авто-напоминания."
        />
      )}

      {theaterPlays.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-12 text-center">
          <BookOpen size={48} className="mx-auto text-gold/30" />
          <p className="mt-4 text-muted">Добавьте постановку, чтобы начать планирование сцен</p>
          <Button className="mt-4" onClick={() => void openCreate()}>
            Добавить постановку
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {(activePlays.length > 1 || archivedPlays.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 border-b border-gold/10 pb-1">
              {activePlays.map((play) => (
                <button
                  key={play.id}
                  type="button"
                  onClick={() => selectActivePlay(play.id)}
                  className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm transition-colors ${
                    !viewingPlayId && displayedPlayId === play.id
                      ? 'bg-gold/15 text-gold-light'
                      : 'text-muted hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <PlayIcon play={play} size="sm" />
                  «{play.title}»
                </button>
              ))}
              {archivedPlays.length > 0 && (
                <ArchivedPlaysMenu
                  plays={archivedPlays}
                  selectedPlayId={viewingPlayId}
                  onSelect={selectArchivedPlay}
                />
              )}
            </div>
          )}

          {selectedPlay && (() => {
            const play = selectedPlay;
            const playReadOnly = isPlayReadOnly(play);
            const sceneCount = state.scenes.filter((s) => s.playId === play.id).length;
            const roleCount = state.playRoles.filter(
              (r) => r.playId === play.id && r.kind === 'character'
            ).length;
            const performanceCount = state.performances.filter((p) => p.playId === play.id).length;
            const coverSrc = resolveAssetUrl(play.coverUrl);

            return (
              <div className="overflow-hidden rounded-2xl border border-gold/30 bg-surface/80">
                {coverSrc && (
                  <img src={coverSrc} alt="" className="aspect-video w-full object-cover" />
                )}
                <div className="p-6">
                {playReadOnly && (
                  <p className="mb-4 rounded-xl border border-border bg-background/40 px-4 py-3 text-sm text-muted">
                    Архивная постановка — только просмотр. Нажмите «Восстановить», чтобы снова редактировать
                    состав и сцены.
                  </p>
                )}
                <div className="flex items-start gap-5">
                  <PlayIcon play={play} size="lg" className="!h-14 !w-14 !text-lg" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold text-white">«{play.title}»</h2>
                    <p className="mt-1 text-gold-light">{play.author}</p>
                    {play.year && <p className="text-sm text-muted">{play.year} год</p>}
                    {play.description && (
                      <p className="mt-3 max-w-2xl text-sm text-muted leading-relaxed">
                        {play.description}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted">
                      {roleCount} ролей · {performanceCount} показов · {sceneCount} сцен
                    </p>

                    {(play.documentUrl || play.scriptFileName) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {play.documentUrl && (
                          <a
                            href={play.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gold/20 bg-background/40 px-3 py-2 text-xs text-gold-light transition-colors hover:border-gold/40"
                          >
                            <ExternalLink size={14} />
                            Онлайн-документ
                          </a>
                        )}
                        {play.scriptFileName && resolvePlayScriptUrl(play) && (
                          <a
                            href={resolvePlayScriptUrl(play)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gold/20 bg-background/40 px-3 py-2 text-xs text-gold-light transition-colors hover:border-gold/40"
                          >
                            <FileText size={14} />
                            {play.scriptFileName}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-start gap-0.5">
                    <Button
                      variant="ghost"
                      className="!px-3 !py-1.5 text-sm"
                      onClick={() => toggleArchive(play)}
                    >
                      {play.archivedAt ? (
                        <>
                          <ArchiveRestore size={16} />
                          Восстановить
                        </>
                      ) : (
                        <>
                          <Archive size={16} />
                          В архив
                        </>
                      )}
                    </Button>
                    {!playReadOnly && (
                      <>
                        <Button
                          variant="ghost"
                          className="!px-3 !py-1.5 text-sm"
                          onClick={() => openEdit(play)}
                        >
                          <Pencil size={16} />
                          Редактировать
                        </Button>
                        <DeleteButton
                          label={`Удалить постановку «${play.title}»`}
                          className="mt-1.5"
                          onClick={() => handleDelete(play)}
                        />
                      </>
                    )}
                  </div>
                </div>
                <CastDistributionPanel playId={play.id} readOnly={playReadOnly} />
                {playReadOnly && (
                  <p className="mt-3 text-xs text-muted">
                    Чтобы назначать исполнителей, восстановите постановку из архива.
                  </p>
                )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Редактировать постановку' : 'Новая постановка'}
        wide
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave}>Сохранить</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Название"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Каменное сердце"
          />
          <Input
            label="Автор"
            value={form.author}
            onChange={(e) => setForm({ ...form, author: e.target.value })}
            placeholder="Тами Айрис"
          />
          <Input
            label="Год"
            type="number"
            value={form.year ?? ''}
            onChange={(e) =>
              setForm({ ...form, year: e.target.value ? Number(e.target.value) : undefined })
            }
          />
          <Textarea
            label="Описание"
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="space-y-3 rounded-xl border border-gold/10 bg-background/20 p-4">
            <p className="text-sm font-medium text-white">Аватар постановки</p>
            <p className="text-xs text-muted">
              Круглое изображение для переключателя постановок и календаря репетиций
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <PlayIcon
                play={{
                  id: editingId ?? undefined,
                  title: form.title || 'Постановка',
                  iconUrl: form.iconUrl,
                  iconColor: form.iconColor,
                }}
                size="lg"
                className="!h-14 !w-14 !text-lg"
              />
              <div className="flex flex-wrap gap-2">
                <ImageCropField
                  title="Аватар постановки"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gold/25 px-3 py-2 text-sm text-gold-light transition-colors hover:border-gold/40 hover:bg-gold/5"
                  onPickError={setIconError}
                  onCropped={handleIconCropped}
                >
                  <Upload size={16} />
                  {form.iconUrl ? 'Заменить' : 'Загрузить'}
                </ImageCropField>
                {form.iconUrl && (
                  <Button variant="secondary" className="!px-3 !py-2 text-sm" onClick={removeIcon}>
                    Убрать
                  </Button>
                )}
              </div>
            </div>
            <Input
              label="Цвет заглушки (если нет изображения)"
              value={form.iconColor ?? ''}
              onChange={(e) => setForm({ ...form, iconColor: e.target.value || undefined })}
              placeholder="#b45309"
            />
            {iconError && <p className="text-sm text-red-400">{iconError}</p>}
          </div>

          <div className="space-y-3 rounded-xl border border-gold/10 bg-background/20 p-4">
            <p className="text-sm font-medium text-white">Обложка постановки</p>
            <p className="text-xs text-muted">
              Прямоугольное изображение для карточки на странице «Все постановки»
            </p>
            {form.coverUrl && resolveAssetUrl(form.coverUrl) && (
              <img
                src={resolveAssetUrl(form.coverUrl)!}
                alt=""
                className="aspect-video w-full max-w-md rounded-xl object-cover"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <ImageCropField
                title="Обложка постановки"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gold/25 px-3 py-2 text-sm text-gold-light transition-colors hover:border-gold/40 hover:bg-gold/5"
                onPickError={setCoverError}
                onCropped={handleCoverCropped}
              >
                <Upload size={16} />
                {form.coverUrl ? 'Заменить обложку' : 'Загрузить обложку'}
              </ImageCropField>
              {form.coverUrl && (
                <Button variant="secondary" className="!px-3 !py-2 text-sm" onClick={removeCover}>
                  Убрать
                </Button>
              )}
            </div>
            {coverError && <p className="text-sm text-red-400">{coverError}</p>}
          </div>

          <Input
            label="Ссылка на онлайн-документ"
            type="url"
            value={form.documentUrl ?? ''}
            onChange={(e) => setForm({ ...form, documentUrl: e.target.value })}
            placeholder="https://docs.google.com/document/d/..."
          />
          <p className="-mt-2 text-xs text-muted">
            Google Docs, Яндекс.Документы или другая ссылка на текст пьесы
          </p>

          <div className="space-y-2">
            <p className="text-sm text-muted">Файл с пьесой</p>
            {form.scriptFileName ? (
              <div className="flex items-center justify-between rounded-lg border border-gold/20 bg-background/40 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText size={18} className="shrink-0 text-gold" />
                  <span className="truncate text-sm text-white">{form.scriptFileName}</span>
                  {form.scriptFileSize != null && (
                    <span className="shrink-0 text-xs text-muted">
                      ({formatFileSize(form.scriptFileSize)})
                    </span>
                  )}
                </div>
                <DeleteButton label="Убрать файл" onClick={removeScriptFile} />
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gold/25 px-4 py-4 text-sm text-muted transition-colors hover:border-gold/40 hover:bg-gold/5">
                <Upload size={18} className="text-gold" />
                Загрузить файл (PDF, DOC, DOCX, TXT — до 5 МБ)
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.rtf,application/pdf,text/plain"
                  className="hidden"
                  onChange={handleScriptFile}
                />
              </label>
            )}
            {fileError && <p className="text-sm text-red-400">{fileError}</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
}
