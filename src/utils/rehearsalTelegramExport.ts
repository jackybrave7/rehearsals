import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { AppState, Rehearsal, ScheduleBlock, Scene, Task } from '../types';
import { resolveSceneScriptUrl } from './googleDocs';
import { getTelegramSceneHeading, getTelegramSceneLocation, getSceneCharacterNames, getSceneShortLabel } from './sceneLabels';
import { formatPerformanceLabel, getActorAssignments } from '../store/selectors';
import { getParticipatingActorIds, resolveRehearsalPerformanceId } from './rehearsalActors';
import { getRehearsalPlayTitles, getScenePlayId } from './rehearsalPlays';
import { resolveRehearsalLocation } from './venue';
import { addMinutes, formatDuration } from './time';
import { getActorSceneNumbersInRehearsal, getActorScenesInRehearsal } from './actorProfile';
import { groupActorScenesByPlay } from './actorMyPage';

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

function formatBlockPrefix(blockNumber: number): string {
  return `👉 ${blockNumber}. `;
}

function formatSceneBlock(
  state: AppState,
  block: ScheduleBlock,
  scene: Scene,
  play: AppState['plays'][number] | undefined,
  blockNumber: number
): { plainLines: string[]; htmlLines: string[] } {
  const { plain, html } = formatSceneLineCore(state, scene, block, play);
  const prefix = `${formatBlockPrefix(blockNumber)}${formatBlockRange(block)} · `;
  const scriptUrl = play ? resolveSceneScriptUrl(play, scene) : null;

  const plainLines = [`${prefix}${plain}`];
  const htmlLines = [`${escapeHtml(prefix)}${html}`];

  if (scriptUrl) {
    plainLines.push(indent(`🔗 ${scriptUrl}`));
  }

  if (scene.description?.trim()) {
    plainLines.push(indent(`📄 ${scene.description.trim()}`));
    htmlLines.push(escapeHtml(indent(`📄 ${scene.description.trim()}`)));
  }

  if (block.notes?.trim()) {
    plainLines.push(indent(`💬 ${block.notes.trim()}`));
    htmlLines.push(escapeHtml(indent(`💬 ${block.notes.trim()}`)));
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
    lines.push(indent(`📄 ${options.task.description.trim()}`));
  }

  if (block.notes?.trim()) {
    lines.push(indent(`💬 ${block.notes.trim()}`));
  }

  return lines;
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
  const performance = state.performances.find(
    (p) => p.id === resolveRehearsalPerformanceId(state, rehearsal)
  );
  const location = resolveRehearsalLocation(rehearsal, state.venues);
  const dateLabel = format(parseISO(rehearsal.date), 'EEEE, d MMMM yyyy', { locale: ru });

  const plainLines: string[] = [
    '🎭 РЕПЕТИЦИЯ',
    formatRehearsalPlayHeader(state, rehearsal),
    `📅 ${dateLabel.charAt(0).toUpperCase()}${dateLabel.slice(1)}`,
    `⏰ ${rehearsal.startTime} – ${rehearsal.endTime}`,
  ];
  const htmlLines = [...plainLines.map(escapeHtml)];

  if (location) {
    plainLines.push(`📍 ${location}`);
    htmlLines.push(escapeHtml(`📍 ${location}`));
  }
  if (performance) {
    plainLines.push(`🎬 ${formatPerformanceLabel(performance)}`);
    htmlLines.push(escapeHtml(`🎬 ${formatPerformanceLabel(performance)}`));
  }

  const performanceId = resolveRehearsalPerformanceId(state, rehearsal);
  const participatingActors = getParticipatingActorIds(state, rehearsal)
    .map((id) => state.actors.find((a) => a.id === id))
    .filter(Boolean);

  if (participatingActors.length > 0) {
    plainLines.push(...section('👥 УЧАСТНИКИ'));
    htmlLines.push(...section('👥 УЧАСТНИКИ').map(escapeHtml));
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

  const sortedSchedule = [...rehearsal.schedule].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );
  const groupPlanByPlay = countDistinctPlanPlays(state, sortedSchedule) > 1;

  if (sortedSchedule.length > 0) {
    plainLines.push(...section('📋 ПЛАН ПО ВРЕМЕНИ'));
    htmlLines.push(...section('📋 ПЛАН ПО ВРЕМЕНИ').map(escapeHtml));

    let currentSectionPlayId: string | null = null;

    for (const [index, block] of sortedSchedule.entries()) {
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
          htmlLines.push(...generic.map(escapeHtml));
        }
      } else {
        const task = block.taskId ? state.tasks.find((t) => t.id === block.taskId) : undefined;
        const generic = formatGenericBlock(state, block, blockNumber, {
          task,
          play: block.type === 'etude' ? blockPlay : undefined,
        });
        plainLines.push(...generic);
        htmlLines.push(...generic.map(escapeHtml));
      }
      plainLines.push('');
      htmlLines.push('');
    }
    if (plainLines[plainLines.length - 1] === '') plainLines.pop();
    if (htmlLines[htmlLines.length - 1] === '') htmlLines.pop();
  }

  const scheduledTaskIds = new Set(
    sortedSchedule.map((b) => b.taskId).filter((id): id is string => Boolean(id))
  );
  const extraTasks = rehearsal.taskIds
    .filter((id) => !scheduledTaskIds.has(id))
    .map((id) => state.tasks.find((t) => t.id === id))
    .filter((task): task is Task => Boolean(task));

  if (extraTasks.length > 0) {
    plainLines.push(...section('✅ ЗАДАЧИ'));
    htmlLines.push(...section('✅ ЗАДАЧИ').map(escapeHtml));
    for (const task of extraTasks) {
      plainLines.push(bullet(task.title));
      htmlLines.push(escapeHtml(bullet(task.title)));
      if (task.description?.trim()) {
        plainLines.push(indent(`📄 ${task.description.trim()}`));
        htmlLines.push(escapeHtml(indent(`📄 ${task.description.trim()}`)));
      }
    }
  }

  if (rehearsal.notes?.trim()) {
    plainLines.push(...section('📝 ЗАМЕТКИ'));
    htmlLines.push(...section('📝 ЗАМЕТКИ').map(escapeHtml));
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
  const body = buildRehearsalTelegramBotMessage(state, rehearsal);
  const greeting = actor
    ? `<b>${escapeHtml(actor.name)}</b>, напоминание о репетиции:\n\n`
    : `<b>Напоминание о репетиции</b>\n\n`;

  const sceneNumbers = getActorSceneNumbersInRehearsal(state, rehearsal, actorId);
  const scenesLine =
    sceneNumbers.length > 0 ? `\n\nТвои сцены: ${sceneNumbers.join(', ')}` : '';

  return `${greeting}${body}${scenesLine}`;
}

