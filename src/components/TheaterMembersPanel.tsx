import { useEffect, useState } from 'react';
import { Users, UserPlus, Trash2 } from 'lucide-react';
import {
  addTheaterMember,
  fetchTheaterMembers,
  removeTheaterMember,
} from '../api/auth';
import { Button } from './Button';
import { ActorAvatar } from './ActorAvatar';
import { useAuth } from '../store/AuthContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import type { AppState } from '../types';
import type { TheaterMember } from '../types/auth';
import { THEATER_ROLE_LABELS } from '../types/auth';
import { findLinkedActor, normalizeActorEmail } from '../utils/actorProfile';

function resolveMemberDisplay(
  state: AppState,
  theaterId: string,
  member: TheaterMember
): { displayName: string; photoUrl?: string; showEmail: boolean } {
  const actor = findLinkedActor(state, member.email, theaterId);
  const displayName =
    actor?.name?.trim() ||
    member.actorName?.trim() ||
    member.name?.trim() ||
    member.email;
  const photoUrl = actor?.photoUrl ?? member.photoUrl;
  const showEmail = normalizeActorEmail(displayName) !== normalizeActorEmail(member.email);
  return { displayName, photoUrl, showEmail };
}

export function TheaterMembersPanel() {
  const { state } = useRehearsalStore();
  const { canManageMembers } = useAuth();
  const theaterId = state.activeTheaterId;
  const canManage = canManageMembers(theaterId);

  const [members, setMembers] = useState<TheaterMember[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'observer' | 'actor'>('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const emailLooksLikeTypo = /@gmai\.com$/i.test(email.trim());

  useEffect(() => {
    if (!theaterId || !canManage) {
      setMembers([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchTheaterMembers(theaterId)
      .then((rows) => {
        if (!cancelled) setMembers(rows);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить участников');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [theaterId, canManage]);

  if (!theaterId || !canManage) return null;

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!theaterId || !email.trim()) return;
    setError(null);
    setSuccess(null);
    try {
      const normalizedEmail = email.trim();
      await addTheaterMember(theaterId, normalizedEmail, role);
      setEmail('');
      const rows = await fetchTheaterMembers(theaterId);
      setMembers(rows);
      setSuccess(
        `${THEATER_ROLE_LABELS[role]} добавлен: ${normalizedEmail}. Попросите коллегу войти с этим же email и нажать «Проверить доступ».`
      );
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Не удалось добавить участника');
    }
  };

  const handleRemove = async (userId: string) => {
    if (!theaterId) return;
    setError(null);
    try {
      await removeTheaterMember(theaterId, userId);
      setMembers((current) => current.filter((member) => member.userId !== userId));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Не удалось удалить участника');
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
        <Users size={16} />
        Доступ к театру
      </div>

      <div className="rounded-2xl border border-gold/10 bg-surface/40 p-5">
        <p className="text-sm leading-relaxed text-muted">
          Пригласите коллег по email. Редактор может изменять данные театра, наблюдатель — только
          просматривать, актёр — личный кабинет с RSVP и доступностью.
        </p>

        {success && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        )}

        {emailLooksLikeTypo && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            Похоже на опечатку: <strong>@gmai.com</strong>. Обычно нужен <strong>@gmail.com</strong>.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <ul className="mt-4 space-y-2">
          {loading ? (
            <li className="text-sm text-muted">Загрузка…</li>
          ) : (
            members.map((member) => {
              const { displayName, photoUrl, showEmail } = resolveMemberDisplay(
                state,
                theaterId,
                member
              );
              return (
              <li
                key={member.userId}
                className="flex items-center gap-3 rounded-xl border border-gold/10 bg-black/20 px-4 py-3"
              >
                <ActorAvatar name={displayName} photoUrl={photoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-white">{displayName}</div>
                  {showEmail && (
                    <div className="truncate text-sm text-muted">{member.email}</div>
                  )}
                </div>
                <span className="rounded-full bg-gold/10 px-3 py-1 text-xs text-gold-light">
                  {THEATER_ROLE_LABELS[member.role]}
                </span>
                {member.role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => void handleRemove(member.userId)}
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-200"
                    title="Удалить доступ"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
              );
            })
          )}
        </ul>

        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleAdd}>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@example.com"
            className="min-w-0 flex-1 rounded-xl border border-gold/15 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as 'editor' | 'observer' | 'actor')}
            className="rounded-xl border border-gold/15 bg-black/20 px-4 py-3 text-white outline-none focus:border-gold/40"
          >
            <option value="editor">Редактор</option>
            <option value="observer">Наблюдатель</option>
            <option value="actor">Актёр</option>
          </select>
          <Button type="submit" className="shrink-0">
            <UserPlus size={16} className="mr-2 inline" />
            Пригласить
          </Button>
        </form>
      </div>
    </section>
  );
}
