import { Agenda } from '../agenda.mjs';

// Traducteur limité au contrat public « cadran fixe, deux cases, tampon engagé ».
// Son seul état acquis est le retour chronologique des actions effectivement demandées.
export class PartiePublique {
  #agenda = new Agenda();
  #marks = new Map();
  #reading = null;
  #history = [];

  constructor(markdown) {
    const material = markdown.match(/Les deux cases (\w+) et (\w+) sont vierges\. Les tampons disponibles sont ([\w, ]+)\./);
    const dial = markdown.match(/Le cadran désigne une seule sortie, (\w+) ou (\w+), qui reste fixe/);
    if (!material || !dial || !markdown.includes('La position initiale du cadran est inconnue')
      || !markdown.includes('Le premier marquage engage ce tampon') || !markdown.includes('Une marque est définitive')
      || !markdown.includes('révèle la sortie désignée, une seule fois') || !markdown.includes('si les deux cases portent le tampon exigé')
      || !markdown.includes('réussir dans chaque monde compatible')) throw new Error('Contrat public non reconnu');
    this.cells = material.slice(1, 3);
    this.stamps = material[3].split(', ');
    this.exits = dial.slice(1);
    this.required = new Map([...markdown.matchAll(/La sortie (\w+) exige le tampon (\w+) sur les deux cases/g)]
      .map(match => [match[1], match[2]]));
    if (this.required.size !== 2 || new Set(this.required.values()).size !== 2
      || !this.exits.every(exit => this.stamps.includes(this.required.get(exit)))) throw new Error('Exigences publiques ambiguës');
  }

  next() {
    const facts = {}, offers = [], actions = new Map();
    const observed = (value, ...evidence) => ({ value, evidence });
    const guard = (fact, expected = true) => ({ fact, expected });
    const dialFact = 'cadranSurPremiereSortie';
    if (this.#reading) facts[dialFact] = observed(this.#reading.exit === this.exits[0], this.#reading.ref);
    const markRefs = [...this.#marks.values()].map(mark => mark.ref);
    const engaged = this.#marks.values().next().value?.stamp;
    function describe(id, action, guards) {
      offers.push({ id, strategy: action.split(' ')[0], group: 'actions_publiques', entry: id,
        guards, contributes: ['validation_garantie'], modeFacts: {} });
      actions.set(id, action);
    }
    for (const stamp of this.stamps) {
      const exit = this.exits.find(candidate => this.required.get(candidate) === stamp);
      facts['exigible/' + stamp] = observed(Boolean(exit), 'fiche:exigences');
      facts['engagement/' + stamp] = observed(!engaged || engaged === stamp, 'fiche:engagement', ...markRefs);
      for (const cell of this.cells) {
        const mark = this.#marks.get(cell);
        facts['vierge/' + cell] = mark ? observed(false, mark.ref) : observed(true, 'fiche:cases-vierges', ...markRefs);
        const guards = [guard('vierge/' + cell), guard('exigible/' + stamp), guard('engagement/' + stamp)];
        if (exit) guards.push(guard(dialFact, exit === this.exits[0]));
        describe([exit ?? 'hors-exigences', cell, stamp].join('/'), ['marquer', cell, stamp].join(' '), guards);
      }
    }
    facts.deuxMarques = observed(this.#marks.size === this.cells.length, 'fiche:cases-vierges', ...markRefs);
    if (this.#reading) facts.bonTampon = observed(engaged === this.required.get(this.#reading.exit),
      'fiche:exigences', this.#reading.ref, ...markRefs);
    describe('validation', 'valider', [guard('deuxMarques'), guard('bonTampon')]);
    const turn = { goal: 'validation_dans_chaque_monde', scope: 'partie', need: { target: 'validation_garantie' },
      observation: { ref: this.#history.at(-1)?.ref ?? 'fiche', epoch: 1, frame: 'sans-image' },
      mode: 'solving', remaining: Infinity, groups: [{ id: 'actions_publiques', entries: [...actions.keys()] }],
      offers, facts, stops: [] };
    const decision = this.#agenda.decide(turn);
    let action = null;
    if (decision.decision === 'ouvrir_preuve' && decision.proof === dialFact && !this.#reading) action = 'lire';
    if (decision.decision === 'selectionner') action = actions.get(decision.branch);
    return { action, decision };
  }

  record(action, feedback) {
    const ref = 'retour-' + (this.#history.length + 1);
    if (action === 'lire') {
      if (this.#reading || !this.exits.includes(feedback)) throw new Error('Lecture publique non interprétable : ' + feedback);
      this.#reading = { exit: feedback, ref };
    } else if (action.startsWith('marquer ')) {
      const [, cell, stamp] = action.split(' ');
      // L'accusé répond à l'unique demande en vol. La case et le tampon sont ceux de cette demande.
      if (feedback !== 'marqué') throw new Error('Marque non attestée : ' + feedback);
      this.#marks.set(cell, { stamp, ref });
    }
    this.#history.push({ ref, action, feedback });
    return ref;
  }
}
