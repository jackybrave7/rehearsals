import { useAuth } from '../store/AuthContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import { canAccessActorCabinet } from '../utils/actorProfile';

/** Доступ к разделу «Моё» (учить текст, явка, недоступность) при текущей постановке/театре. */
export function useActorCabinetAccess(): boolean {
  const { user, getTheaterRole } = useAuth();
  const { state } = useRehearsalStore();
  const theaterId = state.activeTheaterId;
  return canAccessActorCabinet(
    state,
    user?.email,
    user?.name,
    theaterId,
    getTheaterRole(theaterId)
  );
}
