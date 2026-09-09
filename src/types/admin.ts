export type RegistrationMode = 'normal' | 'beta';

export interface RegistrationNotificationSettings {
  enabled: boolean;
  email: string;
}

export interface PlatformSettings {
  registrationMode: RegistrationMode;
  registrationNotify: RegistrationNotificationSettings;
}

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
  broadcastEngagement: UserBroadcastEngagement[];
}

export type BroadcastSubscriptionFilter = 'all' | 'free' | 'pro';
export type BroadcastRegistrationStatusFilter =
  | 'all'
  | 'approved'
  | 'pending_approval'
  | 'pending_email';
export type BroadcastTriStateFilter = 'all' | 'yes' | 'no';

export interface BroadcastFilters {
  registeredFrom?: string;
  registeredTo?: string;
  subscriptionPlan: BroadcastSubscriptionFilter;
  registrationStatus: BroadcastRegistrationStatusFilter;
  emailVerified: BroadcastTriStateFilter;
  hasTheater: BroadcastTriStateFilter;
  isTheaterOwner: BroadcastTriStateFilter;
  minActiveSessions: number;
  excludePlatformAdmins: boolean;
}

export interface BroadcastRecipient {
  id: string;
  email: string;
  name: string;
  subscriptionPlan: 'free' | 'pro';
}

export interface BroadcastPreview {
  recipientCount: number;
  sample: BroadcastRecipient[];
  filters: BroadcastFilters;
}

export interface BroadcastSendResult {
  broadcastId: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  failures: Array<{ email: string; error: string }>;
}

export type BroadcastStatus = 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed';

export interface BroadcastScheduleResult {
  broadcastId: string;
  scheduledAt: string;
  recipientCount: number;
}

export interface BroadcastHistoryItem {
  id: string;
  subject: string;
  bodyPreview: string;
  filters: BroadcastFilters;
  sentByUserId: string;
  sentByEmail: string;
  createdAt: string;
  status: BroadcastStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  openedCount: number;
  clickedCount: number;
  openRatePercent: number;
  clickRatePercent: number;
}

export interface BroadcastEngagementStats {
  sentCount: number;
  failedCount: number;
  openedCount: number;
  clickedCount: number;
  openRatePercent: number;
  clickRatePercent: number;
}

export interface BroadcastRecipientEngagement {
  id: string;
  userId: string;
  email: string;
  name: string;
  deliveryStatus: 'sent' | 'failed' | 'pending';
  deliveryError: string | null;
  sentAt: string | null;
  openedAt: string | null;
  openCount: number;
  clickedAt: string | null;
  clickCount: number;
}

export interface BroadcastDetail extends BroadcastHistoryItem {
  bodyText: string;
  stats: BroadcastEngagementStats;
  recipients: BroadcastRecipientEngagement[];
}

export interface UserBroadcastEngagement {
  broadcastId: string;
  subject: string;
  broadcastAt: string;
  deliveryStatus: 'sent' | 'failed' | 'pending';
  deliveryError: string | null;
  sentAt: string | null;
  openedAt: string | null;
  openCount: number;
  clickedAt: string | null;
  clickCount: number;
  clicks: Array<{ url: string; clickedAt: string }>;
}
