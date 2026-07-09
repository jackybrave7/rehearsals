export type RehearsalSoundTrackMeta = {
  id: string;
  name: string;
  loop: boolean;
  /** 0–100 */
  volume: number;
};

export type RehearsalSoundSettings = {
  masterVolume: number;
  tracks: RehearsalSoundTrackMeta[];
};

const settingsKey = (rehearsalId: string) => `rehearsals-sound:${rehearsalId}`;

const defaultSettings = (): RehearsalSoundSettings => ({
  masterVolume: 100,
  tracks: [],
});

export function loadRehearsalSoundSettings(rehearsalId: string): RehearsalSoundSettings {
  try {
    const raw = localStorage.getItem(settingsKey(rehearsalId));
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as RehearsalSoundSettings;
    return {
      masterVolume: clampVolume(parsed.masterVolume ?? 100),
      tracks: Array.isArray(parsed.tracks)
        ? parsed.tracks.map((track) => ({
            id: track.id,
            name: track.name,
            loop: Boolean(track.loop),
            volume: clampVolume(track.volume ?? 100),
          }))
        : [],
    };
  } catch {
    return defaultSettings();
  }
}

export function saveRehearsalSoundSettings(rehearsalId: string, settings: RehearsalSoundSettings): void {
  try {
    localStorage.setItem(settingsKey(rehearsalId), JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function effectiveVolume(trackVolume: number, masterVolume: number): number {
  return clampVolume(trackVolume) / 100 * (clampVolume(masterVolume) / 100);
}
