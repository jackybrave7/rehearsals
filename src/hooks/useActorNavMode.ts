import { useAuth } from '../store/AuthContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { findLinkedActor } from '../utils/actorProfile';

/** Показывать навигацию и маршруты кабинета актёра, а не режиссёра. */
export function useActorNavMode(): boolean {
  const { isActorOnly, isActorOnlyAccount, getTheaterRole, user, theaters } = useAuth();
  const { state } = useRehearsalStore();

  const activeRole = getTheaterRole(state.activeTheaterId);
  if (activeRole === 'observer' || activeRole === 'owner' || activeRole === 'editor') {
    return false;
  }

  if (isActorOnlyAccount || isActorOnly(state.activeTheaterId)) return true;

  const hasActorMembership = theaters.some((entry) => entry.role === 'actor');
  if (!hasActorMembership || !user?.email) return false;

  const linkedOnActive = findLinkedActor(state, user.email, state.activeTheaterId, user.name);
  return !linkedOnActive;
}
