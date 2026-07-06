import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { AppState, Rehearsal, ScheduleBlock, Scene, Task } from '../types';
import { resolveSceneScriptUrl } from './googleDocs';
import { getTelegramSceneHeading, getTelegramSceneLocation, getSceneCharacterNames, getSceneShortLabel } from './sceneLabels';
import { formatPerformanceLabel, getActorAssignments } from '../store/selectors';
import { getParticipatingActorIds, resolveRehearsalPerformanceId } from './rehearsalActors';
import { getRehearsalPlayTitles, getScenePlayId, getRehearsalAllSceneIds } from './rehearsalPlays';
import { resolveRehearsalLocation } from './venue';
import { addMinutes, formatDuration } from './time';
import { getActorScenesInRehearsal } from './actorProfile';
import { groupActorScenesByPlay } from './actorMyPage';
import { formatActorRsvpStatusLine } from './rehearsalRsvp';
import { REMINDER_TYPE_LABELS, type ReminderType } from './reminders';

const blockTypeLabels: Record<ScheduleBlock['type'], string> = {
  scene: 'Сцена',
  task: 'Задача',
  break: 'Перерыв',
  warmup: 'Разминка',
  custom: 'Другое',
  etude: 'Этюд',
};

export interface TelegramExport {
  text: string;
  html: string;
  botHtml: string;
}

function section(title: string): string[] {
  return ['', title, ''];
}

function telegramSection(title: string): string {
  return `\n<b>${escapeHtml(title)}</b>\n`;
}

function truncateTelegramText(text: string, maxLength = 120): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatTelegramRehearsalHeader(
  state: AppState,
  rehearsal: Rehearsal
): { plain: string[]; html: string[] } {
  const performance = state.performances.find(
    (p) => p.id === resolveRehearsalPerformanceId(state, rehearsal)
  );
  const location = resolveRehearsalLocation(rehearsal, state.venues);
  const dateLabel = format(parseISO(rehearsal.date), 'EEEE, d MMMM yyyy', { locale: ru });
  const capitalizedDate = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  const playHeader = formatRehearsalPlayHeader(state, rehearsal);

  const plain: string[] = [
    '🎭 РЕПЕТИЦИЯ',
    playHeader,
    `📅 ${capitalizedDate}`,
    `⏰ ${rehearsal.startTime} – ${rehearsal.endTime}`,
  ];
  const html: string[] = [
    telegramSection('🎭 РЕПЕТИЦИЯ').trim(),
    `<b>${escapeHtml(playHeader)}</b>`,
    `📅 ${escapeHtml(capitalizedDate)}`,
    `⏰ ${escapeHtml(`${rehearsal.startTime} – ${rehearsal.endTime}`)}`,
  ];

  if (location) {
    plain.push(`📍 ${location}`);
    html.push(`📍 ${escapeHtml(location)}`);
  }
  if (performance) {
    plain.push(`🎬 ${formatPerformanceLabel(performance)}`);
    html.push(`🎬 ${escapeHtml(formatPerformanceLabel(performance))}`);
  }

  const planSummary = buildPlanSummaryLine(state, rehearsal);
  if (planSummary) {
    plain.push(planSummary);
    html.push(`<i>${escapeHtml(planSummary)}</i>`);
  }

  return { plain, html };
}

function getActorScheduleBlocks(
  state: AppState,
  rehearsal: Rehearsal,
  actorId: string
): ScheduleBlock[] {
  const mySceneIds = new Set(
    getActorScenesInRehearsal(state, rehearsal, actorId).map((scene) => scene.id)
  );

  return rehearsal.schedule.filter((block) => {
    if (block.type === 'scene' && block.sceneId) {
      return mySceneIds.has(block.sceneId);
    }
    if (block.type === 'etude') {
      return block.actorIds?.includes(actorId) ?? false;
    }
    if (block.type === 'task' && block.taskId) {
      const task = state.tasks.find((item) => item.id === block.taskId);
      return task?.assignedActorIds?.includes(actorId) ?? false;
    }
    return false;
  });
}

