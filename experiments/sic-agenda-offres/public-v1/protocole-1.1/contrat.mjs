import { isDeepStrictEqual as equal } from 'node:util';

export const version = 'sra.public/1.1';
const legacy = 'sra.public/1';
const reserved = new Set(['Action indisponible.', 'succès', 'échec']);
const key = JSON.stringify;

function check(value, message) {
  if (!value) throw new Error(message);
}
function fields(record, list) {
  check(record && typeof record==='object' && Object.keys(record).length===list.length &&
    list.every(k=>Object.hasOwn(record,k)), 'Champs de déclaration invalides');
}
function citation(page, ns, linked) {
  check(Array.isArray(ns) && ns.length && new Set(ns).size===ns.length &&
    ns.every(n=>Number.isSafeInteger(n) && n>0 && Object.hasOwn(page.sources,n) && linked.has(n)),
    'Citation absente ou étrangère à la commande');
}
function verifyEntry(page, entry, command) {
  const rules = page.rules.filter(r=>equal(r.command,command.command));
  const linked = new Set([...command.source,...rules.flatMap(r=>r.source)]);
  if (entry.status==='undeclared') return fields(entry,['command','status']);
  check(!equal(command.command,page.goal.command) && !rules.some(r=>r.effect?.reveal || (!r.when && r.effect?.end)),
    'Une lecture ou une terminaison ne déclare pas un accusé matériel');
  if (entry.status==='ambiguous') {
    fields(entry,['command','status','source']);
    return citation(page,entry.source,linked);
  }
  check(entry.status==='declared','Statut de déclaration invalide');
  fields(entry,['command','status','replies']);
  check(Array.isArray(entry.replies) && entry.replies.length,'Aucun libellé déclaré');
  const labels = new Set();
  for (const r of entry.replies) {
    const positive = r.kind==='confirmed';
    fields(r,positive?['label','kind','coverage','source']:['label','kind','source']);
    check(positive || ['refused','ambiguous'].includes(r.kind),'Type de retour invalide');
    check(typeof r.label==='string' && r.label.length && r.label.trim()===r.label &&
      !/[\r\n]/.test(r.label) && !reserved.has(r.label) && !labels.has(r.label),'Libellé invalide, réservé ou répété');
    labels.add(r.label);
    citation(page,r.source,linked);
    check(r.source.some(n=>page.sources[n].includes('« '+r.label+' »')),'Libellé absent des lignes citées');
    if (!positive || r.coverage==='unknown') continue;
    check(Array.isArray(r.coverage) && r.coverage.length,'Couverture vide');
    const effects = [];
    for (const item of r.coverage) {
      fields(item,['effect','source']);
      const e = item.effect;
      check(e && typeof e==='object' && Object.keys(e).length===1 && ('set' in e || 'keep' in e),
        'Effet matériel attendu');
      citation(page,item.source,linked);
      check(rules.some(rule=>rule.effect && !rule.when && equal(rule.effect,e) &&
        equal([...rule.source].sort((a,b)=>a-b),[...item.source].sort((a,b)=>a-b))),
        'Effet inconditionnel et citation correspondante introuvables');
      check(!effects.some(prev=>equal(prev,e)),'Effet répété');
      effects.push(e);
    }
  }
}

// Le schéma de base valide la fiche. Cette passe vérifie aussi les relations entre ses enregistrements.
export function validateReceipts(page) {
  check(page.format===legacy || page.format===version,'Version publique inconnue');
  if (!Object.hasOwn(page,'receipts')) return page;
  check(page.format===version && Array.isArray(page.receipts),'Extension hors version');
  const missing = new Map(page.commands.map(c=>[key(c.command),c]));
  for (const entry of page.receipts) {
    const id = key(entry.command), command = missing.get(id);
    check(command,'Commande absente ou déclaration dupliquée');
    verifyEntry(page,entry,command);
    missing.delete(id);
  }
  check(!missing.size,'Statut manquant pour une commande');
  return page;
}

function citedLines(entries) {
  return new Set(entries.flatMap(e=>[...(e.source ?? []),...(e.replies ?? []).flatMap(r=>
    [...r.source,...(Array.isArray(r.coverage) ? r.coverage.flatMap(i=>i.source) : [])])]));
}

// Instantané des lignes relues par l'auteur. Un registre enregistré devient caduc après une retouche.
export function makeLedger(page, entries) {
  const sources=Object.fromEntries([...citedLines(entries)].map(n=>[n,page.sources[n]]));
  return {sources,entries:structuredClone(entries)};
}

export function publish(page, ledger={sources:{},entries:[]}) {
  check(page.format===legacy && !Object.hasOwn(page,'receipts'),'Une fiche sra.public/1 est attendue');
  fields(ledger,['sources','entries']);
  const declarations=ledger.entries;
  check(Array.isArray(declarations),'Registre de déclarations invalide');
  check(equal(ledger.sources,makeLedger(page,declarations).sources),'Texte source différent du registre public');
  const out = structuredClone(page);
  out.format = version;
  const supplied = new Map(declarations.map(d=>[key(d.command),d]));
  check(supplied.size===declarations.length,'Déclaration dupliquée');
  out.receipts = out.commands.map(({command})=>{
    const id=key(command), entry=supplied.get(id);
    supplied.delete(id);
    return entry ? structuredClone(entry) : {command:[...command],status:'undeclared'};
  });
  check(!supplied.size,'Déclaration hors fiche');
  return validateReceipts(out);
}

export function toV1(page) {
  validateReceipts(page);
  const out=structuredClone(page);
  delete out.receipts;
  out.format=legacy;
  return out;
}

// Métadonnées du geste en vol. Ne joue aucune commande, ne projette aucun nouvel état.
export function materialReturn(page, command, text) {
  validateReceipts(page);
  check(page.commands.some(c=>equal(c.command,command)),'Commande en vol absente');
  if (text==='Action indisponible.') return {kind:'refused',protocol:'sra.public/1'};
  if (text==='succès' || text==='échec') return {kind:'terminal',protocol:'sra.public/1'};
  if (page.rules.some(r=>equal(r.command,command) && r.effect?.reveal)) return {kind:'observation'};
  const entry=page.receipts?.find(r=>equal(r.command,command));
  if (!entry || entry.status==='undeclared') return {kind:'undeclared'};
  if (entry.status==='ambiguous') return {kind:'ambiguous',source:[...entry.source]};
  const match=entry.replies.find(r=>r.label===text);
  return match ? structuredClone(match) : {kind:'unmatched'};
}
