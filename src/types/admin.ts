export type RegistrationMode = 'normal' | 'beta';

export interface PlatformStats {
  generatedAt: string;
  registrationMode: 'normal' | 'beta';
  pendingRegistrations: number;
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
    membersByRole: { owner: number; editor: number; observer: number; actor: number };
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

export interface AdminUserSummary {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  authMethods: { password: boolean; google: boolean };
  activeSessions: number;
  subscriptionPlan: 'free' | 'pro';
  subscriptionPlanStored: 'free' | 'pro';
  subscriptionProExpiresAt: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  registrationApproved: boolean;
  registrationStatus: 'approved' | 'pending_approval' | 'pending_email';
  theaterCount: number;
  ownedTheaterCount: number;
  filesCount: number;
  filesBytes: number;
  content: {
    plays: number;
    scenes: number;
    rehearsals: number;
    actors: number;
    tasks: number;
    venues: number;
  };
  activity: {
    rehearsalsUpcoming: number;
    rehearsalsLast30Days: number;
    openTasks: number;
  };
}

export interface AdminUserTheaterStats {
  id: string;
  name: string;
  role: 'owner' | 'editor' | 'observer';
  isOwner: boolean;
  plays: number;
  scenes: number;
  rehearsals: number;
  actors: number;
  tasks: number;
  venues: number;
  members: number;
  rehearsalsUpcoming: number;
}

export interface AdminUserDetail extends AdminUserSummary {
  generatedAt: string;
  theaters: AdminUserTheaterStats[];
}
