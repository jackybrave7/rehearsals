import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { patchActorMemorization, fetchActorNotes, acknowledgeActorNote } from '../api/actorSelf';
import { Button } from '../components/Button';
import { MemorizationStatusBadge } from '../components/MemorizationStatusBadge';
import { useGoogleDocsAuth } from '../store/GoogleDocsAuthContext';
import { useAuth } from '../store/AuthContext';
import { useDesign } from '../store/DesignContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import type { MemorizationStatus, RehearsalActorNote } from '../types';
import { findLinkedActor, getActorRoleIds } from '../utils/actorProfile';
import { fetchSceneLearnText } from '../utils/fetchSceneLearnText';
import { resolveSceneScriptUrl } from '../utils/googleDocs';
import { getMemorizationStatus } from '../utils/memorization';
import { getScenePlayId } from '../utils/rehearsalPlays';
import { LearnLineText } from '../components/LearnLineText';
import { parseSceneLearnLines } from '../utils/sceneLearnLines';
import { getSceneShortLabel } from '../utils/sceneLabels';
import { formatNoteLabel } from '../utils/rehearsalActorNotes';
import { appPaths } from '../navigation/appPaths';
import { pageTitleClass } from '../utils/pageLayout';

const statusOptions: MemorizationStatus[] = ['not_started', 'learning', 'known'];

