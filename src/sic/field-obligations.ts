import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';
import { fieldPitches, fieldSymbolIndex, readFieldCue, solidFieldCells, type ExemplarRule, type FieldCell, type FieldPart } from './field-exemplars.ts';

export type SiteObligation = { box: NativeBox; equal: number[]; different: number[] };
export type FieldObligations = { cues: NativeBox[]; obligations: SiteObligation[]; rule: ExemplarRule };
type Window = { cue: NativeBox; requirements: {cell: FieldCell; equal: boolean; anchor: number}[] };
const coord = (x: number,y: number) => x + ',' + y;
export function fulfillsSite(value: number | null, site: SiteObligation): boolean {
  return value !== null && site.equal.every(c => value === c) && !site.different.includes(value);
}
export function siteValue(rows: NativeRows, box: NativeBox): number | null {
  const [x,y,r,b] = box, value = rows[y]?.[x];
  if (value === undefined) return null;
  for (let j=y;j<=b;j++) for (let i=x;i<=r;i++) if (rows[j]?.[i] !== value) return null;
  return value;
}
function windows(board: NativeRows,cells: FieldCell[],dx: number,dy: number,rule: ExemplarRule): Window[] {
  const {columns,rows,cueIndex} = rule;
  const w = cells[0]!.box[2] - cells[0]!.box[0] + 1, h = cells[0]!.box[3] - cells[0]!.box[1] + 1;
  if (w % columns || h % rows || dx < w || dy < h) return [];
  const places = new Map(cells.map(c => [coord(c.box[0],c.box[1]),c]));
  const offsets = Array.from({length:columns*rows},(_,k) => [(k%columns-cueIndex%columns)*dx,
    (Math.floor(k/columns)-Math.floor(cueIndex/columns))*dy] as const);
  const first = offsets[cueIndex === 0 ? 1 : 0]!;
  const result: Window[] = [];
  for (const cell of cells) {
    const x = cell.box[0]-first[0], y = cell.box[1]-first[1];
    if (x<0 || y<0 || x+w>board[0]!.length || y+h>board.length || places.has(coord(x,y))) continue;
    const neighbors = offsets.map(([u,v]) => places.get(coord(x+u,y+v)));
    if (neighbors.some((n,k) => k!==cueIndex && !n)) continue;
    const cue: NativeBox = [x,y,x+w-1,y+h-1];
    const symbols = readFieldCue(board,{cue,columns,rows});
    if (!symbols) continue;
    const requirements: Window['requirements'] = [];
    for (const [k, neighbor] of neighbors.entries()) {
      if (!neighbor) continue;
      const symbol = symbols[fieldSymbolIndex(k,rule,rule.orientation)]!;
      const equal = rule.sameAsCue.includes(symbol);
      if (!equal && !rule.differentFromCue.includes(symbol)) break;
      requirements.push({cell:neighbor,equal,anchor:symbols[cueIndex]!});
    }
    if (requirements.length === offsets.length-1 && requirements.some(r=>r.equal) && requirements.some(r=>!r.equal)) result.push({cue,requirements});
  }
  return result;
}

function joinWindows(windows: Window[],rule: ExemplarRule): FieldObligations[] {
  const bySite = new Map<string, Window[]>();
  for (const window of windows) for (const {cell} of window.requirements) {
    const key = cell.box.join(), others = bySite.get(key) ?? [];
    others.push(window);
    bySite.set(key,others);
  }
  const result: FieldObligations[] = [], seen = new Set<Window>();
  for (const root of windows) {
    if (seen.has(root)) continue;
    const group = [root], sites = new Map<string,SiteObligation>();
    seen.add(root);
    for (let j=0;j<group.length;j++) for (const r of group[j]!.requirements) {
      const key = r.cell.box.join();
      const site = sites.get(key) ?? {box:r.cell.box,equal:[],different:[]};
      const list = r.equal ? site.equal : site.different;
      if (!list.includes(r.anchor)) list.push(r.anchor);
      sites.set(key,site);
      for (const next of bySite.get(key)!) if (!seen.has(next)) { seen.add(next); group.push(next); }
    }
    const obligations = [...sites.values()].sort((a,b)=>a.box[1]-b.box[1] || a.box[0]-b.box[0]);
    if (obligations.some(s => s.equal.length>1 || s.equal.some(c=>s.different.includes(c)))) continue;
    for (const site of obligations) site.different.sort((a,b)=>a-b);
    const cues = group.map(s=>s.cue).sort((a,b)=>a[1]-b[1] || a[0]-b[0]);
    result.push({cues,obligations,rule});
  }
  return result;
}

export function fieldObligationPlans(board: NativeRows,parts: readonly FieldPart[],rules: readonly ExemplarRule[]): FieldObligations[] {
  const alternatives = new Map<string, Map<string,FieldObligations>>();
  for (const cells of solidFieldCells(board,parts).values()) for (const rule of rules) {
    if (cells.length < rule.rows*rule.columns-1) continue;
    for (const dx of fieldPitches(cells,0)) for (const dy of fieldPitches(cells,1)) {
      for (const plan of joinWindows(windows(board,cells,dx,dy,rule),rule)) {
        const scope = JSON.stringify([plan.cues,plan.obligations.map(s=>s.box)]);
        const options = alternatives.get(scope) ?? new Map<string,FieldObligations>();
        options.set(JSON.stringify(plan.obligations),plan);
        alternatives.set(scope,options);
      }
    }
  }
  const result: FieldObligations[] = [];
  for (const options of alternatives.values()) {
    if (options.size !== 1) continue;
    const plan = options.values().next().value!;
    if (plan.obligations.some(o => !fulfillsSite(siteValue(board,o.box),o))) result.push(plan);
  }
  return result.sort((a,b)=>b.cues.length-a.cues.length || b.obligations.length-a.obligations.length);
}
