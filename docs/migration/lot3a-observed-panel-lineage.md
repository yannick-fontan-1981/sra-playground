# Lot 3A : filiation de la branche de services par panneaux

## Objet et périmètre

Le sous-lot 3A transfère la branche **`panel_service_plan`** de l'entrée V6 `observed_composition_services` dans Logos Engine natif **`logos-engine.typescript.v6.native-migration/0.37.0`**. Il part de la publication 64, commit `3b5cb28a594e8570253371aeeb24444361df3cb0`, moteur natif `0.36.0`.

La branche comprend la mesure publique, la proposition, les gardes, l'acquisition des réponses, les refus et la restauration de son état. La façade originale contient six branches : **une sur six est raccordée par ce sous-lot**. Son entrée de registre reste ouverte et la couverture native expose les cinq plans encore en attente. Ce document établit la filiation et la portée des preuves de composant et d'intégration. Il ne déduit aucun résultat de campagne ni aucun niveau réussi de ces preuves.

La référence est le commit V6 **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**, conservé sous `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/`. Aucun fichier original n'est modifié. La branche consomme des rasters publics, des observations datées et les références des actions disponibles. Elle ne reçoit ni identifiant de jeu, ni trajectoire attendue, ni rôle de palette importé.

## Sources directes et empreintes

Les quatre sources directes suivantes ont été lues et leurs SHA-256 recalculés. Les liens pointent vers les octets de référence conservés dans le dépôt.

| Source originale | Contrat consommé | SHA-256 |
| --- | --- | --- |
| [laya_proto/common_observed_compositions.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_observed_compositions.py) | Façade commune, limite du préfixe, contexte préalable, support mesuré du point, liaison et restauration | `4f836b0c66c84805755533a194a58a05222c1bf8f7a656aa030cc1fe01811d5e` |
| [laya_proto/panel_service_access.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/panel_service_access.py) | Projection, candidats propres, choix de service, mémoire, événements et gardes | `430bbe1c8bbf05dac9e6e3d92a6070cefc6f1dafdfec531fe315328b5ec880a3` |
| [laya_proto/panel_service_projection.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/panel_service_projection.py) | Grammaire des panneaux et correspondances visibles entre matériaux, opérateurs et services | `a47d56983cba1ee04033526bd695aaa79481d254da5ac35324368c5ae0cf6caf` |
| [laya_proto/geometric_observer.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/geometric_observer.py) | Composants monochromes mesurés dans le raster public | `1017b130cb91f799ab5bdb2f26789c2645078d9b9d226469b3915d4a7262eaac` |

Le routage a également été confronté à [morphology_policy/strategy.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.py), SHA-256 `425aca6c30e7abb38a537dfcef38f92c418bc4dfa35201ae52dc42ba4390fa55`, et à [morphology_policy/strategy.drm](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm), SHA-256 `6e8aee941d56511273be79222b03c88d092cdc3ca1c295c91509b9cc93b15f44`. L'acquisition commune et sa remise en mémoire sont définies dans `laya_proto/common_supported_lines.py` et `laya_proto/common_frontier_runtime.py` du même commit.

## Sources, modules, propriétaires et consommateurs

| Producteur source | Transfert ou réemploi natif | Propriétaire et consommation |
| --- | --- | --- |
| `panel_service_projection.scene`, avec `geometric_observer.components` | [v6-panel-service-observation.ts](../../src/logos-engine/v6-panel-service-observation.ts), réutilisant `geometricComponents` de [v6-native-observer.ts](../../src/logos-engine/v6-native-observer.ts) | Une scène éphémère est mesurée à chaque question et aux gardes ; aucune scène présumée n'est injectée comme observation acquise |
| Ensembles Python de tuples de points et union des silhouettes visibles et retenues | [v6-panel-service-pattern-set.ts](../../src/logos-engine/v6-panel-service-pattern-set.ts) | Helper générique pour le hash des tuples entiers imbriqués et l'ordre de construction, copie et union des ensembles CPython 3.12 / 64 bits |
| `PanelServiceAccess.propose_graph`, `before`, `after`, `record`, `apply_event`, `retained_digest` | [v6-panel-service-access.ts](../../src/logos-engine/v6-panel-service-access.ts) | `PanelServiceMemory` possède uniquement la couche des panneaux ; le choix ne modifie pas cette mémoire |
| `ObservedCompositionConstraint`, héritage des adaptateurs couplé et graphe, journal `lines` | [v6-shared-series.ts](../../src/logos-engine/v6-shared-series.ts) | Une instance de `PanelServiceMemory` dans l'unique `SharedSeriesConstraint`, famille enregistrée `public_occurrence_recall` |
| Première sous-question de `goal_access` dans `strategy.drm` et `strategy.py` | [v6-native-runtime.ts](../../src/logos-engine/v6-native-runtime.ts) | Entrée `observed_composition_services` avant `coupled_support_composition` puis `alternating_graph_composition`, avec le même propriétaire |
| Exécution de la source inchangée sur observations et réponses de composant déclarées | [export-v6-panel-service-parity.py](../../scripts/export-v6-panel-service-parity.py), [fixture de parité](../../tests/fixtures/v6-panel-service-parity.json.gz) | [v6-panel-service.test.ts](../../tests/v6-panel-service.test.ts) compare les sorties natives ; [v6-shared-series-native.test.ts](../../tests/v6-shared-series-native.test.ts) contrôle l'intégration au propriétaire |

