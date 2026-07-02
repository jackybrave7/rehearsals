import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Loader2, RefreshCw, Upload } from 'lucide-react';
import type { Play, Scene } from '../types';
import { useRehearsalStore } from '../store/RehearsalContext';
import { uploadFile } from '../api/files';
import { parseScriptImport, resolveScriptImportError } from '../services/scriptImportClient';
import {
  isFileSectionAnchor,
  isSupportedScriptImportFile,
  parseScriptFileId,
} from '../utils/scriptDocument';
import { enrichPlayDocumentMeta } from '../utils/googleDocs';
import { resolveSceneTimingSettings } from '../utils/sceneTiming';
import { appPaths } from '../navigation/appPaths';
import { Button } from './Button';

interface ScriptImportPanelProps {
  play: Play;
  scenes: Scene[];
  readOnly?: boolean;
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

export function ScriptImportPanel({ play, scenes, readOnly = false }: ScriptImportPanelProps) {
  const { state, dispatch } = useRehearsalStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileId = parseScriptFileId(play.scriptFileUrl);
  const syncedAtLabel = formatSyncDate(play.scriptImportSyncedAt);

  const linkedCount = useMemo(
    () => scenes.filter((scene) => scene.scriptAnchor && isFileSectionAnchor(scene.scriptAnchor)).length,
    [scenes]
  );
  const countedCount = useMemo(
    () => scenes.filter((scene) => scene.scriptCharacterCount && scene.scriptCharacterCount > 0).length,
    [scenes]
  );

  const uploadScriptFile = async (file: File) => {
    if (readOnly) return;
    if (!isSupportedScriptImportFile(file.name, file.type)) {
      setSyncError('Поддерживаются файлы .txt и .docx. В Google Docs: Файл → Скачать → Microsoft Word (.docx).');
      return;
    }

    setIsUploading(true);
    setSyncError(null);
    setSyncMessage(null);

    try {
      const uploaded = await uploadFile(file);
      const updatedPlay = enrichPlayDocumentMeta({
        ...play,
        scriptFileName: file.name,
        scriptFileUrl: uploaded.url,
        scriptFileDataUrl: undefined,
        scriptFileMimeType: uploaded.mimeType || file.type || undefined,
        scriptFileSize: uploaded.size,
        scriptImportSyncedAt: undefined,
      });
      dispatch({ type: 'UPDATE_PLAY', payload: updatedPlay });
      setSyncMessage(`Файл «${file.name}» загружен. Нажмите «Сопоставить сцены», чтобы привязать заголовки.`);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Не удалось загрузить файл');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSync = async () => {
    if (readOnly) return;
    setSyncMessage(null);
    setSyncError(null);

    const currentFileId = parseScriptFileId(play.scriptFileUrl);
    if (!currentFileId) {
      setSyncError('Сначала загрузите файл сценария (.txt или .docx).');
      return;
    }
    if (scenes.length === 0) {
      setSyncError('Добавьте сцены в списке выше.');
      return;
    }

    setIsSyncing(true);
    try {
      const { matches, anchorCount, characterCounts } = await parseScriptImport(currentFileId, scenes);

      if (matches.length === 0) {
        setSyncError(
          anchorCount === 0
            ? 'В файле не найдены заголовки сцен. Оформите названия как отдельные строки: «АКТ 1, сц. 2» или стили «Заголовок» в Word.'
            : 'Не удалось сопоставить заголовки файла со сценами. Проверьте названия.'
        );
        return;
      }

      const syncedAt = new Date().toISOString();
      dispatch({
        type: 'APPLY_SCENE_SCRIPT_ANCHORS',
        payload: {
          playId: play.id,
          syncedAt,
          importSource: 'file',
          updates: matches.map((match) => ({
            sceneId: match.sceneId,
            scriptAnchor: match.anchor,
          })),
        },
      });

      const settings = resolveSceneTimingSettings(state.appMeta);
      const countEntries = Object.entries(characterCounts).filter(([, value]) => value > 0);
      if (countEntries.length > 0) {
        dispatch({
          type: 'APPLY_SCENE_CHARACTER_COUNTS',
          payload: {
            playId: play.id,
            syncedAt,
            applyRehearsalMinutes: settings.autoFillRehearsalMinutes,
            updates: countEntries.map(([sceneId, characterCount]) => ({
              sceneId,
              characterCount,
            })),
          },
        });
      }

      setSyncMessage(
        (matches.length === scenes.length
          ? `Сопоставлено ${matches.length} из ${scenes.length} сцен (в файле ${anchorCount} заголовков).`
          : `Сопоставлено ${matches.length} из ${scenes.length} сцен. В файле ${anchorCount} заголовков — часть из них не сцены.`) +
          (countEntries.length > 0 ? ` Подсчитаны знаки для ${countEntries.length} сцен.` : '')
      );
    } catch (error) {
      setSyncError(resolveScriptImportError(error));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gold/10 bg-surface/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <FileText size={16} className="text-gold" />
            Импорт из файла (.txt / .docx)
          </h2>
          <p className="mt-1 text-xs text-muted">
            Без Google: скачайте пьесу из Google Docs как Word или текст и загрузите сюда.
            {linkedCount > 0
              ? ` Привязано ${linkedCount} из ${scenes.length} сцен`
              : ' Сопоставление по заголовкам «АКТ», «сц.» и стилям Word'}
            {countedCount > 0 ? ` · хронометраж для ${countedCount} сцен` : ''}
            {syncedAtLabel ? ` · обновлено ${syncedAtLabel}` : ''}
          </p>
          {play.scriptFileName ? (
            <p className="mt-1 text-xs text-muted">
              Файл: <span className="text-foreground">{play.scriptFileName}</span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">
              Или загрузите сценарий в{' '}
              <Link to={appPaths.play} className="text-gold-light hover:underline">
                карточке постановки
              </Link>
              .
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadScriptFile(file);
                }}
              />
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isSyncing}
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {play.scriptFileName ? 'Заменить файл' : 'Загрузить файл'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => void handleSync()}
                disabled={isSyncing || !fileId || scenes.length === 0}
              >
                {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Сопоставить сцены
              </Button>
            </>
          )}
        </div>
      </div>

      {(syncError || syncMessage) && (
        <div className="mt-3 space-y-1 text-xs">
          {syncError && <p className="text-red-300">{syncError}</p>}
          {syncMessage && <p className="text-emerald-300">{syncMessage}</p>}
        </div>
      )}

      <div className="mt-3 rounded-lg border border-gold/10 bg-black/20 p-3 text-xs text-muted">
        <p className="font-medium text-foreground">Как подготовить файл</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>В Google Docs: Файл → Скачать → Microsoft Word (.docx) или Обычный текст (.txt).</li>
          <li>Названия сцен — отдельными строками, как в списке сцен (лучше стиль «Заголовок 1–2» в Word).</li>
          <li>Загрузите файл и нажмите «Сопоставить сцены» — ссылки откроют файл на сервере.</li>
        </ol>
      </div>
    </section>
  );
}
