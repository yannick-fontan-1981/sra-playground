# Capture des formes communes BranchRouting 8B

Ces deux outils préparent une qualification fonctionnelle du raccordement BranchRouting au service public réel. Ils complètent les huit tests communs par un artefact durable contenant les appels à `V6AgentService.handle`, les commandes et tickets effectivement autorisés, les observations publiques, les opérations du propriétaire enregistré et tous les deltas du graphe Kernel. Le lecteur recharge cet artefact sans créer de runtime, appeler une famille, exécuter un oracle ou produire des attendus depuis le candidat.

L’auteur a seulement écrit et relu les outils. Il n’a lancé ni script, ni import natif, ni contrôle de syntaxe, ni test. Le propriétaire de la qualification déclare, gèle et supervise chaque tentative.

## Entrées indépendantes et périmètre

Les rasters et les événements/états attendus proviennent exclusivement du corpus indépendant `tests/fixtures/v6-branch-routing-reference.json`, gelé sous SHA-256 `e6ae197b7b982bd41f561b9df8e458436d7ce0797f39bbf86d972e55472b6769`. Ce corpus a été exporté depuis la référence source `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Les outils vérifient sa provenance déclarée, ses trois sources épinglées, son exportateur et son manifest original ; ils ne relancent pas l’exportateur. Aucun payload de jeu ou de LKEY n’est interprété.

Chaque session commence par le constructeur froid réel. La branche contraire rejoue les quatre calibrations avant son retour contraire : son acquisition préalable n’est pas injectée depuis le snapshot de la fixture. L’ablation est l’unique remplacement d’un effet acquis : elle remplace explicitement le wrapper `record` sélectionné par `{ events: [] }`. Le cas incomplet conserve la méthode originale ; il avance uniquement l’horloge de niveau du runtime, après le résultat inchangé du garde de la seconde action du préfixe.

La sélection commune utilise le centroïde mesuré **(6, 13)** dans la boîte `[6, 12, 7, 15]`. Le corpus composant avait fourni **(7, 13)** en premier dans une liste manuelle. Les outils déclarent cette différence d’entrée et contrôlent le vrai témoin commun, le digest de projection et le garde courant. Ils ne revendiquent pas une parité exacte de ces deux listes d’entrées.

| Session | Retours publics | Acquisitions source réussies | Effet vérifié | Dernière question autorisée sans retour |
| --- | ---: | ---: | --- | --- |
| `single-positive` | 6 | 6 | Quatre calibrations, mouvement, propagation sans score | Aucune |
| `triple-prefix` | 7 | 7 | Quatre calibrations, sélection, préfixe de deux mouvements acquis au scellement | Propagation `ACTION5` |
| `contrary-return` | 5 | 5 | Même commande de mouvement, retour contraire, révision de `ACTION1` | Calibration `ACTION5` |
| `selected-acquisition-ablation` | 1 | 0 | Même première commande et même retour, effet sélectionné omis ; fait `branches:<revision>` nul | Calibration `ACTION1` |
| `incomplete-prefix` | 7 | 5 | Deux mouvements publics conservés mais non acquis ; arrêt terminal sans reprise automatique | Aucune |

Au total : **26 retours**, **23 acquisitions source réussies**, **1 retour ablaté**, **2 retours incomplets**. Il y a **25 appels au wrapper `record`**, dont **24 invocations de l’adaptateur original** : cette dernière quantité inclut son refus typé et ne mesure donc pas les seules acquisitions réussies. Les modes effectivement exécutés sont 17 calibrations, 2 sélections, 6 mouvements et 1 propagation. Les trois questions finales non exécutées sont comptées séparément.

`caller.acquiredTransitions` compte les retours publics réconciliés. Il ne prouve pas leur acquisition par BranchRouting. `finished: true` après la propagation sans score signifie le retrait de cet essai ; il ne signifie pas une victoire. Les cinq sessions restent à zéro niveau officiellement résolu.

## Vérifications du lecteur

Le lecteur valide l’ordre et les hashes de chaque delta, les schémas Kernel, la portée, les révisions, les origines, le profil du store et les fragments identifiés par contenu. Il reconstruit les nœuds, hydrate toutes les racines modifiées, recalcule l’identité des programmes et compare l’inspection finale aux digests des nœuds et deltas complets. Les valeurs anciennes restent dans les deltas bruts ; le cache hydraté conserve seulement une révision par nœud et peut reconstituer une ancienne racine pour vérifier une restauration.

Les événements et les états complets sont comparés aux attendus du corpus avec transport explicite des références source vers les observations effectivement mesurées. La sélection commune est le seul changement de commande déclaré. Le lecteur lie le propriétaire, ses checkpoints et restaurations réellement appelés, les faits `branches:<revision>`, le programme commun de choix, la libération WHY/ACT, les propositions, les gardes courants, les tickets, les transitions et les relations effectives des nœuds de préfixe. Les noms de liens diagnostiques ne sont pas présentés comme de nouvelles relations Kernel.

Pour les deux acquisitions incomplètes, il vérifie les paquets publics et observations complets, les commandes, index et résultats des gardes conservés, le lien vers `prefix_evidence:<revision>`, `acquired: false`, `release_authority: false` et `frontier.complete: false`. Le premier retour atteint réellement `record` et refuse sur la borne de temps ; le second ne l’appelle pas et référence le premier obstacle. Aucun fait `branches:<revision>` n’est créé pour ces deux retours. Le `resume` du service arrêté conserve exactement le résultat arrêté.

Les scalaires d’horloge des traces restent dans les graphes bruts. Leur représentation exacte est vérifiée et leur création doit appartenir à l’intervalle réel de l’appel `handle` correspondant. Il n’y a ni substitution de `Date.now`, ni normalisation des graphes, ni comparaison de performance.

## Identité du candidat

La capture reçoit un manifest contenant exactement `fileCount`, `digest` et `files`. Elle vérifie les fichiers natifs avant/après et exige un HEAD stable pendant ses cinq sessions. Le lecteur vérifie à nouveau les fichiers, les outils et toutes les entrées avant/après.

Le gel prévu pour ce jalon comporte **331 fichiers** natifs et le digest canonique `3ff1d9ad56e22aedc0fee3a0da6a3af50a1da0bc14a0ba01cb38272ba85234be`. L’ordre est le tri lexical des chemins relatifs complets, sérialisés en table JSON compacte chemin → SHA-256. L’ancien digest `76a403016d2b28287194b7498f10e14727b7e3fb3f214d2f79cb0292390d54bf` utilisait le tri Python des composants ; la réconciliation du propriétaire garde les mêmes 331 empreintes de fichiers. Ces outils ne réécrivent aucun ancien reçu.

## CLI proposée au propriétaire

Depuis `/workspace/sites/sra-lot8b-branch-routing-20261112/.sites-checkout`, exécuter séparément les commandes suivantes sous le superviseur déclaré du propriétaire. Les chemins de sortie doivent être nouveaux ; aucun artefact existant n’est écrasé.

```bash
node docs/migration/lot8b-evidence/tools/delivery/branch-common-capture.mjs \
  /workspace/sites/sra-lot8b-branch-routing-20261112/.sites-checkout \
  docs/migration/lot8b-evidence/delivery-qualification-01/candidate-native.json \
  docs/migration/lot8b-evidence/delivery-qualification-01/branch-common-01/capture.jsonl.gz

