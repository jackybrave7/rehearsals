import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Rehearsal } from '../types';
import { useRehearsalStore } from '../store/RehearsalContext';
import { Textarea } from './FormFields';
import { Button } from './Button';
import {
  buildRehearsalSummaryFromDecidedNotes,
  countScheduleBlocksWithDecidedNotes,
} from '../utils/rehearsalDecidedNotesSummary';

interface RehearsalSummaryNotesPanelProps {
  rehearsal: Rehearsal;
  readOnly?: boolean;
}

export function RehearsalSummaryNotesPanel({
  rehearsal,
  readOnly = false,
}: RehearsalSummaryNotesPanelProps) {
  const { dispatch } = useRehearsalStore();
  const [draft, setDraft] = useState(rehearsal.notes ?? '');
  const [savedHint, setSavedHint] = useState(false);

  useEffect(() => {
    setDraft(rehearsal.notes ?? '');
  }, [rehearsal.id, rehearsal.notes]);

  const generated = useMemo(
    () => buildRehearsalSummaryFromDecidedNotes(rehearsal.schedule),
    [rehearsal.schedule]
  );
  const decidedBlockCount = useMemo(
    () => countScheduleBlocksWithDecidedNotes(rehearsal.schedule),
    [rehearsal.schedule]
  );

  const isDirty = draft !== (rehearsal.notes ?? '');

  const saveNotes = () => {
    const trimmed = draft.trim();
    dispatch({
      type: 'UPDATE_REHEARSAL',
      payload: { ...rehearsal, notes: trimmed || undefined },
    });
    setSavedHint(true);
    window.setTimeout(() => setSavedHint(false), 2000);
  };

  const collectFromBlocks = (mode: 'replace' | 'append') => {
    if (!generated) return;
    const current = draft.trim();
    if (mode === 'append' && current) {
      setDraft(`${current}\n\n${generated}`);
      return;
    }
    setDraft(generated);
  };

  return (
    <section className="rounded-2xl border border-gold/10 bg-surface/40 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Общий комментарий к репетиции
          </h2>
          <p className="mt-1 text-xs text-muted">
            Итог для себя и команды. Можно собрать из «Решений и заметок» по блокам плана (
            {decidedBlockCount} {decidedBlockCount === 1 ? 'блок' : 'блоков'}).
          </p>
        </div>
        {!readOnly && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!generated}
              onClick={() => collectFromBlocks('replace')}
              title={
                generated
                  ? 'Подставить собранный текст вместо текущего'
                  : 'Заполните «Решения и корректировки» в блоках плана'
              }
            >
              <Sparkles size={16} />
              Собрать из плана
            </Button>
            {draft.trim() && generated ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => collectFromBlocks('append')}
                title="Добавить собранный текст в конец"
              >
                Добавить в конец
              </Button>
            ) : null}
          </div>
        )}
      </div>

      {readOnly ? (
        draft.trim() ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{draft}</p>
        ) : (
          <p className="text-sm text-muted">Комментарий не заполнен.</p>
        )
      ) : (
        <>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={6}
            placeholder="Итоги репетиции, что решили, на что обратить внимание…"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button type="button" disabled={!isDirty} onClick={saveNotes}>
              Сохранить
            </Button>
            {savedHint && <span className="text-xs text-gold-light">Сохранено</span>}
            {isDirty && <span className="text-xs text-muted">Есть несохранённые изменения</span>}
          </div>
        </>
      )}
    </section>
  );
}
