# Revue préparatoire de l’intégration 3I, 4A et 7A

Revue en lecture seule, relevée le **10 novembre 2026 à 18:49 UTC** pendant la fenêtre de coût 3I. Aucun test, build, rejeu, export, benchmark, opération Git distante ou changement de source native n’a été exécuté. Ce document décrit une réconciliation à faire ; il ne constitue pas une preuve de fusion ou de publication.

Les trois branches partent du commit `8fa6b261b8b23ac8d232e60c9c179e2f3407d82f`, Site 78 / native 0.49. Les observations ci-dessous portent sur les octets locaux présents lors de la lecture. L’intégrateur doit relire les **commits effectivement publiés**, car les deux autres fils peuvent encore modifier leur état.

| Fil inspecté | HEAD relevé | Gel natif retenu inspecté |
| --- | --- | --- |
| 7A, `lot7a-ranked-workshop` | `5b03ff799dbb61bc8c3acddb86ad38a82c9b78ea` | `8492388162915bd01be1279d645870d366f0fd306e4f31ea47e8b65aafebac7e`, 274 fichiers |
| 3I, checkout `sra-playground-step3d` | `8fa6b261b8b23ac8d232e60c9c179e2f3407d82f`, modifications natives encore non commitées lors de la lecture | `e039a62b5dbb563a6c25f5469228e0025ffb66f243a4e09fdf27caeaeef2bf87`, 270 fichiers |
| 4A, `lot4a-observed-feedback-sequence` | `ddc7d204d42c197fc62136bf2f843b1b72f74aad` | `66be0948fdff5abe10b12d253bb4583db067aab2f5b7248632c9f9d443bc53fe`, 271 fichiers |

## 1. Propriétaires et ordre stratégique

Les contrats de sélection viennent de [`strategy.drm`](../../../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm). Aucun ordre ne doit être reconstruit à partir des branches conditionnelles Python ni de l’ordre du tableau de familles enregistrées.

| Capacité | Propriétaire unique à conserver | Position source et raccordement |
| --- | --- | --- |
| 3I `recurrent_series` | `public_occurrence_recall`, avec le propriétaire ancestral interne `RecurrentSeriesMemory` | Entrée de `window_constraints` après `multiscale_constraints`, à la position déclarée, même si toutes les entrées intermédiaires ne sont pas encore raccordées |
| 4A `observed_feedback_sequence` | Une seule instance de l’adaptateur `feedback_sequences`, conservant un seul objet `FeedbackSequences` | Entrée `goal_access` avant `animated_contact` ; même instance dans le chemin `information_goal`, selon `feedback_sequences_first` |
| 7A `observed_ranked_workshop` | Une seule instance de `RankedWorkshop`, identifiant `public_ranked_workshop` | Quatrième nom déclaré de `factored_material_return`, après `observed_rigid_cargo`, avant `observed_symbol_transaction` et `observed_inventory_composition` |

3I n’ajoute pas une nouvelle famille autonome au tableau de propriétaires. Il remplace les anciens conteneurs `lineTrials`, `lineGoals`, `insertSamples`, `insertOrders`, `insertRejections` et `insertRefutedEpochs` par des projections vers leur propriétaire commun. Il faut conserver son argument supplémentaire `recurrentSeriesConfig` dans l’appel à `createNativeSharedSeriesFamily`, son alias dans `windowProviders`, ses gardes et son contrat d’interruption de recherche.

4A et 7A ajoutent en revanche deux propriétaires autonomes distincts. Le tableau `families`, les deux déclarations de type `acquisitionFamilies`, la validation du constructeur et l’objet transmis au constructeur doivent contenir **les deux instances**. Le contrôle d’identité strict ajouté par 7A pour l’atelier doit rester présent. Les deux entrées de sélection Feedback doivent conserver la même instance ; ne pas recréer un adaptateur pour la seconde entrée.

## 2. Acquisition : ordre à préserver lors du conflit commun

La référence est [`common_frontier_runtime.py`](../../../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_frontier_runtime.py). La lecture directe confirme les trois positions distinctes : retour passif Workshop après celui de `lines`, état Workshop après Reactive, puis retour et état Feedback plus loin, avant les départs morphologiques.

Dans [`v6-native-runtime.ts`](../../../../src/logos-engine/v6-native-runtime.ts), conserver l’enchaînement suivant :

