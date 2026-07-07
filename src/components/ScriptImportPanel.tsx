import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Loader2, RefreshCw, Upload } from 'lucide-react';
import type { Play, Scene } from '../types';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useDesign } from '../store/DesignContext';
import { uploadFile, formatFileUploadError } from '../api/files';
import { parseScriptImport, resolveScriptImportError } from '../services/scriptImportClient';
import {
  isFileSectionAnchor,
  isSupportedScriptImportFile,
  parseScriptFileId,
} from '../utils/scriptDocument';
import { listImportableScenesWithActGroups, mapActAnchorsFromDocument, mapActGroupsToMatchedScenes } from '../utils/googleDocs';
import { enrichPlayDocumentMeta } from '../utils/googleDocs';
import { DEFAULT_SCENE_REHEARSAL_MINUTES } from '../utils/sceneDefaults';
import { resolveSceneTimingSettings } from '../utils/sceneTiming';
import { generateId } from '../utils/id';
import { appPaths } from '../navigation/appPaths';
import { Button } from './Button';
import { Modal } from './Modal';

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
  const { isZen } = useDesign();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
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

  const characterRoles = useMemo(
    () => state.playRoles.filter((role) => role.playId === play.id && role.kind === 'character'),
    [play.id, state.playRoles]
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
      setSyncMessage(
        scenes.length === 0
          ? `Файл «${file.name}» загружен. Нажмите «Импортировать сцены», чтобы создать список из заголовков файла.`
          : `Файл «${file.name}» загружен. Нажмите «Сопоставить сцены», чтобы привязать заголовки.`
      );
    } catch (error) {
      setSyncError(formatFileUploadError(error));
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

    setIsSyncing(true);
    try {
      let targetScenes = scenes;
      let createdCount = 0;

      if (targetScenes.length === 0) {
        const { anchors } = await parseScriptImport(currentFileId, [], characterRoles);
        const sceneAnchors = listImportableScenesWithActGroups(anchors);
        if (sceneAnchors.length === 0) {
          setSyncError(
            anchors.length === 0
              ? 'В файле не найдены заголовки сцен. Оформите названия как отдельные строки: «АКТ 1, сц. 2» или стили «Заголовок» в Word.'
              : 'В файле нет заголовков сцен — только акты/действия. Оформите сцены как «Сцена 1», «АКТ 1, сц. 2» и т.д.'
          );
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

      const { matches, anchorCount, characterCounts, descriptions, roleIds, anchors } =
        await parseScriptImport(currentFileId, targetScenes, characterRoles);

      if (matches.length === 0) {
        setSyncError(
          anchorCount === 0
            ? 'В файле не найдены заголовки сцен. Оформите названия как отдельные строки: «АКТ 1, сц. 2» или стили «Заголовок» в Word.'
            : 'Не удалось сопоставить заголовки файла со сценами. Проверьте названия.'
        );
        return;
      }

      const syncedAt = new Date().toISOString();
      const actGroups = mapActGroupsToMatchedScenes(anchors, matches);
      const actScriptAnchors = mapActAnchorsFromDocument(anchors);
      dispatch({
        type: 'APPLY_SCENE_SCRIPT_ANCHORS',
        payload: {
          playId: play.id,
          syncedAt,
          importSource: 'file',
          actScriptAnchors,
          updates: matches.map((match) => ({
            sceneId: match.sceneId,
            scriptAnchor: match.anchor,
            actGroup: actGroups.get(match.sceneId),
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

      const descriptionEntries = Object.entries(descriptions ?? {}).filter(
        ([, value]) => value.trim().length > 0
      );
      if (descriptionEntries.length > 0) {
        dispatch({
          type: 'APPLY_SCENE_DESCRIPTIONS',
          payload: {
            playId: play.id,
            onlyIfEmpty: true,
            updates: descriptionEntries.map(([sceneId, description]) => ({
              sceneId,
              description,
            })),
          },
        });
      }

      const roleEntries = Object.entries(roleIds ?? {}).filter(([, value]) => value.length > 0);
      if (roleEntries.length > 0) {
        dispatch({
          type: 'APPLY_SCENE_ROLE_IDS',
          payload: {
            playId: play.id,
            onlyIfEmpty: true,
            updates: roleEntries.map(([sceneId, ids]) => ({
              sceneId,
              roleIds: ids,
            })),
          },
        });
      }

      setSyncMessage(
        (createdCount > 0
          ? `Создано ${createdCount} сцен из файла. `
          : '') +
          (matches.length === targetScenes.length
            ? `Сопоставлено ${matches.length} из ${targetScenes.length} сцен (в файле ${anchorCount} заголовков).`
            : `Сопоставлено ${matches.length} из ${targetScenes.length} сцен. В файле ${anchorCount} заголовков — часть из них не сцены.`) +
          (countEntries.length > 0 ? ` Подсчитаны знаки для ${countEntries.length} сцен.` : '') +
          (descriptionEntries.length > 0
            ? ` Краткие описания для ${descriptionEntries.length} сцен.`
            : '') +
          (roleEntries.length > 0 ? ` Персонажи для ${roleEntries.length} сцен.` : '')
      );
    } catch (error) {
      setSyncError(resolveScriptImportError(error));
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerHint = play.scriptFileName
    ? play.scriptFileName
    : linkedCount > 0
      ? `${linkedCount} из ${scenes.length} привязано`
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
        <FileText size={16} className={isZen ? 'text-accent' : 'text-gold'} />
        Импорт из файла
        {triggerHint ? (
          <span className="max-w-[12rem] truncate text-xs font-normal opacity-80">· {triggerHint}</span>
        ) : null}
      </button>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Импорт из файла (.txt / .docx)"
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
            Без Google: скачайте пьесу из Google Docs как Word или текст и загрузите сюда.
            {linkedCount > 0
              ? ` Привязано ${linkedCount} из ${scenes.length} сцен`
              : scenes.length === 0
                ? ' Можно создать сцены из заголовков файла'
                : ' Сопоставление по заголовкам «АКТ», «сц.» и стилям Word'}
            {countedCount > 0 ? ` · хронометраж для ${countedCount} сцен` : ''}
            {syncedAtLabel ? ` · обновлено ${syncedAtLabel}` : ''}
          </p>
          {play.scriptFileName ? (
            <p className="text-sm text-muted">
              Файл: <span className="text-foreground">{play.scriptFileName}</span>
            </p>
          ) : (
            <p className="text-sm text-muted">
              Или загрузите сценарий в{' '}
              <Link to={appPaths.play} className="text-gold-light hover:underline">
                карточке постановки
              </Link>
              .
            </p>
          )}

          {!readOnly && (
            <div className="flex flex-wrap gap-2">
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
                disabled={isSyncing || !fileId}
              >
                {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {scenes.length === 0 ? 'Импортировать сцены' : 'Сопоставить сцены'}
              </Button>
            </div>
          )}

          {(syncError || syncMessage) && (
            <div className="space-y-1 text-sm">
              {syncError && <p className="text-red-300">{syncError}</p>}
              {syncMessage && <p className="text-emerald-300">{syncMessage}</p>}
            </div>
          )}

          <div
            className={`rounded-lg border p-3 text-sm text-muted ${
              isZen ? 'border-border/60 bg-black/[0.02]' : 'border-gold/10 bg-black/20'
            }`}
          >
            <p className="font-medium text-foreground">Как подготовить файл</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>В Google Docs: Файл → Скачать → Microsoft Word (.docx) или Обычный текст (.txt).</li>
              <li>Названия сцен — отдельными строками, как в списке сцен (лучше стиль «Заголовок 1–2» в Word).</li>
              <li>Загрузите файл и нажмите «Импортировать сцены» — список сцен создастся из заголовков (или «Сопоставить», если сцены уже есть).</li>
            </ol>
          </div>
        </div>
      </Modal>
    </>
  );
}
