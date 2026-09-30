import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Film, Images, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { OutcomeGalleryLightbox } from '../components/OutcomeGalleryLightbox';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getTheaterRehearsals } from '../store/selectors';
import { appPaths } from '../navigation/appPaths';
import {
  collectGalleryMedia,
  groupGalleryMediaByDate,
  type GalleryMediaEntry,
} from '../utils/rehearsalOutcomeGallery';
import { outcomeVideoThumbnailUrl } from '../../shared/outcomeVideoEmbed';
import { pageHeaderClass, pageTitleClass } from '../utils/pageLayout';

function GalleryMediaTile({
  entry,
  onOpen,
}: {
  entry: GalleryMediaEntry;
  onOpen: () => void;
}) {
  const videoThumb =
    entry.kind === 'video' ? outcomeVideoThumbnailUrl(entry.url) : null;

  return (
    <button
      type="button"
      className="relative aspect-square w-full overflow-hidden rounded-sm bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
      onClick={onOpen}
    >
      {entry.kind === 'photo' ? (
        <img
          src={entry.url}
          alt=""
          className="h-full w-full object-cover transition hover:scale-[1.02]"
          loading="lazy"
        />
      ) : videoThumb ? (
        <>
          <img
            src={videoThumb}
            alt=""
            className="h-full w-full object-cover transition hover:scale-[1.02]"
            loading="lazy"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <Play size={28} className="text-white drop-shadow" fill="currentColor" />
          </span>
        </>
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-black/40 text-white/80 transition hover:bg-black/50">
          <Film size={28} />
          <Play size={20} fill="currentColor" />
        </span>
      )}
    </button>
  );
}

export function GalleryPage() {
  const { state } = useRehearsalStore();
  const rehearsals = getTheaterRehearsals(state);

  const entries = useMemo(() => collectGalleryMedia(rehearsals), [rehearsals]);
  const groups = useMemo(() => groupGalleryMediaByDate(entries), [entries]);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openAt = (entry: GalleryMediaEntry) => {
    const index = entries.findIndex(
      (item) => item.url === entry.url && item.rehearsalId === entry.rehearsalId
    );
    setLightboxIndex(index >= 0 ? index : 0);
  };

  const activeEntry = lightboxIndex !== null ? entries[lightboxIndex] : null;

  return (
    <div className="space-y-8">
      <header className={pageHeaderClass}>
        <div>
          <h1 className={pageTitleClass}>Галерея</h1>
          <p className="mt-1 text-muted">Фото и видео с репетиций по датам</p>
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-12 text-center text-muted">
          <Images className="mx-auto mb-3 opacity-50" size={40} />
          <p>Пока нет материалов с репетиций.</p>
          <p className="mt-2 text-sm">
            Добавьте фото или видео в карточке завершённой репетиции — они появятся здесь.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.date} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {format(parseISO(group.date), 'd MMMM yyyy', { locale: ru })}
            </h2>
            <ul className="grid grid-cols-3 gap-0.5 sm:grid-cols-4 sm:gap-1 md:grid-cols-5 lg:grid-cols-6">
              {group.items.map((entry) => (
                <li key={`${entry.rehearsalId}-${entry.kind}-${entry.url}`}>
                  <GalleryMediaTile entry={entry} onOpen={() => openAt(entry)} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {lightboxIndex !== null && activeEntry && (
        <OutcomeGalleryLightbox
          items={entries}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          footer={
            <Link
              to={appPaths.rehearsal(activeEntry.rehearsalId)}
              className="inline-flex items-center justify-center rounded-lg bg-gold px-5 py-2.5 text-sm font-medium text-background transition hover:bg-gold-light"
              onClick={() => setLightboxIndex(null)}
            >
              Перейти в эту репетицию
            </Link>
          }
        />
      )}
    </div>
  );
}
