const LEDGER_MAX = 200;

/** ID репетиций, удалённых явно в UI — без этого сервер отклонит «устаревшее» сохранение. */
export function appendRehearsalDeletionId(
  ledger: string[] | undefined,
  rehearsalId: string
): string[] {
  const next = [...(ledger ?? []), rehearsalId];
  return [...new Set(next)].slice(-LEDGER_MAX);
}