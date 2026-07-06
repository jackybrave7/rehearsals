export type ActorStatus = 'active' | 'archived';

export interface Theater {
  id: string;
  name: string;
  notes?: string;
  /** IANA-часовой пояс театра (напоминания, расписание). По умолчанию Europe/Moscow */
  timezone?: string;
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
  kind: ReminderType | 'T-24h' | 'T-2h' | 'custom' | 'rsvp_prompt';
  at: string;
  actorId?: string;
  offsetHours?: number;
}

export type RsvpStatus = 'confirmed' | 'declined' | 'late';

export type ActorUnavailabilityRecurrence = 'none' | 'weekly';

export interface ActorUnavailability {
  id: string;
  from: string;
  to: string;
  reason?: string;
  recurrence?: ActorUnavailabilityRecurrence;
  /** 0=вс … 6=сб; для «будни» — 1–5 */
  weekdays?: number[];
  /** Если оба пусты — недоступен весь день. Иначе интервал «не могу» в эти часы (HH:mm). */
  startTime?: string;
  endTime?: string;
}

export type MemorizationStatus = 'not_started' | 'learning' | 'known';

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
  /** Прогресс заучивания по сценам (sceneId → статус) */
  memorizationByScene?: Record<string, MemorizationStatus>;
}

export type PlayRoleKind = 'character' | 'crew' | 'technical';

export interface PlayRole {
  id: string;
  playId: string;
  name: string;
  kind: PlayRoleKind;
  order: number;
  description?: string;
  /** Имена персонажа в тексте пьесы, если отличаются от названия роли */
  scriptAliases?: string[];
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
  /** Обложка постановки (URL) */
  coverUrl?: string;
  /** Круглая иконка постановки (URL); если нет — буква на iconColor */
  iconUrl?: string;
  /** Цвет фона иконки-заглушки (#hex) */
  iconColor?: string;
  year?: number;
  documentUrl?: string;
  /** ID Google Docs, извлекается из documentUrl */
  googleDocumentId?: string;
  /** Когда последний раз сопоставляли якоря сцен через Google Docs API */
  googleDocsLinksSyncedAt?: string;
  /** Когда последний раз сопоставляли сцены с загруженным файлом сценария */
  scriptImportSyncedAt?: string;
  scriptFileName?: string;
  /** Ссылка на файл сценария на сервере, напр. /api/files/{id} */
  scriptFileUrl?: string;
  /** @deprecated читается для старых данных; новые загрузки — scriptFileUrl */
  scriptFileDataUrl?: string;
  scriptFileMimeType?: string;
  scriptFileSize?: number;
  /** Архивная постановка — на Free только просмотр */
  archivedAt?: string;
  /** Якоря заголовков актов/действий в тексте (ключ — подпись группы, напр. «Действие первое») */
  actScriptAnchors?: Record<string, SceneScriptAnchor>;
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
  /** Группа для списка сцен: «Акт 1», «Действие второе» (из структуры документа) */
  actGroup?: string;
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

export type ScheduleBlockType = 'scene' | 'task' | 'break' | 'warmup' | 'custom' | 'etude';

export interface ScheduleBlock {
  id: string;
  startTime: string;
  durationMinutes: number;
  type: ScheduleBlockType;
  title: string;
  sceneId?: string;
  taskId?: string;
  /** Для этюда: необязательная привязка к постановке */
  playId?: string;
  /** Для этюда: участники */
  actorIds?: string[];
  notes?: string;
  /** Решения и корректировки по сцене (с @-упоминаниями актёров/ролей) */
  decidedNotes?: string;
  /** Для этюда: итог — что получилось, что взять в спектакль */
  outcomeNotes?: string;
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
  /** Ответы участников в Telegram (или вручную режиссёром) */
  rsvp?: Record<string, RsvpStatus>;
  /** Порядок участников в списке репетиции (все потенциальные, не только отмеченные) */
  participantOrder?: string[];
  googleCalendarEventId?: string;
  /** Скрытые пользователем предупреждения перед репетицией */
  dismissedWarningIds?: string[];
  /** Отправленные авто-напоминания в Telegram */
  remindersSent?: RehearsalReminderSent[];
  /** Не отправлять авто-напоминания по этой репетиции */
  reminderOptOut?: boolean;
  /** Когда план последний раз отправляли в чат театра Telegram */
  telegramPlanSentAt?: string;
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'substitute';

export interface RehearsalActorNote {
  id: string;
  theaterId: string;
  rehearsalId: string;
  actorId: string;
  sceneId?: string;
  scheduleBlockId?: string;
  text: string;
  createdAt: string;
  sentAt?: string;
  acknowledgedAt?: string;
}

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
  rehearsalActorNotes: RehearsalActorNote[];
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
    /** Отмечено при экспорте плана (ics / Google / Telegram) для чеклиста настройки */
    guideOnboardingPlanSent?: boolean;
  };
}

export interface SceneTimingSettingsMeta {
  charsPerAuthorPage: number;
  performanceMinutesPerAuthorPage: number;
  rehearsalMultiplier: number;
  autoFillRehearsalMinutes: boolean;
}
