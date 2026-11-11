# Attribution prospective du created de trace

Statut : **sources préparées, non exécutées, non qualifiées**. Ce dossier concerne uniquement le qualificatif de captures fonctionnelles. Aucun code natif ni test gelé de fa23 ne change ; aucune mesure de coût ne résulte de ce correctif.

## Motif et source

Le refus officiel antérieur reste conservé dans `before-refusal.json`, et le qualificatif antérieur dans `before-qualifier.mjs`. Le diagnostic indépendant attempt03 a parcouru les 58 points attendus et tous leurs nœuds communs. Dans les nœuds communs, il n’a trouvé que le digest d’origine lié au rôle et le champ exact d’horodatage d’enveloppe. Les identités dérivées hors nœuds restent soumises aux contrôles existants ; elles ne sont pas normalisées.

`NativeReasoningMemory.constructor` dans `src/logos-engine/v6-reasoning-memory.ts` emploie par défaut `Date.now() / 1000`. Sa méthode `trace` alloue un identifiant entier positif et conserve `{id, episode, kind, body, created}`. `NativeCompositionAuthority.memory`, dans `src/logos-engine/v6-native-authority.ts`, construit cette mémoire sans horloge substituée ; ses écritures conservent les traces sous le composant `native_reasoning_trace`. Les deux fichiers ont la même identité dans les reçus baseline et candidate existants. Ils sont maintenant ajoutés aux sources que le qualificatif doit fingerprint et comparer aux deux gels capturés.

## Exception unique et preuves produites

L’exception porte seulement sur `/value/root/members/created/bits` d’un nœud `reasoning:trace:<entier positif>` de type `component_state`, composant `native_reasoning_trace`, dans sa session effective. Le schéma, les clés d’enveloppe, l’identité de trace, l’épisode, l’encodage float64 et son champ bits sont contrôlés. Le nombre doit être fini, correspondre exactement à une division d’un nombre entier de millisecondes par 1000, et appartenir à l’intervalle fermé startedAt/finishedAt de la capture de son rôle.

Une table distincte par rôle/session/identité exige la stabilité exacte des bits. Le résultat conserve les bits, les secondes, les millisecondes, la date et la fenêtre de capture pour chaque trace. Cette table n’est alimentée qu’après comparaison réussie de tous les autres champs. Les copies temporaires de comparaison remplacent uniquement ce champ bits ; elles ne modifient ni les entrées ni le corps de trace, et ne suppriment aucun `created` imbriqué.

`origin.source_digest` reste séparé, lié exactement au digest de chaque rôle. Les fonctions de reconstruction de chaînes, recalcul de digests, tickets, compteurs, causes/ordre communs et attribution des nœuds/deltas supplémentaires ne sont pas modifiées. Le CLI conserve ses six arguments et son comportement direct ; une garde empêche son lancement lorsque le module est importé par les tests.

## Revue et exécution à venir

`qualifier.patch` permet la revue complète. Les exports `TraceCreatedAttribution` et `commonNode` servent au test ciblé. Aucune dépendance runtime supplémentaire n’est importée. Le qualificatif reste lui-même fingerprinté ; les deux sources productrices de l’horodatage sont ajoutées au contrôle de provenance commun.

Le fichier `trace-created-attribution.test.mjs` prépare un cas positif à horodatages distincts, les bornes inclusives, la séparation des sessions et les refus : hors fenêtre, fenêtre de l’autre rôle, type/bits invalides, NaN/infini, précision incompatible avec Date.now, instabilité dans chaque rôle, faux identifiant, mauvaise session, champ de nœud modifié, corps/nested created modifié et origine incorrecte. Il vérifie aussi l’absence de mutation des entrées et d’attribution partielle après refus.

Commande proposée, **non exécutée** :

```sh
node --test --test-concurrency=1 docs/migration/lot6b-evidence/provisional-063-01/cost-time-attribution-01/trace-created-attribution.test.mjs
```

La revue indépendante précède tout test ou nouvelle qualification. Une qualification ultérieure devra employer de nouveaux chemins de sortie et conserver le refus précédent. Aucun verdict positif n’est anticipé. Le premier éditeur de source s’est arrêté sur une attente de fin de fichier avant d’écrire le qualificatif ; ce garde et les seules copies alors créées sont consignés dans `source-preparation-attempt01.json`.