function formatActorReminderScheduleBlock(
  state: AppState,
  block: ScheduleBlock,
  blockNumber: number
): { plain: string; html: string } {
  const timeRange = formatBlockRange(block);
  const duration = formatDuration(block.durationMinutes);

  if (block.type === 'scene' && block.sceneId) {
    const scene = state.scenes.find((item) => item.id === block.sceneId);
    if (!scene) {
      return {
        plain: `${blockNumber}. ${timeRange} · ${block.title} · ${duration}`,
        html: `<b>${blockNumber}.</b> ${escapeHtml(`${timeRange} · ${block.title} · ${duration}`)}`,
      };
    }

    const play = state.plays.find((item) => item.id === scene.playId);
    const heading = getTelegramSceneHeading(scene);
    const characters = formatSceneCharacterList(state, scene);
    const core = `${timeRange} · ${heading}${characters} · ${duration}`;
    const scriptUrl = play ? resolveSceneScriptUrl(play, scene) : null;
    const linkedHeading = scriptUrl
      ? `<a href="${escapeHtml(scriptUrl)}">${escapeHtml(heading)}</a>`
      : escapeHtml(heading);

    return {
      plain: `${blockNumber}. ${core}`,
      html: `<b>${blockNumber}.</b> ${escapeHtml(`${timeRange} · `)}${linkedHeading}${escapeHtml(`${characters} · ${duration}`)}`,
    };
  }

  const typeLabel = blockTypeLabels[block.type];
  const play =
    block.type === 'etude' && block.playId
      ? state.plays.find((item) => item.id === block.playId)
      : undefined;
  const playSuffix = play ? ` · «${play.title}»` : '';
  const etudeActors = block.type === 'etude' ? formatEtudeActorList(state, block) : '';
  const core = `${timeRange} · ${typeLabel}: ${block.title}${playSuffix}${etudeActors} · ${duration}`;

  return {
    plain: `${blockNumber}. ${core}`,
    html: `<b>${blockNumber}.</b> ${escapeHtml(core)}`,
  };
}

function appendActorReminderBlockDetails(
  state: AppState,
  block: ScheduleBlock,
  htmlLines: string[]
): void {
  if (block.type === 'scene' && block.sceneId) {
    const scene = state.scenes.find((item) => item.id === block.sceneId);
    if (scene?.description?.trim()) {
      const excerpt = truncateTelegramText(scene.description, 140);
      htmlLines.push(`   <i>${escapeHtml(excerpt)}</i>`);
    }
  }

  if (block.type === 'task' && block.taskId) {
    const task = state.tasks.find((item) => item.id === block.taskId);
    if (task?.description?.trim()) {
      const excerpt = truncateTelegramText(task.description, 140);
      htmlLines.push(`   <i>${escapeHtml(excerpt)}</i>`);
    }
  }

  if (block.notes?.trim()) {
    const excerpt = truncateTelegramText(block.notes, 140);
    htmlLines.push(`   ${escapeHtml(excerpt)}`);
  }
}

function bullet(text: string): string {
  return `• ${text}`;
}

