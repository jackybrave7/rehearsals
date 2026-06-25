export type ActorStatus = 'active' | 'archived';

export interface Theater {
  id: string;
  name: string;
  notes?: string;
  /** ID рабочего чата театра в Telegram (группа/канал) */
  telegramChatId?: string;
  /** Авто-напоминания участникам репетиций */
  reminderSettings?: TheaterReminderSettings;
}

export type ReminderType = 'day_before' | 'morning_of' | 'two_hours';

export interface TheaterReminderSettings {
  enabled: boolean;
  types: ReminderType[];
  morningHour?: number;
}

export interface RehearsalReminderSent {
  kind: ReminderType | 'T-24h' | 'T-2h' | 'custom';
  at: string;
  actorId?: string;
  offsetHours?: number;
}

export interface ActorUnavailability {
  id: string;
  from: string;
  to: string;
  reason?: string;
}

export interface Actor {
  id: string;
  theaterId?: string;
  name: string;
  status: ActorStatus;
  archiveReason?: string;
  photoUrl?: string;
  phone?: string;
  email?: string;
  telegramUsername?: string;
  /** Chat ID в Telegram после /start у бота (личные напоминания) */
  telegramChatId?: string;
  notes?: string;
  unavailability?: ActorUnavailability[];
}

export type PlayRoleKind = 'character' | 'crew' | 'technical';

export interface PlayRole {
  id: string;
  playId: string;
  name: string;
  kind: PlayRoleKind;
  order: number;
  description?: string;
}

export interface Performance {
  id: string;
  playId: string;
  name: string;
  description?: string;
  date?: string;
  startTime?: string;
  isDefault?: boolean;
  /** @deprecated используйте description */
  notes?: string;
}

export interface CastAssignment {
  id: string;
  playId: string;
  performanceId: string;
  roleId: string;
  actorId: string;
}

export interface Play {
  id: string;
  theaterId?: string;
  title: string;
  author: string;
  description?: string;
  year?: number;
  documentUrl?: string;
  /** ID Google Docs, извлекается из documentUrl */
  googleDocumentId?: string;
  /** Когда последний раз сопоставляли якоря сцен через Google Docs API */
  googleDocsLinksSyncedAt?: string;
  scriptFileName?: string;
  /** Ссылка на файл сценария на сервере, напр. /api/files/{id} */
  scriptFileUrl?: string;
  /** @deprecated читается для старых данных; новые загрузки — scriptFileUrl */
  scriptFileDataUrl?: string;
  scriptFileMimeType?: string;
  scriptFileSize?: number;
}

export type SceneStatus = 'not_started' | 'in_progress' | 'ready';
export type ScenePriority = 'high' | 'medium' | 'low';

export type SceneScriptAnchorType = 'heading' | 'bookmark';

/** Якорь внутри Google Docs (заголовок или закладка) */
export interface SceneScriptAnchor {
  type: SceneScriptAnchorType;
  id: string;
}

export interface Scene {
  id: string;
  playId: string;
  number: number;
  title: string;
  description?: string;
  /** Внутренние заметки режиссёра, не попадают в Telegram актёрам */
  directorNotes?: string;
  estimatedMinutes?: number;
  status: SceneStatus;
  priority?: ScenePriority;
  /** Роли персонажей, участвующих в сцене */
  roleIds?: string[];
  /** Якорь для быстрого открытия фрагмента текста в Google Docs */
  scriptAnchor?: SceneScriptAnchor;
  /** Знаков текста сцены из Google Docs (после синхронизации) */
  scriptCharacterCount?: number;
  scriptCharacterCountSyncedAt?: string;
}

export type TaskPriority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  theaterId?: string;
  title: string;
  description?: string;
  completed: boolean;
  assignedActorIds: string[];
  rehearsalId?: string;
  dueDate?: string;
  priority?: TaskPriority;
  playId?: string;
  sceneId?: string;
}

export type ScheduleBlockType = 'scene' | 'task' | 'break' | 'warmup' | 'custom';

