import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { materialReturn } from '../accuses-publics/contrat.mjs';
import { groups } from './lots.mjs';
import { translate } from './traduire.mjs';

// Le reçu peut contenir des mondes opérateur. Seuls la fiche initiale et le texte
// public du geste concerné sont passés au classificateur.
const run=JSON.parse(readFileSync(process.argv[2],'utf8'));
const lots=await groups(true), counts={};
for(const [name,rows] of Object.entries(lots)) {
  const pages=new Map(rows.map(c=>[c.id,translate(c.message)]));
  const tally={}; counts[name]=tally;
  for(const r of run.controls[name].departs) {
    const page=pages.get(r.fiche);
    for (const t of r.tours) {
      const command=t.action.split(' '), tagged=materialReturn(page,command,t.retour);
      tally[tagged.kind]=(tally[tagged.kind]??0)+1;
      if (!t.executee) assert.equal(tagged.kind,'refused');
      if (t.retour==='succès' || t.retour==='échec') assert.equal(tagged.kind,'terminal');
      if (tagged.kind==='observation') {
        const reveal=page.rules.find(rule=>rule.command.join(' ')===t.action && rule.effect?.reveal).effect.reveal;
        assert.ok(page.domains.find(d=>JSON.stringify(d.ref)===JSON.stringify(reveal)).values.includes(t.retour));
      }
      if (tagged.kind==='confirmed' && name==='structure') assert.equal(tagged.coverage,'unknown');
    }
  }
}
console.log(JSON.stringify(counts));