Le helper d'ensembles est nécessaire parce que l'ordre des silhouettes détermine l'ordre des services, puis le contenu et l'identité des propositions. Un `Set` JavaScript en ordre d'insertion ne préserve pas ce contrat. Le helper réutilise `pointHash` du module natif existant `v6-point-set.ts` pour les paires d'entiers. Il ne contient aucune silhouette de jeu. Son domaine est celui des tuples entiers imbriqués ; la suppression d'éléments n'est pas utilisée par ce transfert.

**Aucun nouveau noyau V5 direct n'est transféré dans la branche des panneaux.** `geometric_observer.components` est une fonction locale V6. Le propriétaire partagé et ses capacités antérieures restent réutilisés, avec leur filiation V5/V6 déjà documentée. Les imports V5 transitifs nécessaires au chargement de l'héritage Python ne constituent pas une preuve de consommation d'un nouveau noyau V5 par `panel_service`.

## Contrat de la branche transférée

La reconnaissance conserve la grammaire structurelle de la source : panneaux rectangulaires répétés, cellules mesurées, matériau sélectionné, marque de salle et correspondances de silhouettes entre commandes et scène. Les constantes de cette grammaire sont conservées comme prémisses de reconnaissance. Les valeurs de palette, les positions et les correspondances sont mesurées dans le raster courant.

La proposition examine chaque panneau dans l'ordre source. Elle retient un récepteur local unique compatible avec le matériau, sinon une réécriture locale unique qui prépare un récepteur, sinon une destination unique et son paramètre de salle unique. Tout panneau non résolu produit un refus bloquant. Une activité déjà sélectionnée n'est pas cliquée à nouveau.

Avant l'acquisition d'une sélection conforme, la configuration propose un seul clic expérimental. Une sélection conforme autorise ensuite la composition des préparations dans la limite commune de seize primitives et des actions restantes. La projection prédite contient **tous les panneaux**, y compris les champs inchangés. Quand les configurations sont préparées, la branche choisit la première référence d'action sans point, triée dans l'ordre lexical source. L'effet de cette application demeure inconnu et clôt le préfixe pour réconciliation.

L'adaptateur refuse une proposition lorsque `remaining < 1`, exige l'échéance courante et transmet `remaining_level_actions`. Pour chaque action, il renseigne `expected_before`. Les actions `ACTION6` reçoivent un support mesuré au point courant, avec valeur de palette, empreinte de projection et références d'observation. Le binder vérifie l'adresse avant de recopier `point_support` vers `point_binding` ; une charge utile non vide est refusée pour une commande sans point.

La garde préalable contrôle l'identité du plan, l'égalité des commandes de la proposition et du bundle, l'époque, le score, l'action disponible et la géométrie. La première primitive exige le raster et l'observation initiaux exacts. Les suivantes exigent la projection prédite précédente, puis le point, le motif et la couleur de la cellule visée. La garde de retour scelle le préfixe lors d'une différence d'époque ou de score, d'un effet inconnu, d'une scène non reconnue ou d'une projection contraire.

La configuration n'acquiert ni loi d'exécution simultanée, ni stock, ni priorité de travail, ni cause terminale. Les faits et compositions conservent leur statut conditionnel. La progression officielle reste apportée par le retour public.

## Acquisition, journal et restauration

La mémoire propre contient `symbols`, `evidence`, `selection_observed`, `effects` et `failed`. Chaque acquisition émet un événement `observed_panel_service` contenant la mémoire résultante et le détail de la réponse. Une réponse de configuration conforme acquiert `selection_observed` ; une réponse contraire ajoute l'essai au registre des échecs. Une application sans changement informatif, y compris un changement de pixels qui conserve la projection des panneaux, acquiert un échec dans le contexte courant. L'identité de l'essai contient l'époque, la projection et la commande.

