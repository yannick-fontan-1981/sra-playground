# Conversion de l’échéance appelante : brouillon de revue

Statut : revue de texte uniquement sous le calme 6A. Aucun fichier natif ni test
exécutable n’a été modifié ; aucun import, test, contrôle de syntaxe, calcul
d’empreinte, Git, build ou jeu n’a été lancé. Le correctif appartient au root 10B
et doit attendre la comparaison historique de HPDL01, qui requiert ses octets
natifs d’origine.

## Défaut constaté dans le checkout 10B

Dans `src/logos-engine/v6-native-runtime.ts`, `currentExecution`, actuellement
vers les lignes 497–502, remplace `execution.now` par `this.now` et compare
directement `execution.deadlineMs` avec une échéance exprimée dans l’horloge du
runtime. `NativeExecution` (`v6-native-types.ts`, vers 105–111) exprime pourtant
l’échéance dans l’horloge fournie par l’appelant.

Avec runtime = 1000, appelant = 10 et échéance appelante = 60, il reste 50 ms :
l’échéance transmise doit être 1050, sous réserve du plafond actif restant. Le
code actuel transmet 60. Dans l’autre sens, runtime = 10 et appelant = 1000 avec
échéance = 1050, il transmet 1050 au lieu de 60 et accorde un temps excessif.

Les chemins qui consomment ce contexte sont la sélection (`selectFamily`, vers
509), la garde du service courant (`admitCurrentRequiredService`, vers 761) et
la garde d’autorisation réelle (`authorize`, vers 1105). La correction reste
dans leur point de convergence ; aucune nouvelle autorité n’est ajoutée.

## Correction minimale proposée

Remplacer seulement le corps de `currentExecution` par le suivant, après
autorisation du root. Le prélèvement unique de l’horloge du runtime sert à la
fois au budget actif et à l’ancrage de l’échéance. L’horloge appelante est lue
ensuite : ce choix ne prolonge pas l’échéance par le temps de conversion.

```ts
  private currentExecution(execution: NativeExecution): NativeExecution {
    if (!this.current) return execution;
    const currentNow = this.now();
    const runningActiveMs = this.computeStart !== null && this.computeLevel === this.current.level
      ? Math.max(0, currentNow - this.computeStart) : 0;
    const remainingActiveMs = Math.max(0, 360_000 - (this.levelMs.get(this.current.level) ?? 0)
      - runningActiveMs);
    const callerRemainingMs = execution.deadlineMs === undefined ? Infinity
      : Math.max(0, execution.deadlineMs - (execution.now ?? (() => performance.now()))());
    return { ...execution, now: this.now,
      deadlineMs: currentNow + Math.min(remainingActiveMs, callerRemainingMs) };
  }
```

`signal` et `yieldControl` gardent leur identité. Une échéance absente laisse le
plafond actif du runtime s’appliquer ; une échéance déjà expirée donne zéro
temps restant. Une horloge absente avec une échéance utilise `performance.now`,
comme les consommateurs natifs actuels et la conversion 5C. Le cas non
initialisé garde exactement son retour actuel. Aucune nouvelle validation des
valeurs non finies ni nouvelle politique d’exception n’est introduite ici.

## Acquisition : révision distincte à préserver

Le checkout 10B examiné ne contient **pas** de variable `acquisitionExecution`.
Son `seal` (vers 1168) passe encore le contexte reçu à l’autorité ; l’interface
des acquisitions sélectionnées conserve ses arguments historiques.

Le bloc cité dans le signalement existe dans le checkout 5C :
`/workspace/sites/sra-lot5c-recovery-20261111/.sites-checkout/src/logos-engine/v6-native-runtime.ts`,
vers 1186–1195. Il convertit déjà `deadlineMs - caller.now()` en durée restante,
puis l’ancre à `acquisitionNow`. Il réserve cette acquisition au niveau du
premier retour scellé (`prefix.witnessed[0]?.first.level`), car l’observation
courante peut déjà exposer le niveau suivant. Le nouvel argument n’est passé
qu’au propriétaire d’acquisition bornée concerné.

Ne pas remplacer ce bloc 5C par un appel naïf à `currentExecution` lors de la
fusion : cela attribuerait le budget du nouveau niveau à l’acquisition du niveau
précédent. Ce brouillon ne copie pas la fonctionnalité d’acquisition 5C dans
10B et ne change aucun de ses arguments, états ou reçus.

## Test ciblé proposé, non installé et non exécuté

Ajouter `v6FrameHash` à l’import existant provenant de
`../src/runtime/v6-agent-protocol.ts` dans `tests/v6-native-runtime.test.ts`, puis
ajouter le bloc ci-dessous. Il utilise les API publiques `initialize`, `advance`
et `resume` ; aucune lecture de champ privé ne remplace le chemin réel.

Les deux origines inversées couvrent l’expiration prématurée et le budget
excessif. Une progression de 10 ms entre proposition et garde vérifie aussi que
la garde reçoit le temps restant courant. Le retour physique déjà reçu doit
rester acquis après expiration ; l’expiration ne doit pas libérer la seconde
action du préfixe ni être effacée par `resume`.

