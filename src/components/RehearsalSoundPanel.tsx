import { useRef } from 'react';
import { Plus, Repeat, Square, Play, X } from 'lucide-react';
import { useRehearsalSoundBoard, type SfxId } from '../hooks/useRehearsalSoundBoard';

const SFX_BUTTONS: { id: SfxId; emoji: string; label: string }[] = [
  { id: 'applause', emoji: '👏', label: 'Аплодисменты' },
  { id: 'rain', emoji: '⛈️', label: 'Дождь' },
  { id: 'bell', emoji: '🔔', label: 'Колокол' },
  { id: 'door', emoji: '🚪', label: 'Дверь' },
];

type RehearsalSoundPanelProps = {
  rehearsalId: string;
};

function VolumeSlider({
  value,
  onChange,
  label,
  className = '',
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  className?: string;
}) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
        <span>{label}</span>
        <span className="tabular-nums text-foreground/80">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer accent-gold"
        aria-label={label}
      />
    </label>
  );
}

export function RehearsalSoundPanel({ rehearsalId }: RehearsalSoundPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    settings,
    playingTrackId,
    addTracks,
    removeTrack,
    toggleLoop,
    toggleTrack,
    setTrackVolume,
    setMasterVolume,
    playSfx,
  } = useRehearsalSoundBoard(rehearsalId);

  return (
    <section className="rounded-2xl border border-gold/10 bg-surface/40 p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Звук</h2>

      <div className="mb-3 grid grid-cols-4 gap-2">
        {SFX_BUTTONS.map(({ id, emoji, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => void playSfx(id)}
            className="flex aspect-square items-center justify-center rounded-xl border border-gold/10 bg-background/50 text-2xl transition-colors hover:border-gold/25 hover:bg-gold/5"
            title={label}
            aria-label={label}
          >
            {emoji}
          </button>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.ogg,.m4a,.flac"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) {
            void addTracks(event.target.files);
            event.target.value = '';
          }
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gold/20 bg-background/30 px-3 py-2.5 text-sm text-muted transition-colors hover:border-gold/35 hover:text-gold-light"
      >
        <Plus size={16} />
        Добавить музыку
      </button>

      {settings.tracks.length > 0 ? (
        <div className="space-y-2">
          {settings.tracks.map((track) => {
            const isPlaying = playingTrackId === track.id;
            return (
              <div key={track.id} className="rounded-xl border border-gold/10 bg-background/40">
                <div className="flex min-w-0 items-center gap-2 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => void toggleTrack(track)}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                      isPlaying
                        ? 'border-gold/50 bg-gold/15 text-gold-light'
                        : 'border-gold/15 bg-surface/60 text-foreground hover:border-gold/30'
                    }`}
                    aria-label={isPlaying ? 'Остановить' : 'Воспроизвести'}
                  >
                    {isPlaying ? (
                      <Square size={14} fill="currentColor" />
                    ) : (
                      <Play size={14} fill="currentColor" />
                    )}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-sm" title={track.name}>
                    {track.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleLoop(track.id)}
                    className={`rounded-lg p-1.5 transition-colors ${
                      track.loop ? 'text-sky-400' : 'text-muted hover:text-foreground'
                    }`}
                    title={track.loop ? 'Повтор включён' : 'Включить повтор'}
                    aria-label={track.loop ? 'Выключить повтор' : 'Включить повтор'}
                  >
                    <Repeat size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeTrack(track.id)}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:text-red-300"
                    title="Удалить дорожку"
                    aria-label="Удалить дорожку"
                  >
                    <X size={16} />
                  </button>
                </div>
                {isPlaying ? (
                  <div className="border-t border-gold/10 px-3 pb-2.5 pt-2">
                    <VolumeSlider
                      label="Громкость дорожки"
                      value={track.volume}
                      onChange={(value) => setTrackVolume(track.id, value)}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4 border-t border-gold/10 pt-3">
        <VolumeSlider
          label="Общая громкость"
          value={settings.masterVolume}
          onChange={setMasterVolume}
        />
      </div>
    </section>
  );
}