Le propriétaire partagé appelle d'abord les acquisitions des ancêtres, puis celle des panneaux, puis les acquisitions du paquet public. Il conserve un seul journal commun. La couche des panneaux n'est pas réenregistrée comme famille indépendante. Les trois adaptateurs de proposition appellent le même planificateur hérité ; leurs configurations et filtres de plans définissent l'entrée exposée. Dans la fermeture transférée, l'ordre est `panel`, puis `auxiliary`, puis `pair`, puis `graph`.

Un refus `block_unrelated_probe` est transmis avant le filtrage des plans acceptés. Le runtime conserve cette sélection et la traite comme une frontière inconnue. Les arbitrages natifs existants exigent une proposition au statut `proposed` et ne remplacent pas ce refus par une autre expérience.

`applyEvent` possède une copie JSON immuable de l'événement et invalide la révision native avant la mutation. `currentState()` produit une copie indépendante. La restauration reconstruit les couches dans des instances séparées, redistribue les événements, vérifie le digest commun, puis publie les instances reconstruites ensemble. Un échec de restauration ne remplace pas la connaissance acquise. Le certificat existant du propriétaire contrôle aussi la révision, l'identité et les conteneurs internes de la couche des panneaux.

## Deux traitements natifs explicitement qualifiés

**Délégation sans configuration.** Dans la source, la mesure de scène précède le test de présence de `panel_service_question`. Cette mesure est pure. Le transfert délègue immédiatement lorsque la configuration est absente, ce qui évite un parcours du raster lors des entrées couplée et graphe. Il ne supprime aucun événement ou état acquis. La mesure et toutes ses gardes restent exécutées lorsque la branche est configurée.

**Compatibilité des digests antérieurs.** Le digest du propriétaire natif omet la nouvelle couche tant que `panel.eventCount` vaut zéro. Les anciens checkpoints conservent ainsi leur digest exact. Dès le premier événement de panneau, `PanelServiceMemory.retainedDigest(ancestor)` ajoute la mémoire et les événements de cette couche. La même règle est appliquée au calcul courant et à la restauration. Il s'agit d'une enveloppe de migration native ; le digest complet de toute la chaîne Python `ObservedCompositionConstraint` n'est pas revendiqué. La fixture compare séparément le digest propre de la couche, en lui fournissant le véritable digest de l'ancêtre Python inchangé.

## Portée partielle du cumul des points

`panelServiceInputCandidates` reproduit la couche propre : mesure sans silhouettes retenues, ajout des centres de toutes les cellules visibles quand `ACTION6` est disponible, puis déduplication par identité en conservant la première position et la dernière valeur. Son paramètre `inherited` permet de conserver les candidats d'un ancêtre.

L'adaptateur natif 3A n'ajoute aux entrées courantes que les candidats propres aux panneaux obtenus par ce helper. Il ne reconstruit pas encore le cumul complet de `CrossedPrefix` et `MarkedCollection`, transmis par les anciens alias jusqu'à `AuxiliarySupportAccess`, ni les candidats des autres branches encore en attente. Cette limite reste une condition de clôture de la façade globale.

Elle n'affecte pas les décisions de la fermeture active 3A : les ajouts hérités omis sont tous des pointages `ACTION6`, tandis que la branche des panneaux consulte `inputs` uniquement pour choisir une commande d'application sans point. Les planificateurs natifs `Auxiliary`, `Pair` et `Graph` ignorent leur argument `_inputs`. La mesure des commandes de configuration vient directement de la scène courante. Cette justification ne s'étend pas automatiquement aux prochains consommateurs de candidats.

## Six branches et ordre réel de l'héritage

L'ordre de `PLAN_KEYS` dans la façade n'est pas l'ordre de sélection. La résolution des méthodes de `CombinedObservedCompositionMemory(ReferencePopulationAccess, CombinedCoupledMemory)` suit l'ordre ci-dessous pour les six branches.

| Priorité | Plan et classe source | État ou preuve propre | Réemploi V5 direct à traiter | Statut 3A |
| --- | --- | --- | --- | --- |
| 1 | `reference_population_plan`, `ReferencePopulationAccess` | Population, contrôles acquis, identité active ou en attente, essais et relations locales | `maximum_injective_matching`, `_physical` de `neighborhood_pattern_construction`, `DWorkBudget` | En attente |
| 2 | `reception_service_plan`, `ReceptionServiceAccess` | Porteur, translations, essais, immobilité observée, attente cumulée, réfutations et événements résiduels | `ReceptionWaitBudgetD` | En attente |
| 3 | `rooted_line_plan`, `RootedLineAccess` | Effets sur racine et étendue, configuration conditionnelle, essais et contre-exemples | Contrats `Piercing*`, `search_piercing_plans` | En attente |
| 4 | `panel_service_plan`, `PanelServiceAccess` | Silhouettes, preuve de sélection, effets et essais refusés | Aucun nouveau noyau direct | Branche transférée |
| 5 | `chamber_relation_plan`, `RelationalChamberAccess` | Tables partielles, éditions observées, conflits, échecs et frontières | `_network_domain`, `_indexed_combination` de `finite_relation_network` | En attente |
| 6 | `exposed_reception_plan`, `ExposedReceptionAccess` | Contrôles, orientation, hypothèses de contact, mouvement conjoint et changements d'apparence | `_expand_push_chain` de `seeded_partial_push_d` | En attente |

