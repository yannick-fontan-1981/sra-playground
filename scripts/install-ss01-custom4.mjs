/** One-shot source materialization. Run only on the dedicated integration branch, before tests. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
function edit(path, fn) {const before=readFileSync(path,'utf8');const after=fn(before);if(before===after)throw new Error(`No edit in ${path}`);writeFileSync(path,after);}
function one(s,from,to){if(s.split(from).length!==2)throw new Error(`Expected exactly one anchor: ${from.slice(0,100)}`);return s.replace(from,to);}
edit('src/games/catalog.ts', s => {
  s=one(s,"'custom_2' | 'custom_3';","'custom_2' | 'custom_3' | 'custom_4';");
  s=one(s,'export const GAME_CATALOG:',`// Custom 4 is an incremental native collection; only completed games are registered.
records.push({code:'SS01',id:'ss01-c4000001',name:'Sinking Star — Mirror Isles',group:'custom_4',family:'sinking_star_mirrors',levels:8,
  description:'Guide Merchants across islands using movable mirrors, reflected crates and sunken supports. Two Merchants and two goals in levels 1 and 8.',
  sourcePath:'src/games/sinking-star/levels.ts',availability:'playable'});

export const GAME_CATALOG:`);
  return one(s,': `${PUBLIC_SOURCE_BASE}/${entry.sourcePath}`,',": entry.group === 'custom_4' ? `${SOURCE_REPOSITORY}/blob/main/${entry.sourcePath}`\n    : `${PUBLIC_SOURCE_BASE}/${entry.sourcePath}`,");
});
edit('src/runtime/browser-games.ts',s=>{
 s=one(s,"{ type: 'undo' | 'reset' | 'restart' }","{ type: 'undo' | 'reset' | 'restart' | 'nextMerchant' }");
 return one(s,'  undo(): Promise<GameObservation>',"  nextMerchant(): Promise<GameObservation> { return this.request({ type: 'nextMerchant' }); }\n  undo(): Promise<GameObservation>");
});
edit('src/runtime/game-worker.ts',s=>{
 s="import { createGameDispatcher, type GameRequest } from './native-game-dispatcher.ts';\n"+s;
 s=one(s,'let queue = Promise.resolve();',`const dispatcher = createGameDispatcher(async () => {
  ready ??= initialize().catch(error => { ready = undefined; throw error; });
  const python = await ready;
  return { dispatch(request) {
    if (request.type === 'nextMerchant') throw new Error('Merchant selection is only available in SS01.');
    python.globals.set('_browser_request_json', JSON.stringify(request));
    let result;
    try { result = JSON.parse(String(python.runPython('dispatch(_browser_request_json)'))); }
    finally { python.globals.delete('_browser_request_json'); }
    if (result.error) throw new Error(String(result.error));
    return result;
  } };
});
let queue = Promise.resolve();`);
 const start=s.indexOf('      ready ??= initialize()',s.indexOf('let queue = Promise.resolve();'));
 const end=s.indexOf('      workerScope.postMessage({ id, result });',start);
 if(start<0||end<0)throw new Error('Worker bridge anchor missing');
 return s.slice(0,start)+"      const result = await dispatcher.dispatch(request as GameRequest);\n"+s.slice(end);
});
edit('src/main.ts',s=>{
 s=one(s,"  custom_3: 'Custom · Wave 3',","  custom_3: 'Custom · Wave 3',\n  custom_4: 'Custom 4 · Sinking Star',");
 s=one(s,"const defaultGameCode = 'CASC';","const customCount = GAME_CATALOG.filter(game => game.group !== 'official').length;\nconst defaultGameCode = 'CASC';");
 s=s.replaceAll('75 New Games','${customCount} New Games').replaceAll('75 NEW GAMES','${customCount} NEW GAMES')
   .replaceAll('75 new custom games','${customCount} new custom games').replaceAll('75 CUSTOM','${customCount} CUSTOM').replaceAll('all 100 games','all ${GAME_CATALOG.length} games');
 s=one(s,'<div class="utility-controls">','<div class="utility-controls">\n                  <button type="button" id="merchant-button" class="utility-button" title="Select next Merchant (C)" hidden disabled><span>Merchant · C</span></button>');
 s=one(s,"  element<HTMLButtonElement>('#undo-button').disabled = !enabled || !observation?.canUndo;",`  const merchantButton = element<HTMLButtonElement>('#merchant-button');
  merchantButton.hidden = selectedGame.code !== 'SS01';
  merchantButton.disabled = !enabled || Boolean(complete || lost) || !available.has(6);
  element<HTMLButtonElement>('#undo-button').disabled = !enabled || !observation?.canUndo;`);
 s=one(s,'function undo(): void {',`function nextMerchant(): void {
  if (selectedGame.code !== 'SS01' || !observation?.availableActionIds.includes(6) || observation.state === 'WIN') return;
  void run(() => runtime.nextMerchant(), 'Merchant selected.');
}
function undo(): void {`);
 s=one(s,"  if (event.key.toLowerCase() === 'z') {",`  if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'c' && selectedGame.code === 'SS01') {
    event.preventDefault(); nextMerchant(); return;
  }
  if (event.key.toLowerCase() === 'z') {`);
 s=one(s,"element('#undo-button').addEventListener('click', () => { undo(); focusCanvas(); });","element('#merchant-button').addEventListener('click', () => { nextMerchant(); focusCanvas(); });\nelement('#undo-button').addEventListener('click', () => { undo(); focusCanvas(); });");
 return s.replace('R to reset the level.</p>', 'R to reset the level. In SS01, C or a click selects a Merchant.</p>');
});
edit('src/site-header.ts',s=>"import { GAME_CATALOG } from './games/catalog.ts';\nconst customGameCount = GAME_CATALOG.filter(game => game.group !== 'official').length;\n"+s.replace('75 New Games','${customGameCount} New Games'));
edit('scripts/generate-game-gallery.mjs',s=>{
 s="import { makeNativeGalleryGroup } from './native-game-gallery.mjs';\n"+s;
 s=one(s,"const escape = value",`manifest.groups.push(await makeNativeGalleryGroup(root));
const customGameCount = GAME_CATALOG.filter(game => game.group !== 'official').length;
const escape = value`);
 s=one(s,"  { id: 'official', anchor:","  { id: 'custom_4', anchor: 'custom-wave-4', title: 'Custom 4 · Sinking Star', shortTitle: 'Custom 4' },\n  { id: 'official', anchor:");
 s=one(s,"manifest.groups.length !== 4 || GAME_CATALOG.length !== 100","manifest.groups.length !== groupDefinitions.length");
 s=s.replace('all four groups and all 100 games','all catalogue groups');
 s=one(s,"games.length !== 25 || asset.rows !== 25 || asset.games?.length !== 25","games.length < 1 || asset.rows !== games.length || asset.games?.length !== games.length");
 s=s.replaceAll('75 new custom games','${customGameCount} new custom games').replaceAll('75 New Games','${customGameCount} New Games')
   .replaceAll('100 games<span>','${GAME_CATALOG.length} games<span>')
   .replaceAll('class="gallery-group-count">25<','class="gallery-group-count">${group.entries.length}<')
   .replaceAll('<span>25 games</span>','<span>${group.entries.length} ${group.entries.length === 1 ? \'game\' : \'games\'}</span>')
   .replace('four native image atlases.','${groups.length} native image atlases.');
 return s;
});
edit('THIRD_PARTY_NOTICES.md',s=>s+`\n## SS01 / Custom 4\n\nThe native SS01 engine and original introductory level were developed for SRA Playground. Levels 2–8 adapt publicly transcribed Mirror Isles puzzles from Order of the Sinking Star, via Joric's reconstruction (joric/ootss, script blob 3b8768a5152c34e0f572e7e66251dfadb4cb6d1d). These seven maps are compiled/adapted levels, not claimed as original designs. The original game's names/designs retain their respective attribution. See src/games/sinking-star/PROVENANCE.md for the mapping and fidelity limitations.\n`);
mkdirSync('docs/integration',{recursive:true});
writeFileSync('docs/integration/ss01-custom4.md',`# SS01 — first game of Custom 4\n\nSource: standalone laboratory v0.5.0. The production router uses the v5 engine and levels; no solver or reference route is exposed to the agent. The 100 existing games retain the Python bridge. Only SS01 lazy-loads the native TypeScript backend.\n\n## UI\nCustom 4 starts with SS01, eight levels. Two Merchants/two goals in L1 and L8, 3x3 cells, grey square crate previews and 210ms teleport animations are unchanged. Manual C/button selection routes to the same ACTION6 as clicking. Undo, reset, restart, direct level links and the gallery use the shared session.\n\n## Release gate\nTests and build must pass on this integration branch before merging. No Site publication is performed by this workflow. Publication of the existing SRA Playground Site and GitHub/Site SHA verification remain required. No SRA solving score or global performance claim is made.\n\nV5 core SHA-256: ${createHash('sha256').update(readFileSync('src/games/sinking-star/core.ts')).digest('hex')}\n`);
console.log('Integrated shared SS01 v5 sources into Custom 4.');
