const STORAGE_KEY = 'rehearsals-last-rehearsal';

type LastRehearsalVisit = {
  theaterId: string;
  rehearsalId: string;
  visitedAt: string;
};

export function saveLastRehearsalVisit(theaterId: string, rehearsalId: string): void {
  try {
    const payload: LastRehearsalVisit = {
      theaterId,
      rehearsalId,
      visitedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function getLastRehearsalVisit(
  theaterId: string | undefined
): { rehearsalId: string; visitedAt: string } | null {
  if (!theaterId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastRehearsalVisit;
    if (parsed.theaterId !== theaterId || !parsed.rehearsalId) return null;
    return { rehearsalId: parsed.rehearsalId, visitedAt: parsed.visitedAt };
  } catch {
    return null;
  }
}
