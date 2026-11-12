# Lot 8B : revue prospective du raccordement commun

## Statut et périmètre

Cette revue est une lecture du caller original et des chemins natifs déjà présents, commencée sur **`343fabef30fcbd1fa55b5d472f463816a6dc87b1`**. Elle ne constitue pas un résultat de qualification du nouveau raccordement. Aucun test, exportateur, audit, typage, build, jeu ou mesure de coût n'a été exécuté pour cette revue. Aucun verrou n'a été pris. Le présent document est le seul fichier écrit par son auteur dans cette étape.

Le jalon de composant reste celui de `component-stage-01` : fixture originale 03, 37 frames, 20 cas géométriques, 12 scénarios / 83 opérations originales, comparaison native à 249 tests et sous-tests, 17 contrôles natifs séparés. Ces résultats acquis ne sont pas des résultats du caller commun à venir. Les 249 décomptent notamment les 83 opérations dans deux modes natifs et leurs tests parents ; ils ne représentent pas 249 scénarios indépendants.

Le responsable du raccordement a retenu pendant cette revue : **arrêt terminal en cas d'acquisition BranchRouting incomplète, sans reprise automatique**, conservation du retour public complet, absence d'acquisition des retours BranchRouting suivants du même préfixe après la première incomplétude, et poursuite unique des acquisitions communes/passives. Les obligations ci-dessous décrivent ce choix prospectif ; elles ne le déclarent pas déjà implémenté ou testé.

## Références lues

Les chemins Python sont relatifs à `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/`.

| Référence | Point de contrat lu |
| --- | --- |
| `morphology_policy/strategy.py` | Construction de `self.branches`, branche `parallel_branch_routing`, annotation du sous-problème, distinction des contraintes et des offres du GoalAccess caller. |
| `morphology_policy/strategy.drm` | Position de `parallel_branch_routing` immédiatement après `motif_conditioned_access` et avant `conserved_band_transfer`. |
| `laya_proto/common_frontier_runtime.py` | Propriétaire choisi par `branch_plan`, gardes, acquisition sélectionnée, mémoire `branches:<revision>`, diagnostic final `branch_routing`. |
| `laya_proto/common_branch_routing.py` | État du propriétaire, retour officiel prioritaire, acquisition des mouvements et comportement des époques. |
| `src/logos-engine/v6-native-runtime.ts` | `originalEventFamily`, `subquestionFamily`, sélection ordonnée, `seal`, `retainSelectedAcquisition`, `acquisitionIncompletionReceipt`, acquisition passive, persistance et restauration. |
| `src/logos-engine/v6-native-authority.ts` | Ordre de `acquire`, conservation des transitions, branche `unassessed_public_transition`, réconciliation composée. |
| `src/logos-engine/v6-native-caller.ts` | Ordre de `beforeAssessment`, acquisition sélectionnée puis Goal/Point/Control et évaluation. |
| `src/logos-engine/v6-target-binding.ts` | `protocolProjection` : projection du protocole sans raster ni packet. |
| `src/logos-engine/v6-observed-binding.ts` | Adaptation existante de l'acquisition incomplète : absence d'événement source inventé et refus lié au retour courant. |
| `src/logos-engine/v6-branch-routing.ts`, `v6-branch-routing-geometry.ts` | API de composant, refus de proposition et exception typée `BranchRoutingIncomplete` avant mutation d'acquisition. |
| `tests/v6-selected-rigid-integration.test.ts` | Précédent de réception de retours réels, acquisition passive Binding incomplète et arrêt `native_acquisition_incomplete`. |
| `scripts/audit-v6-entry-points.ts`, `scripts/audit-v6-migration.py` | Construction des deux attestations distinctes : raccordement des entrées et inventaire de transfert des sources. |

## Raccordement minimal conforme au caller source

### Un propriétaire, une position et un adaptateur direct

Le caller Python crée une seule instance `strategy_router.branches`. La présence de `branch_plan` lui attribue les gardes et le retour sélectionné. Le natif doit donc créer un seul propriétaire `branch_routing`, conserver son état sous `family_state:branch_routing` et enregistrer l'entrée à sa position DRM exacte dans `factored_material_return`.

