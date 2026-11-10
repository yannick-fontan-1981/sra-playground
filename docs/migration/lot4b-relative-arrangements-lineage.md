# Lot 4B — filiation de RelativeArrangements

## Portée de cette lecture

Cette note décrit le contrat **des sources Python épinglées**, avant les preuves d'exécution du transfert 4B. La référence est `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, sous `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/`. Elle concerne l'entrée `window_constraints / relative_arrangement` et le workflow `v6.relative_arrangements.choose`. Elle ne livre ni `facet_example` (4C), ni une stratégie complète V5/V6.

La lecture et la rédaction ont été réalisées sur la branche `lot4b-relative-arrangement`, pendant la fenêtre exclusive 7A, sans import Python, oracle, test, construction, rejeu, partie, aperçu ou décompression de campagne. Les noms de jeu ci-dessous proviennent du catalogue existant ; aucun moteur ni état caché de jeu n'a servi à cette analyse. Les éventuelles adaptations natives doivent être attestées séparément des propriétés de la source exposées ici.

Les repères `family.py`, `geometry.py`, `planner.py`, `.drm` et `.src` renvoient au dossier [relative_arrangements](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/relative_arrangements/family.py). `strategy.py` et `strategy.drm` appartiennent à `agents/yf_arc3_v6/morphology_policy/`. L'appelant est `agents/yf_arc3_v6/laya_proto/common_frontier_runtime.py`. Les numéros indiquent les lignes des originaux épinglés, pas celles du code natif en cours de développement.

## Carte des producteurs et consommateurs

| Source et repère | Contrat observable | Risque de transfert |
| --- | --- | --- |
| `family.py:11`, constructeur | Une instance possède `models`, `events`, `failed`, `selection_ref`, `epoch` ; `last_layout` et `last` servent au choix courant. Elle charge le DRM et les trois callbacks SRC. | Fusionner cet état avec SharedSeries ou multiplier les instances changerait la propriété et la reprise. |
| `family.py:15`, `measure` | Réinitialise la mémoire locale à un changement d'epoch, puis projette l'observation actuelle ; rend `qualified` et `remaining`. | Une proposition finalement nulle peut déjà avoir réinitialisé l'état. L'acquisition sélectionnée seule ne signifie pas que `propose` est sans mutation. |
| `geometry.py:44`, `project` | Qualifie exactement une combinaison plateau/modèle/participants/actionneurs mesurée sur les pixels publics. | Une projection ambiguë vaut absence de reconnaissance ; elle n'autorise pas le blocage du groupe. |
| `geometry.py:78`, `translated_targets` | Produit des arrangements relatifs par translations ancrées sur un participant de même valeur. | Ce domaine n'énumère pas toutes les translations imaginables, ni rotations ou réflexions. Le rôle terminal reste hypothétique. |
| `planner.py:5`, `assignments` | Énumère les correspondances entre occurrences de même valeur, avec les limites exactes du DRM et de la source. | Tronquer l'énumération, conserver un résultat partiel ou transformer la limite en contradiction modifierait le contrat. |
| `planner.py:20`, `options` | Propose la sélection d'un participant ou un essai local d'actionneur ; consomme les gains acquis dans la sélection courante et les essais refusés. | Un gain n'est ni universel ni transféré automatiquement après une nouvelle sélection. |
| `family.py:24`, `select` | Retient la première offre selon l'ordre du planificateur et publie un diagnostic éphémère. | `last.status` ne suffit pas à décider si la source ferme le groupe : des refus surviennent après ce choix. |
| `family.py:28`, `propose` | Produit une seule `ACTION6`, liée à un support unique mesuré, avec plan, hypothèse, risques et reçu SRC. | Le point est dérivé de la composition ; l'exiger dans l'échantillonneur exploratoire `inputs` serait une restriction nouvelle. |
| `family.py:47`, `bind` ; `family.py:51`, `before` | Vérifie l'accord action/point, puis le contexte public complet et le pixel actuel avant l'action. | Une coordonnée seule ne constitue pas une autorisation. La garde reste nécessaire après restauration. |
| `family.py:56`, `after` | Rend toujours `matched: null`, `seal_prefix: true` et demande de mesurer l'effet. | Une prédiction ne doit pas devenir une confirmation ni autoriser une seconde primitive sans replanification. |
| `family.py:57`, `record` | Acquiert uniquement le retour lié à l'action de la proposition et à son observation initiale. | Aucun passage passif analogue à Feedback n'existe pour cette famille. |
| `geometry.py:92`, `effect` | Sépare sélection, absence de changement, changement ambigu et déplacement d'un unique participant avec un unique actionneur. | Les statuts de refus doivent rester distincts ; une divergence de prédiction peut néanmoins fournir un déplacement réellement mesuré. |
| `family.py:69`, `state` ; `family.py:70`, `restore` | Sérialise/restaure cinq champs, avec copie des modèles et événements et reconstruction de l'ensemble `failed`. | `last_layout`, `last`, `picked` et `context` ne sont pas une mémoire source durable. |
| `strategy.py:415`, branche `relative_arrangement` | Une projection reconnue suivie d'une proposition nulle termine le seul groupe `window_constraints`. | Continuer vers RecurrentSeries ou la symétrie dans ce groupe serait contraire à la source ; arrêter tous les autres groupes le serait également. |
| `common_frontier_runtime.py:842`, acquisition sélectionnée ; `:858`, persistance | Appelle `record`, conserve l'événement, écrit `relative_arrangement_state`, puis appelle `restore` sur cette valeur relue. | Le propriétaire, l'événement et le miroir doivent rester reliés au même retour public et à la même proposition. |

