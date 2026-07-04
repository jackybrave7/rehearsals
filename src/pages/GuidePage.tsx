import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import guideSource from '../content/guide.md?raw';
import { GuideRenderer } from '../components/guide/GuideRenderer';
import { GuideSearch } from '../components/guide/GuideSearch';
import { GuideToc } from '../components/guide/GuideToc';
import { restoreGuideChecklist } from '../components/guide/TheaterSetupChecklist';
import { useAuth } from '../store/AuthContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useDesign } from '../store/DesignContext';
import { appPaths } from '../navigation/appPaths';
import { pageTitleClass } from '../utils/pageLayout';
import {
  guideTextMatchesQuery,
  headingMatchesRole,
  parseGuideMarkdown,
  type GuideRole,
} from '../utils/guideParse';

const GUIDE_ROLE_KEY = 'guide-role';
type ViewRole = 'director' | 'actor';

function readStoredRole(): ViewRole | null {
  try {
    const value = localStorage.getItem(GUIDE_ROLE_KEY);
    return value === 'actor' || value === 'director' ? value : null;
  } catch {
    return null;
  }
}

function defaultRoleFromAccess(
  getTheaterRole: (id: string | null | undefined) => string | null,
  theaterId: string | null
): ViewRole {
  const role = getTheaterRole(theaterId);
  if (role === 'owner' || role === 'editor') return 'director';
  return 'actor';
}

function collectDetailsIds(headings: ReturnType<typeof parseGuideMarkdown>['headings'], query: string) {
  const ids = new Set<string>();
  if (!query || query.length < 2) return ids;

  const walk = (blocks: typeof headings[0]['blocks']) => {
    for (const block of blocks) {
      if (block.type === 'details') {
        const text = `${block.summary} ${block.blocks.map((b) => ('content' in b ? b.content : '')).join(' ')}`;
        if (guideTextMatchesQuery(text, query)) ids.add(block.id);
        walk(block.blocks);
      }
    }
  };

  for (const heading of headings) walk(heading.blocks);
  return ids;
}

export function GuidePage() {
  const parsed = useMemo(() => parseGuideMarkdown(guideSource), []);
  const { state } = useRehearsalStore();
  const { getTheaterRole } = useAuth();
  const { isZen } = useDesign();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const headingElements = useRef(new Map<string, HTMLElement>());
  const zeroResultLogged = useRef<string | null>(null);

  const paramRole = searchParams.get('role');
  const storedRole = readStoredRole();
  const viewRole: ViewRole =
    paramRole === 'actor' || paramRole === 'director'
      ? paramRole
      : storedRole ?? defaultRoleFromAccess(getTheaterRole, state.activeTheaterId);

  useEffect(() => {
    try {
      localStorage.setItem(GUIDE_ROLE_KEY, viewRole);
    } catch {
      // ignore
    }
  }, [viewRole]);

  const setViewRole = (role: ViewRole) => {
    const next = new URLSearchParams(searchParams);
    next.set('role', role);
    setSearchParams(next, { replace: true });
  };

  const filteredHeadings = useMemo(() => {
    return parsed.headings.filter((heading) => {
      if (!headingMatchesRole(heading.role, viewRole as GuideRole)) return false;
      if (search.length >= 2 && !guideTextMatchesQuery(heading.text, search)) return false;
      return true;
    });
  }, [parsed.headings, viewRole, search]);

  const filteredToc = useMemo(
    () => parsed.toc.filter((item) => filteredHeadings.some((h) => h.id === item.id)),
    [parsed.toc, filteredHeadings]
  );

  const openDetailsIds = useMemo(() => {
    const ids = collectDetailsIds(filteredHeadings, search);
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) ids.add(hash);
    return ids;
  }, [filteredHeadings, search]);

  useEffect(() => {
    if (search.length >= 2 && filteredHeadings.length === 0 && zeroResultLogged.current !== search) {
      console.info('[guide-search]', search);
      zeroResultLogged.current = search;
    }
  }, [search, filteredHeadings.length]);

  const onRegisterHeading = useCallback((id: string, element: HTMLElement | null) => {
    if (element) headingElements.current.set(id, element);
    else headingElements.current.delete(id);
  }, []);

  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id) ?? headingElements.current.get(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `${appPaths.guide}#${id}`);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const timer = window.setTimeout(() => scrollToId(hash), 100);
    return () => window.clearTimeout(timer);
  }, [scrollToId, filteredHeadings]);

  useEffect(() => {
    const ids = filteredHeadings.map((h) => h.id);
    if (ids.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [filteredHeadings]);

  const onCopyAnchor = async (id: string) => {
    const url = `${window.location.origin}${appPaths.guide}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage('Ссылка скопирована');
    } catch {
      setCopyMessage('Не удалось скопировать');
    }
    window.setTimeout(() => setCopyMessage(null), 2000);
  };

  const showIntro =
    search.length < 2 ||
    guideTextMatchesQuery(
      parsed.introBlocks.map((b) => ('content' in b ? b.content : '')).join(' '),
      search
    );

  return (
    <div className="min-w-0 space-y-6">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gold-light">
          <BookMarked size={14} />
          Справка
        </div>
        <h1 className={pageTitleClass}>Как работать в «Репетициях»</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Выберите роль ниже — покажем только нужные разделы. Термины с пунктиром можно навести для подсказки.
        </p>
      </header>

      <GuideSearch
        value={search}
        onChange={setSearch}
        resultCount={filteredHeadings.length + (showIntro ? 1 : 0)}
      />

      <div
        className={`flex gap-1 rounded-xl border p-1 ${
          isZen ? 'border-border/70 bg-white' : 'border-gold/15 bg-surface/40'
        }`}
        role="tablist"
        aria-label="Роль в руководстве"
      >
        {(
          [
            ['director', 'Я режиссёр / владелец'],
            ['actor', 'Я актёр / участник'],
          ] as const
        ).map(([role, label]) => (
          <button
            key={role}
            type="button"
            role="tab"
            aria-selected={viewRole === role}
            onClick={() => setViewRole(role)}
            className={`min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              viewRole === role
                ? isZen
                  ? 'bg-foreground text-background'
                  : 'bg-gold/20 text-gold-light'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <GuideToc items={filteredToc} activeId={activeId} onNavigate={scrollToId} mobile />

      {copyMessage && (
        <p className="text-center text-xs text-gold-light" role="status">
          {copyMessage}
        </p>
      )}

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <GuideToc items={filteredToc} activeId={activeId} onNavigate={scrollToId} />

        <article
          className={`min-w-0 rounded-2xl border p-4 sm:p-6 lg:p-8 ${
            isZen ? 'border-border/70 bg-white' : 'border-gold/10 bg-surface/40'
          }`}
        >
          <GuideRenderer
            introBlocks={showIntro ? parsed.introBlocks : []}
            headings={filteredHeadings}
            highlightQuery={search.length >= 2 ? search : undefined}
            openDetailsIds={openDetailsIds}
            onRegisterHeading={onRegisterHeading}
            onCopyAnchor={onCopyAnchor}
          />

          <p className="mt-8 border-t border-gold/10 pt-4 text-xs text-muted">
            Скрыли чеклист на обзоре?{' '}
            <button
              type="button"
              className="text-gold-light underline"
              onClick={() => {
                restoreGuideChecklist();
                setCopyMessage('Чеклист снова на обзоре');
                window.setTimeout(() => setCopyMessage(null), 2000);
              }}
            >
              Показать снова
            </button>
          </p>
        </article>
      </div>
    </div>
  );
}
