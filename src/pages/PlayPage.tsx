import { useEffect, useState } from 'react';
import { BookOpen, Pencil, ExternalLink, FileText, Upload, Plus } from 'lucide-react';
import { DeleteButton } from '../components/DeleteButton';
import { useRehearsalStore } from '../store/RehearsalContext';
import { generateId } from '../utils/id';
import { formatFileSize } from '../utils/file';
import { uploadFile } from '../api/files';
import { resolvePlayScriptUrl } from '../utils/fileUrls';
import type { Play } from '../types';
import { enrichPlayDocumentMeta } from '../utils/googleDocs';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import { Input, Textarea } from '../components/FormFields';
import { CastDistributionPanel } from '../components/CastDistributionPanel';
import { getTheaterPlays } from '../store/selectors';
import { useHashScroll } from '../hooks/useHashScroll';
import { pageHeaderClass, pageTitleClass } from '../utils/pageLayout';

const emptyPlay = (): Omit<Play, 'id'> => ({
  title: '',
  author: '',
  description: '',
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
  const { confirmDelete } = useConfirmDialog();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPlay());
  const [fileError, setFileError] = useState<string | null>(null);
  const theaterPlays = getTheaterPlays(state);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyPlay());
    setFileError(null);
    setModalOpen(true);
  };

  const openEdit = (play: Play) => {
    setEditingId(play.id);
    setForm({
      ...play,
      documentUrl: play.documentUrl ?? '',
    });
    setFileError(null);
    setModalOpen(true);
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

  const selectedPlayId =
    state.activePlayId && theaterPlays.some((p) => p.id === state.activePlayId)
      ? state.activePlayId
      : (theaterPlays[0]?.id ?? null);

  const selectedPlay = theaterPlays.find((p) => p.id === selectedPlayId) ?? null;

  useHashScroll([selectedPlayId]);

  useEffect(() => {
    if (theaterPlays.length === 0) return;
    const isValid =
      state.activePlayId !== null && theaterPlays.some((p) => p.id === state.activePlayId);
    if (!isValid) {
      dispatch({ type: 'SET_ACTIVE_PLAY', payload: theaterPlays[0].id });
    }
  }, [theaterPlays, state.activePlayId, dispatch]);

  const selectPlay = (playId: string) => {
    dispatch({ type: 'SET_ACTIVE_PLAY', payload: playId });
  };

  return (
    <div className="space-y-6">
      <header className={pageHeaderClass}>
        <div>
          <h1 className={pageTitleClass}>Постановки</h1>
          <p className="mt-1 text-muted">Несколько спектаклей в работе одновременно</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} />
          Добавить постановку
        </Button>
      </header>

      {theaterPlays.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-12 text-center">
          <BookOpen size={48} className="mx-auto text-gold/30" />
          <p className="mt-4 text-muted">Добавьте постановку, чтобы начать планирование сцен</p>
          <Button className="mt-4" onClick={openCreate}>
            Добавить постановку
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {theaterPlays.length > 1 && (
            <div className="flex flex-wrap gap-2 border-b border-gold/10 pb-1">
              {theaterPlays.map((play) => (
                <button
                  key={play.id}
                  type="button"
                  onClick={() => selectPlay(play.id)}
                  className={`rounded-t-lg px-4 py-2.5 text-sm transition-colors ${
                    selectedPlayId === play.id
                      ? 'bg-gold/15 text-gold-light'
                      : 'text-muted hover:bg-white/5 hover:text-white'
                  }`}
                >
                  «{play.title}»
                </button>
              ))}
            </div>
          )}

          {selectedPlay && (() => {
            const play = selectedPlay;
            const sceneCount = state.scenes.filter((s) => s.playId === play.id).length;
            const roleCount = state.playRoles.filter(
              (r) => r.playId === play.id && r.kind === 'character'
            ).length;
            const performanceCount = state.performances.filter((p) => p.playId === play.id).length;

            return (
              <div className="rounded-2xl border border-gold/30 bg-surface/80 p-6">
                <div className="flex items-start gap-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold">
                    <BookOpen size={28} />
                  </div>
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
                  </div>
                </div>
                <CastDistributionPanel playId={play.id} />
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