node docs/migration/lot8b-evidence/tools/delivery/branch-common-qualify.mjs \
  docs/migration/lot8b-evidence/delivery-qualification-01/branch-common-01/capture.jsonl.gz \
  docs/migration/lot8b-evidence/delivery-qualification-01/branch-common-01/capture.receipt.json \
  docs/migration/lot8b-evidence/delivery-qualification-01/branch-common-01/graph-review.json \
  docs/migration/lot8b-evidence/delivery-qualification-01/branch-common-01/work-forms.json
```

Limites prospectives conseillées : **600 secondes pour la capture**, **900 secondes pour le lecteur**, `NODE_OPTIONS=--max-old-space-size=1536`. Cette option borne le heap V8, pas toute la mémoire du groupe ; un plafond de **3 Gio de RSS** du groupe peut être imposé par le superviseur. Les limites sont des garde-fous de préparation, pas une durée prévue ou une garantie de coût de production. Les outils ne remplacent pas la supervision externe, ne relancent pas un échec et n’ouvrent aucun verrou. Toute tentative interrompue doit garder ses sorties brutes, son journal et son reçu de supervision.

La capture écrit `capture.jsonl.gz` et `capture.receipt.json`. Le lecteur écrit toujours un rapport lorsque son traitement atteint sa finalisation ; il n’écrit les formes qualifiées qu’après tous les contrôles. Les statuts de succès sont respectivement `captured_synthetic_common_structure` et `qualified_synthetic_common_work_forms_and_graphs`. Un statut d’échec ou un artefact absent ne peut pas être traité comme une qualification partielle réussie.

Cette preuve reste limitée aux formes synthétiques communes déclarées. Elle ne démontre ni résultat de jeu, ni parité complète du caller original, ni égalité de graphes entre versions, ni acceptation de performance, ni publication. Les résultats restent `officialPerformanceEligible: false` et `wholeCallerParity: false`.
