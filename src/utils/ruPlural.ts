export function ruPlural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function formatSceneCountLabel(n: number): string {
  return `${n} ${ruPlural(n, 'сцена', 'сцены', 'сцен')}`;
}

export function formatPerformanceCountLabel(n: number): string {
  return `${n} ${ruPlural(n, 'показ', 'показа', 'показов')}`;
}

export function formatRoleCountLabel(n: number): string {
  return `${n} ${ruPlural(n, 'роль', 'роли', 'ролей')}`;
}