Le wrapper doit annoter la proposition avec `material_access_subquestion: parallel_branch_routing`. Le slot correspondant de `entryPoints` doit rester **`null`** : c'est un propriétaire direct, et non une entrée partagée utilisant `proposeInSubquestion`. La liste des familles et la liste `entryPoints` doivent rester strictement alignées. Une chaîne non nulle sur ce slot ferait demander au runtime une méthode d'entrée partagée que cet adaptateur ne possède pas.

`originalEventFamily` est un précédent utile pour `bind`, `before`, `after`, `state`, `restore` et la conversion d'un événement source en `{ events: [event] }`. Il ne suffit toutefois pas seul pour `record` : son implémentation actuelle laisserait s'échapper `BranchRoutingIncomplete` et ne transmet pas le contexte natif de calcul à ce composant. L'adaptateur BranchRouting doit conserver le résultat source exact en cas de réussite et traiter explicitement le cas incomplet.

### Ordre de sélection et refus courant

Le mode borné de production doit transmettre à `propose` l'exécution courante et les plafonds publiés du composant. Une absence de proposition après une recherche entièrement terminée conserve son sens source et permet de consulter l'entrée suivante.

Une recherche incomplète est différente : le refus de composant contient déjà l'observation, l'époque, le hash, la révision lorsque disponible, le score, l'empreinte de l'état du propriétaire et l'absence d'autorité. L'adaptateur commun doit ajouter **`block_unrelated_probe: true`** à ce refus courant. Sans ce champ, `retainProposalRefusal` le journalise mais la sélection continue vers BandTransfer ou d'autres offres ; la borne native changerait alors l'ordre source comme si BranchRouting avait terminé son calcul.

Ce blocage doit concerner uniquement un refus d'incomplétude encore lié à l'observation et à l'état du propriétaire courants. Il ne doit pas être ajouté aux `null` source complets, réutilisé dans une nouvelle époque ou conservé comme savoir acquis.

### Mémoire et diagnostic

Après une acquisition sélectionnée réussie, la clé source est **`branches:<before.revision>`**, avec la valeur de l'unique événement source, la référence `after.observation_ref` et la révision `after.revision`. `retainSelectedAcquisition` possède déjà la table de clés des adaptateurs à événement unique ; c'est l'extension minimale.

La source ne fournit pas d'acquisition passive BranchRouting et n'ajoute pas de clé métier `branches_state`. Il ne faut pas inventer une telle acquisition ou un second propriétaire. Le checkpoint natif générique `family_state:branch_routing` reste distinct de la clé source d'événement. Les acquisitions communes et celles des autres familles conservent leur propre ordre et leur unicité.

Le diagnostic source `branch_routing.scored_witnesses` correspond à `passed`, et `branch_routing.observed_effects` à `events`. Un diagnostic natif peut lire ces champs depuis le propriétaire unique/checkpoint commun ; il ne doit pas en conserver une seconde copie faisant autorité. `finished` local ne signifie pas qu'un niveau a été gagné.

### Restauration et frontière publique

Le runtime persiste chaque famille puis la restaure depuis le graphe commun. Le raccordement doit conserver le snapshot froid à quatre attributs source, les méthodes acquises d'une époque antérieure, l'absence de modèle à une nouvelle époque, ainsi que des événements historiques portant sur un autre nombre de barres.

La fermeture du domaine restaurable est une adaptation native séparée. Les vérifications de forme et d'entiers sûrs existantes ne suffisent pas à qualifier des `unit`, `limit` ou coordonnées arbitrairement immenses. Les bornes publiques doivent être validées avant une mutation du propriétaire, avec rejet atomique d'un checkpoint invalide. Une restauration ne constitue jamais une nouvelle observation autorisant une action.

Les observations fournies par le runtime sont gelées ; l'adaptateur doit conserver cette stabilité pendant les cessions coopératives. Les plafonds de produits cartésiens ne doivent pas être décrits comme une borne générale de toute la mémoire ou de la latence de `layout`, des copies et de l'historique.

## Acquisition incomplète : risques concrets et choix retenu

### Exception après réception physique

`advance` a déjà enregistré le retour officiel, mesuré `after` et ajouté la transition au préfixe avant d'appeler `seal`. Une exception de recherche laissée brute dans `record` interromprait l'acquisition après réception physique et avant la clôture normale des écritures communes. Une simple nouvelle action ou un nouvel appel `advance` ne serait pas une reprise valide de ce retour.

