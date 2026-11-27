import assert from 'node:assert/strict';
import { isDeepStrictEqual as equal } from 'node:util';
import { makeLedger, publish, toV1 } from '../accuses-publics/contrat.mjs';

// Grammaires des sources publiques auditées. Les groupes nomment le poste de l'effet
// ou les deux marques possibles. Une phrase inconnue ne produit aucune déclaration.
const patterns = {
  normal: /^(\S+ \S+) est disponible si (\S+) est non indexé\. La commande indexe \2 et renvoie exactement « ([^«»]+) »\.$/u,
  first: /^La commande (\S+ \S+) renvoie exactement « ([^«»]+) »\. Elle est disponible si (\S+) est non indexé et indexe \3\.$/u,
  moving: /^indexer (\S+) exige \1 non indexé, indexe \1 et rend « ([^«»]+) »\. Si le guide vaut (\S+), le cadran passe à \3\. Si le guide vaut (\S+), il passe à \4\.$/u,
  mark: /^(?:Après indexation, )?marquer (\S+) (\S+) ou marquer \1 (\S+) inscrit la valeur choisie sur la case vierge\. Le retour est « ([^«»]+) »\.$/u,
  structuralIndex: /^Lors d’une indexation correcte, la butée engagée maintient le cadran\. Si la butée est libre, le cadran prend la sortie du guide\. Le retour est toujours « ([^«»]+) »\.$/u,
  structuralOpen: /^ouvrir (\S+) est disponible après indexation si le récepteur de cette sortie est fermé\. Si le cadran la désigne, le récepteur s’ouvre et le retour est « ([^«»]+) »\. Sinon la partie termine en échec\.$/u,
};
function parseLine(line, command) {
  const [verb,obj,mark]=command, name=command.join(' ');
  const indexed = (label,station)=>({label,effect:{set:[['indexed',station],true]}});
  let m=patterns.normal.exec(line);
  if (m && m[1]===name && obj===m[2]) return indexed(m[3],obj);
  m=patterns.first.exec(line);
  if (m && m[1]===name && obj===m[3]) return indexed(m[2],obj);
  m=patterns.moving.exec(line);
  if (m && name==='indexer '+m[1]) return indexed(m[2],obj);
  m=patterns.mark.exec(line);
  if (m && verb==='marquer' && obj===m[1] && [m[2],m[3]].includes(mark) && command.length===3)
    return {label:m[4],effect:{set:[['mark',obj],mark]}};
  m=patterns.structuralIndex.exec(line);
  if (m && verb==='indexer' && command.length===2) return {label:m[1]};
  m=patterns.structuralOpen.exec(line);
  if (m && name==='ouvrir '+m[1]) return {label:m[2]};
  return null;
}

export function translate(page) {
  const entries=[];
  for (const {command,source} of page.commands) {
    const rules=page.rules.filter(r=>equal(r.command,command));
    const ns=[...new Set([...source,...rules.flatMap(r=>r.source)])];
    const replies=[];
    for (const n of ns) {
      const parsed=parseLine(page.sources[n],command);
      if (!parsed) continue;
      const rule=parsed.effect && rules.find(r=>!r.when && equal(r.effect,parsed.effect) && r.source.includes(n));
      replies.push({kind:'confirmed',label:parsed.label,source:[n],
        coverage:rule?[{effect:rule.effect,source:rule.source}]:'unknown'});
    }
    if (replies.length===1) entries.push({command,status:'declared',replies});
    else if (replies.length>1) entries.push({command,status:'ambiguous',source:replies.flatMap(r=>r.source)});
  }
  const out=publish(page,makeLedger(page,entries));
  assert.deepEqual(toV1(out),page);
  return out;
}
