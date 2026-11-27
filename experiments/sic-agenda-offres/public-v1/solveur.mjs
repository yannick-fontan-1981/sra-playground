import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { admit, key } from './admission.mjs';
import { initialState, decide, project } from './planifier.mjs';

// Accusés matériels observés sur les parties publiques de développement.
// Le texte valide le geste en vol. Les effets viennent des règles de la fiche.
const acknowledgements = new Map([['marquer', 'marqué'], ['purger', 'purge terminée'],
  ['bloquer', 'butée bloquée'], ['retirer', 'poignée libérée'], ['indexer', 'poste indexé']]);

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
      if (!feedback.trim() || feedback === 'Action indisponible.') return this.#stop('retour vide ou commande indisponible');
      if (feedback === 'succès' || feedback === 'échec') {
        this.#closed = true;
        return null; // Seul l’opérateur classe le verdict réel.
      }
      if (pending.end) return this.#stop('verdict terminal non reconnu');
      const options = pending.next;
      if (options.every(s => !s.revealed.length) && acknowledgements.get(pending.verb) !== feedback) {
        return this.#stop('accusé matériel non reconnu pour la commande demandée');
      }
      // Le protocole donne le code observé pour une lecture. Un retour opaque
      // ne peut pas décider deux branches. Une commande applicable sans lecture
      // suit uniquement ses effets publics déterministes après l’accusé.
      const matches = options.filter(s => !s.revealed.length ||
        (s.revealed.length === 1 && String(s.revealed[0].value) === feedback));
      if (matches.length !== 1) return this.#stop('retour sans interprétation publique unique');
      this.#state = matches[0];
      this.#history.push('retour:' + (this.#history.length + 1));
    }
    const choice = decide(this.#model, this.#state, this.#history);
    if (!choice.command) return this.#stop(choice.reason);
    this.#pending = { ...project(this.#model, this.#state, key(choice.command)), verb: choice.command[0] };
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
