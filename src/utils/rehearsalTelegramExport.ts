import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { AppState, Rehearsal, ScheduleBlock, Scene, Task } from '../types';
import { resolveSceneScriptUrl } from './googleDocs';
import { getTelegramSceneHeading, getTelegramSceneLocation, getSceneCharacterNames } from './sceneLabels';
import { formatPerformanceLabel, getActorAssignments } from '../store/selectors';
import { getParticipatingActorIds, resolveRehearsalPerformanceId } from './rehearsalActors';
import { resolveRehearsalLocation } from './venue';
import { addMinutes, formatDuration } from './time';

const blockTypeLabels: Record<ScheduleBlock['type'], string> = {
  scene: 'Сцена',
  task: 'Задача',
  break: 'Перерыв',
  warmup: 'Разминка',
  custom: 'Другое',
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

function formatGenericBlock(
  block: ScheduleBlock,
  blockNumber: number,
  task?: Task
): string[] {
  const typeLabel = blockTypeLabels[block.type];
  const lines = [
    `${formatBlockPrefix(blockNumber)}${formatBlockRange(block)} · ${typeLabel}: ${block.title} · ${formatDuration(block.durationMinutes)}`,
  ];

  if (task?.description?.trim()) {
    lines.push(indent(`📄 ${task.description.trim()}`));
  }

  if (block.notes?.trim()) {
    lines.push(indent(`💬 ${block.notes.trim()}`));
  }

  return lines;
}

function buildMessages(state: AppState, rehearsal: Rehearsal): TelegramExport {
  const play = state.plays.find((p) => p.id === (rehearsal.playId ?? state.activePlayId));
  const performance = state.performances.find(
    (p) => p.id === resolveRehearsalPerformanceId(state, rehearsal)
  );
  const location = resolveRehearsalLocation(rehearsal, state.venues);
  const dateLabel = format(parseISO(rehearsal.date), 'EEEE, d MMMM yyyy', { locale: ru });

  const plainLines: string[] = [
    '🎭 РЕПЕТИЦИЯ',
    play ? `«${play.title}»` : 'Без постановки',
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

  if (sortedSchedule.length > 0) {
    plainLines.push(...section('📋 ПЛАН ПО ВРЕМЕНИ'));
    htmlLines.push(...section('📋 ПЛАН ПО ВРЕМЕНИ').map(escapeHtml));

    for (const [index, block] of sortedSchedule.entries()) {
      const blockNumber = index + 1;
      if (block.type === 'scene') {
        const scene = block.sceneId ? state.scenes.find((s) => s.id === block.sceneId) : undefined;
        if (scene) {
          const formatted = formatSceneBlock(state, block, scene, play, blockNumber);
          plainLines.push(...formatted.plainLines);
          htmlLines.push(...formatted.htmlLines);
        } else {
          const generic = formatGenericBlock(block, blockNumber);
          plainLines.push(...generic);
          htmlLines.push(...generic.map(escapeHtml));
        }
      } else {
        const task = block.taskId ? state.tasks.find((t) => t.id === block.taskId) : undefined;
        const generic = formatGenericBlock(block, blockNumber, task);
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

export function buildRehearsalTelegramBotMessage(state: AppState, rehearsal: Rehearsal): string {
  return buildMessages(state, rehearsal).botHtml;
}

export async function copyRehearsalTelegramMessage(
  state: AppState,
  rehearsal: Rehearsal
): Promise<void> {
  const { text } = buildMessages(state, rehearsal);
  await navigator.clipboard.writeText(text);
}