export interface ScheduleBlock {
  id: string;
  startTime: string;
  durationMinutes: number;
  type: ScheduleBlockType;
  title: string;
  sceneId?: string;
  taskId?: string;
  notes?: string;
  /** Что решили на репетиции, внутренне для истории работы */
  decidedNotes?: string;
  /** Что осталось сделать, внутренне для истории работы */
  remainingNotes?: string;
  /** Отметка после репетиции: выполнен пункт плана или нет (не для перерывов) */
  completed?: boolean;
}

export interface Venue {
  id: string;
  theaterId?: string;
  name: string;
  address?: string;
  notes?: string;
}

export interface Rehearsal {
  id: string;
  theaterId?: string;
  seriesId?: string;
  date: string;
  startTime: string;
  endTime: string;
  venueId?: string;
  location?: string;
  notes?: string;
  playId?: string;
  performanceId?: string;
  sceneIds: string[];
  taskIds: string[];
  schedule: ScheduleBlock[];
  actorIds: string[];
  attendance?: Record<string, AttendanceStatus>;
  /** Порядок участников в списке репетиции (все потенциальные, не только отмеченные) */
  participantOrder?: string[];
  googleCalendarEventId?: string;
  /** Скрытые пользователем предупреждения перед репетицией */
  dismissedWarningIds?: string[];
  /** Отправленные авто-напоминания в Telegram */
  remindersSent?: RehearsalReminderSent[];
  /** Не отправлять авто-напоминания по этой репетиции */
  reminderOptOut?: boolean;
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'substitute';

export interface RehearsalTemplateBlock {
  durationMinutes: number;
  type: ScheduleBlock['type'];
  title: string;
  sceneId?: string;
  taskId?: string;
  notes?: string;
  decidedNotes?: string;
  remainingNotes?: string;
}

export interface RehearsalTemplate {
  id: string;
  theaterId?: string;
  playId?: string;
  name: string;
  startTime: string;
  endTime: string;
  sceneIds: string[];
  taskIds: string[];
  blocks: RehearsalTemplateBlock[];
}

export interface RehearsalSeries {
  id: string;
  theaterId?: string;
  playId?: string;
  performanceId?: string;
  venueId?: string;
  location?: string;
  startTime: string;
  endTime: string;
  /** 0 = воскресенье … 6 = суббота */
  weekday: number;
  fromDate: string;
  untilDate?: string;
  templateId?: string;
  name?: string;
}

export interface AppState {
  theaters: Theater[];
  activeTheaterId: string | null;
  actors: Actor[];
  plays: Play[];
  activePlayId: string | null;
  /** Последняя выбранная вкладка показа для каждой постановки */
  selectedPerformanceByPlayId?: Record<string, string>;
  playRoles: PlayRole[];
  performances: Performance[];
  castAssignments: CastAssignment[];
  scenes: Scene[];
  tasks: Task[];
  venues: Venue[];
  rehearsals: Rehearsal[];
  /** Метки применённых миграций — хранятся вместе с данными пользователя */
  appMeta?: {
    stoneHeartCastVersion?: string;
    stoneHeartScenesVersion?: string;
    rehearsalTemplates?: RehearsalTemplate[];
    rehearsalSeries?: RehearsalSeries[];
    /** false — скрыть блок «Перед репетицией» на обзоре и в карточке репетиции */
    showRehearsalWarnings?: boolean;
    /** Коэффициенты прогноза хронометража по знакам */
    sceneTiming?: Partial<SceneTimingSettingsMeta>;
    /** Порог «давно не репетировалась» для сцен в работе (дней) */
    staleSceneDays?: number;
    /** Авто-напоминания о репетициях в Telegram */
    reminders?: {
      enabled: boolean;
      offsetsHours: number[];
    };
    /** Миграция встроенных data-URL в файловое хранилище */
    filesMigratedVersion?: string;
  };
}

export interface SceneTimingSettingsMeta {
  charsPerAuthorPage: number;
  performanceMinutesPerAuthorPage: number;
  rehearsalMultiplier: number;
  autoFillRehearsalMinutes: boolean;
}
