import { useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Loader2, RefreshCw } from 'lucide-react';
import type { Play, Scene } from '../types';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useDesign } from '../store/DesignContext';
import {
  fetchGoogleDocAnchorsForLinks,
  resolveGoogleDocsSyncError,
} from '../services/googleDocsClient';
import {
  isGoogleDocsUrl,
  isLikelyUploadedOfficeDoc,
  listImportableScenesWithActGroups,
  mapActAnchorsFromDocument,
  mapActGroupsToMatchedScenes,
  matchScenesToDocAnchors,
  prepareGoogleSceneLinkMatches,
} from '../utils/googleDocs';
import { mergeMissingScenesFromImport } from '../utils/scriptDocument';
import { buildSceneNumberUpdates, resolveSceneNumberFromTitle } from '../utils/sceneNumbering';
import { DEFAULT_SCENE_REHEARSAL_MINUTES } from '../utils/sceneDefaults';
import { generateId } from '../utils/id';
import { Button } from './Button';
import { Modal } from './Modal';

interface GoogleDocsLinksPanelProps {
  play: Play;
  scenes: Scene[];
}

function formatSyncDate(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return null;
  }
}

export function GoogleDocsLinksPanel({ play, scenes }: GoogleDocsLinksPanelProps) {
  const { state, dispatch } = useRehearsalStore();
  const { isZen } = useDesign();
  const [modalOpen, setModalOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const autoSyncAttemptedRef = useRef<string | null>(null);

  const hasGoogleDocs = Boolean(play.documentUrl && isGoogleDocsUrl(play.documentUrl));

  const linkedCount = useMemo(
    () => scenes.filter((scene) => scene.scriptAnchor).length,
    [scenes]
  );
  const countedCount = useMemo(
    () => scenes.filter((scene) => scene.scriptCharacterCount && scene.scriptCharacterCount > 0).length,
    [scenes]
  );

  const syncedAtLabel = formatSyncDate(play.googleDocsLinksSyncedAt);
  const likelyOfficeUpload = hasGoogleDocs ? isLikelyUploadedOfficeDoc(play.documentUrl!) : false;

  const handleSync = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setSyncMessage(null);
      setSyncError(null);
    }
    setIsSyncing(true);

    try {
      if (!play.documentUrl) {
        if (!options?.silent) setSyncError('У постановки не указан Google Docs URL.');
        return;
      }

      const { anchors, anchorCount } = await fetchGoogleDocAnchorsForLinks(play.documentUrl);

      let targetScenes = scenes;
      let createdCount = 0;

      if (targetScenes.length === 0) {
        const sceneAnchors = listImportableScenesWithActGroups(anchors);
        if (sceneAnchors.length === 0) {
          if (!options?.silent) {
            setSyncError(
              anchors.length === 0
                ? 'В документе не найдены заголовки. Оформите названия сцен как заголовки (H1–H6) в Google Docs.'
                : 'В документе нет заголовков сцен — только акты/действия. Оформите сцены как «Сцена 1», «Сцена 2» и т.д.'
            );
          }
          return;
        }

        const createdScenes: Scene[] = sceneAnchors.map(({ anchor, actGroup }, index) => ({
          id: generateId(),
          playId: play.id,
          number: resolveSceneNumberFromTitle(anchor.text, index + 1),
          title: anchor.text,
          actGroup,
          status: 'not_started',
          priority: 'medium',
          roleIds: [],
          estimatedMinutes: DEFAULT_SCENE_REHEARSAL_MINUTES,
        }));
        createdScenes.forEach((scene) => dispatch({ type: 'ADD_SCENE', payload: scene }));
        targetScenes = createdScenes;
        createdCount = createdScenes.length;
      }

      let matches = matchScenesToDocAnchors(targetScenes, anchors);

      if (targetScenes.length > 0) {
        const { toAdd, toUpdate, allScenes } = mergeMissingScenesFromImport(
          play.id,
          targetScenes,
          anchors,
          matches
        );
        if (toAdd.length > 0 || toUpdate.length > 0) {
          toAdd.forEach((scene) => dispatch({ type: 'ADD_SCENE', payload: scene }));
          toUpdate.forEach((scene) => dispatch({ type: 'UPDATE_SCENE', payload: scene }));
          createdCount += toAdd.length;
          targetScenes = allScenes;
          matches = matchScenesToDocAnchors(targetScenes, anchors);
        }
      }

      const { matches: linkMatches, scriptGoogleSceneAnchors } = prepareGoogleSceneLinkMatches(
        targetScenes,
        anchors
      );
      const actGroups = mapActGroupsToMatchedScenes(anchors, linkMatches);
      const actScriptAnchors = mapActAnchorsFromDocument(anchors);
      const keepFileSceneAnchors = Boolean(play.scriptFileUrl);

      if (linkMatches.length === 0) {
        if (!options?.silent) {
          setSyncError(
            anchorCount === 0
              ? 'В документе не найдены заголовки. Оформите названия сцен как заголовки (H1–H6) в Google Docs.'
              : keepFileSceneAnchors
                ? 'Не удалось сопоставить сцены с заголовками Google Docs. Проверьте, что каждая сцена оформлена как заголовок (H1–H6), например «Сцена 1. Метро».'
                : 'Не удалось сопоставить заголовки документа со сценами. Проверьте названия.'
          );
        }
        return;
      }

      const syncedAt = new Date().toISOString();
      if (scriptGoogleSceneAnchors.length > 0) {
        dispatch({
          type: 'UPDATE_PLAY',
          payload: { ...play, scriptGoogleSceneAnchors },
        });
      }

      if (!keepFileSceneAnchors) {
        dispatch({
          type: 'APPLY_SCENE_SCRIPT_ANCHORS',
          payload: {
            playId: play.id,
            syncedAt,
            importSource: 'google',
            actScriptAnchors,
            updates: linkMatches.map((match) => ({
              sceneId: match.sceneId,
              scriptAnchor: match.anchor,
              actGroup: actGroups.get(match.sceneId),
            })),
          },
        });
      }

      const latestPlayScenes = [
        ...targetScenes,
        ...state.scenes.filter(
          (scene) =>
            scene.playId === play.id && !targetScenes.some((item) => item.id === scene.id)
        ),
      ];
      for (const scene of buildSceneNumberUpdates(scenes, latestPlayScenes, play.id)) {
        dispatch({ type: 'UPDATE_SCENE', payload: scene });
      }

      if (!options?.silent) {
        setSyncMessage(
          (createdCount > 0 ? `Создано ${createdCount} сцен из документа. ` : '') +
            (linkMatches.length === targetScenes.length
              ? `Сопоставлено ${linkMatches.length} из ${targetScenes.length} сцен (в документе ${anchorCount} заголовков).`
              : `Сопоставлено ${linkMatches.length} из ${targetScenes.length} сцен. В документе ${anchorCount} заголовков — часть из них не сцены (например, «Действие первое»). Проверьте названия несопоставленных сцен.`) +
            (play.scriptFileUrl
              ? ' Знаки и хронометраж — через «Импорт из файла».'
              : ' Для подсчёта знаков загрузите .docx в карточке постановки.')
        );
      }
    } catch (error) {
      const message = resolveGoogleDocsSyncError(error);
      if (!options?.silent || message) {
        setSyncError(message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (
      !hasGoogleDocs ||
      likelyOfficeUpload ||
      linkedCount > 0 ||
      play.googleDocsLinksSyncedAt ||
      autoSyncAttemptedRef.current === play.id
    ) {
      return;
    }

    autoSyncAttemptedRef.current = play.id;
    void handleSync({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-sync once per play when document is linked
  }, [hasGoogleDocs, likelyOfficeUpload, linkedCount, play.googleDocsLinksSyncedAt, play.id]);

  if (!hasGoogleDocs) {
    return null;
  }

  const triggerHint = linkedCount > 0 ? `${linkedCount} из ${scenes.length} привязано` : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
          isZen
            ? 'border-border/60 text-muted hover:bg-black/[0.03] hover:text-foreground'
            : 'border-gold/15 text-muted hover:bg-white/5 hover:text-white'
        }`}
      >
        <Link2 size={16} className={isZen ? 'text-accent' : 'text-gold'} />
        Google Docs
        {triggerHint ? (
          <span className="max-w-[12rem] truncate text-xs font-normal opacity-80">· {triggerHint}</span>
        ) : null}
      </button>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Ссылки на текст (Google Docs)"
        wide
        footer={
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Закрыть
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {linkedCount > 0
              ? `Привязано ${linkedCount} из ${scenes.length} сцен`
              : scenes.length === 0
                ? 'Можно создать сцены из заголовков документа'
                : 'Сопоставьте сцены с заголовками документа для быстрого открытия фрагмента текста'}
            {countedCount > 0 ? ` · хронометраж для ${countedCount} сцен` : ''}
            {syncedAtLabel ? ` · обновлено ${syncedAtLabel}` : ''}
          </p>

          <p className="rounded-lg border border-gold/15 bg-gold/5 px-3 py-2 text-xs text-muted">
            Документ должен быть <strong className="text-white">публичным</strong>: «Настройки доступа» →
            «Все, у кого есть ссылка» → «Читатель». Вход в Google не нужен.
            {play.scriptFileUrl
              ? ' Знаки, описания и режим «Учить текст» — из загруженного .docx («Импорт из файла»).'
              : ' Для знаков и режима «Учить текст» скачайте документ как .docx и загрузите в карточке постановки.'}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={scenes.length === 0 ? 'primary' : 'secondary'}
              onClick={() => void handleSync()}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {scenes.length === 0 ? 'Импортировать сцены' : 'Сопоставить ссылки'}
            </Button>
          </div>

          {(likelyOfficeUpload || syncError || syncMessage) && (
            <div className="space-y-1 text-sm">
              {likelyOfficeUpload && !syncError && (
                <p className="text-amber-200">
                  Похоже, это загруженный Word, а не Google Документ. Для сопоставления ссылок сохраните его как
                  Google Документ (Файл → «Сохранить как Google Документ») и обновите ссылку в постановке.
                </p>
              )}
              {syncError && <p className="text-red-300">{syncError}</p>}
              {syncMessage && <p className="text-emerald-300">{syncMessage}</p>}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
