// Transport only. The three solver source files are extracted byte-for-byte from Git.
import { createInterface } from 'node:readline';
import { PartiePublique } from './experiments/sic-agenda-offres/transfert/fiche-publique.mjs';

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
let game, pending;
for await (const line of lines) {
  const input = JSON.parse(line);
  if (!game) {
    try {
      game = new PartiePublique(input.fiche);
    } catch (error) {
      console.log(JSON.stringify({ incompatible: error.message }));
      break;
    }
  } else {
    game.record(pending, input.retour);
    if (pending === 'valider') break; // Same stop condition as the shipped operator.
  }
  const { action } = game.next();
  if (!action) {
    console.log(JSON.stringify({ arret: 'Première étape sans action publique' }));
    break;
  }
  pending = action;
  console.log(JSON.stringify({ action }));
}
