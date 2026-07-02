export const APP_BASE = '/app';

export const appPaths = {
  home: APP_BASE,
  pricing: '/pricing',
  overview: `${APP_BASE}/overview`,
  play: `${APP_BASE}/play`,
  scenes: `${APP_BASE}/scenes`,
  actors: `${APP_BASE}/actors`,
  actor: (id: string) => `${APP_BASE}/actors/${id}`,
  rehearsals: `${APP_BASE}/rehearsals`,
  venues: `${APP_BASE}/venues`,
  tasks: `${APP_BASE}/tasks`,
  settings: `${APP_BASE}/settings`,
  guide: `${APP_BASE}/guide`,
  admin: `${APP_BASE}/admin`,
  adminUsers: `${APP_BASE}/admin/users`,
  adminUser: (id: string) => `${APP_BASE}/admin/users/${id}`,
  rehearsal: (id: string) => `${APP_BASE}/rehearsals/${id}`,
  playCast: `${APP_BASE}/play#cast`,
} as const;