## Sélection et arrêt du groupe

Le constructeur de `StrategyRouter` crée `self.arrangements = RelativeArrangements()` (`strategy.py:89`). Le DRM place `window_constraints` en deuxième position, après `goal_access`, parmi seize groupes (`strategy.drm:358`). La boucle SRC extérieure poursuit le groupe suivant lorsqu'un fournisseur rend `None` (`strategy.src:17` ; `strategy.py:135`).

L'ordre de `window_constraints`, fixé à `strategy.drm:40`, est :

1. `occluded_catalogue_composition`
2. `queued_field_composition`
3. `product_panel_composition`
4. `labeled_sequence_composition`
5. `linked_packet_composition`
6. `trace_field_composition`
7. `cell_patch_composition`
8. `observed_occurrence_recall`
9. `observed_program_composition`
10. `typed_material_flow`
11. `radial_port_composition`
12. `observed_framed_analogy`
13. `field_service_composition`
14. `rooted_quota_composition`
15. `framed_window_composition`
16. `coupled_prefix_reference`
17. `relative_arrangement`
18. `multiscale_constraints`
19. `recurrent_series`
20. `periodic_sums`
21. `reflected_cover`

Une proposition non nulle reçoit `field_subquestion = relative_arrangement` et revient immédiatement (`strategy.py:424`). Si elle est nulle **et** que `last_layout` est non nul, `repeated_field()` retourne immédiatement `None` (`strategy.py:417`). Cela exclut les quatre sous-questions suivantes **et** le repli `self.symmetry.propose` de `strategy.py:433`. Cela ne bloque ni `goal_access`, déjà examiné, ni les groupes extérieurs suivants, à commencer par `orbit_constraints`.

La condition couvre toutes les façons dont `propose` peut rendre `None` après reconnaissance : aucune offre, budget inférieur à une primitive, `ACTION6` indisponible, support du point non unique. Le diagnostic `conditional_offer` peut donc coexister avec une proposition nulle lorsque le refus survient après `select`. En revanche, une interface absente ou ambiguë rend `last_layout = None` et laisse continuer les replis. Cette barrière est distincte de l'exclusion supplémentaire des interfaces de contrôle par `motif_lattice` / `motif_body`, appliquée près du repli de symétrie (`strategy.py:427`).

### Conséquence pour les arbitrages natifs existants

Le contrat minimal d'une barrière générique est : la consulter **après** le résultat nul d'un `propose` de cette entrée, avec une projection attestant l'observation courante, son epoch et son hash de raster. Sa portée est le reste du groupe courant. Le résultat mis en cache doit appartenir à cette même planification ; un ancien `last_layout` ne suffit pas après reprise ou changement d'observation.

