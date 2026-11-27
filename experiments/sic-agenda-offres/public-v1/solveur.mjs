import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { admit, key } from './admission.mjs';
import { initialState, decide, project } from './planifier.mjs';

// Accusés matériels observés sur les parties publiques de développement.
// Le texte valide le geste en vol. Les effets viennent des règles de la fiche.
const acknowledgements = new Map([['marquer', 'marqué'], ['purger', 'purge terminée'],
  ['bloquer', 'butée bloquée'], ['retirer', 'poignée libérée'], ['indexer', 'poste indexé']]);

export function qualifyReturn(model, pending, feedback) {
  if (!feedback.trim() || feedback === 'Action indisponible.') return { reason: 'retour vide ou commande indisponible' };
  if (feedback === 'succès' || feedback === 'échec') return { terminal: true };
  if (pending.end) return { reason: 'verdict terminal non reconnu' };
  const { command, next: options } = pending;
  if (options.every(s => !s.revealed.length)) {
    const declaration = model.receipts.get(key(command));
    if (declaration?.ambiguous) return { reason: 'déclaration d’accusé matériel ambiguë' };
    const expected = declaration?.text ?? acknowledgements.get(command[0]);
    if (expected !== feedback) return { reason: 'accusé matériel non reconnu pour la commande demandée' };
  }
  const matches = options.filter(s => !s.revealed.length ||
    (s.revealed.length === 1 && String(s.revealed[0].value) === feedback));
  return matches.length === 1 ? { state: matches[0] } : { reason: 'retour sans interprétation publique unique' };
}

export class PublicSession {
  #model;
  #state;
  #pending;
  #history = [];
  #closed = false;

  get admitted() { return !!this.#model; }

  next(message) {
    if (this.#closed) return null;
    if (!message || typeof message !== 'object' || Object.keys(message).length !== 1) throw new Error('Message public invalide');
    if (!this.#model) {
      if (!Object.hasOwn(message, 'fiche')) throw new Error('Fiche initiale attendue');
      this.#model = admit(message.fiche);
      this.#state = initialState(this.#model);
    } else {
      if (!Object.hasOwn(message, 'retour') || typeof message.retour !== 'string' || !this.#pending) {
        throw new Error('Retour de la commande demandée attendu');
      }
      const pending = this.#pending, feedback = message.retour;
      this.#pending = undefined;
      const confirmed = qualifyReturn(this.#model, pending, feedback);
      if (confirmed.reason) return this.#stop(confirmed.reason);
      if (confirmed.terminal) {
        this.#closed = true;
        return null; // Seul l’opérateur classe le verdict réel.
      }
      this.#state = confirmed.state;
      this.#history.push('retour:' + (this.#history.length + 1));
    }
    const choice = decide(this.#model, this.#state, this.#history);
    if (!choice.command) return this.#stop(choice.reason);
    this.#pending = { ...project(this.#model, this.#state, key(choice.command)), command: choice.command };
    return { action: choice.command.join(' ') };
  }

  #stop(reason) {
    this.#closed = true;
    return { arret: reason };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const session = new PublicSession();
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    let reply;
    try {
      reply = session.next(JSON.parse(line));
    } catch (error) {
      reply = { [session.admitted ? 'arret' : 'incompatible']: error.message };
    }
    if (reply) process.stdout.write(JSON.stringify(reply) + '\n');
    if (!reply || !reply.action) break;
  }
}
