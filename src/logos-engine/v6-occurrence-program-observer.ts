/** Inherited, unconditional public-packet observation used by occurrence recall.
 * Source: marked_collection_access.collection_scene/record_packet and
 * observed_program_effects.align_program_packet, unchanged pinned V6.
 * Program search and its other questions remain separate providers.
 */
import { geometricComponents, projection } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual } from './v6-operations.ts';
import type { OccurrenceRecord as R } from './v6-occurrence-scene.ts';

export function occurrenceCollectionBorder(rows: NativeRows, box: readonly number[]): number | null {
  const [x, y, right, bottom] = box as [number, number, number, number];
  if (x < 1 || y < 1 || right + 1 >= rows[0]!.length || bottom + 1 >= rows.length) return null;
  const colors = new Set<number>();
  for (let v = y - 1; v < bottom + 2; v++) for (let u = x - 1; u < right + 2; u++) {
    if (v === y - 1 || v === bottom + 1 || u === x - 1 || u === right + 1) colors.add(rows[v]![u]!);
  }
  return colors.size === 1 ? [...colors][0]! : null;
}

function rectangularMembers(rows: NativeRows, examples: readonly R[], palette: Set<number>, limit: number): R[] {
  const [x, y, right, bottom] = examples[0]!.bbox, width = right - x + 1, height = bottom - y + 1;
  const result: R[] = []; let v = 0;
  while (v < limit) {
    const values = new Set(rows[v]!.slice(x, x + width));
    if (values.size !== 1 || !palette.has([...values][0]!)) { v++; continue; }
    const color = [...values][0]!, start = v;
    while (v < limit && rows[v]!.slice(x, x + width).every(value => value === color)) v++;
    if (v - start === height) result.push({ bbox: [x, start, x + width - 1, v - 1], color, area: width * height });
  }
  return result;
}

export function occurrenceCollectionScene(rows: NativeRows): R | null {
  const groups = new Map<string, { width: number; height: number; area: number; parts: R[] }>();
  for (const part of geometricComponents(rows)) {
    const [x, y, right, bottom] = part.bbox, width = right - x + 1, height = bottom - y + 1;
    if (Math.min(width, height) < 2 || part.area < width * height / 2) continue;
    const key = JSON.stringify([width, height, part.area]);
    if (!groups.has(key)) groups.set(key, { width, height, area: part.area, parts: [] });
    groups.get(key)!.parts.push({ bbox: part.bbox, color: part.color, area: part.area });
  }
  const controls: R[][] = [], members: R[][] = [];
  for (const { width, height, area, parts } of groups.values()) {
    if (parts.length < 2) continue;
    if (new Set(parts.map(part => part.bbox[1])).size === 1 && parts.length >= 3 && area < width * height) {
      const ordered = [...parts].sort((a, b) => a.bbox[0] - b.bbox[0]), steps = new Set(ordered.slice(1).map((part, index) => part.bbox[0] - ordered[index]!.bbox[0]));
      if (steps.size === 1 && Math.min(...steps) > width) controls.push(ordered);
    }
    if (new Set(parts.map(part => part.bbox[0])).size === 1 && area === width * height) {
      const ordered = [...parts].sort((a, b) => a.bbox[1] - b.bbox[1]), steps = new Set(ordered.slice(1).map((part, index) => part.bbox[1] - ordered[index]!.bbox[1]));
      const minimum = Math.min(...steps);
      if (minimum > height && [...steps].every(step => step % minimum === 0)) members.push(ordered);
    }
  }
  const layouts: R[] = [];
  for (const cs of controls) {
    const palette = new Set<number>(cs.map(part => part.color)); if (palette.size < 3) continue;
    const markedControls = cs.filter(part => occurrenceCollectionBorder(rows, part.bbox) !== null); if (markedControls.length > 1) continue;
    for (const originals of members) {
      if (!originals.every(part => palette.has(part.color))) continue;
      const ms = rectangularMembers(rows, originals, palette, Math.min(...cs.map(part => part.bbox[1])));
      const markedMembers = ms.filter(part => occurrenceCollectionBorder(rows, part.bbox) !== null); if (markedMembers.length > 1) continue;
      if (markedMembers.length && markedControls.length && occurrenceCollectionBorder(rows, markedMembers[0]!.bbox) !== occurrenceCollectionBorder(rows, markedControls[0]!.bbox)) continue;
      layouts.push({ controls: cs, members: ms, marked_controls: markedControls, marked_members: markedMembers, palette: [...palette].sort((a, b) => a - b) });
    }
  }
  return layouts.length === 1 ? layouts[0]! : null;
}

function worldParts(rows: NativeRows, exclusions: readonly number[][]): Map<string, R[]> {
  const out = new Map<string, R[]>();
  for (const part of geometricComponents(rows)) {
    const [x, y, right, bottom] = part.bbox;
    if (part.area < 3 || exclusions.some(([a, b, c, d]) => !(right < a! || x > c! || bottom < b! || y > d!))) continue;
    const signature = identity([part.normalized, part.color, part.area]);
    if (!out.has(signature)) out.set(signature, []);
    out.get(signature)!.push({ position: [x, y], bbox: part.bbox, palette: part.color, area: part.area, mask: part.normalized });
  }
  return out;
}

