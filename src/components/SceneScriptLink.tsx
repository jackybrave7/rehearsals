import { ExternalLink } from 'lucide-react';
import type { Play, Scene } from '../types';
import { resolveActScriptUrl, resolveSceneScriptUrl } from '../utils/googleDocs';

interface SceneScriptLinkProps {
  play: Play | undefined;
  scene: Scene;
  compact?: boolean;
  className?: string;
}

export function SceneScriptLink({ play, scene, compact, className = '' }: SceneScriptLinkProps) {
  const url = resolveSceneScriptUrl(play, scene);
  if (!url) return null;

  const hasAnchor = Boolean(scene.scriptAnchor);

  if (compact) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={hasAnchor ? 'Открыть сцену в тексте' : 'Открыть текст пьесы'}
        aria-label={hasAnchor ? 'Открыть сцену в тексте' : 'Открыть текст пьесы'}
        className={`inline-flex items-center rounded-md border border-gold/20 bg-gold/10 p-1 text-gold-light transition-colors hover:border-gold/40 hover:bg-gold/20 ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        <ExternalLink size={12} />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-lg border border-gold/20 bg-background/40 px-2.5 py-1 text-xs text-gold-light transition-colors hover:border-gold/40 ${className}`}
      onClick={(event) => event.stopPropagation()}
    >
      <ExternalLink size={14} />
      {hasAnchor ? 'Текст сцены' : 'Текст пьесы'}
    </a>
  );
}

interface ActScriptLinkProps {
  play: Play | undefined;
  actGroup: string;
  compact?: boolean;
  className?: string;
}

export function ActScriptLink({ play, actGroup, compact, className = '' }: ActScriptLinkProps) {
  const url = resolveActScriptUrl(play, actGroup);
  if (!url) return null;

  const hasAnchor = Boolean(play?.actScriptAnchors?.[actGroup]);

  if (compact) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={hasAnchor ? 'Открыть действие в тексте' : 'Открыть текст пьесы'}
        aria-label={hasAnchor ? 'Открыть действие в тексте' : 'Открыть текст пьесы'}
        className={`inline-flex items-center rounded-md border border-gold/20 bg-gold/10 p-1 text-gold-light transition-colors hover:border-gold/40 hover:bg-gold/20 ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        <ExternalLink size={12} />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-lg border border-gold/20 bg-background/40 px-2.5 py-1 text-xs text-gold-light transition-colors hover:border-gold/40 ${className}`}
      onClick={(event) => event.stopPropagation()}
    >
      <ExternalLink size={14} />
      {hasAnchor ? 'Текст действия' : 'Текст пьесы'}
    </a>
  );
}