export function buildActorPlanTelegramBotMessage(
  state: AppState,
  rehearsal: Rehearsal,
  actorId: string
): string {
  const actor = state.actors.find((item) => item.id === actorId);
  const location = resolveRehearsalLocation(rehearsal, state.venues);
  const dateLabel = format(parseISO(rehearsal.date), 'EEEE, d MMMM yyyy', { locale: ru });
  const playHeader = formatRehearsalPlayHeader(state, rehearsal);

  const lines = [
    actor ? `<b>${escapeHtml(actor.name)}</b>, ваш план:` : '<b>Ваш план</b>',
    '',
    `🎭 ${escapeHtml(playHeader)}`,
    `📅 ${escapeHtml(dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1))}`,
    `⏰ ${escapeHtml(`${rehearsal.startTime} – ${rehearsal.endTime}`)}`,
  ];

  if (location) {
    lines.push(`📍 ${escapeHtml(location)}`);
  }

  const myScenes = getActorScenesInRehearsal(state, rehearsal, actorId);
  if (myScenes.length > 0) {
    lines.push('', '<b>Ваши сцены:</b>');
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

  return lines.join('\n');
}

export async function copyRehearsalTelegramMessage(
  state: AppState,
  rehearsal: Rehearsal
): Promise<void> {
  const { text } = buildMessages(state, rehearsal);
  await navigator.clipboard.writeText(text);
}
