import { appPaths } from './appPaths';

/** Маршруты контекстной шапки: театр · постановка · показ */
export const workContextLinks = {
  theater: appPaths.home,
  play: appPaths.play,
  performance: appPaths.playCast,
} as const;