1. Le retour du propriétaire sélectionné est acquis par le chemin actif existant.
2. Le propriétaire SharedSeries acquiert son retour passif lorsqu’il n’était pas sélectionné. En 3I, l’acquisition ancestrale Recurrent précède Crossed et Occurrence dans ce propriétaire ; le cutoff Rooted et le traitement du paquet complet restent ceux de 3I.
3. L’atelier reçoit le retour passif **immédiatement après Recall**, uniquement si `selectedId !== workshop.id`, sans proposition Workshop injectée.
4. Les familles déjà présentes conservent leur ordre. Après Reactive, l’état source `observed_ranked_workshop_state` est écrit/restauré sous la condition source `mode_evidence.length || events.length`.
5. Le bloc Feedback vient **après l’état Workshop**. Il appelle son `record` passif uniquement si `selectedId !== feedback.id`, puis conserve `feedback_sequence_state` lorsque `layout` ou `entry_method` est présent.
6. Les observations de départ Morphology restent après ces deux propriétaires.

Les ajouts 4A et 7A occupent le même point textuel avant les départs Morphology. Une résolution mécanique prenant simplement un côté perdrait une acquisition ; une concaténation inversée ne reproduirait pas l’ordre source. Ne pas fusionner les états `feedback_sequence_state`, `observed_ranked_workshop_state` et `repeated_series_state`.

Le dictionnaire `singleEventKeys` doit conserver **`feedback_sequences → feedback_sequence_event`** et **`public_ranked_workshop → ranked_workshop_event`**. Chaque propriétaire sélectionné continue d’être exclu de son propre passage passif. L’existence du passage passif Feedback n’autorise pas une extension analogue aux transactions du futur 7B.

## 3. Observateurs de campagne et inventaire

Dans [`tests/helpers/v6-live-game-campaign.ts`](../../../../tests/helpers/v6-live-game-campaign.ts), les deux insertions sont complémentaires :

- Conserver les tableaux `feedbackSourceCalls` **et** `workshopSourceCalls` dans le rapport initial.
- Conserver séparément les observateurs Feedback (`propose`, `proposeInSubquestion`, `record`) et Workshop (`proposeSource`, `recordSource`, avec sa protection `sourceDepth`). Ils enveloppent des instances différentes. Leurs valeurs de retour synchrones/asynchrones, arguments opérationnels et exceptions doivent rester inchangés.
- Conserver le checkpoint `observedFeedbackSequence` ajouté aux préfixes par 4A.
- Conserver les champs `observedRecurrentSeries`, `recurrentSeriesEventCount` et `recurrentSeriesAcquiredEvents` ajoutés par 3I. Le compteur précédent vient du préfixe réellement conservé.

L’observateur ne doit ni réacquérir un retour ni alimenter le runtime depuis une attente du rapport. Geler le harness réconcilié avant les nouvelles preuves.

Dans [`scripts/audit-v6-entry-points.ts`](../../../../scripts/audit-v6-entry-points.ts), garder les trois alias `recurrent_series`, `observed_feedback_sequence` et `observed_ranked_workshop`. Le test `explicitSharedEntry` doit inclure **Feedback et Workshop** en plus des familles existantes : une classe simplement enregistrée n’établit pas le raccordement de son entrée déclarée.

Les modifications de [`migration/v6-transfer-map.json`](../../../../migration/v6-transfer-map.json) sont principalement disjointes. Conserver les nouveaux groupes 4A/7A, les mises à jour 3I de `common_repeated_lines.py`, `common_supported_lines.py` et `common_crossed_prefix.py`, ainsi que les ajouts 7A aux lignes communes `strategy.py` et `common_frontier_runtime.py`. Ces deux lignes communes restent **`partial_transfer`**. Le sous-ensemble V5 `station_profile_workbench.py` reste partiel. Les fichiers de couverture générés doivent être régénérés depuis le candidat commun ; ne pas sélectionner arbitrairement le JSON d’un fil.

## 4. Attentes de tests à réconcilier explicitement

### Lacune repérée dans le test de comptage isolé 7A

[`tests/v6-radial-port-integration.test.ts`](../../../../tests/v6-radial-port-integration.test.ts) maintient sa propre table d’alias. Le checkout 7A inspecté n’y ajoute pas encore `observed_ranked_workshop`. Son ancien contrôle **53/76** peut donc réussir alors que l’audit effectif compte 54 entrées. Cette lacune ne change pas le résultat de l’audit ; elle limite ce que prouve le test isolé.

