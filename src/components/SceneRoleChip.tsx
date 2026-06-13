interface SceneRoleChipProps {
  roleName: string;
  performanceName: string;
  actorNames: string[];
}

export function SceneRoleChip({ roleName, performanceName, actorNames }: SceneRoleChipProps) {
  const castLabel =
    actorNames.length > 0 ? actorNames.join(', ') : 'Актёр не назначен';

  return (
    <span className="group/role relative inline-flex">
      <span className="cursor-default rounded bg-gold/10 px-1.5 py-0.5 text-[10px] text-gold-light">
        {roleName}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-20 w-max max-w-[220px] -translate-x-1/2 rounded-lg border border-gold/20 bg-surface px-2.5 py-1.5 text-left opacity-0 shadow-lg transition-opacity group-hover/role:opacity-100"
      >
        <span className="block text-[10px] text-muted">{performanceName}</span>
        <span className="block text-xs text-white">{castLabel}</span>
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-surface" />
      </span>
    </span>
  );
}
