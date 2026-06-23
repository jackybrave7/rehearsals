export interface PlatformStats {
  generatedAt: string;
  users: {
    total: number;
    newLast30Days: number;
    withPassword: number;
    withGoogle: number;
  };
  sessions: {
    active: number;
    activeUsers: number;
  };
  theaters: {
    total: number;
    membersByRole: { owner: number; editor: number; observer: number };
  };
  content: {
    plays: number;
    scenes: number;
    rehearsals: number;
    actors: number;
    tasks: number;
    venues: number;
    scheduleBlocks: number;
  };
  activity: {
    rehearsalsPast: number;
    rehearsalsUpcoming: number;
    rehearsalsLast30Days: number;
    openTasks: number;
    completedTasks: number;
  };
  storage: {
    fileCount: number;
    totalBytes: number;
    backupCount: number;
    dbSizeBytes: number;
  };
  integrations: {
    playsWithGoogleDocs: number;
    actorsWithTelegram: number;
  };
  signupsByMonth: Array<{ month: string; count: number }>;
  theatersOverview: Array<{
    id: string;
    name: string;
    plays: number;
    rehearsals: number;
    actors: number;
    members: number;
  }>;
  recentUsers: Array<{
    id: string;
    email: string;
    name: string;
    createdAt: string;
    theaterCount: number;
  }>;
}