Après la fusion réelle :

- Ajouter `observed_ranked_workshop: 'public_ranked_workshop'` à la table d’alias du test.
- Exiger également l’entrée explicite alignée pour `public_ranked_workshop`, comme pour Feedback et les autres propriétaires concernés.
- Conserver l’alias Feedback ajouté par 4A et l’alias Recurrent ajouté par 3I.
- Recalculer les attentes à partir de l’audit réel. L’union des trois changements inspectés conduit **prévisionnellement** à `[[10,12],[20,21],[8,10],[18,33]]`, soit **56/76** ; ce nombre n’est pas un résultat d’exécution de cette revue.
- Conserver la nouvelle liste des entrées Window et les **16 occurrences de sélection du même propriétaire Recall** attendues par 3I dans `v6-coupled-pair-planning.test.ts`. Ce nombre d’entrées ne signifie pas 16 propriétaires.
- Conserver le nouveau nom de portée de digest SharedSeries dans `v6-support-caller-integration.test.ts`.

La correction déjà faite par 7A dans `v6-inventory-kernel.test.ts` est appropriée : le test vérifie les entrées connectées contre l’ordre DRM, au lieu de supposer que Reactive est toujours le voisin immédiat d’Inventory. L’échec isolé **2960/2961** reste inchangé dans son reçu historique. Le prochain contrôle doit porter sur le candidat intégré et sa propre liste de tests.

## 5. Portée exacte de la compatibilité des sauvegardes

La revue secondaire n’a trouvé aucun défaut bloquant dans le chemin de production actuel lié à l’ajout du propriétaire Workshop. Les preuves existantes doivent néanmoins être présentées au niveau qu’elles vérifient réellement.

| Preuve inspectée | Contrat couvert |
| --- | --- |
| `tests/v6-crossed-prefix-integration.test.ts` | 11 checkpoints réels du propriétaire SharedSeries provenant de native 0.48 / Site 76 ; état, digest et propriétaire CrossedPrefix |
| Nouveau `tests/v6-recurrent-series-integration.test.ts` dans 3I | 19 checkpoints réels du même propriétaire provenant de native 0.49 / Site 78 ; deux emplacements ancestraux de digest, propriétaire unique et événements historiques incomplets laissés opaques |
| `tests/v6-native-checkpoint-integration.test.ts` | Rétention et restauration immuables dans une session commune nouvellement initialisée |
| `tests/v6-ranked-workshop-reference.test.ts` | Restauration de la nouvelle enveloppe `native.public_ranked_workshop.v1`, y compris dans une nouvelle instance, puis proposition conditionnelle attendue |
| `tests/v6-ranked-workshop-kernel.test.ts` | Restauration des connaissances depuis le graphe autoritaire après remise à froid de l’objet de travail ; nouvelle portée, revalidation et réfutation |

**Ces preuves ne démontrent pas l’import d’une session complète archivée.** `NativeV6Runtime.initialize()` crée un nouveau `NativeKnowledgeStore` et installe les nœuds de toutes les familles enregistrées. Le protocole [`V6AgentOperation`](../../../../src/runtime/v6-agent-protocol.ts) n’expose pas d’import de session complète : il propose `init`, `advance`, `edit`, `resume`, `snapshot`, `inspect` et `close`. Les éditions autorisées portent sur l’activation d’une famille et le remplacement d’un programme.

L’injection hypothétique d’un ancien graphe complet dépourvu de `family_state:public_ranked_workshop` échouerait lorsque `restoreFamilies()` recherche ce nœud. Ce scénario n’est pas une opération de production actuellement exposée et ne doit pas être annoncé comme compatible. Les 19 contrôles historiques 0.49 de 3I devront être exécutés sur le candidat réellement intégré avant d’être attribués à cette livraison.

## Conclusion de la revue préparatoire

Les raccordements inspectés peuvent être réunis sans un nouveau propriétaire partagé entre Feedback et Workshop, sans modifier leur priorité source et sans doubler les acquisitions. Les points à traiter sont les conflits communs énumérés ci-dessus, la correction du test d’alias, la conservation de la portée des checkpoints et les preuves sur le gel réellement intégré. Cette revue ne remplace aucune de ces vérifications finales.
