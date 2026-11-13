/**
 * Native evolution: rebind the currently visible part of an acquired program
 * editor. This is deliberately separate from source-parity programEditor.
 *
 * Operator knowledge and current access are different facts: an absent control
 * never removes an operator from the learned model. Exact public appearances
 * and one common translation attest access; they do not prove a new operator,
 * a terminal role, or the meaning of an unavailable control.
 */
import { geometricComponents, projection } from './v6-native-observer.ts';
import { occurrenceRectangularMembers } from './v6-occurrence-program-observer.ts';
import { programIdentity } from './v6-program-identity.ts';
import { pythonEqual } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';
import type { OccurrenceRecord as R } from './v6-occurrence-scene.ts';

type Box = [number, number, number, number];
type Control = { color: number; bbox: Box; patch: number[][]; area: number };

export type CurrentProgramAccess = {
  status: 'bound'; layout: R; insertable_labels: number[]; unavailable_labels: number[];
  unknown_controls: R[]; evidence: R;
} | { status: 'unknown'; reason: string; details: R };

const schema = 'logos-engine.native.current-program-access.v1';
const unknown = (reason: string, details: R = {}): CurrentProgramAccess => ({ status: 'unknown', reason, details });
const labels = (values: readonly number[]): number[] => [...new Set(values)].sort((a, b) => a - b);
const size = (box: readonly number[]): [number, number] => [box[2]! - box[0]! + 1, box[3]! - box[1]! + 1];
const shifted = (box: readonly number[], dx: number, dy: number): Box => [box[0]! + dx, box[1]! + dy, box[2]! + dx, box[3]! + dy];
const within = (box: readonly number[], width: number, height: number): boolean => box[0]! >= 0 && box[1]! >= 0
  && box[2]! < width && box[3]! < height;
const overlaps = (a: readonly number[], b: readonly number[]): boolean => !(a[2]! < b[0]! || a[0]! > b[2]! || a[3]! < b[1]! || a[1]! > b[3]!);
const validBox = (value: unknown): value is Box => Array.isArray(value) && value.length === 4
  && value.every(Number.isSafeInteger) && value[0] >= 0 && value[1] >= 0 && value[0] <= value[2] && value[1] <= value[3];
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;

/**
 * No control-count threshold is used. Even one unique retained appearance can
 * anchor a translation; conflicting or duplicated anchors remain unknown.
 * Current controls may have gaps at any learned position. Extra row appearances
 * are evidence of unresolved access, never an assignment of operator semantics.
 */
