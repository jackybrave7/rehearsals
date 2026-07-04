import { useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Loader2, LogOut, RefreshCw } from 'lucide-react';
import type { Play, Scene } from '../types';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useDesign } from '../store/DesignContext';
import { useGoogleDocsAuth } from '../store/GoogleDocsAuthContext';
import { syncSceneAnchorsFromGoogleDoc, fetchGoogleDocAnchors, loadGoogleDocumentSceneInsights, resolveGoogleDocsSyncError, GoogleDocsClientError } from '../services/googleDocsClient';
import { isGoogleDocsUrl, isLikelyUploadedOfficeDoc, listImportableScenesWithActGroups, mapActAnchorsFromDocument, mapActGroupsToMatchedScenes } from '../utils/googleDocs';
import { DEFAULT_SCENE_REHEARSAL_MINUTES } from '../utils/sceneDefaults';
import { generateId } from '../utils/id';
import { resolveSceneTimingSettings } from '../utils/sceneTiming';
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
  const auth = useGoogleDocsAuth();
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

  const appOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const syncedAtLabel = formatSyncDate(play.googleDocsLinksSyncedAt);
  const likelyOfficeUpload = hasGoogleDocs ? isLikelyUploadedOfficeDoc(play.documentUrl!) : false;

  const characterRoles = useMemo(
    () => state.playRoles.filter((role) => role.playId === play.id && role.kind === 'character'),
    [play.id, state.playRoles]
  );

  const applySceneInsights = async (
    scenesForInsights: Scene[],
    token: string
  ): Promise<{ counted: number; described: number; rostered: number }> => {
    if (!play.documentUrl) return { counted: 0, described: 0, rostered: 0 };
    const insights = await loadGoogleDocumentSceneInsights(
      play.documentUrl,
      scenesForInsights,
      token,
      characterRoles,
      play.id
    );

    if (insights.characterCounts.size > 0) {
      const settings = resolveSceneTimingSettings(state.appMeta);
      dispatch({
        type: 'APPLY_SCENE_CHARACTER_COUNTS',
        payload: {
          playId: play.id,
          syncedAt: new Date().toISOString(),
          applyRehearsalMinutes: settings.autoFillRehearsalMinutes,
          updates: [...insights.characterCounts.entries()].map(([sceneId, characterCount]) => ({
            sceneId,
            characterCount,
          })),
        },
      });
    }

    if (insights.descriptions.size > 0) {
      dispatch({
        type: 'APPLY_SCENE_DESCRIPTIONS',
        payload: {
          playId: play.id,
          onlyIfEmpty: true,
          updates: [...insights.descriptions.entries()].map(([sceneId, description]) => ({
            sceneId,
            description,
          })),
        },
      });
    }

    if (insights.roleIds.size > 0) {
      dispatch({
        type: 'APPLY_SCENE_ROLE_IDS',
        payload: {
          playId: play.id,
          onlyIfEmpty: true,
          updates: [...insights.roleIds.entries()].map(([sceneId, roleIds]) => ({
            sceneId,
            roleIds,
          })),
        },
      });
    }

    return {
      counted: insights.characterCounts.size,
      described: insights.descriptions.size,
      rostered: insights.roleIds.size,
    };
  };

  const handleSync = async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setSyncMessage(null);
      setSyncError(null);
    } else {
      setSyncMessage(null);
      setSyncError(null);
    }
    setIsSyncing(true);

    try {
      if (!play.documentUrl) {
        if (!options?.silent) setSyncError('У постановки не указан Google Docs URL.');
        return;
      }
      const token = await auth.getAccessToken({ interactive: true });
      if (!token) {
        if (!options?.silent) setSyncError('Не удалось получить доступ Google.');
        return;
      }

      let targetScenes = scenes;
      let createdCount = 0;

      if (targetScenes.length === 0) {
        const { anchors } = await fetchGoogleDocAnchors(play.documentUrl, token);
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
          number: index + 1,
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

      const { matches, anchorCount, anchors } = await syncSceneAnchorsFromGoogleDoc(
        play.documentUrl,
        targetScenes,
        token
      );
      const actGroups = mapActGroupsToMatchedScenes(anchors, matches);
      const actScriptAnchors = mapActAnchorsFromDocument(anchors);

      if (matches.length === 0) {
        if (!options?.silent) {
          setSyncError(
            anchorCount === 0
              ? 'В документе не найдены заголовки. Оформите названия сцен как заголовки (H1–H6) в Google Docs.'
              : 'Не удалось сопоставить заголовки документа со сценами. Проверьте названия.'
          );
        }
        return;
      }

      const syncedAt = new Date().toISOString();
      dispatch({
        type: 'APPLY_SCENE_SCRIPT_ANCHORS',
        payload: {
          playId: play.id,
          syncedAt,
          importSource: 'google',
          actScriptAnchors,
          updates: matches.map((match) => ({
            sceneId: match.sceneId,
            scriptAnchor: match.anchor,
            actGroup: actGroups.get(match.sceneId),
          })),
        },
      });

      const scenesWithAnchors = targetScenes.map((scene) => {
        const match = matches.find((item) => item.sceneId === scene.id);
        return match ? { ...scene, scriptAnchor: match.anchor } : scene;
      });
      const { counted, described, rostered } = await applySceneInsights(scenesWithAnchors, token);

      setSyncMessage(
        (createdCount > 0 ? `Создано ${createdCount} сцен из документа. ` : '') +
          (matches.length === targetScenes.length
          ? `Сопоставлено ${matches.length} из ${targetScenes.length} сцен (в документе ${anchorCount} заголовков).`
          : `Сопоставлено ${matches.length} из ${targetScenes.length} сцен. В документе ${anchorCount} заголовков — часть из них не сцены (например, «Действие первое»). Проверьте названия несопоставленных сцен.`) +
          (counted > 0 ? ` Подсчитаны знаки для ${counted} сцен.` : '') +
          (described > 0 ? ` Краткие описания для ${described} сцен.` : '') +
          (rostered > 0 ? ` Персонажи для ${rostered} сцен.` : '')
      );
    } catch (error) {
      if (error instanceof GoogleDocsClientError && error.code === 'AUTH_EXPIRED') {
        auth.signOut();
      }
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
      !auth.isConfigured ||
      !auth.accessToken ||
      likelyOfficeUpload ||
      linkedCount > 0 ||
      play.googleDocsLinksSyncedAt ||
      autoSyncAttemptedRef.current === play.id
    ) {
      return;
    }

    autoSyncAttemptedRef.current = play.id;
    void handleSync({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-sync once per play when token already exists
  }, [
    hasGoogleDocs,
    auth.isConfigured,
    auth.accessToken,
    likelyOfficeUpload,
    linkedCount,
    play.googleDocsLinksSyncedAt,
    play.id,
  ]);

  const handleCountCharacters = async () => {
    setSyncMessage(null);
    setSyncError(null);
    setIsSyncing(true);

    try {
      if (!play.documentUrl) {
        setSyncError('У постановки не указан Google Docs URL.');
        return;
      }
      const token = await auth.getAccessToken({ interactive: true });
      if (!token) {
        setSyncError('Не удалось получить доступ Google.');
        return;
      }

      const anchored = scenes.filter((scene) => scene.scriptAnchor);
      if (anchored.length === 0) {
        setSyncError('Сначала сопоставьте сцены с заголовками документа.');
        return;
      }

      const { counted, described, rostered } = await applySceneInsights(scenes, token);
      if (counted === 0 && described === 0 && rostered === 0) {
        setSyncError('Не удалось извлечь текст сцен из документа. Проверьте заголовки.');
        return;
      }

      setSyncMessage(
        (counted > 0 ? `Подсчитаны знаки для ${counted} сцен.` : '') +
          (described > 0 ? ` Краткие описания для ${described} сцен.` : '') +
          (rostered > 0 ? ` Персонажи для ${rostered} сцен.` : '')
      );
    } catch (error) {
      if (error instanceof GoogleDocsClientError && error.code === 'AUTH_EXPIRED') {
        auth.signOut();
      }
      setSyncError(resolveGoogleDocsSyncError(error));
    } finally {
      setIsSyncing(false);
    }
  };

  if (!hasGoogleDocs) {
    return null;
  }

  const triggerHint = linkedCount > 0
    ? `${linkedCount} из ${scenes.length} привязано`
    : !auth.isConfigured
      ? 'не настроено'
      : !auth.accessToken
        ? 'не подключено'
        : null;

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

          <div className="flex flex-wrap gap-2">
            {!auth.isConfigured ? (
              <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Добавьте VITE_GOOGLE_CLIENT_ID в .env
              </span>
            ) : !auth.accessToken ? (
              <Button
                variant={scenes.length === 0 ? 'primary' : 'secondary'}
                onClick={() => void auth.signIn()}
                disabled={auth.isRequesting}
              >
                {auth.isRequesting ? <Loader2 size={16} className="animate-spin" /> : null}
                Подключить Google Docs
              </Button>
            ) : (
              <>
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
                  {scenes.length === 0 ? 'Импортировать сцены' : 'Ссылки и хронометраж'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleCountCharacters}
                  disabled={isSyncing || linkedCount === 0}
                >
                  Подсчитать знаки
                </Button>
                <Button variant="ghost" onClick={auth.signOut} title="Выйти из Google">
                  <LogOut size={16} />
                </Button>
              </>
            )}
          </div>

          {(likelyOfficeUpload || auth.error || syncError || syncMessage) && (
            <div className="space-y-1 text-sm">
              {likelyOfficeUpload && !syncError && (
                <p className="text-amber-200">
                  Похоже, это загруженный Word, а не Google Документ. Для сопоставления ссылок сохраните его как
                  Google Документ (Файл → «Сохранить как Google Документ») и обновите ссылку в постановке.
                </p>
              )}
              {auth.error && <p className="text-red-300">{auth.error}</p>}
              {syncError && <p className="text-red-300">{syncError}</p>}
              {syncMessage && <p className="text-emerald-300">{syncMessage}</p>}
            </div>
          )}

          {(auth.error?.includes('OAuth Client ID') || !auth.isConfigured) && (
            <div
              className={`space-y-2 rounded-lg border p-3 text-sm text-muted ${
                isZen ? 'border-border/60 bg-black/[0.02]' : 'border-amber-500/20 bg-amber-500/5'
              }`}
            >
              <p className="font-medium text-amber-100">Настройка Google Cloud Console</p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>
                  <a
                    href="https://console.cloud.google.com/apis/library/docs.googleapis.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold-light hover:underline"
                  >
                    Включите Google Docs API
                  </a>
                </li>
                <li>
                  Credentials → Create credentials → OAuth client ID → тип{' '}
                  <strong className="text-white">Web application</strong>
                </li>
                <li>
                  Authorized JavaScript origins: добавьте{' '}
                  <code className="rounded bg-white/5 px-1">{appOrigin}</code>
                </li>
                <li>
                  Скопируйте Client ID в <code className="rounded bg-white/5 px-1">.env</code> как{' '}
                  <code className="rounded bg-white/5 px-1">VITE_GOOGLE_CLIENT_ID=...</code>
                </li>
                <li>Перезапустите приложение (restart.bat)</li>
              </ol>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
