import json
from pathlib import Path

scenes = json.loads(
    Path("tmp-scenes.json").read_text(encoding="utf-8")
)


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'")


out: list[str] = [
    "import type { AppState, PlayRole, Scene } from '../types';",
    "import { generateId } from '../utils/id';",
    "",
    "/** Сцены из инсценировки «Каменное сердце», вер. 4 (27 янв 2026) */",
    "export const STONE_HEART_SCENES_SOURCE = '«Каменное сердце», инсценировка, вер. 4.docx';",
    "export const STONE_HEART_SCENES_VERSION = '1';",
    "",
    "export interface StoneHeartSceneSeed {",
    "  act: number;",
    "  part?: string;",
    "  sceneInAct: number;",
    "  title: string;",
    "  location: string;",
    "  characters: string[];",
    "  synopsis?: string;",
    "}",
    "",
    "export const STONE_HEART_SCENE_DATA: StoneHeartSceneSeed[] = [",
]

for sc in scenes:
    out.append("  {")
    out.append(f"    act: {sc['act']},")
    if sc.get("part"):
        out.append(f"    part: '{esc(sc['part'])}',")
    out.append(f"    sceneInAct: {sc['sceneInAct']},")
    out.append(f"    title: '{esc(sc['title'])}',")
    out.append(f"    location: '{esc(sc['location'])}',")
    chars = ", ".join(f"'{esc(c)}'" for c in sc["characters"])
    out.append(f"    characters: [{chars}],")
    if sc.get("synopsis"):
        out.append(f"    synopsis: '{esc(sc['synopsis'])}',")
    out.append("  },")

out.append("];")
out.append("")
out.append(
    """function findRoleId(playRoles: PlayRole[], playId: string, roleName: string): string | undefined {
  const roles = playRoles.filter((r) => r.playId === playId && r.kind === 'character');
  const exact = roles.find((r) => r.name === roleName);
  if (exact) return exact.id;
  const normalized = roleName.trim().toLowerCase();
  return roles.find((r) => r.name.trim().toLowerCase() === normalized)?.id;
}

export function buildStoneHeartScenes(playId: string, playRoles: PlayRole[]): Scene[] {
  return STONE_HEART_SCENE_DATA.map((entry, index) => ({
    id: generateId(),
    playId,
    number: index + 1,
    title: entry.title,
    description: entry.synopsis,
    estimatedMinutes: 5,
    status: 'not_started' as const,
    roleIds: entry.characters
      .map((name) => findRoleId(playRoles, playId, name))
      .filter((id): id is string => Boolean(id)),
  }));
}

export function applyStoneHeartScenesToState(state: AppState, playId: string): AppState {
  const scenes = buildStoneHeartScenes(playId, state.playRoles);
  return {
    ...state,
    scenes: [...state.scenes.filter((s) => s.playId !== playId), ...scenes],
  };
}
"""
)

Path("src/data/stoneHeartScenes.ts").write_text("\n".join(out), encoding="utf-8")
print(f"written {len(scenes)} scenes")
