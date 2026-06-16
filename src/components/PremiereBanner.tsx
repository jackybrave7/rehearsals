import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { AppState } from '../types';
import { getPlayScenes } from '../store/selectors';
import { getUpcomingPremiere, getPremiereBadgeTone } from '../utils/premiere';
import { appPaths } from '../navigation/appPaths';

interface PremiereBannerProps {
  state: AppState;
  playId: string;
}

export function PremiereBanner({ state, playId }: PremiereBannerProps) {
  const premiere = getUpcomingPremiere(state, playId);
  const scenes = getPlayScenes(state, playId);
  const ready = scenes.filter((scene) => scene.status === 'ready').length;
  const notReady = scenes.filter((scene) => scene.status !== 'ready');

  if (!premiere) {
    return (
      <div className="rounded-xl border border-gold/10 bg-surface/40 px-4 py-3 text-sm text-muted">
        Премьера не запланирована.{' '}
        <Link to={appPaths.playCast} className="text-gold-light hover:underline">
          Укажите дату показа
        </Link>
      </div>
    );
  }

  const tone = getPremiereBadgeTone(premiere.daysLeft);
  const urgent = premiere.daysLeft <= 3 && notReady.length > 0;

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        urgent
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
          : tone === 'gold'
            ? 'border-gold/20 bg-gold/5 text-gold-light'
            : 'border-gold/10 bg-surface/40 text-muted'
      }`}
    >
      <p>
        Премьера {format(parseISO(premiere.date), 'd MMMM yyyy', { locale: ru })} · осталось{' '}
        {premiere.daysLeft} дн. · готово {ready} из {scenes.length} сцен
      </p>
      {urgent && (
        <p className="mt-1 text-amber-200">
          Не готово к премьере: {notReady.slice(0, 6).map((scene) => scene.title).join(', ')}
          {notReady.length > 6 ? '…' : ''}
        </p>
      )}
    </div>
  );
}
