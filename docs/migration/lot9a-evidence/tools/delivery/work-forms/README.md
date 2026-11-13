# Lot 9A : formes de livraison et graphes 0.67 → 0.68

Ces outils sont des dérivés prospectifs des outils finaux 8B. Ils ne doivent pas être lancés avant le gel de la déclaration root et la revue indépendante. Leur préparation et leur analyse de syntaxe n'exécutent ni le runtime natif, ni une capture, ni un jeu, ni l'oracle original.

## Paire figée

| Rôle | Source | Version | Fichiers natifs | Digest canonique |
|---|---|---|---:|---|
| A publié | `8462204043aa368faa7df280d796bb706eb53b38` | 0.67.0 | 331 | `c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a` |
| B candidat | HEAD déclaré avant les commandes | 0.68.0 | 334 | `e7a94fbc7cdcb19d8704b5d4120f27a858cbcd07e455084711510ee147f4e653` |

Le publié est Site 108. Le checkout A est `/workspace/sites/sra-lot9a-baseline067-20261112`. Le checkout B est `/workspace/sites/sra-lot9a-chart-navigation-20261112/.sites-checkout`.

Les manifests résident sous `docs/migration/lot9a-evidence/delivery-final-068-01`. Chaque rôle reçoit une nouvelle capture du même générateur ; aucune capture historique n'est renommée. Le contrôle corrigé du lecteur 8B v2 reste présent : chaque ligne de préflight doit correspondre au générateur du reçu propre à son rôle.

## Travail commun inchangé

Par rôle, quatre sessions froides : STCK3, STCK10, SMLP3, SMLP15. Elles ont une cible de trois niveaux et les plafonds `[600,600,600]`. Les formes complètes ont chacune trois inspections terminales réelles. Cela donne **31 retours par rôle**, **8 sessions et 62 retours** pour la paire attendue.

Les deux traces, leurs SHA, l'ordre des formes et les nombres d'actions sont repris sans modification du manifeste 8B. Les seuls changements du nouveau `cases.json` sont les métadonnées de portée et de provenance. Les commandes publiques sont comparées exactement à la trace avant de fournir chaque retour. Le harness de coût est seulement fingerprinté, jamais exécuté ici.

## Delta Chart autorisé

L'inventaire observe les deux fabriques réelles sans initialiser de session, puis leurs programmes de familles dans des stores locaux séparés. Les handles de workflow refusent toute exécution. Il exige :

- 62 → 63 propriétaires ; seul `public_chart_navigation` est ajouté.
- 28 → 29 programmes familiaux ; seul `v6.chart_navigation.choose` est ajouté.
- Les 62 propriétaires et 28 installations antérieurs restent dans le même ordre.
- L'entrée `chart_navigation` est ajoutée exactement dans `factored_material_return`.
- Seuls les trois fichiers Chart sont nouveaux et `v6-native-runtime.ts` est modifié.

Les trois nouvelles racines sont `family_state:public_chart_navigation`, `family_activation:public_chart_navigation` et `program:v6.chart_navigation.choose`. Les fragments supplémentaires doivent être atteignables depuis ces racines et leur identifiant doit vérifier leur contenu. Le programme installé est lié à sa valeur et à sa définition capturées par l'inventaire ; il garde sa révision initiale.

Binding, SelectedRigid, Motif, Recruitment et **BranchRouting** sont communs aux deux rôles. BranchRouting ne conserve aucune exemption d'attribution. L'instance Chart d'acquisition doit être l'instance enregistrée unique. `recordSource` observe chaque retour étranger acquis exactement une fois ; on n'instrumente pas simultanément son wrapper `record` pour en doubler le compte.

Sur ces formes étrangères, Chart doit conserver son état source initial complet, à l'exception de son époque. Une proposition, un événement, un refus ou une mémoire Chart positive ne sont pas acceptés automatiquement : ils arrêtent cette qualification et doivent être examinés comme une divergence nouvelle.

## Snapshots, décisions et graphes complets

La capture retient le `response.snapshot` intégral, son hash JSON, et un hash distinct du triplet complet `proposal/srcDecision/whyAct`. Elle conserve aussi la projection 8B pour les formes ; le lecteur vérifie que cette projection dérive du snapshot complet, puis compare **toutes les feuilles du snapshot complet**. Les champs de décision, de proposition et d'autorité ne sont jamais supprimés.

Chaque graphe est reconstruit depuis tous ses deltas. Le Kernel/store propre à son rôle vérifie nœuds, fragments, révisions, causes, hashes, chaînes et digest d'exécution. Les tickets doivent se lier aux graphes effectivement reconstruits. Les checkpoints de famille doivent correspondre aux appels réels observés. Tous les états et toutes les valeurs communes, y compris ceux de BranchRouting, sont comparés exactement.

Les compteurs de consommation sont distincts des formes terminées : `sessionStarts` compte les débuts déclarés, `initializedSessions` les instances dont l'initialisation native est effectivement observée, et `physicalReturns` chaque appel `advance` recevant son paquet public, même si cet appel échoue. Ils sont conservés par session, dans les points et échecs, puis dans le reçu final. Le champ historique `actions`, somme des formes complètes, ne sert jamais à effacer la consommation d'une session partielle.

