import { isCharacterLabelForRole } from '../src/utils/sceneRoleAssignment.ts';
import { clampImageCropOffset } from '../src/utils/imageCrop.ts';
import { createWeekdayUnavailability, isActorUnavailable } from '../src/utils/actorAvailability.ts';
import { countRsvpSummary } from '../src/utils/rehearsalRsvp.ts';
import { parseSceneLearnLines } from '../src/utils/sceneLearnLines.ts';
import {
  convertEmphasisHtmlToLearnText,
  docxParagraphToLearnLine,
  isEntirelyEmphasisHtml,
  isEntirelyRemarkHtml,
  paragraphsToLearnScriptText,
} from '../src/utils/docxLearnText.ts';
import { expandScriptTextToLines } from '../src/utils/scriptTextLines.ts';
import {
  formatDecidedNotesForDisplay,
  formatMention,
  parseDecidedNotesMentions,
  syncDecidedNotesToActorNotes,
} from '../src/utils/decidedNotesMentions.ts';
import type { AppState, PlayRole } from '../src/types.ts';

function assert(name: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL ${name}`);
    process.exit(1);
  }
  console.log(`PASS ${name}`);
}

const actor = {
  id: 'a1',
  name: 'Test',
  status: 'active' as const,
  unavailability: [
    createWeekdayUnavailability([1, 2, 3, 4, 5], 'Будни до 19', 'w1', {
      startTime: '00:00',
      endTime: '19:00',
    }),
  ],
};

assert(
  'weekday unavailability blocks morning',
  isActorUnavailable(actor, '2026-07-06', { startTime: '10:00', endTime: '12:00' })
);
assert(
  'weekday unavailability free evening',
  !isActorUnavailable(actor, '2026-07-06', { startTime: '20:00', endTime: '21:00' })
);
assert(
  'image crop offset allows upward pan',
  clampImageCropOffset(40, 400, 280) === 40 && clampImageCropOffset(80, 400, 280) === 60
);

const summary = countRsvpSummary(
  {
    id: 'r1',
    date: '2026-07-06',
    startTime: '18:00',
    endTime: '21:00',
    sceneIds: [],
    taskIds: [],
    schedule: [],
    actorIds: ['a1', 'a2'],
    rsvp: { a1: 'confirmed', a2: 'declined' },
  },
  ['a1', 'a2', 'a3']
);
assert('rsvp summary confirmed', summary.confirmed === 1);
assert('rsvp summary declined', summary.declined === 1);
assert('rsvp summary pending', summary.pending === 1);

const playRoles: PlayRole[] = [
  { id: 'role-peter', playId: 'play-1', name: 'Петер Мунк', kind: 'character' },
  { id: 'role-michel', playId: 'play-1', name: 'Михель-Голландец', kind: 'character' },
];

const sampleScript =
  'Петер идёт по ЛЕСУ. В лесу поднимается сильный ветер. Петер: Да где же эта ель? Михель-Голландец: Ну вот, опять ты!';

const expanded = expandScriptTextToLines(sampleScript);
assert('expand script splits stage direction and dialogue', expanded.length >= 3);
assert('expand script finds colon dialogue', expanded.some((line) => line.startsWith('Петер:')));

const learnLines = parseSceneLearnLines(sampleScript, playRoles, 'play-1', new Set(['role-peter']));
const peterLines = learnLines.filter((line) => line.isActorLine);
assert('parse learn lines finds actor dialogue', peterLines.length >= 1);
assert('parse learn lines marks colon format', peterLines.some((line) => line.text.includes('Петер:')));

const michelRoleId = '2df71a4e-f2b4-474d-8d65-04667537d8f3';
const michelLines = parseSceneLearnLines(
  'Михель: Что ты делаешь в лесу?',
  [
    {
      id: michelRoleId,
      playId: 'play-1',
      name: 'Михель-Голландец',
      kind: 'character',
      order: 1,
      scriptAliases: ['Михель'],
    },
  ],
  'play-1',
  new Set([michelRoleId])
);
assert(
  'script alias matches role',
  michelLines.some((line) => line.isActorLine && line.text.startsWith('Михель:'))
);

const michelContinuation = parseSceneLearnLines(
  'Петер: Не та? Как это?\nМихель: Не туда ты забрёл. Но раз уж ты ищешь Стеклянного человека, то я скажу...\nЗря. Денег он даёт мало, а осчастливить кого-то?\nПетер: А кто может?',
  [
    {
      id: michelRoleId,
      playId: 'play-1',
      name: 'Михель-Голландец',
      kind: 'character',
      order: 1,
      scriptAliases: ['Михель'],
    },
    { id: 'role-peter', playId: 'play-1', name: 'Петер', kind: 'character', order: 2 },
  ],
  'play-1',
  new Set([michelRoleId])
);
const continuationLine = michelContinuation.find((line) => line.text.startsWith('Зря.'));
assert(
  'dialogue continues after inline character line',
  continuationLine?.kind === 'dialogue' &&
    continuationLine.roleName === 'Михель' &&
    continuationLine.isActorLine === true
);

const remarkAfterSpeech = parseSceneLearnLines(
  'Михель: А, Петер. Проходи, садись.\n(Вся пещера увешана шкурами.)\nПетер: Вы знаете меня?',
  [
    {
      id: michelRoleId,
      playId: 'play-1',
      name: 'Михель-Голландец',
      kind: 'character',
      order: 1,
      scriptAliases: ['Михель'],
    },
    { id: 'role-peter', playId: 'play-1', name: 'Петер', kind: 'character', order: 2 },
  ],
  'play-1',
  new Set([michelRoleId])
);
const caveLine = remarkAfterSpeech.find((line) => line.text.includes('пещера'));
assert(
  'remark after finished speech is not actor dialogue',
  caveLine?.kind === 'direction' && caveLine.isActorLine === false
);

const nestedRemark = parseSceneLearnLines(
  'Михель: А, Петер. Проходи, садись.\nВся пещера (стены) увешана шкурами животных.\nНад вытесанном в стене отверстии для котла (импровизированном камине) висят часы.\nПетер: Вы знаете меня?',
  [
    {
      id: michelRoleId,
      playId: 'play-1',
      name: 'Михель-Голландец',
      kind: 'character',
      order: 1,
      scriptAliases: ['Михель'],
    },
    { id: 'role-peter', playId: 'play-1', name: 'Петер', kind: 'character', order: 2 },
  ],
  'play-1',
  new Set([michelRoleId])
);
const remarkLines = nestedRemark.filter((line) => line.kind === 'direction');
assert(
  'stage direction with inner parentheses stays whole',
  remarkLines.length === 2 &&
    remarkLines.every((line) => !line.isActorLine) &&
    remarkLines.some((line) => line.text.includes('(стены)')) &&
    remarkLines.some((line) => line.text.includes('(импровизированном камине)'))
);

assert(
  'docx em italic paragraph detected',
  isEntirelyEmphasisHtml('<em>Вся пещера (стены) увешана шкурами</em>')
);
assert(
  'docx italic span style detected',
  isEntirelyRemarkHtml('<span style="font-style: italic">Петер идёт по лесу.</span>')
);
assert(
  'docx italic span becomes direction',
  docxParagraphToLearnLine({
    plainText: 'Петер идёт по лесу.',
    html: '<span style="font-style: italic">Петер идёт по лесу.</span>',
    isEntirelyItalic: true,
  }) === '(Петер идёт по лесу.)'
);
assert(
  'docx plain narrative paragraph becomes remark',
  docxParagraphToLearnLine({
    plainText: 'Петер идёт по ЛЕСУ. В лесу поднимается сильный ветер.',
    html: 'Петер идёт по ЛЕСУ. В лесу поднимается сильный ветер.',
    isEntirelyItalic: false,
  }) === '(Петер идёт по ЛЕСУ. В лесу поднимается сильный ветер.)'
);
assert(
  'docx dialogue paragraph stays dialogue',
  docxParagraphToLearnLine({
    plainText: 'Петер: Да где же эта ель?',
    html: '<strong>Петер:</strong> Да где же эта ель?',
    isEntirelyItalic: false,
  }) === 'Петер: Да где же эта ель?'
);
const forestRemark = parseSceneLearnLines(
  'Петер идёт по ЛЕСУ. В лесу поднимается сильный ветер.\nПетер: Да где же эта ель?',
  [{ id: 'role-peter', playId: 'play-1', name: 'Петер', kind: 'character', order: 1 }],
  'play-1',
  new Set()
);
assert(
  'plain narrative line renders as direction',
  forestRemark[0]?.kind === 'direction' && forestRemark[0].text.includes('ЛЕСУ')
);
assert(
  'zrya is not treated as character label',
  !isCharacterLabelForRole('Михель', 'Зря') && isCharacterLabelForRole('Михель', 'Михель')
);
assert(
  'docx italic paragraph becomes direction',
  docxParagraphToLearnLine({
    plainText: 'Вся пещера (стены) увешана шкурами',
    html: '<em>Вся пещера (стены) увешана шкурами</em>',
    isEntirelyItalic: true,
  }) === '(Вся пещера (стены) увешана шкурами)'
);
assert(
  'docx inline italic converted',
  convertEmphasisHtmlToLearnText('Петер смотрит. <em>Он отворачивается.</em>') ===
    'Петер смотрит. (Он отворачивается.)'
);
assert(
  'docx merges consecutive italic paragraphs',
  paragraphsToLearnScriptText([
    {
      plainText: 'Вся пещера',
      html: '<em>Вся пещера</em>',
      isEntirelyItalic: true,
    },
    {
      plainText: '(стены) увешана шкурами',
      html: '<em>(стены) увешана шкурами</em>',
      isEntirelyItalic: true,
    },
  ]) === '(Вся пещера (стены) увешана шкурами)'
);

const directionLines = parseSceneLearnLines(
  '(Вся пещера увешана шкурами.)\nМихель: Здравствуйте.',
  [{ id: michelRoleId, playId: 'play-1', name: 'Михель-Голландец', kind: 'character', order: 1 }],
  'play-1',
  new Set([michelRoleId])
);
assert(
  'parenthesized direction parsed as direction',
  directionLines[0]?.kind === 'direction'
);

const mentionState = {
  theaters: [{ id: 'th1', name: 'Театр' }],
  activeTheaterId: 'th1',
  actors: [
    { id: 'actor-1', theaterId: 'th1', name: 'Анна', status: 'active' as const },
    { id: 'actor-2', theaterId: 'th1', name: 'Борис', status: 'active' as const },
  ],
  plays: [{ id: 'play-1', theaterId: 'th1', title: 'Спектакль', author: 'Автор' }],
  activePlayId: 'play-1',
  selectedPerformanceByPlayId: {},
  playRoles: [
    { id: 'role-anna', playId: 'play-1', name: 'Героя', kind: 'character' as const, order: 1 },
    { id: 'role-boris', playId: 'play-1', name: 'Злодей', kind: 'character' as const, order: 2 },
  ],
  performances: [{ id: 'perf-1', playId: 'play-1', name: 'Основной', isDefault: true }],
  castAssignments: [
    {
      id: 'cast-1',
      playId: 'play-1',
      performanceId: 'perf-1',
      roleId: 'role-anna',
      actorId: 'actor-1',
    },
    {
      id: 'cast-2',
      playId: 'play-1',
      performanceId: 'perf-1',
      roleId: 'role-boris',
      actorId: 'actor-2',
    },
  ],
  scenes: [
    {
      id: 'scene-1',
      playId: 'play-1',
      number: 1,
      title: 'Сцена 1',
      status: 'not_started' as const,
      roleIds: ['role-anna', 'role-boris'],
    },
  ],
  tasks: [],
  venues: [],
  rehearsals: [
    {
      id: 'reh-1',
      theaterId: 'th1',
      date: '2026-07-06',
      startTime: '18:00',
      endTime: '21:00',
      sceneIds: ['scene-1'],
      taskIds: [],
      schedule: [
        {
          id: 'block-1',
          startTime: '18:00',
          durationMinutes: 30,
          type: 'scene' as const,
          title: 'Сцена 1',
          sceneId: 'scene-1',
          decidedNotes: `${formatMention('Анна', 'actor', 'actor-1')} сделать паузу длиннее\nОбщая строка без упоминания\n${formatMention('Злодей', 'role', 'role-boris')} усилить интонацию`,
        },
      ],
      actorIds: ['actor-1', 'actor-2'],
      playId: 'play-1',
      performanceId: 'perf-1',
    },
  ],
  rehearsalActorNotes: [],
  appMeta: {},
} satisfies AppState;

const parsed = parseDecidedNotesMentions(
  mentionState.rehearsals[0]!.schedule[0]!.decidedNotes!,
  mentionState,
  mentionState.rehearsals[0]!,
  'scene-1'
);
assert('mention parse creates actor line', parsed.some((line) => line.actorId === 'actor-1'));
assert('mention parse resolves role to actor', parsed.some((line) => line.actorId === 'actor-2'));
assert(
  'mention parse skips lines without mentions',
  !parsed.some((line) => line.text.includes('Общая строка'))
);
assert(
  'mention display strips markup',
  formatDecidedNotesForDisplay(formatMention('Анна', 'actor', 'actor-1')) === '@Анна'
);

const synced = syncDecidedNotesToActorNotes(mentionState);
assert('mention sync creates actor notes', (synced.rehearsalActorNotes ?? []).length === 2);
assert(
  'mention sync links scene and block',
  (synced.rehearsalActorNotes ?? []).every(
    (note) => note.sceneId === 'scene-1' && note.scheduleBlockId === 'block-1'
  )
);

console.log('\nAll unit checks passed\n');