Les parcours `preferCurrentRequiredService` et `preferAcquiredContinuation` peuvent ignorer les familles dépourvues de leur témoin spécialisé. Avant un candidat situé après une barrière source, un préexamen paresseux de cette barrière, mis en cache, est donc nécessaire pour conserver le refus local. Une barrière vraie abandonne ce groupe, sans abandonner les autres groupes. Une proposition non nulle ne satisfait pas cette condition ; les priorités supplémentaires de ces arbitrages restent des extensions natives à qualifier séparément.

Les trois parcours restrictifs `deferUnlearnedInvitation`, `scopeStationaryContactRefusal` et `scopeReturnedContactRefusal` rendent déjà `false` à un fournisseur sans leur témoin, avant d'en exécuter la projection. Ils restent conservateurs à cet endroit. Cette observation est une revue statique de raccordement, pas une preuve de parité complète de l'appelant.

## Reconnaissance et domaine géométrique

`rectangles` (`geometry.py:5`) exige un contour rectangulaire complet d'au moins trois pixels dans chaque dimension, avec aire et masque exacts. `cell` (`:14`) accepte une cellule uniforme, ou une unique exception placée exactement au centre calculé. Les égalités du `Counter` suivent la première occurrence rencontrée ; changer cette règle peut changer la projection.

Pour chaque contour candidat, `project` ne considère que la taille de carré plein la plus fréquente à l'intérieur. Il exige au moins six occurrences, une taille d'au moins deux pixels, des dimensions intérieures divisibles et au moins trois cellules par axe. Les valeurs majoritaires des deux parités du damier doivent être distinctes et représenter ensemble strictement plus de la moitié des cellules. Un autre cadre, entièrement à l'extérieur du plateau, fournit au moins deux pixels hors de ces valeurs de terrain ; leur multiensemble de valeurs doit correspondre exactement aux participants du plateau. Il ne doit y avoir qu'un participant marqué au maximum, au moins un groupe d'actionneurs, et finalement **une seule** projection candidate (`geometry.py:76`).

`pads` (`geometry.py:20`) part des carrés de taille mesurée dont l'origine est extérieure au rectangle du plateau, choisit le plus petit espacement admissible et construit les composantes par parcours en profondeur. Chaque groupe doit remplir un rectangle d'au moins deux cellules par axe et porter au plus un marqueur. L'ordre des cellules suit ce parcours ; seuls les groupes sont ensuite triés par origine. Trier les cellules indépendamment modifierait les égalités du choix final.

`translated_targets` ancre successivement un élément du modèle sur un participant de même valeur, écarte les sorties du plateau et déduplique les cibles complètes. Les champs `already_preserved`, `remove` et `add` décrivent les écarts mesurés. `terminal_role` vaut `hypothesis_until_observed_boundary` : une correspondance visuelle n'établit pas la réussite.

## Calcul fini, ordre et limites contraires

`assignments` trie les valeurs, les positions sources et les positions cibles, puis parcourt les permutations et leur produit. Les correspondances calculent une distance de Manhattan totale et le nombre de participants à déplacer. Deux refus sont globaux pour cet appel : plus de six participants d'une même valeur, ou un produit de permutations supérieur à `maximum_assignments = 1024` pour une cible. Dans les deux cas la fonction rend `[]`, même si elle avait déjà produit des affectations pour une cible précédente. La limite porte sur le produit d'une cible, pas sur la somme de toutes les cibles. Ce résultat borné n'est pas une preuve d'impossibilité du jeu.

Si le participant actuellement sélectionné n'a aucun déplacement requis dans l'affectation, le planificateur propose de sélectionner les participants à déplacer. Sinon, il examine les actionneurs dont le marqueur porte la même valeur que ce participant. Les modèles consommés doivent avoir le même `pad_ref`, le même `selection_ref` et la même `object_value` (`planner.py:36`).

Pour chaque axe où l'actionneur s'est déplacé, le gain vaut déplacement du participant divisé par déplacement du marqueur. Un gain nul, ou un déplacement du participant supérieur à la moitié de la dimension correspondante du plateau, est ignoré. Des gains différents pour le même axe rendent cet actionneur contradictoire et suppriment ses offres. Un gain négatif ou fractionnaire n'est pas interdit en soi ; la prédiction finale doit tomber sur des coordonnées entières dans le plateau.

