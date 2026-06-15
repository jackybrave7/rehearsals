import type { AppState, Scene } from '../types';

export interface SceneTimingSettings {
  /** Печатных знаков с пробелами в одном авторском листе */
  charsPerAuthorPage: number;
  /** Минут в спектакле на один а.л. */
  performanceMinutesPerAuthorPage: number;
  /** Во сколько раз репетиция длиннее спектакля */
  rehearsalMultiplier: number;
  /** Подставлять «на репетицию» при синхронизации из Google Docs */
  autoFillRehearsalMinutes: boolean;
}

export const DEFAULT_SCENE_TIMING_SETTINGS: SceneTimingSettings = {
  charsPerAuthorPage: 1800,
  performanceMinutesPerAuthorPage: 2.5,
  rehearsalMultiplier: 3,
  autoFillRehearsalMinutes: true,
};

export type SceneTimingSource = 'google-docs' | 'description' | 'none';

export interface SceneTimingEstimate {
  descriptionCharCount: number;
  docsCharCount?: number;
  effectiveCharCount: number;
  authorPages: number;
  performanceMinutes: number;
  rehearsalMinutes: number;
  source: SceneTimingSource;
}

export function resolveSceneTimingSettings(
  appMeta: AppState['appMeta']
): SceneTimingSettings {
  const stored = appMeta?.sceneTiming;
  return {
    charsPerAuthorPage: stored?.charsPerAuthorPage ?? DEFAULT_SCENE_TIMING_SETTINGS.charsPerAuthorPage,
    performanceMinutesPerAuthorPage:
      stored?.performanceMinutesPerAuthorPage ??
      DEFAULT_SCENE_TIMING_SETTINGS.performanceMinutesPerAuthorPage,
    rehearsalMultiplier:
      stored?.rehearsalMultiplier ?? DEFAULT_SCENE_TIMING_SETTINGS.rehearsalMultiplier,
    autoFillRehearsalMinutes:
      stored?.autoFillRehearsalMinutes ?? DEFAULT_SCENE_TIMING_SETTINGS.autoFillRehearsalMinutes,
  };
}

/** Печатные знаки с пробелами (как в авторском листе). */
export function countScriptCharacters(text: string | undefined | null): number {
  if (!text) return 0;
  return text.replace(/\s+/g, ' ').trim().length;
}

export function authorPagesFromCharCount(charCount: number, settings: SceneTimingSettings): number {
  if (charCount <= 0 || settings.charsPerAuthorPage <= 0) return 0;
  return charCount / settings.charsPerAuthorPage;
}

export function estimatePerformanceMinutes(
  charCount: number,
  settings: SceneTimingSettings = DEFAULT_SCENE_TIMING_SETTINGS
): number {
  if (charCount <= 0) return 0;
  const pages = authorPagesFromCharCount(charCount, settings);
  return Math.max(1, Math.round(pages * settings.performanceMinutesPerAuthorPage));
}

export function estimateRehearsalMinutes(
  charCount: number,
  settings: SceneTimingSettings = DEFAULT_SCENE_TIMING_SETTINGS
): number {
  const performance = estimatePerformanceMinutes(charCount, settings);
  if (performance <= 0) return 0;
  return Math.max(1, Math.round(performance * settings.rehearsalMultiplier));
}

export function estimateRehearsalMinutesFromPerformance(
  performanceMinutes: number,
  settings: SceneTimingSettings = DEFAULT_SCENE_TIMING_SETTINGS
): number {
  if (performanceMinutes <= 0) return 0;
  return Math.max(1, Math.round(performanceMinutes * settings.rehearsalMultiplier));
}

export function getSceneTimingEstimate(
  scene: Scene,
  settings: SceneTimingSettings = DEFAULT_SCENE_TIMING_SETTINGS
): SceneTimingEstimate {
  const descriptionCharCount = countScriptCharacters(scene.description);
  const docsCharCount =
    scene.scriptCharacterCount && scene.scriptCharacterCount > 0
      ? scene.scriptCharacterCount
      : undefined;

  const useDocs =
    docsCharCount !== undefined && scene.scriptAnchor !== undefined && docsCharCount > 0;
  const effectiveCharCount = useDocs ? docsCharCount : descriptionCharCount;
  const source: SceneTimingSource =
    effectiveCharCount <= 0 ? 'none' : useDocs ? 'google-docs' : 'description';

  const authorPages = authorPagesFromCharCount(effectiveCharCount, settings);
  const performanceMinutes = estimatePerformanceMinutes(effectiveCharCount, settings);
  const rehearsalMinutes = estimateRehearsalMinutesFromPerformance(performanceMinutes, settings);

  return {
    descriptionCharCount,
    docsCharCount,
    effectiveCharCount,
    authorPages,
    performanceMinutes,
    rehearsalMinutes,
    source,
  };
}

export function formatCharCount(count: number): string {
  return count.toLocaleString('ru-RU');
}

export function formatAuthorPages(pages: number): string {
  if (pages <= 0) return '0 а.л.';
  if (pages < 0.1) return '<0,1 а.л.';
  return `${pages.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} а.л.`;
}

export function formatSceneTimingSummary(estimate: SceneTimingEstimate): string {
  if (estimate.effectiveCharCount <= 0) return '';
  const pages = formatAuthorPages(estimate.authorPages);
  return `~${estimate.performanceMinutes} мин спектакль · ~${estimate.rehearsalMinutes} мин репетиция (${pages})`;
}

export function formatSceneTimingDetail(estimate: SceneTimingEstimate): string {
  if (estimate.effectiveCharCount <= 0) return 'Добавьте текст в описание или синхронизируйте Google Docs';
  const chars = formatCharCount(estimate.effectiveCharCount);
  const pages = formatAuthorPages(estimate.authorPages);
  const sourceLabel =
    estimate.source === 'google-docs'
      ? 'Google Docs'
      : estimate.source === 'description'
        ? 'описание'
        : '';
  return `${chars} зн. · ${pages} · ~${estimate.performanceMinutes} мин спектакль · ~${estimate.rehearsalMinutes} мин репетиция${sourceLabel ? ` (${sourceLabel})` : ''}`;
}