Le composant lève `BranchRoutingIncomplete` avant de modifier `motion`, `seen`, `verified`, `refs`, `current`, `finished` ou `events` pour cette acquisition. L'adaptateur doit attraper **uniquement cette exception typée**, puis retourner :

- `events: []` ;
- `native_acquisition_incomplete: true` ;
- un `native_acquisition_refusal` explicitement lié à **`after`**, avec `status: unknown`, `release_authority: false` et `frontier.complete: false` ;
- la cause, la phase, la quantité examinée et les bornes, sans produire de contre-exemple physique ou d'événement source ordinaire.

Le chemin `acquisitionIncompletionReceipt` exige précisément les trois identités `observation_ref`, `level_epoch`, `frame_hash` du retour et l'absence d'autorité/incomplétude. Une réutilisation aveugle du refus de proposition, lié à l'observation avant action et dépourvu de `frontier.complete`, ne remplirait pas ce contrat.

### Exécution courante d'acquisition

`seal` construit déjà `acquisitionExecution` depuis le temps actif restant du niveau où l'action a eu lieu et l'échéance restante de l'appelant. À la base lue, seul Binding reçoit ce dernier argument. BranchRouting doit le recevoir explicitement aussi ; il ne doit pas réutiliser une échéance de proposition devenue ancienne pendant une pause.

L'adaptation de planning ne doit pas modifier les listes d'arguments historiques des autres familles ni attribuer à la source Python des paramètres de scheduling natif.

### Conservation durable du retour complet

Le reçu d'incomplétude existant contient seulement les références avant/après, la commande et le refus. Ce contenu prouve l'identité d'un retour, pas la disponibilité de ses pixels et animations. Le nœud ordinaire `reasoning:transition` conserve un `unassessed_public_transition` complet uniquement lorsque l'évaluation n'a pas mis à jour les registres. `protocolProjection` ne contient pas les rasters ou packets. Il ne faut donc pas supposer que toutes les autres branches de réconciliation conservent déjà les arguments nécessaires à une acquisition BranchRouting différée.

Le choix retenu ajoute pour chaque retour BranchRouting non acquis un témoin durable comprenant :

- les observations mesurées `before` et `after` ;
- les packets publics complets `first` et `second`, y compris leurs `frame_rows` et `frame_packet` ;
- la commande et l'index réel dans le préfixe ;
- **`acquired: false`** et l'identité du propriétaire ;
- un lien au `prefix_evidence:<revision>` conservant la proposition complète.

Ce témoin est conservé dans le graphe/checkpoint, et pas seulement dans la trace circulaire de 128 éléments. Aucune animation n'est tronquée pour faire tenir le reçu. Le reçu ne porte aucune autorité de réexécution physique.

### Préfixe contenant plusieurs retours

Après la première acquisition BranchRouting incomplète, le choix retenu suspend les acquisitions BranchRouting suivantes du même préfixe. Chaque retour officiel ultérieur reçoit son propre reçu non acquis et son témoin complet. Une transition ultérieure plus facile à analyser ne doit pas masquer la lacune du préfixe en devenant une acquisition source prétendument continue.

Les autres acquisitions communes/passives poursuivent leur traitement une fois, dans l'ordre actuel. Elles ne doivent être ni annulées ni rejouées pour simuler une reprise BranchRouting. Le préfixe est persisté et le runtime termine avec `native_acquisition_incomplete`, sous réserve de la priorité existante d'une fin officielle.

La méthode `resume()` actuelle n'agit que sur `kind: boundary`. Sur `stopped`, elle rend la sortie arrêtée. Ce jalon choisit donc un **arrêt explicite**, pas une file de reprise automatique. Une future reprise métier exigerait un protocole supplémentaire par propriétaire/transition pour exclure toute double acquisition ; elle est hors de ce raccordement minimal.

### Score, compteurs et preuve d'unicité

Une augmentation de score sur une acquisition ordinaire, sans lacune préalable, reste prioritaire dans `record` : elle produit `official_boundary` avant l'énumération d'identité, avant `events` et avant `finished`. Une borne d'identité ne doit pas supprimer cette branche source.

Si une frontière officielle survient après un retour déjà non acquis dans le même préfixe, le résultat officiel du runtime conserve sa priorité, mais les retours BranchRouting suspendus restent explicitement `acquired: false`. Le score public ne prouve pas que leur acquisition métier a réussi.

