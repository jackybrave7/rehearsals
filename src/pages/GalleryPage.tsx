import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Images } from 'lucide-react';
import { Link } from 'react-router-dom';
import { OutcomePhotoLightbox } from '../components/OutcomePhotoLightbox';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getTheaterRehearsals } from '../store/selectors';
import { appPaths } from '../navigation/appPaths';
import {
  collectGalleryPhotos,
  groupGalleryPhotosByDate,
  type GalleryPhotoEntry,
} from '../utils/rehearsalOutcomePhotos';
import { pageHeaderClass, pageTitleClass } from '../utils/pageLayout';

export function GalleryPage() {
  const { state } = useRehearsalStore();
  const rehearsals = getTheaterRehearsals(state);

  const entries = useMemo(() => collectGalleryPhotos(rehearsals), [rehearsals]);
  const groups = useMemo(() => groupGalleryPhotosByDate(entries), [entries]);
  const flatUrls = useMemo(() => entries.map((entry) => entry.url), [entries]);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openAt = (entry: GalleryPhotoEntry) => {
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
          <p className="mt-1 text-muted">Фото с репетиций по датам</p>
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-12 text-center text-muted">
          <Images className="mx-auto mb-3 opacity-50" size={40} />
          <p>Пока нет фото с репетиций.</p>
          <p className="mt-2 text-sm">
            Добавьте снимки в карточке завершённой репетиции — они появятся здесь.
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
                <li key={`${entry.rehearsalId}-${entry.url}`}>
                  <button
                    type="button"
                    className="relative aspect-square w-full overflow-hidden rounded-sm bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                    onClick={() => openAt(entry)}
                  >
                    <img
                      src={entry.url}
                      alt=""
                      className="h-full w-full object-cover transition hover:scale-[1.02]"
                      loading="lazy"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {lightboxIndex !== null && activeEntry && (
        <OutcomePhotoLightbox
          photos={flatUrls}
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
