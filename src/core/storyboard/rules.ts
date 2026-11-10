import type { Storyboard, StoryboardScene } from '../../shared/schemas';

const SIDE_OF: Record<string, 'left' | 'right' | 'center' | null> = {
  left: 'left',
  'top-left': 'left',
  right: 'right',
  'top-right': 'right',
  center: 'center',
  bottom: 'center',
  top: null,
  around: null,
  hand: null,
};

/** Continuity / composition rules that schema validation cannot express. */
export function reviewStoryboardRules(sb: Storyboard): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  sb.scenes.forEach((s, i) => {
    if (ids.has(s.id)) issues.push(`Scene ${i + 1}: duplicate id ${s.id}`);
    ids.add(s.id);
    const placements = s.props.filter((p) => p.placement !== 'around').map((p) => p.placement);
    const dup = placements.find((p, k) => placements.indexOf(p) !== k);
    if (dup) issues.push(`Scene ${s.id}: two props share placement "${dup}"`);
    if (s.character.visible) {
      for (const p of s.props) {
        if (SIDE_OF[p.placement] && SIDE_OF[p.placement] === s.character.position && p.placement !== 'bottom') {
          issues.push(`Scene ${s.id}: prop ${p.asset} overlaps the character (${p.placement})`);
        }
      }
      if (s.props.some((p) => p.placement === 'hand') && !['holding-money', 'holding-phone', 'pointing', 'explaining', 'surprised', 'idle', 'happy'].includes(s.character.pose)) {
        issues.push(`Scene ${s.id}: "hand" prop with pose ${s.character.pose}`);
      }
    }
    if (s.chart && s.props.some((p) => p.placement === 'center')) issues.push(`Scene ${s.id}: chart and a centered prop collide`);
    for (const p of s.props) if (p.imageKey && !sb.illustrations.some((il) => il.key === p.imageKey)) issues.push(`Scene ${s.id}: unknown illustration "${p.imageKey}"`);
  });
  const visible = sb.scenes.filter((s) => s.character.visible).length;
  if (visible < Math.ceil(sb.scenes.length * 0.6)) issues.push('The mascot is visible in too few scenes; keep it on screen for continuity.');
  for (let i = 2; i < sb.scenes.length; i++) {
    const a = sb.scenes[i - 2]!;
    const b = sb.scenes[i - 1]!;
    const c = sb.scenes[i]!;
    if (a.camera === b.camera && b.camera === c.camera && c.camera !== 'static') issues.push(`Scenes ${a.id}-${c.id}: same camera move three times in a row`);
  }
  return issues;
}

/**
 * Deterministic repairs applied to every storyboard (any provider) so the
 * render is always well-composed and continuous.
 */
export function repairStoryboard(sb: Storyboard): Storyboard {
  const scenes: StoryboardScene[] = sb.scenes.map((s, i) => {
    const sc: StoryboardScene = structuredClone(s);
    sc.id = `s${String(i + 1).padStart(2, '0')}`;
    if (i === 0) sc.transition = 'cut';
    // Move props away from the character's side.
    if (sc.character.visible) {
      const opposite = sc.character.position === 'left' ? 'right' : sc.character.position === 'right' ? 'left' : null;
      for (const p of sc.props) {
        const side = SIDE_OF[p.placement];
        if (side && side === sc.character.position && p.placement !== 'bottom') {
          if (opposite) p.placement = p.placement.startsWith('top') ? (`top-${opposite}` as const) : opposite;
          else p.placement = p.placement.startsWith('top') ? 'top-right' : 'right';
        }
      }
      if (sc.character.position === 'center' && sc.props.some((p) => ['left', 'right', 'top-left', 'top-right'].includes(p.placement))) {
        // Center character with side props is fine; but a "center" prop must go above.
        for (const p of sc.props) if (p.placement === 'center') p.placement = 'top';
      }
    }
    // De-duplicate placements.
    const used = new Set<string>();
    const free = ['top-right', 'top-left', 'top', 'right', 'left', 'bottom'] as const;
    for (const p of sc.props) {
      if (p.placement === 'around') continue;
      if (used.has(p.placement)) {
        const alt = free.find((f) => !used.has(f) && SIDE_OF[f] !== sc.character.position);
        if (alt) p.placement = alt;
      }
      used.add(p.placement);
    }
    if (sc.chart) for (const p of sc.props) if (p.placement === 'center') p.placement = 'top';
    return sc;
  });
  // Break up triple identical camera moves.
  for (let i = 2; i < scenes.length; i++) {
    if (scenes[i]!.camera === scenes[i - 1]!.camera && scenes[i - 1]!.camera === scenes[i - 2]!.camera && scenes[i]!.camera !== 'static') {
      scenes[i]!.camera = 'static';
    }
  }
  return { ...sb, characterId: sb.characterId || 'nummo', scenes };
}