function indent(text: string): string {
  return `  ${text}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatActorTelegramName(actor: NonNullable<AppState['actors'][number]>): string {
  const username = actor.telegramUsername?.replace(/^@+/, '').trim();
  return username ? `${actor.name} @${username}` : actor.name;
}

function formatBlockRange(block: ScheduleBlock): string {
  const end = addMinutes(block.startTime, block.durationMinutes);
  return `${block.startTime}–${end}`;
}

function formatSceneCharacterList(state: AppState, scene: Scene): string {
  const names = getSceneCharacterNames(state, scene);
  if (names.length === 0) return '';
  return ` (${names.join(', ')})`;
}

function formatSceneLineCore(
  state: AppState,
  scene: Scene,
  block: ScheduleBlock,
  play: AppState['plays'][number] | undefined
): { plain: string; html: string } {
  const heading = getTelegramSceneHeading(scene);
  const characters = formatSceneCharacterList(state, scene);
  const location = getTelegramSceneLocation(scene);
  const duration = formatDuration(block.durationMinutes);
  const scriptUrl = play ? resolveSceneScriptUrl(play, scene) : null;

  const tail = location ? ` - ${location} - ${duration}` : ` - ${duration}`;
  const core = `${heading}${characters}${tail}`;
  const linkedHtml = scriptUrl
    ? `<a href="${escapeHtml(scriptUrl)}">${escapeHtml(heading)}</a>${escapeHtml(characters + tail)}`
    : escapeHtml(core);

  return { plain: core, html: linkedHtml };
}

function formatSceneNumberRanges(numbers: number[]): string {
  if (numbers.length === 0) return '';
  if (numbers.length === 1) return String(numbers[0]);

  const sorted = [...numbers].sort((a, b) => a - b);
  const parts: string[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] === rangeEnd + 1) {
      rangeEnd = sorted[index];
    } else {
      parts.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}–${rangeEnd}`);
      rangeStart = sorted[index];
      rangeEnd = sorted[index];
    }
  }
  parts.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}–${rangeEnd}`);
  return parts.join(', ');
}

function formatPlayScenesLabel(numbers: number[]): string {
  if (numbers.length === 0) return '';
  const ranges = formatSceneNumberRanges(numbers);
  return numbers.length === 1 ? `сцена ${ranges}` : `сцены ${ranges}`;
}

function buildPlanSummaryLine(state: AppState, rehearsal: Rehearsal): string | null {
  const sceneIds = getRehearsalAllSceneIds(rehearsal);
  const scenesByPlay = new Map<string, number[]>();
  const playOrder: string[] = [];

  for (const sceneId of sceneIds) {
    const scene = state.scenes.find((item) => item.id === sceneId);
    if (!scene) continue;
    const playId = scene.playId;
    if (!scenesByPlay.has(playId)) {
      scenesByPlay.set(playId, []);
      playOrder.push(playId);
    }
    scenesByPlay.get(playId)!.push(scene.number);
  }

  const parts: string[] = [];

  for (const playId of playOrder) {
    const play = state.plays.find((item) => item.id === playId);
    const numbers = scenesByPlay.get(playId) ?? [];
    if (numbers.length === 0) continue;
    const title = (play?.title ?? 'Без постановки').toUpperCase();
    parts.push(`${title}: ${formatPlayScenesLabel(numbers)}`);
  }

  const etudeTitles = rehearsal.schedule
    .filter((block) => block.type === 'etude')
    .map((block) => block.title.trim())
    .filter(Boolean);

  if (etudeTitles.length > 0) {
    parts.push(`ЭТЮДЫ: ${etudeTitles.join(', ')}`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

function formatBlockPrefix(blockNumber: number): string {
  return `${blockNumber}. `;
}

function formatBlockPrefixHtml(blockNumber: number): string {
  return `<b>${blockNumber}.</b> `;
}

function formatSceneBlock(
  state: AppState,
  block: ScheduleBlock,
  scene: Scene,
  play: AppState['plays'][number] | undefined,
  blockNumber: number
): { plainLines: string[]; htmlLines: string[] } {
  const { plain, html } = formatSceneLineCore(state, scene, block, play);
  const heading = getTelegramSceneHeading(scene);
  const characters = formatSceneCharacterList(state, scene);
  const location = getTelegramSceneLocation(scene);
  const duration = formatDuration(block.durationMinutes);
  const tail = location ? ` - ${location} - ${duration}` : ` - ${duration}`;
  const prefix = `${formatBlockPrefix(blockNumber)}${formatBlockRange(block)} · `;
  const prefixHtml = `${formatBlockPrefixHtml(blockNumber)}${escapeHtml(`${formatBlockRange(block)} · `)}`;
  const scriptUrl = play ? resolveSceneScriptUrl(play, scene) : null;

  const plainLines = [`${prefix}${plain}`];
  const htmlLines = [
    scriptUrl
      ? `${prefixHtml}<a href="${escapeHtml(scriptUrl)}">${escapeHtml(heading)}</a>${escapeHtml(`${characters}${tail}`)}`
      : `${prefixHtml}${html}`,
  ];

  if (scene.description?.trim()) {
    const excerpt = truncateTelegramText(scene.description, 140);
    plainLines.push(indent(`📄 ${excerpt}`));
    htmlLines.push(`   <i>${escapeHtml(excerpt)}</i>`);
  }

  if (block.notes?.trim()) {
    const excerpt = truncateTelegramText(block.notes, 140);
    plainLines.push(indent(`💬 ${excerpt}`));
    htmlLines.push(`   ${escapeHtml(excerpt)}`);
  }

  return { plainLines, htmlLines };
}

function formatEtudeActorList(state: AppState, block: ScheduleBlock): string {
  const names = (block.actorIds ?? [])
    .map((id) => state.actors.find((actor) => actor.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? ` (${names.join(', ')})` : '';
}

function formatGenericBlock(
  state: AppState,
  block: ScheduleBlock,
  blockNumber: number,
  options?: { task?: Task; play?: AppState['plays'][number] }
): string[] {
  const typeLabel = blockTypeLabels[block.type];
  const playSuffix =
    block.type === 'etude' && options?.play ? ` · «${options.play.title}»` : '';
  const etudeActors = block.type === 'etude' ? formatEtudeActorList(state, block) : '';
  const lines = [
    `${formatBlockPrefix(blockNumber)}${formatBlockRange(block)} · ${typeLabel}: ${block.title}${playSuffix}${etudeActors} · ${formatDuration(block.durationMinutes)}`,
  ];

  if (options?.task?.description?.trim()) {
    lines.push(indent(`📄 ${truncateTelegramText(options.task.description, 140)}`));
  }

  if (block.notes?.trim()) {
    lines.push(indent(`💬 ${truncateTelegramText(block.notes, 140)}`));
  }

  return lines;
}

function formatGenericBlockHtml(
  state: AppState,
  block: ScheduleBlock,
  blockNumber: number,
  options?: { task?: Task; play?: AppState['plays'][number] }
): string[] {
  const typeLabel = blockTypeLabels[block.type];
  const playSuffix =
    block.type === 'etude' && options?.play ? ` · «${options.play.title}»` : '';
  const etudeActors = block.type === 'etude' ? formatEtudeActorList(state, block) : '';
  const core = `${formatBlockRange(block)} · ${typeLabel}: ${block.title}${playSuffix}${etudeActors} · ${formatDuration(block.durationMinutes)}`;
  const htmlLines = [`${formatBlockPrefixHtml(blockNumber)}${escapeHtml(core)}`];

  if (options?.task?.description?.trim()) {
    htmlLines.push(`   <i>${escapeHtml(truncateTelegramText(options.task.description, 140))}</i>`);
  }

  if (block.notes?.trim()) {
    htmlLines.push(`   ${escapeHtml(truncateTelegramText(block.notes, 140))}`);
  }

  return htmlLines;
}

function resolveBlockPlayId(state: AppState, block: ScheduleBlock): string | null {
  if (block.type === 'scene' && block.sceneId) {
    return getScenePlayId(state, block.sceneId) ?? null;
  }
  if (block.type === 'etude' && block.playId) {
    return block.playId;
  }
  return null;
}

function countDistinctPlanPlays(state: AppState, schedule: ScheduleBlock[]): number {
  const playIds = new Set<string>();
  for (const block of schedule) {
    const playId = resolveBlockPlayId(state, block);
    if (playId) playIds.add(playId);
  }
  return playIds.size;
}

function formatRehearsalPlayHeader(state: AppState, rehearsal: Rehearsal): string {
  const titles = getRehearsalPlayTitles(state, rehearsal);
  if (titles.length === 0) return 'Без постановки';
  if (titles.length === 1) return `«${titles[0]}»`;
  return titles.map((title) => `«${title}»`).join(' · ');
}

function appendPlaySectionHeader(
  play: AppState['plays'][number] | undefined,
  plainLines: string[],
  htmlLines: string[]
): void {
  const title = play ? `«${play.title}»` : 'Без постановки';
  plainLines.push(title);
  htmlLines.push(escapeHtml(title));
}

function buildMessages(state: AppState, rehearsal: Rehearsal): TelegramExport {
  const performanceId = resolveRehearsalPerformanceId(state, rehearsal);
  const header = formatTelegramRehearsalHeader(state, rehearsal);
  const plainLines = [...header.plain];
  const htmlLines = [...header.html];

  const planSchedule = rehearsal.schedule;
  const participatingActors = getParticipatingActorIds(state, rehearsal)
    .map((id) => state.actors.find((a) => a.id === id))
    .filter(Boolean);

  if (participatingActors.length > 0) {
    plainLines.push(...section('👥 УЧАСТНИКИ'));
    htmlLines.push(telegramSection('👥 УЧАСТНИКИ'));
    for (const actor of participatingActors) {
      const roles =
        performanceId &&
        getActorAssignments(state, actor!.id)
          .filter((a) => a.performanceId === performanceId)
          .map((a) => state.playRoles.find((r) => r.id === a.roleId)?.name)
          .filter(Boolean)
          .join(', ');
      const actorName = formatActorTelegramName(actor!);
      const line = bullet(roles ? `${actorName} — ${roles}` : actorName);
      plainLines.push(line);
      htmlLines.push(escapeHtml(line));
    }
  }

  const groupPlanByPlay = countDistinctPlanPlays(state, planSchedule) > 1;

  if (planSchedule.length > 0) {
    plainLines.push(...section('📋 ПЛАН ПО ВРЕМЕНИ'));
    htmlLines.push(telegramSection('📋 ПЛАН ПО ВРЕМЕНИ'));

    let currentSectionPlayId: string | null = null;

    for (const [index, block] of planSchedule.entries()) {
      const blockNumber = index + 1;
      const blockPlayId = resolveBlockPlayId(state, block);
      const blockPlay = blockPlayId
        ? state.plays.find((play) => play.id === blockPlayId)
        : undefined;

      if (groupPlanByPlay && blockPlayId && blockPlayId !== currentSectionPlayId) {
        appendPlaySectionHeader(blockPlay, plainLines, htmlLines);
        currentSectionPlayId = blockPlayId;
      }

      if (block.type === 'scene') {
        const scene = block.sceneId ? state.scenes.find((s) => s.id === block.sceneId) : undefined;
        if (scene) {
          const scenePlay = blockPlay ?? state.plays.find((p) => p.id === scene.playId);
          const formatted = formatSceneBlock(state, block, scene, scenePlay, blockNumber);
          plainLines.push(...formatted.plainLines);
          htmlLines.push(...formatted.htmlLines);
        } else {
          const generic = formatGenericBlock(state, block, blockNumber);
          plainLines.push(...generic);
          htmlLines.push(...formatGenericBlockHtml(state, block, blockNumber));
        }
      } else {
        const task = block.taskId ? state.tasks.find((t) => t.id === block.taskId) : undefined;
        const generic = formatGenericBlock(state, block, blockNumber, {
          task,
          play: block.type === 'etude' ? blockPlay : undefined,
        });
        plainLines.push(...generic);
        htmlLines.push(
          ...formatGenericBlockHtml(state, block, blockNumber, {
            task,
            play: block.type === 'etude' ? blockPlay : undefined,
          })
        );
      }
      plainLines.push('');
      htmlLines.push('');
    }
    if (plainLines[plainLines.length - 1] === '') plainLines.pop();
    if (htmlLines[htmlLines.length - 1] === '') htmlLines.pop();
  }

  const scheduledTaskIds = new Set(
    planSchedule.map((b) => b.taskId).filter((id): id is string => Boolean(id))
  );
  const extraTasks = rehearsal.taskIds
    .filter((id) => !scheduledTaskIds.has(id))
    .map((id) => state.tasks.find((t) => t.id === id))
    .filter((task): task is Task => Boolean(task));

  if (extraTasks.length > 0) {
    plainLines.push(...section('✅ ЗАДАЧИ'));
    htmlLines.push(telegramSection('✅ ЗАДАЧИ'));
    for (const task of extraTasks) {
      plainLines.push(bullet(task.title));
      htmlLines.push(escapeHtml(bullet(task.title)));
      if (task.description?.trim()) {
        const excerpt = truncateTelegramText(task.description, 140);
        plainLines.push(indent(`📄 ${excerpt}`));
        htmlLines.push(`   <i>${escapeHtml(excerpt)}</i>`);
      }
    }
  }

  if (rehearsal.notes?.trim()) {
    plainLines.push(...section('📝 ЗАМЕТКИ'));
    htmlLines.push(telegramSection('📝 ЗАМЕТКИ'));
    plainLines.push(rehearsal.notes.trim());
    htmlLines.push(escapeHtml(rehearsal.notes.trim()));
  }

  return {
    text: plainLines.join('\n').trim(),
    html: `<div>${htmlLines.join('<br>')}</div>`,
    botHtml: htmlLines.join('\n'),
  };
}

export function buildRehearsalTelegramHtml(state: AppState, rehearsal: Rehearsal): string {
  return buildMessages(state, rehearsal).html;
}

export function buildRehearsalTelegramMessage(state: AppState, rehearsal: Rehearsal): string {
  return buildMessages(state, rehearsal).text;
}

export function buildRehearsalTelegramBotMessage(
  state: AppState,
  rehearsal: Rehearsal,
  options?: { initiatedBy?: string }
): string {
  const body = buildMessages(state, rehearsal).botHtml;
  const initiatedBy = options?.initiatedBy?.trim();
  if (!initiatedBy) return body;
  return `${body}\n\n<i>/ ${escapeHtml(initiatedBy)} /</i>`;
}

export function buildActorReminderTelegramBotMessage(
  state: AppState,
  rehearsal: Rehearsal,
  actorId: string
): string {
  const actor = state.actors.find((item) => item.id === actorId);
  const header = formatTelegramRehearsalHeader(state, rehearsal);
  const myBlocks = getActorScheduleBlocks(state, rehearsal, actorId);

  const lines: string[] = [
    actor
      ? `<b>${escapeHtml(actor.name)}</b>, напоминание о репетиции`
      : '<b>Напоминание о репетиции</b>',
    '',
    ...header.html,
  ];

  if (myBlocks.length > 0) {
    lines.push(telegramSection('Твой план').trim());
    myBlocks.forEach((block, index) => {
      const formatted = formatActorReminderScheduleBlock(state, block, index + 1);
      lines.push(formatted.html);
      appendActorReminderBlockDetails(state, block, lines);
      lines.push('');
    });
    if (lines[lines.length - 1] === '') lines.pop();
  } else {
    const myScenes = getActorScenesInRehearsal(state, rehearsal, actorId);
    if (myScenes.length > 0) {
      lines.push(telegramSection('Твои сцены').trim());
      for (const { play, scenes } of groupActorScenesByPlay(state, myScenes)) {
        if (play) {
          lines.push(`<i>«${escapeHtml(play.title)}»</i>`);
        }
        for (const scene of scenes) {
          lines.push(`• ${escapeHtml(getSceneShortLabel(scene))}`);
        }
      }
    }
  }

  if (rehearsal.notes?.trim()) {
    lines.push(telegramSection('📝 Заметки').trim());
    lines.push(escapeHtml(truncateTelegramText(rehearsal.notes, 240)));
  }

  return lines.join('\n');
}

export function buildActorShortReminderTelegramBotMessage(
  state: AppState,
  rehearsal: Rehearsal,
  actorId: string,
  reminderType?: ReminderType
): string {
  const actor = state.actors.find((item) => item.id === actorId);
  const dateLabel = format(parseISO(rehearsal.date), 'EEEE, d MMMM yyyy', { locale: ru });
  const capitalizedDate = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
  const playHeader = formatRehearsalPlayHeader(state, rehearsal);
  const location = resolveRehearsalLocation(rehearsal, state.venues);
  const rsvpStatus = rehearsal.rsvp?.[actorId];
  const planSummary = buildPlanSummaryLine(state, rehearsal);
  const myBlocks = getActorScheduleBlocks(state, rehearsal, actorId);

  const lines: string[] = [
    actor
      ? `<b>${escapeHtml(actor.name)}</b>, напоминание о репетиции`
      : '<b>Напоминание о репетиции</b>',
  ];

  if (reminderType) {
    lines.push(`<i>${escapeHtml(REMINDER_TYPE_LABELS[reminderType])}</i>`);
  }

  lines.push(
    '',
    `<b>${escapeHtml(playHeader)}</b>`,
    `📅 ${escapeHtml(capitalizedDate)}`,
    `⏰ ${escapeHtml(`${rehearsal.startTime} – ${rehearsal.endTime}`)}`
  );

  if (location) {
    lines.push(`📍 ${escapeHtml(location)}`);
  }

  if (planSummary) {
    lines.push(`<i>${escapeHtml(planSummary)}</i>`);
  }

  if (myBlocks.length > 0) {
    const first = myBlocks[0];
    const last = myBlocks[myBlocks.length - 1];
    const range = `${first.startTime}–${addMinutes(last.startTime, last.durationMinutes)}`;
    const sceneLabels = myBlocks
      .filter((block) => block.type === 'scene' && block.sceneId)
      .map((block) => {
        const scene = state.scenes.find((item) => item.id === block.sceneId);
        return scene ? getTelegramSceneHeading(scene) : block.title;
      });
    if (sceneLabels.length > 0) {
      lines.push(`🎬 ${escapeHtml(range)} · ${escapeHtml(sceneLabels.join(', '))}`);
    }
  }

  if (rsvpStatus) {
    lines.push('', `Ваш ответ: <b>${escapeHtml(formatActorRsvpStatusLine(rsvpStatus))}</b>`);
  }

  return lines.join('\n');
}

export function buildActorPlanTelegramBotMessage(
  state: AppState,
  rehearsal: Rehearsal,
  actorId: string
): string {
  const actor = state.actors.find((item) => item.id === actorId);
  const header = formatTelegramRehearsalHeader(state, rehearsal);
  const myBlocks = getActorScheduleBlocks(state, rehearsal, actorId);

  const lines: string[] = [
    actor ? `<b>${escapeHtml(actor.name)}</b>, ваш план` : '<b>Ваш план</b>',
    '',
    ...header.html,
  ];

  if (myBlocks.length > 0) {
    lines.push(telegramSection('Твой план').trim());
    myBlocks.forEach((block, index) => {
      const formatted = formatActorReminderScheduleBlock(state, block, index + 1);
      lines.push(formatted.html);
      appendActorReminderBlockDetails(state, block, lines);
      lines.push('');
    });
    if (lines[lines.length - 1] === '') lines.pop();
  } else {
    const myScenes = getActorScenesInRehearsal(state, rehearsal, actorId);
    if (myScenes.length > 0) {
      lines.push(telegramSection('Твои сцены').trim());
      for (const { play, scenes } of groupActorScenesByPlay(state, myScenes)) {
        if (play) {
          lines.push(`<i>«${escapeHtml(play.title)}»</i>`);
        }
        for (const scene of scenes) {
          lines.push(`• ${escapeHtml(getSceneShortLabel(scene))}`);
        }
      }
    } else {
      lines.push('', 'В плане пока нет ваших сцен.');
    }
  }

  return lines.join('\n');
}

export async function copyRehearsalTelegramMessage(
  state: AppState,
  rehearsal: Rehearsal
): Promise<void> {
  const { text } = buildMessages(state, rehearsal);
  await navigator.clipboard.writeText(text);
}
