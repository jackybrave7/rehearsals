import { CHARACTER_CUE_LINE_RE, CHARACTER_DIALOGUE_INLINE_RE } from '../utils/scriptTextLines';
import { isCharacterLabelForRole } from '../utils/sceneRoleAssignment';
import type { SceneLearnLine } from '../utils/sceneLearnLines';

function normalizeCharacterToken(value: string): string {
  return value.replace(/[:.]$/, '').trim();
}

function CharacterName({ name, marker }: { name: string; marker: ':' | '.' }) {
  return (
    <strong className="font-bold uppercase">
      {name.toUpperCase()}
      {marker}
    </strong>
  );
}

export function LearnLineText({ line }: { line: SceneLearnLine }) {
  const inline = line.text.match(CHARACTER_DIALOGUE_INLINE_RE);
  if (
    inline &&
    line.roleName &&
    isCharacterLabelForRole(line.roleName, inline[1]) &&
    (line.kind === 'dialogue' || line.kind === 'cue')
  ) {
    const name = inline[1];
    const separator = line.text.charAt(name.length);
    const marker = separator === '.' ? '.' : ':';
    const speech = (inline[2] ?? '').trim();
    return (
      <>
        <CharacterName name={name} marker={marker} />
        {speech ? ` ${speech}` : ''}
      </>
    );
  }

  const trimmed = line.text.trim();
  if (line.kind === 'cue' && CHARACTER_CUE_LINE_RE.test(trimmed) && line.roleName) {
    const name = normalizeCharacterToken(trimmed);
    const marker = trimmed.endsWith('.') ? '.' : ':';
    return <CharacterName name={name} marker={marker} />;
  }

  return <>{line.text}</>;
}
