import { useMemo, useState } from 'react';
import { Link2, Loader2, LogOut, RefreshCw } from 'lucide-react';
import type { Play, Scene } from '../types';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useGoogleDocsAuth } from '../hooks/useGoogleDocsAuth';
import { syncSceneAnchorsFromGoogleDoc, syncSceneCharacterCountsFromGoogleDoc, resolveGoogleDocsSyncError, GoogleDocsClientError } from '../services/googleDocsClient';
import { isGoogleDocsUrl, isLikelyUploadedOfficeDoc } from '../utils/googleDocs';
import { resolveSceneTimingSettings } from '../utils/sceneTiming';
import { Button } from './Button';

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
  const auth = useGoogleDocsAuth();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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

  if (!play.documentUrl || !isGoogleDocsUrl(play.documentUrl)) {
    return null;
  }

  const syncedAtLabel = formatSyncDate(play.googleDocsLinksSyncedAt);
  const likelyOfficeUpload = isLikelyUploadedOfficeDoc(play.documentUrl);

  const applyCharacterCounts = async (scenesForCount: Scene[], token: string): Promise<number> => {
    if (!play.documentUrl) return 0;
    const counts = await syncSceneCharacterCountsFromGoogleDoc(
      play.documentUrl,
      scenesForCount,
      token
    );
    if (counts.size === 0) return 0;

    const settings = resolveSceneTimingSettings(state.appMeta);
    dispatch({
      type: 'APPLY_SCENE_CHARACTER_COUNTS',
      payload: {
        playId: play.id,
        syncedAt: new Date().toISOString(),
        applyRehearsalMinutes: settings.autoFillRehearsalMinutes,
        updates: [...counts.entries()].map(([sceneId, characterCount]) => ({
          sceneId,
          characterCount,
        })),
      },
    });
    return counts.size;
  };

  const handleSync = async () => {
    setSyncMessage(null);
    setSyncError(null);
    setIsSyncing(true);

    try {
      if (!play.documentUrl) {
        setSyncError('У постановки не указан Google Docs URL.');
        return;
      }
      const token = await auth.getAccessToken();
      if (!token) {
        setSyncError('Не удалось получить доступ Google.');
        return;
      }

      const { matches, anchorCount } = await syncSceneAnchorsFromGoogleDoc(
        play.documentUrl,
        scenes,
        token
      );

      if (matches.length === 0) {
        setSyncError(
          anchorCount === 0
            ? 'В документе не найдены заголовки. Оформите названия сцен как заголовки (H1–H6) в Google Docs.'
            : 'Не удалось сопоставить заголовки документа со сценами. Проверьте названия.'
        );
        return;
      }

      const syncedAt = new Date().toISOString();
      dispatch({
        type: 'APPLY_SCENE_SCRIPT_ANCHORS',
        payload: {
          playId: play.id,
          syncedAt,
          updates: matches.map((match) => ({
            sceneId: match.sceneId,
            scriptAnchor: match.anchor,
          })),
        },
      });

      const scenesWithAnchors = scenes.map((scene) => {
        const match = matches.find((item) => item.sceneId === scene.id);
        return match ? { ...scene, scriptAnchor: match.anchor } : scene;
      });
      const counted = await applyCharacterCounts(scenesWithAnchors, token);

      setSyncMessage(
        (matches.length === scenes.length
          ? `Сопоставлено ${matches.length} из ${scenes.length} сцен (в документе ${anchorCount} заголовков).`
          : `Сопоставлено ${matches.length} из ${scenes.length} сцен. В документе ${anchorCount} заголовков — часть из них не сцены (например, «Действие первое»). Проверьте названия несопоставленных сцен.`) +
          (counted > 0 ? ` Подсчитаны знаки для ${counted} сцен.` : '')
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

  const handleCountCharacters = async () => {
    setSyncMessage(null);
    setSyncError(null);
    setIsSyncing(true);

    try {
      if (!play.documentUrl) {
        setSyncError('У постановки не указан Google Docs URL.');
        return;
      }
      const token = await auth.getAccessToken();
      if (!token) {
        setSyncError('Не удалось получить доступ Google.');
        return;
      }

      const anchored = scenes.filter((scene) => scene.scriptAnchor);
      if (anchored.length === 0) {
        setSyncError('Сначала сопоставьте сцены с заголовками документа.');
        return;
      }

      const counted = await applyCharacterCounts(scenes, token);
      if (counted === 0) {
        setSyncError('Не удалось извлечь текст сцен из документа. Проверьте заголовки.');
        return;
      }

      setSyncMessage(`Подсчитаны знаки для ${counted} сцен.`);
    } catch (error) {
      if (error instanceof GoogleDocsClientError && error.code === 'AUTH_EXPIRED') {
        auth.signOut();
      }
      setSyncError(resolveGoogleDocsSyncError(error));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gold/10 bg-surface/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Link2 size={16} className="text-gold" />
            Ссылки на текст (Google Docs)
          </h2>
          <p className="mt-1 text-xs text-muted">
            {linkedCount > 0
              ? `Привязано ${linkedCount} из ${scenes.length} сцен`
              : 'Сопоставьте сцены с заголовками документа для быстрого открытия фрагмента текста'}
            {countedCount > 0 ? ` · хронометраж для ${countedCount} сцен` : ''}
            {syncedAtLabel ? ` · обновлено ${syncedAtLabel}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!auth.isConfigured ? (
            <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Добавьте VITE_GOOGLE_CLIENT_ID в .env
            </span>
          ) : !auth.accessToken ? (
            <Button variant="secondary" onClick={() => auth.signIn()} disabled={auth.isRequesting}>
              {auth.isRequesting ? <Loader2 size={16} className="animate-spin" /> : null}
              Войти в Google
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={handleSync} disabled={isSyncing || scenes.length === 0}>
                {isSyncing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Ссылки и хронометраж
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
      </div>

      {(likelyOfficeUpload || auth.error || syncError || syncMessage) && (
        <div className="mt-3 space-y-1 text-xs">
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
        <div className="mt-3 space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted">
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
    </section>
  );
}