Les compteurs existants `acquiredRecords` et `caller.acquiredTransitions` incluent les callbacks/retours réconciliés, même lorsqu'un callback produit le marqueur d'incomplétude. Ils ne sont donc pas, seuls, un décompte d'acquisitions BranchRouting réussies. Les événements `branches:<revision>`, les appels capturés et les reçus non acquis doivent établir ce décompte sans ambiguïté.

## Validations proposées, sans exécution dans cette revue

Le responsable a choisi une qualification ciblée : typage ; référence, contrat, frontière publique et Kernel ; régressions runtime/BranchRouting/Binding/MotifAccess/SelectedRigid ; attestations d'entrées et de couverture ; build. Le plan exécutable et ses limites restent sous sa responsabilité. Aucune réussite de ces étapes n'est anticipée ici.

| Obligation | Cas indépendant disponible ou preuve attendue |
| --- | --- |
| Acquisition depuis froid | `cold_four_calibrations_move_propagate_epoch` : `base`, `north`, `south`, `west`, `east`, `aligned`, `propagation_no_score`. Les quatre commandes doivent être acquises par les retours communs, sans seed de `motion`. |
| Sélection et préfixe de deux mouvements | `cold_equal_cost_select_first_point_bind_move` : chaîne `triple` à `triple_east`, point de sélection, `triple_selected`, `triple_moved`, `triple_aligned`. Le corpus se termine sur la proposition de propagation, sans record final de cette propagation. |
| Effet contraire | Après les quatre calibrations simples : `east` vers `contrary_south` au lieu d'`aligned`, révision de `ACTION1` et prochaine calibration. |
| Réponses incomplètes et frontières | `diagonal`, `missing`, `official_score`, `official_epoch`, `official_state`, `empty_new_epoch`. Le score demeure synthétique. |
| Acquisition sélectionnée unique | Une clé `branches:<revision>` par retour BranchRouting réussi ; aucune acquisition passive de BranchRouting sur une action étrangère ; méthode acquise relue après restauration commune. |
| Refus courant de proposition | Limite réduite déclarée, refus encore lié au champ courant, aucune action de la famille suivante libérée pour contourner l'incomplétude. |
| Retour non acquis | Borne/échéance atteinte après réception officielle : aucune mutation métier, aucun événement `branches` inventé, témoin public intégral persisté, arrêt terminal et aucune seconde commande. |
| Suffixe d'un préfixe incomplet | Plusieurs retours déjà reçus, premier incomplet : appels BranchRouting ultérieurs suspendus, un témoin non acquis par retour, passifs communs acquis une fois. |
| Frontière officielle prioritaire | Score augmenté sans lacune préalable malgré une limite d'identité réduite ; aucun événement ordinaire ajouté. |
| Restauration publique | États valides à modèles absents ou époques différentes admis ; données hors frontière publique rejetées atomiquement. |
| Régressions du mécanisme partagé | Runtime ordinaire, Binding complet/incomplet, MotifAccess, SelectedRigid : mêmes signatures historiques, ordre et conservation des retours. |

Les retours retenus de la fixture 03 peuvent fournir des rasters indépendants au nouveau test Kernel, mais une preuve depuis froid doit les obtenir par les retours réels de cette session de test. Les trois seeds contrefactuels `motion` du corpus de composant ne sont pas nécessaires à la chaîne froide commune.

## Audits et carte de transfert après qualification

Le registre lu contient **68/76 entrées**, dont **25/33** dans `factored_material_return`. `parallel_branch_routing` est encore `pending`, `family: null`. La version du runtime lue est `0.66.0`.

Après un raccordement réellement qualifié, les mises à jour minimales sont :

