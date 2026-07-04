import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { SceneWorkHistoryEntry } from '../utils/sceneRehearsalHistory';
import { DecidedNotesDisplay } from './DecidedNotesDisplay';

function historyCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} репетиция`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} репетиции`;
  return `${count} репетиций`;
}

interface SceneWorkHistoryPanelProps {
  history: SceneWorkHistoryEntry[];
}

export function SceneWorkHistoryPanel({ history }: SceneWorkHistoryPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (history.length === 0) return null;

  const latest = history[0];

  return (
    <div className="scene-work-history mt-2 rounded-lg border border-gold/10 bg-background/20 text-xs text-muted">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted/70 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
        />
        <span className="text-[10px] uppercase tracking-wide text-muted/70">История работы</span>
        <span className="text-muted/50">·</span>
        <span className="min-w-0 truncate text-muted">
          {expanded
            ? 'Свернуть'
            : `${historyCountLabel(history.length)} · ${format(parseISO(latest.rehearsal.date), 'd MMM yyyy', { locale: ru })}`}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-gold/10 px-2 py-2">
          {history.map(({ rehearsal, block, participants }) => (
            <div key={`${rehearsal.id}:${block.id}`} className="space-y-0.5">
              <p className="text-white/80">
                {format(parseISO(rehearsal.date), 'd MMM yyyy', { locale: ru })} · {block.startTime}
              </p>
              {participants && (
                <p>
                  {participants.label}: {participants.text}
                </p>
              )}
              {block.decidedNotes?.trim() && (
                <p>
                  Решения: <DecidedNotesDisplay text={block.decidedNotes.trim()} />
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
