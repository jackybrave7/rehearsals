import { useCallback, useEffect, useRef, useState } from 'react';
import { generateId } from '../utils/id';
import {
  clampVolume,
  effectiveVolume,
  loadRehearsalSoundSettings,
  saveRehearsalSoundSettings,
  type RehearsalSoundSettings,
  type RehearsalSoundTrackMeta,
} from '../utils/rehearsalSoundStorage';
import {
  deleteRehearsalSoundFile,
  loadRehearsalSoundFile,
  saveRehearsalSoundFile,
} from '../utils/rehearsalSoundFiles';

export type SfxId = 'applause' | 'rain' | 'bell' | 'door';

const SFX_DURATIONS: Record<SfxId, number> = {
  applause: 1.2,
  rain: 2.5,
  bell: 1.4,
  door: 0.35,
};

function playSfxTone(
  audioContext: AudioContext,
  masterGain: GainNode,
  kind: SfxId
): void {
  const now = audioContext.currentTime;
  const gain = audioContext.createGain();
  gain.connect(masterGain);

  if (kind === 'applause') {
    const bufferSize = audioContext.sampleRate * SFX_DURATIONS.applause;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      const envelope = 1 - i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * envelope * 0.35;
    }
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.9, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + SFX_DURATIONS.applause);
    source.start(now);
    source.stop(now + SFX_DURATIONS.applause);
    return;
  }

  if (kind === 'rain') {
    const bufferSize = audioContext.sampleRate * SFX_DURATIONS.rain;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.08;
    }
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    source.connect(filter);
    filter.connect(gain);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.7, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + SFX_DURATIONS.rain);
    source.start(now);
    source.stop(now + SFX_DURATIONS.rain);
    return;
  }

  if (kind === 'bell') {
    const osc = audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + SFX_DURATIONS.bell);
    osc.connect(gain);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.8, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + SFX_DURATIONS.bell);
    osc.start(now);
    osc.stop(now + SFX_DURATIONS.bell);
    return;
  }

  const osc = audioContext.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(90, now + SFX_DURATIONS.door);
  osc.connect(gain);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.55, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + SFX_DURATIONS.door);
  osc.start(now);
  osc.stop(now + SFX_DURATIONS.door);
}

export function useRehearsalSoundBoard(rehearsalId: string) {
  const [settings, setSettings] = useState<RehearsalSoundSettings>(() =>
    loadRehearsalSoundSettings(rehearsalId)
  );
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  const persistSettings = useCallback(
    (next: RehearsalSoundSettings) => {
      setSettings(next);
      saveRehearsalSoundSettings(rehearsalId, next);
    },
    [rehearsalId]
  );

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.connect(audioContextRef.current.destination);
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const applyMasterGain = useCallback((masterVolume: number) => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = clampVolume(masterVolume) / 100;
    }
    if (audioRef.current && playingTrackId) {
      const track = settings.tracks.find((item) => item.id === playingTrackId);
      if (track) {
        audioRef.current.volume = effectiveVolume(track.volume, masterVolume);
      }
    }
  }, [playingTrackId, settings.tracks]);

  useEffect(() => {
    setSettings(loadRehearsalSoundSettings(rehearsalId));
    setPlayingTrackId(null);
    setReady(true);
  }, [rehearsalId]);

  useEffect(() => {
    applyMasterGain(settings.masterVolume);
  }, [settings.masterVolume, applyMasterGain]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      void audioContextRef.current?.close();
    };
  }, []);

  const stopTrack = useCallback(() => {
    audioRef.current?.pause();
    setPlayingTrackId(null);
  }, []);

  const playTrack = useCallback(
    async (track: RehearsalSoundTrackMeta) => {
      const blob = await loadRehearsalSoundFile(rehearsalId, track.id);
      if (!blob) return;

      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audio.loop = track.loop;
      audio.volume = effectiveVolume(track.volume, settings.masterVolume);
      audio.onended = () => {
        if (!track.loop) setPlayingTrackId(null);
      };
      audioRef.current = audio;
      setPlayingTrackId(track.id);
      await audio.play();
    },
    [rehearsalId, settings.masterVolume]
  );

  const toggleTrack = useCallback(
    async (track: RehearsalSoundTrackMeta) => {
      if (playingTrackId === track.id) {
        stopTrack();
        return;
      }
      await playTrack(track);
    },
    [playTrack, playingTrackId, stopTrack]
  );

  const addTracks = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((file) => file.type.startsWith('audio/') || /\.(wav|mp3|ogg|m4a|flac)$/i.test(file.name));
      if (list.length === 0) return;

      const nextTracks = [...settings.tracks];
      for (const file of list) {
        const id = generateId();
        await saveRehearsalSoundFile(rehearsalId, id, file);
        nextTracks.push({
          id,
          name: file.name,
          loop: false,
          volume: 100,
        });
      }
      persistSettings({ ...settings, tracks: nextTracks });
    },
    [persistSettings, rehearsalId, settings]
  );

  const removeTrack = useCallback(
    async (trackId: string) => {
      if (playingTrackId === trackId) stopTrack();
      await deleteRehearsalSoundFile(rehearsalId, trackId);
      persistSettings({
        ...settings,
        tracks: settings.tracks.filter((track) => track.id !== trackId),
      });
    },
    [persistSettings, playingTrackId, rehearsalId, settings, stopTrack]
  );

  const toggleLoop = useCallback(
    (trackId: string) => {
      const nextTracks = settings.tracks.map((track) =>
        track.id === trackId ? { ...track, loop: !track.loop } : track
      );
      persistSettings({ ...settings, tracks: nextTracks });
      if (playingTrackId === trackId && audioRef.current) {
        const updated = nextTracks.find((track) => track.id === trackId);
        if (updated) audioRef.current.loop = updated.loop;
      }
    },
    [persistSettings, playingTrackId, settings]
  );

  const setTrackVolume = useCallback(
    (trackId: string, volume: number) => {
      const nextVolume = clampVolume(volume);
      const nextTracks = settings.tracks.map((track) =>
        track.id === trackId ? { ...track, volume: nextVolume } : track
      );
      persistSettings({ ...settings, tracks: nextTracks });
      if (playingTrackId === trackId && audioRef.current) {
        audioRef.current.volume = effectiveVolume(nextVolume, settings.masterVolume);
      }
    },
    [persistSettings, playingTrackId, settings]
  );

  const setMasterVolume = useCallback(
    (volume: number) => {
      const nextVolume = clampVolume(volume);
      persistSettings({ ...settings, masterVolume: nextVolume });
      applyMasterGain(nextVolume);
    },
    [applyMasterGain, persistSettings, settings]
  );

  const playSfx = useCallback(
    async (kind: SfxId) => {
      const audioContext = await ensureAudioContext();
      if (!masterGainRef.current) return;
      masterGainRef.current.gain.value = clampVolume(settings.masterVolume) / 100;
      playSfxTone(audioContext, masterGainRef.current, kind);
    },
    [ensureAudioContext, settings.masterVolume]
  );

  return {
    ready,
    settings,
    playingTrackId,
    addTracks,
    removeTrack,
    toggleLoop,
    toggleTrack,
    setTrackVolume,
    setMasterVolume,
    playSfx,
  };
}