1. Ajouter l'alias `parallel_branch_routing: branch_routing` à `scripts/audit-v6-entry-points.ts`. L'entrée est directe ; ne pas la faire passer pour une entrée partagée. Régénérer l'attestation depuis la vraie factory, en contrôlant la position entre MotifAccess et BandTransfer et le slot direct `null`.
2. Vérifier le résultat attendu de cette unique nouvelle entrée : **69/76, 90,8 %**, et **26/33** pour la liste matériau. Les trois autres listes et le dénominateur 76 restent les mêmes. Ce pourcentage mesure le raccordement, pas le volume de code, le score ou la parité complète du caller.
3. Ajouter à `migration/v6-transfer-map.json` un mapping unique de `agents/yf_arc3_v6/laya_proto/common_branch_routing.py` vers les deux modules natifs, au statut `component_verified`, avec les preuves composant conservées et les nouveaux reçus communs réellement obtenus. Ne pas déclarer `verified` ou une clôture globale.
4. Compléter les preuves/notes des mappings existants de `common_frontier_runtime.py` et `morphology_policy/strategy.py` sans dupliquer leurs sources et sans relever leur statut global sur la seule preuve BranchRouting. `common_multiscale_constraints.py` et `geometric_observer.py` sont déjà mappés : leurs helpers consommés ne créent pas de nouveaux modules transférés.
5. Régénérer `docs/migration/v6-coverage.json` par l'audit existant, après validation du plan. Pour ce seul nouveau mapping, la projection de l'inventaire lu est 215 modules `component_verified` et 1 007 `pending`, avec 147 `partial_transfer` ; ce sont des valeurs attendues conditionnelles, pas un résultat exécuté. Les six portes globales restent fausses.
6. Conserver la séparation entre qualification du raccordement, couverture structurelle, régressions, coût officiel et publication. Aucun nouveau programme compilé n'est impliqué par l'ajout de ce propriétaire au programme de sélection existant. La version/publication et la feuille de route sont des décisions de livraison distinctes.

Le script de couverture est un inventaire statique des sources ; le script d'entrées instancie la factory native. Aucun des deux n'est exécuté dans cette revue. La sélection de leurs commandes, l'enveloppe, les fichiers d'entrée et les reçus doivent être déclarés avant l'exécution autorisée par le responsable.

## Relecture statique du premier diff d'intégration

Après la rédaction du contrat prospectif, le responsable a demandé une relecture de son diff `v6-native-runtime.ts`. Cette relecture ne lance aucun composant ni test et ne vaut pas qualification fonctionnelle. Aucun défaut supplémentaire de perte ou double acquisition n'a été trouvé dans les branches modifiées examinées :

- `branchRoutingFamily` clone et gèle les entrées de proposition ; transmet l'exécution courante ; expose un refus courant bloquant ; et attrape seulement `BranchRoutingIncomplete` dans `record`.
- `seal` transmet `acquisitionExecution` à BranchRouting. Le premier marqueur incomplet installe une barrière locale au préfixe. Le suffixe produit des reçus `earlier_selected_acquisition_incomplete`, avec `source_record_attempted: false`, sans rappeler le propriétaire.
- `retainSelectedAcquisition` n'est appelé pour aucun de ces retours incomplets. Les autres acquisitions communes/passives conservent leur passage unique existant.
- Le reçu BranchRouting ajoute `acquired: false`, `release_authority: false`, un lien au préfixe et la copie intégrale de `WitnessedTransition`. Celle-ci comprend les packets, les observations mesurées, la commande, l'index et le résultat du garde après action. Les reçus sont inclus dans l'écriture durable de `prefix_evidence`.
- Le mapping d'événement est `branch_routing: branches`. La factory construit un propriétaire unique et l'ajoute dans l'ordre déclaré, avec un slot direct `null`.
- La constante `NATIVE_V6_IMPLEMENTATION` reste à **0.66.0** pendant ce jalon de développement. La nouvelle liste de familles, les extensions déclarées et le `sourceDigest` distinguent le candidat du publié. Le responsable réserve un nouveau numéro de livraison à une qualification ultérieure ; le présent document ne présente pas le candidat comme une nouvelle publication.

Les assertions Kernel, de frontière publique et de régression annoncées doivent encore vérifier ces chemins. Les attestations JSON de registre et couverture examinées restent les attestations antérieures tant qu'elles ne sont pas régénérées dans une exécution déclarée.

## Limites conservées

Les documents de composant, les reçus historiques et leurs échecs restent conservés. Cette étape ne rouvre aucun jeu, payload ou oracle, et ne comporte aucune interaction LKEY. Elle ne remplace pas une campagne de jeu, ne promet pas une parité du caller original complet et ne fournit aucun coût officiel 8B. Le critère de coût global et les publications antérieures conservent leurs preuves et réserves propres.