export function bindCurrentProgramAccess(rows: NativeRows, model: R, observation: R = {}): CurrentProgramAccess {
  const geometry = model.editor_geometry, retained: R[] | undefined = geometry?.controls;
  if (!Array.isArray(retained) || !retained.length || typeof model.model_id !== 'string') return unknown('missing_learned_editor');
  const old: Control[] = [];
  for (const control of retained) {
    if (!validBox(control.bbox) || !Number.isSafeInteger(control.color) || control.color < 0 || control.color > 255
      || !Array.isArray(control.patch) || !control.patch.length) return unknown('invalid_learned_control');
    const [width, height] = size(control.bbox), patch: number[][] = control.patch;
    if (patch.length !== height || patch.some(row => !Array.isArray(row) || row.length !== width
      || row.some(value => !Number.isSafeInteger(value) || value < 0 || value > 255))) return unknown('invalid_learned_control_patch');
    const area = patch.flat().filter(value => value === control.color).length;
    if (!area) return unknown('missing_learned_control_support');
    old.push({ color: control.color, bbox: [...control.bbox], patch, area });
  }
  if (new Set(old.map(control => control.color)).size !== old.length) return unknown('ambiguous_learned_control_label');
  const first = old[0]!, [controlWidth, controlHeight] = size(first.bbox);
  if (old.some(control => control.bbox[1] !== first.bbox[1] || !pythonEqual(size(control.bbox), size(first.bbox)))) {
    return unknown('unsupported_learned_control_geometry');
  }
  const orderedOld = [...old].sort((a, b) => a.bbox[0] - b.bbox[0]);
  if (orderedOld.some((control, index) => index > 0 && overlaps(control.bbox, orderedOld[index - 1]!.bbox))) {
    return unknown('overlapping_learned_controls');
  }
  const parts = geometricComponents(rows), height = rows.length, width = rows[0]!.length;
  const matches: { retained: Control; current: Control; offset: [number, number] }[] = [];
  for (const control of old) {
    const candidates = parts.filter(part => part.color === control.color && part.area === control.area
      && pythonEqual(size(part.bbox), size(control.bbox)) && pythonEqual(projection(rows, part.bbox), control.patch));
    if (candidates.length > 1) return unknown('ambiguous_current_control', { label: control.color, boxes: candidates.map(part => part.bbox) });
    if (candidates.length === 1) {
      const part = candidates[0]!;
      matches.push({ retained: control, current: { color: part.color, bbox: [...part.bbox], area: part.area,
        patch: projection(rows, part.bbox) }, offset: [part.bbox[0] - control.bbox[0], part.bbox[1] - control.bbox[1]] });
    }
  }
  if (!matches.length) return unknown('no_current_learned_control');
  if (matches.some(match => !pythonEqual(match.offset, matches[0]!.offset))) {
    return unknown('inconsistent_current_control_translation', { offsets: matches.map(match => ({ label: match.retained.color, offset: match.offset })) });
  }
  const [dx, dy] = matches[0]!.offset, rowTop = first.bbox[1] + dy, rowBottom = rowTop + controlHeight - 1;
  const current = matches.map(match => match.current).sort((a, b) => a.bbox[0] - b.bbox[0]);
  const oldLabels = new Set(old.map(control => control.color)), attested = new Set(current.map(control => control.color));
  const unavailable: R[] = [];
  for (const control of old) {
    if (attested.has(control.color)) continue;
    const expected = shifted(control.bbox, dx, dy), visible = within(expected, width, height);
    const patch = visible ? projection(rows, expected) : null;
    // A changed known-colour glyph is not treated as a harmless omission. A
    // wholly different, unassigned appearance can be recorded without its role.
    if (patch?.some(row => row.includes(control.color))) {
      return unknown('changed_learned_control_appearance', { label: control.color, expected_bbox: expected });
    }
    unavailable.push({ label: control.color, expected_bbox: expected, status: 'current_access_not_attested',
      reason: visible ? 'learned_appearance_not_present' : 'learned_position_outside_current_frame',
      observed_patch_digest: patch ? programIdentity(patch) : null });
  }
  const rowParts = parts.filter(part => part.bbox[1] === rowTop && part.bbox[3] === rowBottom
    && size(part.bbox)[0] === controlWidth && part.area >= controlWidth * controlHeight / 2 && part.area < controlWidth * controlHeight);
  for (const part of rowParts) if (oldLabels.has(part.color) && !current.some(control => pythonEqual(control.bbox, part.bbox))) {
    return unknown('unmatched_known_control_appearance', { label: part.color, bbox: part.bbox });
  }

  // Full row patches also retain unknown glyphs whose foreground is split into
  // several components. Their sites come from the learned row lattice, never
  // from an assigned colour or the number of expected controls.
  const unknownBoxes = new Map<string, Box>();
  const remember = (box: Box): void => {
    if (!within(box, width, height) || current.some(control => overlaps(control.bbox, box))) return;
    if (new Set(projection(rows, box).flat()).size > 1) unknownBoxes.set(box.join(','), box);
  };
  for (const part of rowParts) if (!oldLabels.has(part.color)) remember([...part.bbox]);
  for (const item of unavailable) remember(item.expected_bbox);
  const gaps = orderedOld.slice(1).map((control, index) => control.bbox[0] - orderedOld[index]!.bbox[0]);
  const stride = gaps.reduce(gcd, 0), rowOrigin = orderedOld[0]!.bbox[0] + dx;
  if (stride > controlWidth) {
    for (let index = Math.ceil(-rowOrigin / stride); index <= Math.floor((width - controlWidth - rowOrigin) / stride); index++) {
      const x = rowOrigin + index * stride;
      remember([x, rowTop, x + controlWidth - 1, rowBottom]);
    }
  }
  const unknownControls: R[] = [...unknownBoxes.values()].sort((a, b) => a[0] - b[0]).map(box => {
    const patch = projection(rows, box);
    return { bbox: box, patch, patch_digest: programIdentity(patch), palette: labels(patch.flat()), status: 'unattributed_current_row_appearance' };
  });
  const memberSize: unknown = geometry.member_size, column: unknown = geometry.member_column;
  if (!Array.isArray(memberSize) || memberSize.length !== 2 || memberSize.some(value => !Number.isSafeInteger(value) || value < 1)
    || !validBox(column)) return unknown('invalid_learned_member_geometry');
  const [memberWidth, memberHeight] = memberSize as [number, number], memberX = column[0] + dx;
  if (memberX < 0 || memberX + memberWidth > width || rowTop < memberHeight || rowTop > height) return unknown('member_column_outside_current_frame');
  const memberBox: Box = [memberX, 0, memberX + memberWidth - 1, rowTop - 1];
  const members = occurrenceRectangularMembers(rows, [{ bbox: [memberX, 0, memberX + memberWidth - 1, memberHeight - 1] }], oldLabels, rowTop);
  const operatorLabels = labels([...(model.moves ?? []).map((move: R) => move.label), model.interaction?.label]
    .filter((label: unknown): label is number => Number.isSafeInteger(label)));
  const insertable = operatorLabels.filter(label => attested.has(label)), inaccessible = operatorLabels.filter(label => !attested.has(label));
  const bindingGeometry = {
    offset: [dx, dy], member_box: memberBox, member_size: [memberWidth, memberHeight], limit: rowTop,
    learned_control_labels: labels([...oldLabels]), known_operator_labels: operatorLabels, attested_control_labels: labels([...attested]),
    insertable_labels: insertable, unavailable_labels: inaccessible,
    matches: matches.map(match => ({ label: match.retained.color, learned_bbox: [...match.retained.bbox], current_bbox: [...match.current.bbox],
      point: [Math.floor((match.current.bbox[0] + match.current.bbox[2]) / 2), Math.floor((match.current.bbox[1] + match.current.bbox[3]) / 2)],
      patch_digest: programIdentity(match.current.patch), area: match.current.area, status: 'exact_current_learned_appearance' })),
    unavailable_controls: unavailable, unknown_controls: unknownControls,
  };
  const evidence: R = { schema, status: 'current_program_access_bound', model_id: model.model_id, model_digest: programIdentity(model),
    frame_digest: programIdentity(rows), observation_ref: observation.observation_ref ?? null, level_epoch: observation.level_epoch ?? null,
    geometry: bindingGeometry, geometry_digest: programIdentity(bindingGeometry),
    scope: 'Exact retained appearances attest current access under a common translation. Learned operator semantics stay complete. Missing access has no inferred cause; additional row appearances have no assigned operator. Collection geometry remains the retained conditional editor hypothesis.' };
  const layout = { controls: current, members, member_box: memberBox, member_size: [memberWidth, memberHeight], offset: [dx, dy], limit: rowTop,
    current_access: evidence };
  return { status: 'bound', layout, insertable_labels: insertable, unavailable_labels: inaccessible, unknown_controls: unknownControls, evidence };
}

/**
 * Recheck access between primitives. A collection edit may change the frame and
 * word; it may not silently change the controls, translation, or known absences.
 * The runtime still binds each action and its observation through ordinary WHY.
 */
export function currentProgramAccessMatches(rows: NativeRows, model: R, retainedAccess: R): boolean {
  if (retainedAccess?.schema !== schema || retainedAccess.status !== 'current_program_access_bound'
    || !retainedAccess.geometry || typeof retainedAccess.geometry_digest !== 'string') return false;
  const current = bindCurrentProgramAccess(rows, model);
  return current.status === 'bound' && current.evidence.model_id === retainedAccess.model_id
    && current.evidence.model_digest === retainedAccess.model_digest
    && programIdentity(retainedAccess.geometry) === retainedAccess.geometry_digest
    && current.evidence.geometry_digest === retainedAccess.geometry_digest;
}
