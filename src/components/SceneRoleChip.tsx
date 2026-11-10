import { useEffect, useId, useRef, useState } from 'react';

interface SceneRoleChipProps {
  roleName: string;
  performanceName: string;
  actorNames: string[];
}

export function SceneRoleChip({ roleName, performanceName, actorNames }: SceneRoleChipProps) {
  const castLabel = actorNames.length > 0 ? actorNames.join(', ') : 'Актёр не назначен';
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <span ref={rootRef} className="group/role relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        className="rounded bg-gold/10 px-1.5 py-0.5 text-[10px] text-gold-light transition-colors hover:bg-gold/20"
      >
        {roleName}
      </button>
      <span
        id={popoverId}
        role="tooltip"
        className={`absolute bottom-[calc(100%+6px)] left-1/2 z-20 w-max max-w-[220px] -translate-x-1/2 rounded-lg border border-gold/20 bg-surface px-2.5 py-1.5 text-left shadow-lg transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover/role:opacity-100'
        }`}
      >
        <span className="block text-[10px] text-muted">{performanceName}</span>
        <span className="block text-xs text-white">{castLabel}</span>
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-surface" />
      </span>
    </span>
  );
}