Les fichiers sources correspondants sont `laya_proto/reference_population_access.py`, `reception_service_access.py`, `rooted_line_access.py`, `panel_service_access.py`, `relational_chamber_access.py` et `exposed_reception_access.py` sous la référence définie plus haut. Après ces branches vient `AuxiliarySupportAccess`. Le nom `EphemeralMapAccess` utilisé dans `exposed_reception_access.py` est un alias de cette classe ; il ne désigne pas une couche supplémentaire.

Deux particularités de source restent à traiter dans les sous-lots futurs. Premièrement, `ReferencePopulationAccess` peut refuser la revalidation d'une scène retenue avant de tester sa clé de configuration ; ce refus peut donc être visible depuis les trois adaptateurs communs. Deuxièmement, `ExposedReceptionAccess` et `ReceptionServiceAccess` utilisent tous deux l'attribut `reception_events`. L'initialisation de la classe supérieure remet ce journal à zéro, puis les deux couches l'utilisent et l'incluent dans leurs digests imbriqués. Le port de ces branches devra tester le mélange des événements et la restauration de cette structure source. Le lot 3A ne la modifie pas et ne prétend pas l'avoir transférée.

## Preuves disponibles et limites d'attribution

L'[exporteur de parité](../../scripts/export-v6-panel-service-parity.py), SHA-256 `b62135501103731bf165ffe51b6b4c1a1fdb983f3750099693449fcc60dda15a`, exécute la source inchangée. Il vérifie les **1 786 fichiers de la référence** avant import et après exécution. La fixture conserve également les empreintes de 823 sources chargées et la politique réellement consommée. Elle déclare zéro action physique, aucune exécution de host de jeu, aucune modification ou substitution de la source, et aucune lecture de source, oracle ou solution de jeu.

La [fixture comprimée](../../tests/fixtures/v6-panel-service-parity.json.gz) a pour SHA-256 `0fc54e9b3af159e9bc9fc9d3525737f83a47d4ab038612be0cfe6e127d6cb2ac`. Elle contient 100 mesures initiales publiques, 34 cas propres, 15 cas de garde, 7 enveloppes communes et 4 cas d'ensembles de silhouettes. Le corpus d'entrée [v6-linked-packet-initial-public.json.gz](../../tests/fixtures/v6-linked-packet-initial-public.json.gz), SHA-256 `3f82fb0b60a104095623216023054ef438ca4cc516941c671c385ebcbf1e54f2`, contient 100 vues, sans action enregistrée ni saut de niveau. Le raster initial public RSWP est un témoin de reconnaissance dans les tests ; son identifiant n'entre pas dans le code de production.

La vérification dédiée de [v6-panel-service.test.ts](../../tests/v6-panel-service.test.ts) a passé **58 tests sur 58**. Elle couvre les mesures, les propositions et états exacts, les gardes, les retours contraires, les transformations de palette et de position, la restauration et les ordres d'ensembles. Les sept enveloppes communes de la fixture sont en outre comparées au propriétaire natif dans [v6-shared-series-native.test.ts](../../tests/v6-shared-series-native.test.ts), avec la compatibilité des checkpoints, les mutations, le rollback, les priorités des gardes et l'acquisition unique. Le raccordement de l'entrée et sa couverture partielle sont contrôlés dans [v6-coupled-pair-planning.test.ts](../../tests/v6-coupled-pair-planning.test.ts).

Le contrôle TypeScript `npx tsc --noEmit` a réussi après écriture des modules. Un contrôle ciblé de développement a comparé 121 unions déterministes d'ensembles au Python installé, sans écart d'ordre ; les quatre cas durables de la fixture couvrent construction, copie, hash, union et redimensionnement. Ces vérifications ne sont pas des mesures de performance.

Les rasters altérés et les réponses acquises construits par l'exporteur sont des cas de contrat de composant déclarés. Ils ne constituent ni des transitions physiques observées sur un jeu, ni une preuve de réussite de niveau. La clôture de la façade demandera les cinq branches restantes, le cumul des candidats et leurs contrats d'intégration ; les résultats d'une campagne physique doivent être établis séparément.