Les attributions sont limitées aux preuves suivantes :

- Identité source, implémentation, population, révision, chaîne et digest d'exécution déjà validés pour le rôle.
- Couverture et références d'état correspondant exactement à l'inventaire des fabriques et à l'ajout Chart. La suppression inverse des trois nouveaux littéraux d'extension doit restituer les bytes de la déclaration source précédente.
- `trace[n].graph_chain` uniquement pour les notes source `src_selection` et `why_act_release`, avec une chaîne connue du graphe complet de chaque rôle.
- `reasoning:trace.created` selon la règle 8B existante : scalaire ou encodage float64 exact, identité de trace vérifiée et borne réelle de `Date.now` entourant son appel `service.handle`.
- `activeSeconds` selon ses propres compteurs réels : valeur finie, positive, monotone, comprise entre `runtime.elapsedMs` avant/après l'appel ; cette croissance doit tenir dans l'intervalle réel de `performance.now`, avec `executionMs=0` et aucune computation restant ouverte après le retour.

Ni `Date.now` ni `performance.now` ne sont remplacés. Aucun masque global de timestamp ou de hash n'est ajouté. Chaque différence reste dans le JSONL comprimé, avec sa justification. **Une différence inexpliquée fait échouer la qualification**, même si les formes seules concordent.

## Commandes exactes proposées

Depuis le checkout B, sous le superviseur borné root :

```bash
node docs/migration/lot9a-evidence/tools/delivery/work-forms/record-owner-source-inventory.mjs /workspace/sites/sra-lot9a-baseline067-20261112 /workspace/sites/sra-lot9a-chart-navigation-20261112/.sites-checkout docs/migration/lot9a-evidence/delivery-final-068-01/work-inventory-01/owner-source-inventory.json

node docs/migration/lot9a-evidence/tools/delivery/work-forms/capture-cost-owner-graphs.mjs baseline /workspace/sites/sra-lot9a-baseline067-20261112 docs/migration/lot9a-evidence/tools/delivery/work-forms/cases.json docs/migration/lot9a-evidence/delivery-final-068-01/baseline-native.json docs/migration/lot9a-evidence/delivery-final-068-01/work-baseline-01/baseline.json.gz

node docs/migration/lot9a-evidence/tools/delivery/work-forms/capture-cost-owner-graphs.mjs candidate /workspace/sites/sra-lot9a-chart-navigation-20261112/.sites-checkout docs/migration/lot9a-evidence/tools/delivery/work-forms/cases.json docs/migration/lot9a-evidence/delivery-final-068-01/candidate-native.json docs/migration/lot9a-evidence/delivery-final-068-01/work-candidate-01/candidate.json.gz

node docs/migration/lot9a-evidence/tools/delivery/work-forms/qualify-cost-owner-graphs.mjs docs/migration/lot9a-evidence/delivery-final-068-01/work-inventory-01/owner-source-inventory.json docs/migration/lot9a-evidence/delivery-final-068-01/work-baseline-01/baseline.json.gz docs/migration/lot9a-evidence/delivery-final-068-01/work-baseline-01/baseline.receipt.json docs/migration/lot9a-evidence/delivery-final-068-01/work-candidate-01/candidate.json.gz docs/migration/lot9a-evidence/delivery-final-068-01/work-candidate-01/candidate.receipt.json docs/migration/lot9a-evidence/delivery-final-068-01/work-qualify-01/graph-review.json docs/migration/lot9a-evidence/delivery-final-068-01/work-qualify-01/work-forms.json
```

## Bornes et clôture

| Catégorie | Attendu | Maximum avec une reprise corrective déclarée | Limite par commande | Cumul maximum |
|---|---:|---:|---:|---:|
| Inventaire | 1 | 2 | 120 s | 240 s |
| Capture A | 1 | 2 | 300 s | 600 s |
| Capture B | 1 | 2 | 300 s | 600 s |
| Lecture appariée | 1 | 2 | 300 s | 600 s |
| Total de ce volet | 4 | 8 | | **2 040 s** |

La cible normale est 1 020 secondes de plafonds cumulés, pas une durée attendue de calcul. Le maximum de captures de ce volet représente 16 sessions et 124 retours ; les tentatives échouées restent dans le cumul. Les autres catégories Chart common et les exécutions historiques sont suivies par le journal root, sans remise à zéro.

Un seul groupe de processus est actif à la fois. `NODE_OPTIONS=--max-old-space-size=1536` limite le old-space V8 et ne prétend pas borner tout le RSS. Le superviseur gère timeout et enfants. Aucun retry automatique, aucun écrasement de sortie, aucun effacement d'échec. HEAD, fichiers natifs, inputs et générateurs doivent rester inchangés pendant chaque commande.

Cette étape conserve `preparedOnly: true`, `officialPerformanceEligible: false` et `strictCommonGraphParity: false`. Elle n'établit pas une contribution positive Chart, un nouveau jeu gagné, une qualification worker ou un coût officiel. Elle n'utilise aucun verrou global. Les mesures officielles et la publication restent des jalons séparés avec leur exclusivité courte. Aucun domaine fermé ou oracle original n'est rouvert.