export function LearnScenePage() {
  const { sceneId } = useParams<{ sceneId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isZen } = useDesign();
  const { state, dispatch } = useRehearsalStore();
  const googleAuth = useGoogleDocsAuth();
  const theaterId = state.activeTheaterId;
  const linkedActor = findLinkedActor(state, user?.email, theaterId, user?.name);

  const scene = state.scenes.find((item) => item.id === sceneId);
  const playId = scene ? getScenePlayId(state, scene.id) : undefined;
  const play = playId ? state.plays.find((item) => item.id === playId) : undefined;
  const playRoles = useMemo(
    () => (playId ? state.playRoles.filter((role) => role.playId === playId) : []),
    [playId, state.playRoles]
  );
  const actorRoleIds = useMemo(
    () => (linkedActor ? getActorRoleIds(state, linkedActor.id) : new Set<string>()),
    [linkedActor, state]
  );

  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState(false);
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<MemorizationStatus>('not_started');
  const [savingStatus, setSavingStatus] = useState(false);
  const [sceneNotes, setSceneNotes] = useState<RehearsalActorNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [ackSavingId, setAckSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!linkedActor || !scene || !theaterId) {
      setSceneNotes([]);
      return;
    }
    let cancelled = false;
    setNotesLoading(true);
    void fetchActorNotes(theaterId)
      .then((notes) => {
        if (!cancelled) {
          setSceneNotes(notes.filter((note) => note.sceneId === scene.id));
        }
      })
      .catch(() => {
        if (!cancelled) setSceneNotes([]);
      })
      .finally(() => {
        if (!cancelled) setNotesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linkedActor, scene, theaterId]);

  const handleAcknowledgeNote = async (noteId: string) => {
    if (!theaterId) return;
    setAckSavingId(noteId);
    try {
      const updated = await acknowledgeActorNote(theaterId, noteId);
      setSceneNotes((current) =>
        current.map((note) => (note.id === updated.id ? updated : note))
      );
      dispatch({ type: 'MERGE_REHEARSAL_ACTOR_NOTES', payload: [updated] });
    } catch {
      setLoadError('Не удалось отметить замечание.');
    } finally {
      setAckSavingId(null);
    }
  };

  const scriptUrl = play && scene ? resolveSceneScriptUrl(play, scene) : null;

  useEffect(() => {
    if (!linkedActor || !scene) return;
    setStatus(getMemorizationStatus(linkedActor.memorizationByScene, scene.id));
  }, [linkedActor, scene]);

  useEffect(() => {
    if (!play || !scene) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setNeedsGoogleAuth(false);

    void (async () => {
      try {
        const token = googleAuth.accessToken;
        const result = await fetchSceneLearnText(play, scene, token, theaterId);
        if (cancelled) return;
        if (result.text) {
          setText(result.text);
        } else if (result.needsGoogleAuth) {
          setNeedsGoogleAuth(true);
          setText(null);
        } else {
          setText(null);
        }
      } catch {
        if (!cancelled) setLoadError('Не удалось загрузить текст сцены.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [play, scene, googleAuth.accessToken, theaterId]);

  const learnLines = useMemo(() => {
    if (!text || !play) return [];
    return parseSceneLearnLines(text, playRoles, play.id, actorRoleIds);
  }, [text, play, playRoles, actorRoleIds]);

  useEffect(() => {
    const actorLineIds = learnLines.filter((line) => line.isActorLine).map((line) => line.id);
    setHiddenLines(new Set(actorLineIds));
  }, [learnLines]);

  const toggleLine = (lineId: string) => {
    setHiddenLines((current) => {
      const next = new Set(current);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  };

  const hasActorLines = learnLines.some((line) => line.isActorLine);

  const showAll = () => setHiddenLines(new Set());
  const hideAll = () => {
    setHiddenLines(new Set(learnLines.filter((line) => line.isActorLine).map((line) => line.id)));
  };

  const allActorHidden =
    hasActorLines &&
    learnLines
      .filter((line) => line.isActorLine)
      .every((line) => hiddenLines.has(line.id));

  const handleStatusChange = async (next: MemorizationStatus) => {
    if (!linkedActor || !scene || !theaterId) return;
    setSavingStatus(true);
    try {
      const memorizationByScene = await patchActorMemorization(theaterId, scene.id, next);
      setStatus(next);
      dispatch({
        type: 'UPDATE_ACTOR',
        payload: { ...linkedActor, memorizationByScene },
      });
    } catch {
      setLoadError('Не удалось сохранить статус.');
    } finally {
      setSavingStatus(false);
    }
  };

  const sectionClass = isZen
    ? 'rounded-2xl border border-border/60 bg-surface p-4'
    : 'rounded-2xl border border-gold/10 bg-surface/40 p-4';

  const lineBaseClass = isZen
    ? 'rounded-lg px-3 py-2 text-sm leading-relaxed text-foreground'
    : 'rounded-lg px-3 py-2 text-sm leading-relaxed text-foreground';

  const blurClass = isZen
    ? 'select-none blur-[5px] text-foreground/40'
    : 'select-none blur-[5px] text-muted';

  if (!linkedActor) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">Профиль участника не найден.</p>
        <Link to={appPaths.my} className="text-sm text-gold-light hover:underline">
          ← Моё
        </Link>
      </div>
    );
  }

  if (!scene || !play) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">Сцена не найдена.</p>
        <button
          type="button"
          onClick={() => navigate(appPaths.my)}
          className="text-sm text-gold-light hover:underline"
        >
          ← Моё
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <header className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate(appPaths.my)}
          className={`mt-1 shrink-0 rounded-xl p-2 ${isZen ? 'text-foreground hover:bg-black/[0.04]' : 'text-gold-light hover:bg-white/5'}`}
          aria-label="Назад"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className={pageTitleClass}>Учить текст</h1>
          <p className="mt-1 truncate text-sm text-muted">{getSceneShortLabel(scene)}</p>
          <p className="truncate text-xs text-muted">«{play.title}»</p>
        </div>
        <MemorizationStatusBadge status={status} variant={isZen ? 'zen' : 'theater'} />
      </header>

      <section className={sectionClass}>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Мой статус</p>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((option) => (
            <button
              key={option}
              type="button"
              disabled={savingStatus}
              onClick={() => void handleStatusChange(option)}
              className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
                status === option
                  ? isZen
                    ? 'border-accent/50 bg-accent/10 text-foreground'
                    : 'border-gold/40 bg-gold/15 text-gold-light'
                  : isZen
                    ? 'border-border/60 bg-surface text-foreground hover:border-accent/30'
                    : 'border-gold/15 bg-black/20 text-muted hover:border-gold/30 hover:text-foreground'
              }`}
            >
              <MemorizationStatusBadge status={option} variant={isZen ? 'zen' : 'theater'} />
            </button>
          ))}
        </div>
      </section>

      {!notesLoading && sceneNotes.length > 0 && (
        <section className={sectionClass}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Замечания по сцене
          </p>
          <ul className="space-y-2">
            {sceneNotes.map((note) => {
              const rehearsal = state.rehearsals.find((item) => item.id === note.rehearsalId);
              return (
                <li
                  key={note.id}
                  className="rounded-lg border border-gold/10 bg-black/15 px-3 py-2 text-sm"
                >
                  <p className="mb-1 text-xs text-muted">
                    {formatNoteLabel(note, state.scenes, rehearsal?.date)}
                  </p>
                  <p className="whitespace-pre-wrap text-foreground">{note.text}</p>
                  {note.sentAt && (
                    <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={Boolean(note.acknowledgedAt)}
                        disabled={Boolean(note.acknowledgedAt) || ackSavingId === note.id}
                        onChange={() => void handleAcknowledgeNote(note.id)}
                        className="h-3.5 w-3.5 rounded border-gold/30 accent-gold"
                      />
                      учтено
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {loadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className={`${sectionClass} text-center text-sm text-muted`}>Загрузка текста…</div>
      ) : !text ? (
        <div className={`${sectionClass} space-y-3 text-sm`}>
          <p className={isZen ? 'text-foreground' : 'text-foreground'}>
            Текст сцены пока недоступен для режима заучивания.
          </p>
          {needsGoogleAuth && (
            <p className="text-muted">
              Текст в Google Docs — войдите в Google в настройках режиссёра или откройте документ
              напрямую.
            </p>
          )}
          {!scene.scriptAnchor && (
            <p className="text-muted">
              Сцена не привязана к фрагменту сценария. Попросите режиссёра синхронизировать сцены с
              текстом.
            </p>
          )}
          {scriptUrl && (
            <a
              href={scriptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 text-sm font-medium hover:underline ${isZen ? 'text-foreground' : 'text-gold-light'}`}
            >
              <ExternalLink size={14} />
              Открыть текст в документе
            </a>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">Нажмите на свою реплику, чтобы показать или скрыть</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={showAll} disabled={!hasActorLines}>
                <Eye size={14} className="mr-1 inline" />
                Показать все
              </Button>
              <Button variant="secondary" onClick={hideAll} disabled={!hasActorLines || allActorHidden}>
                <EyeOff size={14} className="mr-1 inline" />
                Скрыть все
              </Button>
            </div>
          </div>

          <div className={`${sectionClass} space-y-1`}>
            {!hasActorLines && (
              <p className="mb-2 text-xs text-muted">
                Ваши реплики не найдены в тексте — проверьте назначение роли в составе постановки.
              </p>
            )}
            {learnLines.map((line) => {
              const isHidden = line.isActorLine && hiddenLines.has(line.id);
              const isCue = line.kind === 'cue';
              const isDirection = line.kind === 'direction';
              const actorLineClass = line.isActorLine
                ? isZen
                  ? isHidden
                    ? 'bg-amber-50/60 ring-1 ring-amber-200/70'
                    : 'bg-amber-50 text-amber-950 ring-1 ring-amber-300/60'
                  : isHidden
                    ? 'bg-gold/5 ring-1 ring-gold/20'
                    : 'bg-gold/15 text-gold-light ring-1 ring-gold/30'
                : '';

              return (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => line.isActorLine && toggleLine(line.id)}
                  disabled={!line.isActorLine}
                  className={`block w-full text-left transition-colors ${
                    line.isActorLine
                      ? isZen
                        ? 'cursor-pointer hover:bg-amber-100/80'
                        : 'cursor-pointer hover:bg-gold/20'
                      : 'cursor-default'
                  } ${lineBaseClass} ${actorLineClass} ${
                    isCue && !line.isActorLine
                      ? isZen
                        ? 'font-semibold text-foreground'
                        : 'font-semibold text-gold-light'
                      : ''
                  } ${isDirection ? (isZen ? 'italic text-muted' : 'italic text-muted') : ''}`}
                >
                  <span className={isHidden ? blurClass : ''}>
                    <LearnLineText line={line} />
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