export function occurrenceProgramResidual(before: NativeRows, after: NativeRows, exclusions: readonly number[][]): R {
  const a = worldParts(before, exclusions), b = worldParts(after, exclusions), translations: R[] = [], changes: R[] = [];
  for (const signature of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const left = new Map((a.get(signature) ?? []).map(part => [JSON.stringify(part.position), part]));
    const right = new Map((b.get(signature) ?? []).map(part => [JSON.stringify(part.position), part]));
    const first = [...left].filter(([position]) => !right.has(position)).map(([, part]) => part);
    const last = [...right].filter(([position]) => !left.has(position)).map(([, part]) => part);
    if (first.length === 1 && last.length === 1) {
      const from = first[0]!, to = last[0]!;
      translations.push({ signature, shape: from.mask, palette: from.palette, area: from.area, before: from.position,
        after: to.position, vector: [to.position[0] - from.position[0], to.position[1] - from.position[1]], identity_status: 'unique_residual_correspondence_hypothesis' });
    } else if (first.length || last.length) changes.push({ signature, before_count: first.length, after_count: last.length,
      before_positions: first.map(part => part.position), after_positions: last.map(part => part.position), identity_status: 'appearance_change_not_object_death_proof' });
  }
  return { translations, other_changes: changes };
}

export function alignOccurrenceProgramPacket(before: NativeRows, frames: readonly NativeRows[], input: R): R {
  const members: R[] = input.members, controls: R[] = input.controls;
  if (members.length < 2 || !frames.length) return { status: 'unknown', reason: 'no_multi_member_reference_or_packet', phases: [] };
  const baselines = members.map(part => projection(before, part.bbox)), images = [before, ...frames], phases: R[] = [];
  let active: number | null = null, stop = images.length - 1;
  for (let index = 1; index < images.length; index++) {
    const changed = members.flatMap((part, j) => !pythonEqual(projection(images[index]!, part.bbox), baselines[j]) ? [j] : []);
    if (changed.length > 1) {
      if (active !== null) { phases.at(-1)!.end_exclusive = index; active = null; }
      stop = index; break;
    }
    const current = changed[0] ?? null;
    if (current !== active) {
      if (active !== null) phases.at(-1)!.end_exclusive = index;
      if (current !== null) phases.push({ member_index: current, label: members[current]!.color, start: index });
      active = current;
    }
  }
  if (active !== null) phases.at(-1)!.end_exclusive = stop;
  if (phases.length < 2) return { status: 'unknown', reason: 'insufficient_unique_active_member_phases', phases };
  const indices = phases.map(phase => phase.member_index);
  if (new Set(indices).size !== indices.length) return { status: 'unknown', reason: 'repeated_phase_binding_requires_disambiguation', phases };
  const pane = [Math.min(...members.map(part => part.bbox[0])), 0, Math.max(...members.map(part => part.bbox[2])), before.length - 1];
  const footer = [0, Math.min(...controls.map(part => part.bbox[1])), before[0]!.length - 1, before.length - 1];
  for (const phase of phases) {
    const start = phase.start, end = phase.end_exclusive ?? stop;
    if (end <= start) { phase.effect = { status: 'unknown', reason: 'no_observed_phase_duration' }; continue; }
    const endpoint = end < stop ? end : end - 1;
    phase.effect = occurrenceProgramResidual(images[start]!, images[endpoint]!, [pane, footer]); phase.endpoint = endpoint;
    phase.evidence = [{ observation_ref: input.observation_ref, packet_index: start - 1 }, { observation_ref: input.observation_ref, packet_index: endpoint - 1 }];
  }
  const signatures: Set<string>[] = phases.filter(phase => phase.effect.translations?.length)
    .map(phase => new Set((phase.effect.translations as R[]).map(item => item.signature)));
  const shared = signatures.length ? [...signatures[0]!].filter(signature => signatures.every(set => set.has(signature))) : [];
  const roles = shared.sort().map(signature => ({ signature,
    supporting_phase_count: phases.filter(phase => phase.effect.translations?.some((item: R) => item.signature === signature)).length, status: 'candidate_operand_role' }));
  const firstBox = members[0]!.bbox;
  return { status: 'phase_aligned_candidates', epoch: input.epoch, command_ref: input.command_ref,
    before_ref: input.observation_ref, after_ref: input.after_observation_ref, phases, candidate_roles: roles, collection_order: indices, excluded_from: stop,
    editor_geometry: { member_column: pane, member_size: [firstBox[2] - firstBox[0] + 1, firstBox[3] - firstBox[1] + 1],
      controls: controls.map(part => ({ bbox: part.bbox, color: part.color, patch: projection(before, part.bbox) })), footer }, initial_members: members,
    scopes: ['Public member-patch changes bind labels to time intervals.', 'Residual translation is a correspondence hypothesis, not universal physical-object identity.',
      'A single execution cannot prove a context-independent operator law.', 'Final scene rewrite and official boundary are excluded from per-operator attribution.'], predictive_use_allowed: false };
}

export function observeOccurrenceProgramPacket(before: R, command: R, after: R, rows: NativeRows, frames: readonly NativeRows[]): R[] {
  if (frames.length < 2) return [];
  const scene = occurrenceCollectionScene(rows); if (!scene) return [];
  const alignment = alignOccurrenceProgramPacket(rows, frames, { members: scene.members, controls: scene.controls,
    observation_ref: before.observation_ref, epoch: before.level_epoch, command_ref: command.action_ref, after_observation_ref: after.observation_ref });
  return alignment.status === 'phase_aligned_candidates' ? [{ kind: 'public_program_phase_alignment', alignment, evidence: [before.observation_ref, after.observation_ref] }] : [];
}
