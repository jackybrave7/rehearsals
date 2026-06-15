import type { AppState, Scene } from '../types';
import {
  formatSceneTimingDetail,
  formatSceneTimingSummary,
  getSceneTimingEstimate,
  resolveSceneTimingSettings,
} from '../utils/sceneTiming';

interface SceneTimingHintProps {
  scene: Scene;
  appMeta?: AppState['appMeta'];
  compact?: boolean;
  className?: string;
}

export function SceneTimingHint({ scene, appMeta, compact, className = '' }: SceneTimingHintProps) {
  const settings = resolveSceneTimingSettings(appMeta);
  const estimate = getSceneTimingEstimate(scene, settings);

  if (estimate.effectiveCharCount <= 0) {
    if (compact) return null;
    return (
      <p className={`text-xs text-muted/70 ${className}`}>
        Хронометраж: добавьте текст в описание или синхронизируйте Google Docs
      </p>
    );
  }

  const text = compact ? formatSceneTimingSummary(estimate) : formatSceneTimingDetail(estimate);

  return (
    <p
      className={`text-xs text-muted/90 ${className}`}
      title={`${estimate.effectiveCharCount.toLocaleString('ru-RU')} печатных знаков с пробелами`}
    >
      {text}
    </p>
  );
}

export function getSuggestedRehearsalMinutes(
  scene: Scene,
  appMeta?: AppState['appMeta']
): number {
  const settings = resolveSceneTimingSettings(appMeta);
  return getSceneTimingEstimate(scene, settings).rehearsalMinutes;
}