Sans aucun modèle correspondant, le premier essai est limité par `max(abs(dx), abs(dy)) <= first_control_step`, avec `first_control_step = 1`. Cela autorise une diagonale ; ce n'est pas une contrainte de distance de Manhattan égale à un. Un axe non mesuré utilise le gain concordant conditionnel `1`, explicitement déclaré comme **expérience réfutable**. La restriction du premier essai disparaît dès que des modèles correspondants existent, même si leurs gains ont été ignorés par les filtres précédents. Ce détail ne doit pas être renforcé silencieusement.

Une offre d'actionneur doit réduire strictement la distance au placement visé, rester dans le plateau, éviter une position occupée par un autre participant, et ne pas appartenir à `failed`. La clé de refus est `(position du participant, pad_ref, position du marqueur, destination du marqueur)` ; elle ne contient ni valeur du participant ni `selection_ref`.

Les rangs exacts sont :

| Offre | Rang source |
| --- | --- |
| Sélection d'un participant | `[distance totale, nombre de déplacements, 1, position source]` |
| Essai d'actionneur | `[distance totale projetée, nombre de déplacements, 0, nombre d'axes non mesurés, point mesuré]` |

Le tri Python est stable. En cas d'égalité complète, l'ordre de génération demeure décisif. Les champs déclaratifs `order` du DRM décrivent cette politique ; le calcul opérationnel est celui de `planner.py:67`.

Les alternatives `no_motion`, `opposite_motion`, `different_gain`, `coupled_motion` et `edge_transition` restent explicites. Les falsificateurs et risques sont conservés dans l'offre et dans l'événement. Ils ne constituent pas chacun un test automatique supplémentaire : `record` peut acquérir un déplacement différent de la prédiction s'il satisfait le contrat de déplacement unique de `effect`.

## Liaison, retour et acquisition

Une offre contient exactement une action `ACTION6`. Son support doit être unique à la fois par boîte et par appartenance du point au masque (`family.py:32`). La proposition conserve le pixel, le support, sa signature, l'observation, l'epoch, le score public et le hash du raster. `before` exige l'égalité de l'observation initiale, de l'epoch, du score et du hash, l'accord action/étape/point, la disponibilité de l'action et la présence du pixel attendu. La garde ne mesure pas de nouveau séparément l'identifiant et la signature du support. `bind` ne rééchantillonne pas le domaine exploratoire : le lieu découle déjà de la composition mesurée.

`after` ne confirme jamais la prédiction ; il ferme le préfixe avec résultat inconnu. L'appelant acquiert ensuite le retour de la contrainte effectivement sélectionnée (`common_frontier_runtime.py:844`). `record` lève `Unbound arrangement response` si la commande diffère de l'action liée ou si `before.observation_ref` diffère de l'observation initiale de la proposition (`family.py:58`). La famille produit une primitive, ce qui maintient cet avant exact.

Le score public en hausse prime : il produit `official_boundary`, conserve la cible comme hypothèse et cite les deux observations. Sinon, `effect` distingue :

| Statut | Condition déterminante et conséquence |
| --- | --- |
| `scope_unbound` | Projection manquante ou `scope_ref` différent. |
| `selection_observed` | Nouveau marqueur de participant, ou changement de sélection sans déplacement d'arrangement ; met à jour `selection_ref`. Le cas sans sélection antérieure est reconnu avant la comparaison des ensembles d'objets. |
| `no_arrangement_change` | Aucun participant ajouté/retiré et aucune nouvelle sélection reconnue. |
| `ambiguous_multi_object_change` | Le différentiel n'est pas exactement un participant retiré et un ajouté. |
| `selected_identity_unbound` | Valeur différente, sélection manquante, ou positions sélectionnées ne correspondant pas au participant déplacé. |
| `actuator_change_ambiguous` | Le déplacement du participant n'est pas accompagné d'exactement un marqueur d'actionneur déplacé dans un groupe correspondant. |
| `single_object_and_actuator_displacement` | Acquiert le déplacement réel, les autres participants préservés, l'action et les observations ; le modèle est limité au participant et à l'actionneur actuellement sélectionnés. |

Un déplacement unique acquis reçoit le `selection_ref` courant et entre dans `models`. Pour toute autre issue hors frontière, si l'offre contenait un `trial`, celui-ci entre dans `failed`. Cela inclut une `selection_observed` après un essai d'actionneur : l'affectation de `selection_ref` ne contourne pas l'ajout du refus. Une simple offre `select_participant` n'a pas de `trial` et n'est donc pas bloquée par cette voie en cas d'absence d'effet.

La copie ajoutée à `models` précède l'ajout de `expected` et `risks` à l'événement retourné (`family.py:65`, puis `:68`). Le modèle acquis n'a donc pas ces deux champs supplémentaires. Les événements conservent tous les retours, sans les remplacer par une réussite supposée. Aucun appel passif à `arrangements.record` n'apparaît dans l'appelant épinglé.

## Mémoire, remise à zéro et reprise

Les cinq champs durables exacts sont `models`, `events`, `failed`, `selection_ref` et `epoch`. `state` copie les deux listes d'éléments acquis et transporte `failed` sous forme de liste. L'ordre de cette liste n'a pas de sens source : `failed` est un ensemble de tuples. Si le transport natif impose un ordre déterministe, cette adaptation doit être déclarée et la comparaison comme ensemble limitée à ce champ ; l'ordre des modèles, événements et offres reste significatif.

Le changement de `level_epoch` est traité au prochain `measure` : `models`, `failed` et `selection_ref` sont effacés ; `events` reste conservé. Ni `record(official_boundary)` ni la seule hausse du score n'effectuent ce reset. `last_layout` est recalculé à chaque mesure ; `last` est remplacé à chaque sélection SRC. `restore` reconstitue les cinq champs durables ; il laisse les champs transitoires de l'instance inchangés et n'en fournit aucun à une instance neuve. Une ancienne projection en mémoire ne peut donc pas attester à elle seule une reconnaissance après reprise.

L'appelant choisit le propriétaire via `arrangement_plan` (`common_frontier_runtime.py:434`), compte son acquisition et écrit `relative_arrangement_event:<revision>` (`:848`). Il écrit ensuite le miroir `relative_arrangement_state`, lié à l'observation après retour, et le relit pour `restore` (`:860`). C'est un aller-retour de mémoire réellement consommé dans la source. Une preuve future de reprise native devra montrer la conservation de ces acquis, puis une nouvelle projection avant décision ; la seule existence d'un schéma de checkpoint ne le démontre pas.

## Dépendances V5 réellement consommées

Cette famille ne charge pas de module V5 spécialisé dans le réarrangement rigide. Les importations consommées sont limitées aux infrastructures suivantes :

| Dépendance | Usage effectif |
| --- | --- |
| `agents.yf_arc3_v5.drm.loader.load_drm_document` (`family.py:4`) | Charge et valide le document DRM ; vérifie ses octets et fournit les identités de source et de sens. |
| `morphology_policy.src_runtime.SrcProgram` (`family.py:5`) | Compile le workflow et relie les callbacks `arrangement.measure`, `arrangement.compose`, `arrangement.bind`. |
| V5 via `src_runtime.py:8` | Types d'effets, registres d'opérateurs et de workflows, compilateur SRC, symboles, ordonnanceur et `EventStore`. Le workflow doit terminer dans la borne de l'ordonnanceur ; sinon le wrapper lève une erreur. |
| `terminal_composition.identity` (`family.py:3`, `geometry.py:3`) | SHA-256 du JSON canonique Python pour les identités de groupe d'actionneurs, de portée et de composition cible. |
| Bibliothèque standard Python | Compteurs, parcours, copies, permutations, produit cartésien et calcul numérique fini. |

Le SRC de quinze lignes exécute réellement `measure → compose → bind` ; le reçu contient `workflow`, `src_hash`, `src_status` et `executed_statements` (`src_runtime.py:65`). Son identité transitive dépend des sources, pas d'un hachage des rangs calculés. Les entrées des trois `identity` géométriques ne contiennent pas les gains ou rangs flottants. La division Python peut produire `1.0` là où le JSON JavaScript écrit `1` ; ces représentations doivent être comparées comme valeurs numériques, sans en déduire une différence d'identité géométrique ni modifier les nombres acquis.

Le fait que le dépôt contienne des capacités V5 portant des noms voisins ne les rend pas consommées par 4B. Les comportements plus riches de ces autres familles, les informations de moteur et les règles privées d'un jeu restent hors de ce transfert.

## Candidats et preuves encore à établir

La provenance des candidats est [src/games/catalog.ts](../../src/games/catalog.ts), catalogue relié au commit `212d8d426f07eea2b6797c2bb647545767488a96`. Il s'agit d'une aide au choix d'expérience, pas d'une entrée de production.

| Candidat existant | Métadonnées du catalogue | Qualification à ce stade |
| --- | --- | --- |
| **TRIA**, `tria-c0000001` (`catalog.ts:740`) | Six niveaux ; trois cubes commandés par trois joysticks indépendants pour reproduire un arrangement relatif visible. | Candidat principal cohérent avec le contrat public. La reconnaissance, les gains et trois niveaux effectifs restent à mesurer. La mention du tore n'autorise aucune règle de bouclage préchargée. |
| **VOIS**, `vois-c0000001` (`catalog.ts:707`) | Six niveaux ; cubes et relations de voisinage comparées à une légende. | Contraste possible : le catalogue ne démontre pas l'interface d'actionneurs exigée par `project`. |
| **CATR**, `catr-c3000001` (`catalog.ts:1103`) | Six niveaux ; réglage de relations d'attraction pour atteindre un arrangement. | Contraste possible entre relation visuelle et interface locale d'actionneurs ; aucune reconnaissance 4B présumée. |

Les fixtures existantes `tests/fixtures/v6-reference-population-reference.json.gz`, `v6-reference-population-legacy-checkpoints.json.gz` et `v6-configured-arrivals-reference.json.gz` sont des ressources de régression de leurs propres familles. Leurs chemins ont été relevés sans décompression ; elles ne sont pas présentées ici comme preuves de RelativeArrangements ni comme observations TRIA.

Les futurs contrôles utiles, motivés par les risques ci-dessus, doivent comparer aux originaux inchangés : projection unique et ambiguë ; ordre et égalités ; sélection puis gain acquis ; gains opposés, contradictoires ou ignorés ; `trial` refusé ; avant non lié ; frontière puis reset ; reprise des cinq champs ; reconnu sans offre qui ferme seulement son groupe ; non reconnu qui laisse le repli ; absence d'acquisition étrangère. Une trace de contribution devra montrer observation, hypothèse, expérience choisie, retour réel et décision suivante, en conservant également les ablations dont la décision ne change pas.

L'objectif de campagne reste trois niveaux si possible, sous une horloge cumulée de quarante minutes par jeu. La preuve de composant, l'intégration dans l'appelant, la contribution publique en jeu, la reprise et le coût global strictement inférieur à +10 % par jeu sont des questions distinctes. Une phase isolée supérieure à +10 % ne suffit pas à déterminer le verdict global. Cette note n'attribue encore aucun résultat de campagne ou de coût à 4B.

## Empreintes des fichiers examinés

Empreintes SHA-256 lues sur les fichiers épinglés, sans exécution :

| Fichier | SHA-256 |
| --- | --- |
| `relative_arrangements/family.py` | `34931e43892cc7c8ef3c82dbeb4952feea2cecabda633086d122b0ffa500eba8` |
| `relative_arrangements/geometry.py` | `a4e0c42cc27a67a35cca18fb4b120112817d9b9d7c3d2a203bd2fcb43cd161f6` |
| `relative_arrangements/planner.py` | `523c0ab9001db6eb781147d8d536b620b31f3fe22e3a4e5723430d917a6ebddb` |
| `relative_arrangements/relative_arrangements.drm` | `393294d9ba9fa06084706da9d91e1e8e5e852321bf43e614cf5a3ae64b95b954` |
| `relative_arrangements/relative_arrangements.src` | `5bb14dc57dbb69a853be34661116164e9b01ab0b2c8504982519a73088b07247` |
| `morphology_policy/strategy.py` | `425aca6c30e7abb38a537dfcef38f92c418bc4dfa35201ae52dc42ba4390fa55` |
| `morphology_policy/strategy.drm` | `6e8aee941d56511273be79222b03c88d092cdc3ca1c295c91509b9cc93b15f44` |
| `laya_proto/common_frontier_runtime.py` | `bcc9bc79d04287c830efedce48b4cc2ab89b5600b8a77fe09782c35d1c05c064` |