```ts
for (const [runtimeOrigin, callerOrigin] of [[1000, 10], [10, 1000]] as const) {
  test(`native current deadlines convert caller clock ${callerOrigin} to runtime clock ${runtimeOrigin}`, async () => {
    let runtimeClock: number = runtimeOrigin, callerClock: number = callerOrigin;
    const controller = new AbortController();
    const yieldControl = async () => {};
    const execution: NativeExecution = { now: () => callerClock, deadlineMs: callerOrigin + 50,
      signal: controller.signal, yieldControl };
    const planned: number[] = [], guarded: number[] = [], recorded: number[] = [];
    const remaining = (context: NativeExecution | undefined): number => {
      assert.ok(context?.now && context.deadlineMs !== undefined);
      assert.equal(context.signal, controller.signal);
      assert.equal(context.yieldControl, yieldControl);
      return context.deadlineMs - context.now();
    };
    const family: NativeFamily = {
      id: 'independent-clock-test',
      propose: (_observation, _rows, _inputs, _remaining, context) => {
        const time = remaining(context); planned.push(time);
        if (time <= 0) return null;
        runtimeClock += 10; callerClock += 10;
        return { status: 'proposed', kind: 'public_test',
          actions: [{ action_ref: 'ACTION1', data: {} }, { action_ref: 'ACTION1', data: {} }], steps: [{}, {}] };
      },
      before: (_proposal, _index, _packet, _observation, context) => {
        const time = remaining(context); guarded.push(time);
        return { admitted: time > 0, reason: time > 0 ? 'current' : 'caller_deadline' };
      },
      after: (_proposal, index) => ({ matched: true, seal_prefix: index === 1, reason: 'witnessed' }),
      record: (_before, _after, _command, _first, _second, _proposal, index) => {
        recorded.push(index); return { events: [] };
      },
      state: () => ({ recorded: [...recorded] }),
      restore: state => { recorded.splice(0, recorded.length, ...(state.recorded as number[])); },
    };
    const rows = board().frame, frameHash = await v6FrameHash(rows);
    const packet = (step_index: number): NativePublicObservation => ({ frame_rows: rows, frame_packet: [rows],
      state: 'NOT_FINISHED', level: 1, levels_completed: 0, available_action_refs: ['ACTION1'], step_index, frame_hash: frameHash });
    const runtime = new NativeV6Runtime({ families: [family], maxPointOccurrences: 250,
      sourceDigest: 'independent-clock-test', now: () => runtimeClock });
    try {
      const first = await runtime.initialize({ sessionId: `offset-${runtimeOrigin}-${callerOrigin}`,
        observation: packet(0), budgets: { targetLevels: 1, levelActionCaps: [600], maxActions: 600 } }, execution);
      assert.equal(first.kind, 'action');
      assert.deepEqual(planned, [50]); assert.deepEqual(guarded, [40]);
      runtimeClock += 41; callerClock += 41;
      const second = await runtime.advance({ command: first.command!, observation: packet(1), executionMs: 0 }, execution);
      assert.notEqual(second.kind, 'action', 'An expired caller cannot authorize the second path action');
      assert.deepEqual(guarded, [40, 0]);
      assert.deepEqual(recorded, [0], 'The actual first return is acquired exactly once before the next decision');
      const resumed = await runtime.resume(execution);
      assert.notEqual(resumed.kind, 'action', 'Resume cannot refresh the expired request');
      assert.equal(planned.at(-1), 0);
      assert.deepEqual(recorded, [0]);
    } finally { runtime.close('independent_clock_test_finished'); }
  });
}
```

La structure du test vient du signalement textuel 5C conservé dans
`/workspace/scratch/8a0681e98bf4/clock_regression_draft.txt` ; le brouillon ci-dessus
ajoute le vieillissement entre proposition et garde, les assertions de dernier
plan et l’import exact observé dans ce dépôt. Aucun résultat d’exécution n’est
déduit de cette lecture.

## Portée et précautions d’intégration

- Le service navigateur standard (`src/runtime/v6-agent-service.ts`, vers
  75–80) ne fournit actuellement ni `deadlineMs` ni `now`. Ce chemin conserve
  le seul plafond actif courant. Cela ne prouve aucune identité binaire ni
  invariance des performances après édition.
- Les consommateurs qui fournissent les deux champs doivent exprimer
  l’échéance dans leur propre horloge, comme le contrat le demande. Un appelant
  qui fournissait une échéance runtime avec une autre horloge devra corriger
  son propre contrat ; ce mélange ne doit pas être préservé comme comportement
  valide.
- Les horloges sont supposées monotones et leurs unités restent des
  millisecondes. Cette correction traite les origines différentes, pas les
  changements de cadence ni les horloges non finies.
- Le plafond actif reste 360 000 ms par niveau. `runningActiveMs` reproduit
  exactement la condition de `runningMs(this.current.level)` avec le même
  prélèvement que l’ancrage de l’échéance ; les pauses restent exclues par la
  comptabilité existante.
- Ne pas modifier le natif avant la preuve partielle historique HPDL01. Après
  application, il faut un nouveau gel natif et les vérifications demandées par
  le root ; les résultats HPDL01 restent liés à l’ancien digest et ne deviennent
  pas la preuve d’exécution du candidat corrigé.
- Le test est un contrôle ciblé de conversion et d’autorisation. Il ne prétend
  pas démontrer une parité complète du caller, une victoire de jeu ou un coût
  global acceptable.
