import { components } from '../logos-engine/field-stock.ts';
import type { PublicFrameLike, PublicObservationLike } from '../logos-engine/linked-preparation.ts';
import type { CommonCampaignObservation } from '../logos-engine/v6-common-campaign-contracts.ts';
import type { AgentObservation } from './contracts.ts';

export interface MeasuredPublicEntity {
  component_ref: string;
  signature: string;
  palette_value: number;
  position: readonly [number, number];
  bbox: readonly [number, number, number, number];
  mask: readonly (readonly [number, number])[];
  rectangular: boolean;
}

function hex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0');
}

function hashCodes(codes: Iterable<number>): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  let c = 0x85ebca6b;
  let d = 0xc2b2ae35;
  for (const code of codes) {
    const value = code & 0xff;
    a = Math.imul(a ^ value, 0x01000193);
    b = Math.imul(b ^ (value + 0x51), 0x27d4eb2d);
    c = Math.imul(c ^ (value + 0x9d), 0x165667b1);
    d = Math.imul(d ^ (value + 0xe7), 0x85ebca77);
  }
  return `${hex(a)}${hex(b)}${hex(c)}${hex(d)}`;
}

function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Uint8Array) return `u8:[${[...value].join(',')}]`;
  if (Array.isArray(value)) return `[${value.map(item => canonical(item)).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return String(value);
}

export function digestPublicValue(value: unknown): string {
  return hashCodes([...canonical(value)].map(character => character.charCodeAt(0)));
}

export function publicRows(observation: AgentObservation): number[][] {
  const { width, height, pixels } = observation.image;
  if (width !== 64 || height !== 64 || pixels.length !== width * height) {
    throw new RangeError('agent public image must be exactly 64x64 palette indices');
  }
  const rows: number[][] = [];
  for (let y = 0; y < height; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < width; x += 1) {
      const value = pixels[y * width + x];
      if (value === undefined || value < 0 || value > 15) {
        throw new RangeError('agent public pixels must be palette indices in [0, 15]');
      }
      row.push(value);
    }
    rows.push(row);
  }
  return rows;
}

function cloneAgentObservation(observation: AgentObservation): AgentObservation {
  return {
    ...observation,
    image: { ...observation.image, pixels: Uint8Array.from(observation.image.pixels) },
    availableActionIds: [...observation.availableActionIds],
  };
}

export function measurePublicCampaignObservation(
  source: AgentObservation,
): CommonCampaignObservation {
  const agent = cloneAgentObservation(source);
  const rows = publicRows(agent);
  const observationRef = `public-observation:${agent.sessionId}:${agent.sequence}`;
  const frameHash = `public-frame:${hashCodes(agent.image.pixels)}`;
  const entities: MeasuredPublicEntity[] = components(rows).map((component, index) => {
    const [left, top, right, bottom] = component.bbox;
    const shapeRef = digestPublicValue({
      palette: component.color,
      width: right - left + 1,
      height: bottom - top + 1,
      mask: component.mask,
    }).slice(0, 16);
    return {
      component_ref: `${observationRef}:component:${index}`,
      signature: `visible-component:${shapeRef}`,
      palette_value: component.color,
      position: [left, top],
      bbox: component.bbox,
      mask: component.mask,
      rectangular: component.rectangular,
    };
  });
  const availableActionRefs = agent.availableActionIds.map(id => `ACTION${id}`);
  const observation: PublicObservationLike = {
    observation_ref: observationRef,
    revision: agent.sequence,
    level_epoch: agent.level,
    levels_completed: agent.levelsCompleted,
    state: agent.state,
    frame_hash: frameHash,
    available_action_refs: availableActionRefs,
    entities,
  };
  const publicFrame: PublicFrameLike = {
    frame_rows: rows,
    level: agent.level,
    levels_completed: agent.levelsCompleted,
    state: agent.state,
    frame_hash: frameHash,
    available_action_refs: availableActionRefs,
  };
  return { agent, observation, publicFrame, rows };
}

export function samePublicCampaignState(
  left: CommonCampaignObservation,
  right: CommonCampaignObservation,
): boolean {
  return left.observation.frame_hash === right.observation.frame_hash
    && left.observation.level_epoch === right.observation.level_epoch
    && left.observation.levels_completed === right.observation.levels_completed
    && left.observation.state === right.observation.state
    && JSON.stringify(left.observation.available_action_refs)
      === JSON.stringify(right.observation.available_action_refs);
}
