# Arbre conditionnel L1 — représentation éditable

> **Public-copy note:** Only internal link formatting has been adjusted in this copy. Links to project files outside the selected export are shown as source paths. Provenance is recorded in the snapshot’s root README and manifest.

Statut : **proposition v2 extraite des traces et du pseudocode humain, à
valider conjointement avant promotion runtime**. Le routage source-hashé est
compilé et testé ; la complétude sémantique des contrats n’est pas encore
déclarée finale.

## Où éditer et où vérifier

Ce fichier est la vue éditable principale de l’arbre : les blocs `text`, les
noms d’objectifs, les trois branches de chaque nœud, les demandes perceptives
lazy, les invariants de mémoire et les conditions de réconciliation peuvent
être relus et modifiés ici en langage clair. Il ne faut pas éditer directement
les journaux d’extraction pour changer la forme de l’arbre.

Les artefacts associés ont des rôles distincts :

- `l1_objective_trace_ledger.json` conserve les événements source des 50 L1 ;
- `l1_objective_contract_catalog.json` conserve les contrats et références
  exactes utilisés pour contrôler la couverture ;
- `l1_objective_contract_review.md` expose les regroupements à discuter ;
- `agents/yf_arc3_v5/src/arc3/conditional_reasoning_tree.src`, les autres
  `.src` et les déclarations `.drm` sont la projection exécutable attestée.

Une modification manuelle de l’arbre Markdown n’est donc promue dans le
runtime qu’après : (1) mise à jour de la déclaration SRC/DRM correspondante,
(2) compilation source-hashée, (3) contrôle de couverture des contrats L1 et
(4) tests ciblés. Cette séparation est volontaire pendant la validation ; la
prochaine étape est de produire une vérification automatique de divergence
entre cette vue éditable et sa projection exécutable.

## Limites explicites

- profondeur logique maximale : 8 nœuds ;
- branches sortantes maximales par nœud : **3** ;
- chemins exécutables simultanés : **1** ;
- routes candidates : au plus 3, conformément au contrat V5 ;
- mémoire cognitive synthétisée : **10 KiB maximum** ;
- aucune perception implicite ;
- aucune action codée par jeu, niveau, palette ou coordonnée.

## Arbre

```text
ROOT frame_delta
├─ 1 same_declared_context + continue_authorized
│  └─ CONTINUE declared_action_series
├─ 2 terminal_or_identity_boundary
│  └─ RECONCILE boundary_delta
└─ 3 new_or_changed_observation
   └─ DEMAND active_reasoning_evidence

DEMAND active_reasoning_evidence
├─ 1 no_perception_demand_declared
│  └─ REASON use_current_facts_without_optional_perception
├─ 2 declared_demand_has_exact_valid_cached_evidence
│  └─ MEMORY reuse_compact_projection
└─ 3 declared_demand_missing_or_invalidated_by_delta
   └─ PERCEIVE execute_one_declared_demand

PERCEIVE execute_one_declared_demand
├─ 1 morphology_or_scene_structure
│  └─ MORPHOLOGY retained_geometry_or_discovery
├─ 2 temporal_or_transition_effect
│  └─ MEMORY synthesize_delta
└─ 3 correspondence_or_interaction_measurement
   └─ MEMORY synthesize_delta

MORPHOLOGY retained_geometry_or_discovery
├─ 1 current_geometry_preserved_as_revisable_alternative
│  └─ RECOUNT exact_changed_cells_then_MEMORY_delta
├─ 2 structural_contradiction_or_unknown_geometry
│  └─ DISCOVER bounded_grid_alternatives_then_MEMORY_delta
└─ 3 objective_demands_other_morphology
   └─ PERCEIVE required_components_or_sprites_then_MEMORY_delta

INITIAL_GRID other_cell_corroboration (bootstrap only; reached after discovery)
├─ 1 truncated_grid_frontier + multiple_singleton_cells
│  └─ PERCEIVE repeated_shape_families_and_bounded_lattices
└─ 2 no_such_ambiguity
   └─ MEMORY preserve_current_grid_alternatives_without_this_measurement

PERCEIVE repeated_shape_families_and_bounded_lattices
└─ CLASSIFY each_lattice_with_DRM

CLASSIFY each_lattice_with_DRM
├─ 1 no_repeated_cell_sized_pattern_in_gap
│  └─ REVISABLE_GRID test_unique_geometry
├─ 2 repeated_cell_sized_patterns_in_gap
│  └─ MEMORY preserve_structural_challenge_to_pure_separator
└─ 3 missing_or_truncated_evidence
   └─ MEMORY preserve_unresolved_alternatives

REVISABLE_GRID test_unique_geometry
├─ 1 exactly_one_not_contradicted + exact_grid_match
│  └─ TRANSPORT revisable_geometry; canonicalize_then_reconcile_after_action
├─ 2 ambiguous_or_unmatched
│  └─ MEMORY preserve_all_grid_alternatives
└─ 3 later_action_contradicts_geometry
   └─ DISCOVER reopen_bounded_grid_alternatives

MEMORY compact_projection
├─ 1 delta_already_synthesized
│  └─ REASON active_reasoning
├─ 2 delta_not_synthesized
│  └─ SYNTHESIZE <=10KiB, then REASON
└─ 3 contradiction_or_new_falsifier
   └─ REASON reopen_only_implicated_objective

REASON active_reasoning
├─ 1 committed_verified_route_is_valid
│  └─ ACTION release_declared_action
├─ 2 objective_needs_declared_evidence
│  └─ DEMAND active_reasoning_evidence
└─ 3 no_committed_route
   └─ METAPLAN declared_strategy_and_bounded_route

ACTION release_declared_action
├─ 1 declared_action_available
│  └─ CONTINUE execute_only_that_action
├─ 2 no_action_available
│  └─ REASON active_reasoning
└─ 3 terminal_action_or_boundary
   └─ RECONCILE boundary_delta

RECONCILE causal_delta
├─ 1 expected_effect_observed
│  └─ MEMORY synthesize_delta_then_ROOT
├─ 2 objective_complete_or_level_boundary
│  └─ STOP completed
└─ 3 mismatch_or_identity_failure
   └─ DEMAND invalidate_only_implicated_evidence
```

La sous-branche `INITIAL_GRID` est exécutée au démarrage sur BP35. SRC choisit
sa géométrie 5×5 à gap 1 comme **révisable**, sans déclarer le rôle du curseur.
Ce sont les sept cellules répétées disponibles qui départagent les géométries :
le faux macro-découpage place 74 cellules complètes dans ses séparateurs. Le
curseur ne fait donc pas foi seul ; son déplacement corrobore ou révise ensuite
la géométrie déjà soutenue par l'ensemble des cellules. Le contrôleur transporte
le résumé compact, puis le recomptage delta rouvre la découverte si un témoin
structural contredit la géométrie retenue.
Sur AR25, la demande SRC la diffère et aucune mesure des formes répétées
n'est lancée. Ce nœud rend visible une preuve structurale, pas encore un
remplacement de l'assimilation générale.

Sur la toute première observation, la racine exécutable sélectionne maintenant
explicitement `tree.request_declared_perception` puis
`perception.morphology_scene` avant l'assimilation. Les demandes ultérieures
ne sont pas encore produites par les objectifs et l'assimilation post-action
reste systématique ; ce jalon ne prouve donc ni perception lazy complète ni
gain de vitesse.

La sous-branche SRC de découverte de grille est maintenant appelée avant la
décomposition complète sur la première observation. La mesure typée de
singleton y est disponible avant les objets ; l'assimilation complète reste
ensuite exécutée et son résultat grille est vérifié identique. L'audit des
50 frames initiales du catalogue trouve zéro divergence, mais ne constitue
pas un replay des 50 niveaux ni une preuve de perception lazy complète.

### Sous-arbre cellulaire candidat, témoin BP35 — non promu

Après la première action directionnelle BP35, la perception actuelle produit
192 composantes 4-connexes, 192 zones 8-connexes, 192 sprites et 192 entités
suivies. Elle trouve aussi trois géométries de grille de 100, 100 et 70
cellules. Deux géométries présentent chacune une seule cellule multicolore
à motif unique ; la troisième reste une alternative morphologique. Le même
comptage était présent avant l'action. AR25, contrôle contrastif, produit
14 composantes suivies et aucune géométrie à cellule multicolore unique.

```text
GRID_FIRST cell_structure_demand
├─ 1 retained_geometry_valid + one_exact_singleton_in_active_geometry
│  └─ RECOUNT changed_cells; SUPPOSE unique_control_bearer_revisably
├─ 2 geometry_or_singleton_ambiguous + control_identity_open
│  └─ PRESERVE grid_alternatives; PROBE one causal action; RECONCILE
└─ 3 geometry_contradicted_or_object_structure_explicitly_required
   └─ DISCOVER bounded_grid_or_PERCEIVE demanded_components
```

Ce nœud ne choisit pas une grille en Python et ne convertit pas une cellule
unique en rôle causal certain. Son gain potentiel vient de ne pas fabriquer
les 192 entités quand le but courant ne demande que cellules, occurrence et
un test de contrôle. La préférence révisable entre géométries et la
réouverture en cas de contradiction doivent être décidées en DRM/SRC et
validées avec Yannick ; aucune économie de temps n'est revendiquée ici.

Un audit de la première décision BP35 précise le sous-but réellement suivi :
`goal.reveal_action_conditioned_structure` par une route d'ouverture
morphologique, avec falsificateur « le pas ne produit pas le delta attendu ».
Le calcul de route actuel inspecte seulement la première grille candidate.
Mesurées séparément, les deux grilles à singleton multicolore donnent la
même route `ACTION4 × 4` ; la troisième (quatre cellules uniques) ne donne
aucune route. Ce consensus observé peut devenir une mesure générique de
support commun, **sans sélectionner une grille**, mais doit encore être
déclaré dans DRM/SRC et testé avec un cas où les routes divergent. AR25 est
un contre-exemple utile : aucune grille n'y a de singleton multicolore
unique, bien que la première propose seule une route `ACTION3` que le
solveur ne choisit pas. La présence d'une route dans `candidates[0]` ne
suffit donc pas à engager ce sous-but.

Cette route candidate `ACTION4 × 4` n'est **pas** une continuation autorisée.
Le premier `ACTION4` BP35 poursuit bien l'ouverture morphologique, mais la
réflexion suivante ouvre `goal.exploration.probe:discrete:ACTION4`; après le
deuxième `ACTION4`, elle ouvre
`goal.exploration.probe:discrete:ACTION3`. Chaque coup a donc sa propre
décision et son propre falsificateur après réconciliation. Un parcours rapide
doit reconstruire ces changements d'objectif depuis le delta causal ; il ne
peut pas exécuter quatre mouvements sur la seule longueur de route. Au même
point AR25, le but actif est la réduction de l'écart entre formes homologues,
avec `ACTION2` : cette branche demande d'autres mesures que le témoin
cellulaire BP35.

État mesuré de `MORPHOLOGY retained_geometry_or_discovery` sur AR25 L1 :
la branche « géométrie conservée → recompte » est déclarée dans cette vue,
et la capacité de recompte exact existe, mais aucun engagement SRC/DRM d'une
géométrie courante ne l'alimente encore. Après la série de six actions,
la frame terminale provoque une découverte froide (~130 ms) qui rend trois
candidats, puis deux consultations du même résultat en cache. Les familles
de candidats varient entre frames : choisir silencieusement le premier en
Python ferait disparaître des alternatives. Pour activer la branche 1, il
faudra un choix source attesté par l'objectif, un critère de préservation
observable et un falsificateur qui rouvre la branche 2.

Jalon runtime intégré, encore à valider sur les 50 L1 : la racine DRM/SRC
choisit maintenant `tree.reconcile_without_optional_perception` lorsqu'aucune
demande n'est déclarée. Elle distingue cette issue d'une preuve exacte déjà
réutilisée, demande une perception seulement si une référence explicite est
présente, et conserve la troisième sortie pour une action déclarée. Le défaut
`default_perception_ref = perception.correspondence_interaction` a été retiré.
Un essai AR25 sans le repli confirme zéro appel de correspondance d'affichage
au neuvième pas, mais reste non résolu et non accéléré au total. VC33 révèle
que retirer ce repli sans demande de remplacement change un clic nécessaire ;
le repli controller a donc été réactivé temporairement. Le nœud source est
intégré, mais le parcours complet **n'est pas encore lazy**. Les jeux qui ont
besoin de cette perception doivent la demander depuis leur objectif, puis
leur couverture doit être prouvée avant suppression du repli.

La branche `MEMORY compact_projection` est elle aussi **partiellement
implémentée** : le synthétiseur applique une borne dure de 10 KiB, mais sur
les 14 premiers coups AR25 il publie 144 octets, zéro fait retenu et trois
champs descriptifs à chaque réconciliation. Cette projection est actuellement
écrite sans être relue par la décision suivante. Elle n'est donc pas encore
la mémoire causale chaude promise par l'arbre ; sa taille minuscule ne prouve
pas que les connaissances réellement utilisées tiennent dans 10 KiB. La
promotion demandera une sélection DRM des faits révisables, leur delta et
leurs falsificateurs, puis une lecture SRC effective du paquet mesuré.

## Arbre objectif détaillé proposé pour validation

Le squelette ci-dessus décrit la boucle temporelle. Le sous-arbre suivant
décrit ce que signifie « raisonner sur l’objectif actif ». Il est construit à
partir des 50 traces L1, des 9 576 références exactes conservées dans le
catalogue et des règles du pseudocode humain. Une référence exacte est une
instance de preuve ; elle ne crée pas une branche supplémentaire.

```text
OBJECTIVE_FRONTIER active_objective
├─ 1 representation_evidence_needed
│  └─ REPRESENTATION
│     ├─ 1 detect_world_and_grid_or_control_surface
│     ├─ 2 inventory_cells_pixels_and_occurrences
│     └─ 3 assemble_connected_or_repeated_objects
├─ 2 interpretation_evidence_needed
│  └─ INTERPRETATION
│     ├─ 1 compare_objects_by_exact_morphology_and_aspects
│     ├─ 2 test_correspondence_symmetry_or_reflection
│     └─ 3 reconcile_scene_roles_and_preserve_alternatives
└─ 3 control_evidence_or_progress_needed
   └─ CONTROL
      ├─ 1 probe_controlled_motion_or_information_gain
      ├─ 2 establish_terminal_objective_and_invariants
      └─ 3 route_and_execute
         ├─ 1 search_bounded_route_at_most_three_witnesses
         ├─ 2 release_committed_action
         └─ 3 reconcile_action_delta
```

## Instance AR25 L1 — crosswalk détaillé extrait

Cette instance est un **crosswalk de couverture partielle**, pas une règle codée
pour AR25 ni une preuve de couverture sémantique complète. Elle montre la
précision réellement disponible dans l'extraction et sépare le
témoin historique de la forme d'exécution compilée que l'arbre cherche à
promouvoir.

```text
AR25_L1 new_frame
├─ 1 neutral_components_observed
│  └─ preserve palette roles as unknown
├─ 2 exact_repeated_non_unit_silhouettes
│  └─ open revisable compatible-peer / alignment objective
└─ 3 no sufficient causal meaning yet
   └─ CONTROL run the smallest reversible probe

CONTROL vertical_alignment
├─ 1 ACTION2 produces 3-pixel vertical translation
│  └─ establish repeatable vertical operator
├─ 2 boundary decreases and effect remains invariant
│  └─ repeat only while residual-reducing contract holds
└─ 3 effect absent or contradictory
   └─ invalidate only the implicated operator claim

CONTROL horizontal_relation
├─ 1 vertical residual closed, horizontal sign unresolved
│  └─ ACTION4 reversible discriminating probe
├─ 2 dependent element moves in the opposed direction
│  └─ preserve both moving bodies; test the remaining causal alternatives,
│     then restore/advance with a verified opposite operator
└─ 3 restoration/effect contract fails
   └─ retrospection and reopen the horizontal alternatives

CONTROL terminal_alignment
├─ 1 verified operator still reduces the declared residual
│  └─ SERIES_AUTHORIZATION
│     ├─ terminal predicate and preserved-axis invariants checkable
│     │  └─ release bounded action series; verify only at its end
│     ├─ effect verified but terminal predicate not checkable
│     │  └─ release one action, then reconcile
│     └─ effect or invariant contradicted
│        └─ retrospection; reopen causal alternatives
├─ 2 terminal score/level transition observed
│  └─ STOP completed
└─ 3 terminal evidence absent or mismatched
   └─ final reconciliation -> retrospection
```

### Ce que cette instance confirme, et ce qu'elle ne confirme pas

| Élément évoqué dans le raisonnement humain | Évidence AR25 L1 extraite | Place dans l'arbre |
|---|---|---|
| composantes neutres et scène initiale | confirmé ; rôles de palette conservés comme inconnus | `representation.scene_model` |
| regroupement d'objets multi-cellules | confirmé sous forme de silhouettes non unitaires répétées et compatibles | `assemble_connected_or_repeated_objects` |
| comparaison des objets | confirmé par morphologie exacte et résidu d'alignement | `compare_objects_by_exact_morphology_and_aspects` |
| symétrie/réflexion | relation opposée confirmée expérimentalement ; aucune inversion injectée avant le probe | `test_correspondence_symmetry_or_reflection` |
| probe de mouvement | confirmé par `ACTION2`, `ACTION4`, `ACTION3` et mesures temporelles | `probe_controlled_motion_or_information_gain` |
| objectif | l'oracle exige la superposition exacte du dépendant et de la cible ; le bon run montre réduction verticale puis horizontale du résidu, sans liaison explicite action→`goal.*` dans le SRL compact | `establish_terminal_objective_and_invariants` |
| BFS | **non observé dans AR25 L1** ; le témoin complet est `ACTION2 × 10, ACTION4, ACTION1, ACTION2, ACTION3 × 6` | route bornée générique, inactive pour cette instance |
| superposition gris/jaune | **obligation explicite de l'oracle**, confirmée comme état final par score/niveau ; l'attribution de ces rôles par le runtime à partir des seuls pixels et effets n'est pas prouvée par le SRL compact | objectif générique d'alignement, jamais `gray/yellow` codé dans le runtime |
| `continue` sans cognition intermédiaire | **non prouvé par le témoin historique** : chaque action historique possède une mesure/meaning après coup | optimisation cible, à valider par test dédié |

### Contrat enseignant AR25, extrait sans script d'actions

L'oracle complet possède neuf artefacts et nomme cinq buts liés :
`goal.identify_controlled_object`, `goal.identify_transform`,
`goal.identify_target`, `goal.compute_displacement` et `goal.solve_level`
(instance — `../oracles/AR25/LVL1/ar25_level1_oracle_instance.srl`,
pseudocode — `../oracles/AR25/LVL1/ar25_level1_oracle_pseudocode.md`).
Ces noms et les couleurs sont créateur-side : le runtime ne doit ni les lire
ni déduire un rôle de la seule palette.

| Sous-objectif | Indice et mesure demandée | Falsificateur / porte lazy | Preuve disponible et lacune |
|---|---|---|---|
| Identifier le contrôlé | composantes, marqueurs blancs internes, puis delta d'un contrôle directionnel | si aucun déplacement direct, conserver les autres porteurs ; ne pas lancer comparaison temporelle avant une action | oracle : corps noir à marques blanches ; bon run : premier `ACTION2` mesure une translation verticale ; lien au rôle nommé non certifié par SRL |
| Identifier la transformation | comparer deux porteurs compatibles sous déplacements verticaux puis horizontaux ; axe visuel seulement supposé avant effet | un mouvement de signe identique sur l'axe horizontal falsifie l'inversion ; perception de reflet détaillée seulement si le couplage est interrogé | oracle : réflexion verticale `(dx,dy)→(-dx,dy)` ; bon run : `ACTION4` contredit le couplage direct et `ACTION3` restaure/teste l'opposé |
| Identifier la cible | mêmes silhouette et orientation après normalisation des marques internes, puis immobilité sous action | si la cible bouge ou la forme diverge, rouvrir les paires ; comparaison détaillée seulement pour les paires compatibles | oracle : L gris/jaune compatibles ; bon run : objectif morphologique révisable, sans attribution de palette prouvée |
| Calculer le résidu | position relative, quantum observé et contrôle causal ; maintenir forme/orientation | quantum ou effet attendu contradit → arrêter la répétition ; BFS seulement si une route/détour est requis | oracle : déplacement dépendant +30 vertical et +15 horizontal, quantum 3 ; bon run : dix pas verticaux puis test du signe horizontal |
| Atteindre et vérifier | réduire le résidu jusqu'à superposition, préserver l'opérateur vérifié, contrôler score/niveau | résultat terminal absent ou décalé → réconciliation/rétrospection ; aucun `continue` sur effet inconnu | oracle : superposition exacte ; bon run : score 1/niveau 2 en 17 actions contre 15 dans un témoin oracle non obligatoire |

Les probes click et Space sont des **alternatives d'information de l'oracle** :
click y est stérile, Space consomme une ressource sans déplacement utile.
Le bon run n'avait pas à les reproduire. Le bas d'écran noir demeure une
interface de fonction inconnue. Les cinq objectifs doivent encore être joints
aux sélections SRC/DRM et aux effets réconciliés pour déclarer la couverture
100 % de cette instance.

Le run compilé conserve les 13 premières actions **primitives** du témoin,
mais choisit `ACTION2` au lieu de `ACTION3` à la primitive 14. Une série de six
`ACTION2` occupe une seule ligne de décision ; comparer les lignes aurait
inventé une divergence dès la ligne 6. La réconciliation terminale conserve
les frames primitives, mais ne reconstitue pas encore tous les faits causaux
que le témoin acquérait entre actions : après la primitive 10, zéro terme
provisoire contre deux dans le témoin. Ces deux termes historiques provenaient
d'une mesure agrégée physiquement inexacte (18 pixels au lieu des déplacements
de 3 pixels), et ne doivent donc pas être copiés comme une obligation.

### Budget AR25 et portes de non-activation — mesure du 18 septembre 2026

Ces portes sont des **contrats candidats à valider**, pas encore le comportement
de production. L'absence d'une branche dans le témoin AR25 ne suffit jamais à
l'effacer des 49 autres jeux ; les alternatives restent révisables.

| sous-branche | activation nécessaire | si la condition manque ou reste inchangée |
|---|---|---|
| découverte de grille | demande de structure encore ouverte, aucune géométrie courante valide | ne pas relancer les 4 899 couples d'axes ; réutiliser la géométrie source-déclarée |
| types/occurrences de cellules | grille retenue et frame changée | réutiliser les types ; sinon recompter exactement les cellules de cette géométrie |
| assemblage d'objets | types/connexités disponibles et objectif exigeant une structure d'objet | différer les groupes, composantes 4/8 et trous |
| comparaison / miroir | au moins deux candidats comparables et relation encore ouverte | ne pas énumérer les paires ni les symétries |
| probe d'effet | opérateur/contrôle encore incertain et probe admissible par les invariants | réutiliser l'effet causal déjà établi ; la seule présence de touches ne suffit pas |
| ouverture d'accès par cellule / pair orthogonal | un objectif de mobilité ou de relation demande le booléen existentiel ; DRM l'utilise avant la matérialisation d'un candidat | garder la branche possible sans construire tous les points/cellules ; ne l'éteindre que si la priorité n'en dépend pas |
| dégagement partagé de sprites | une hypothèse de passage entre cellules a besoin d'une mesure de dégagement, avec géométrie potentiellement compatible | ne pas générer ni typer les grilles sans témoin géométrique possible ; conserver cette branche pour les autres jeux |
| correspondance affichage/HUD | indice d'affichage consommé par un objectif ouvert | ne pas lancer `display_correspondence_measurements` par défaut |

Contraste vérifié sur la première action : AR25 `ACTION2` ne tire aucun terme
de cette perception (~125 ms dépensées), tandis que PORT `ACTION4` en tire
27 (22 membres d'interface, quatre correspondances d'indicateur et un compteur
de niveaux). Une porte « jamais sur un mouvement » serait donc fausse. La
demande devra venir d'un objectif SRC/DRM lié à une structure d'interface
observée ; le producteur de cette demande manque encore dans le parcours V5.
La mesure exacte de répétition des rectangles au bord donne `()` sur la frame
initiale AR25 et `(6,)` sur PORT, où six niveaux sont annoncés. Son usage comme
porte révisable de la branche `indicateur/interface` est proposé à Yannick,
pas encore confirmé ni activé dans l'arbre de production.
L'audit des 50 frames initiales en trouve 19 avec un groupe dont l'effectif
égale le nombre de niveaux annoncé ; AR25 n'en fait pas partie. Cela décrit
seulement la sous-branche `indicateur/interface` au premier écran, pas les
effets ou objectifs qui peuvent apparaître plus tard.
| route BFS ou simulation | but engagé, opérateur causal et contraintes de déplacement disponibles, route directe insuffisante | ne pas ouvrir BFS ; aucun BFS n'est prouvé nécessaire pour AR25 L1 |
| point, ressource, portail, replay, autres mécanismes | indice structurel ou effet action-conditionné requis par l'objectif | conserver l'alternative sans exécuter sa perception ni son workflow |
| épisode de glyphes ordonnés | collection rectangulaire ordonnée effectivement mesurée dans la frame précédente | zéro collection → zéro épisode ; ne pas construire de scène/grille pour cette seule sous-branche (porte exacte active dans la capacité) |
| `continue` | route entièrement vérifiée, bornée et engagée | une action expérimentale seulement, puis réconciliation |

La condition géométrique nécessaire du dégagement partagé est désormais
filtrée mécaniquement avant création des objets typés. Sur AR25 initial,
aucun candidat généré de cette famille ne survit ; 314 candidats de probes
globaux demeurent toutefois et leur énumération coûte encore 1 117,89 ms
dans le run `offline_AR25_s1_044920`. Le routage lazy par objectif dans la
table reste **à implémenter** ; le filtre ne signifie pas que cette
sous-branche est déjà désactivée par SRC.

Mesure suivante `offline_AR25_s1_045535` : le filtre exact des deux formes de
témoin réduit les grilles typées de 686 à 129 sur 1 482 géométries testées ;
314 candidats globaux restent, mais leur énumération descend à 816,75 ms.
La comparaison PORT filtrée/non filtrée garde le même témoin `ACTION4` pour
six porteurs. Ce gain interne ne remplace toujours pas la porte SRC qui doit
éviter de demander la famille entière quand l'objectif actif n'en a pas besoin.

Après le premier `ACTION2` AR25, 193 candidats de cellule et 14 de point
sont encore construits ; leur suppression brute garde les 14 premières
actions mais remplace la priorité « mobilité locale » par « exploration par
défaut ». Le premier candidat cellulaire suffit déjà à établir le fait
existentiel `access_opening_candidate_present` ; la requête bornée correspond
à l'énumération complète sur les cas testés. L'arbre doit d'abord transporter
ce fait compact vers DRM, puis n'ouvrir la sous-branche de matérialisation
que si l'objectif sélectionné demande réellement une action point/cellule.
Un contre-essai qui garde ce premier témoin, mais diffère le reste, conserve
sur les 14 premières primitives AR25 les mêmes actions, 195 TERM, 318 CLAIM
et la même priorité « mobilité locale ». La première décision tombe à
~867 ms dans ce diagnostic, **pas** à 50 ms et **pas** encore en production.

Sous-nœud proposé, limité à trois sorties et **non activé** :

```text
objectif de probe ouvert
  ├─ mesurer seulement les témoins existentiels demandés
  │    → DRM conserve la priorité et les alternatives révisables
  ├─ SRC demande une action de cellule/point
  │    → développer uniquement la famille requise, puis sélectionner l'action
  └─ SRC dispose déjà d'un opérateur discret admissible
       → ne pas matérialiser les autres candidats ; réconcilier après action
```

Mise à jour BP35 : pour une grille déjà retenue, « développer la famille
requise » ne signifie plus énumérer les pixels ni toutes les cellules. La
feuille active transmet au plus trois cellules informatives exigées par son
delta, avec une candidate centrée par cellule. Les cellules homogènes répétées
de mur/sol/vide restent une troisième branche lazy de dernier recours. Le
préfixe réel réduit ainsi 661 candidats de clic historiques à exactement 1.
Une feuille qui ne demande aucun index exact produit zéro candidat : elle ne
peut plus retomber silencieusement sur toutes les cellules multivaleurs.

Un témoin « essayé sans effet » n'est plus réutilisé : le fait existentiel est
recalculé sur le delta et cherche un autre témoin. L'ordre entre les trois
sorties ne doit pas être choisi en Python ; il reste à déclarer ses prémisses
et falsificateurs en DRM/SRC et à tester les jeux dont le clic est réellement
nécessaire.

La branche `current_geometry_preserved_as_revisable_alternative` est une
**proposition non encore activée**. Le test officiel AR25 seed 0 montre qu'un
premier mouvement change 22 pixels hors des cellules de la grille retenue :
une règle « tout séparateur changé ⇒ redécouverte » serait fausse. La
redécouverte froide perd même cette grille de son top 3, alors que le
recompte exact n'observe que 6 cellules changées sur 81. La persistance
révisable ne signifie ni rôle de grille prouvé, ni interdiction de nouvelles
alternatives : une contradiction observée ou une demande d'objectif doit
rouvrir la découverte. La règle générale a été soumise à Yannick.

Mesures isolées AR25, frame 64×64 : histogramme 0,248 ms ; découverte
périodique à froid ~158 ms après une première optimisation ; recompte de 81
cellules dans la nouvelle capacité de production 0,187 ms ; assemblage des 12
groupes candidats 0,192 ms **incluant une autre extraction des cellules** ;
66 comparaisons de silhouettes/miroirs 0,092 ms ; delta réel après une action
0,415 ms ; synthèse mécanique d'un paquet de 1 716 octets 0,061 ms. On ne
doit pas additionner le recompte 0,187 ms et l'assemblage prototype 0,192 ms
comme s'ils partageaient déjà leur extraction. La route vérifiée existante a
été mesurée autour de 0,86 ms pour sa seule énumération, pas pour un BFS
spécial de reflet. Le transport officiel seul prend une médiane de 5,175 ms
par primitive sur le témoin de 17 actions, soit ~92 ms cumulés : une cible de
50 ms **par décision cognitive** ne signifie pas 50 ms pour toute la partie.

La mesure de 50 ms du chemin complet n'existe pas encore : projection DRM,
sélection SRC, réconciliation terminale, mémoire causale et découverte froide
doivent être instrumentées sur le nouveau parcours. Le profil actuel montre
encore ~196 ms par énumération de probes, ~171 ms par correspondance affichée,
~299 ms pour l'avancement `information_probe` et ~53 ms par projection d'agenda
DRM sur l'échantillon détaillé ; ces spans sont imbriqués et ne s'additionnent
pas. Les rendre inactifs doit être prouvé par le prédicat causal et un test
négatif, jamais par le seul nom du jeu ou par une suppression opportuniste.

La précision logique est donc maintenant explicite à deux niveaux :

1. le ledger conserve chaque événement, candidat, sélection, objectif et
   transition observés ;
2. ce sous-arbre conserve le contrat causal minimal qui explique la trajectoire
   sans imposer ses identités d'actions.

Le second niveau ne doit pas inventer les détails absents du premier. En
particulier, le chemin compilé `CONTINUE` ne sera déclaré équivalent à la trace
AR25 que lorsque le test montrera que la série déjà engagée peut exécuter ses
actions sans perception ni calcul intermédiaire, puis effectuer une seule
réconciliation terminale avec rétropection en cas d'écart.

État du 18 septembre : la sous-branche « effet vérifié, mais prédicat final
non vérifiable » est active pour la série verticale AR25 ; six `ACTION2`
sont donc réconciliés séparément. Les faits disponibles nomment deux porteurs,
un axe actif `row`, un quantum 3 et six actions, mais la distance agrégée 66
couvre aussi l'axe horizontal. Une future autorisation de rafale doit déclarer
le résidu **de l'axe actif** attendu après six pas et l'invariant de l'autre
axe, puis les mesurer sur la frame finale ; l'état actuel ne le fait pas.
Le témoin offline seed 0 donne une paire d'exemples exacte : au départ,
le porteur mobile est à `(27,36)-(35,44)` et le fixe à
`(45,51)-(53,59)` ; après cinq pas verticaux le mobile est encore à
`(42,36)-(50,44)` (résidu vertical 3), après six il est à
`(45,36)-(53,44)` (résidu vertical 0, écart horizontal 15 inchangé).
Ces coordonnées sont une **preuve créateur-side**, jamais une condition du
runtime. Le prédicat générique proposé porte sur les résidus et invariants
mesurés de deux identités suivies sans ambiguïté.

### Contrats minimaux de chaque famille

| famille | objectif suivi | perception lazy autorisée | mémoire produite | effet attendu | falsificateur principal |
|---|---|---|---|---|---|
| `representation.scene_model` | établir la structure observable minimale | grille/cellules, composantes, occurrences, formes | inventaire delta et signatures morphologiques | objets ou cellules comparables deviennent explicites | segmentation non stable, silhouette contradictoire ou grille inexistante |
| `interpretation.correspondence_and_effect` | expliquer une relation entre éléments ou états | comparaison exacte, symétrie, correspondance, delta temporel | claim/supposition révisable avec preuve | une relation ou un effet est supporté sans effacer les alternatives | observation ne distingue pas les alternatives ou falsifie le lien |
| `control.discriminating_probe` | réduire une incertitude causale | probe minimal et réversible | effet action-conditionné + résidu | une hypothèse gagne ou perd une preuve | probe stérile, effet non causal ou contexte non comparable |
| `control.bounded_route` | transporter l’objet/état vers l’objectif | BFS borné ou route structurelle | premier témoin valide, au plus trois candidats | route engagée avec invariants | collision, route non admissible ou objectif non préservé |
| `control.release_and_reconcile` | libérer l’action déjà décidée | aucune perception intermédiaire pendant `continue` | delta de transition après réconciliation | l’action est exécutée puis son effet est mesuré | effet attendu absent, identité rompue ou frontière terminale |
| `memory.compact_reuse` | réutiliser uniquement un savoir encore valide | aucune si le hash et les dépendances sont valides | synthèse immutable <=10 KiB | aucun recalcul déjà validé | dépendance invalidée ou contradiction nouvelle |
| `reasoning.objective_frontier` | ordonner les objectifs prêts et leurs dépendances | demande déclarée par l’objectif actif | frontier, contraintes, falsificateurs | un seul objectif local est sélectionné | aucune preuve discriminante ou objectif prématuré |
| `reasoning.revisable_claims` | conserver les alternatives et leur statut | seulement la perception demandée par le claim actif | ajout/suppression du seul lien falsifié | le graphe causal reste cohérent | contradiction locale non réconciliée |

Exemple de jointure **créateur-side, encore à valider** pour SWCH L1, qui
n'avait auparavant qu'une note libre : son contrat documentaire passe par
`representation.scene_model` (curseur identifié par effet directionnel,
obstacles révélés), `interpretation.correspondence_and_effect` (interaction
qui change l'élément et l'affichage), `control.bounded_route` (chemin vers la
sortie observée) et `control.release_and_reconcile` (score 1 et passage L2).
La nécessité du voyant rouge et le coût de la barre magenta restent inconnus.
Ce rapprochement ne prouve pas encore que chaque action du run a été choisie
pour l'un de ces objectifs ; aucune branche runtime spécifique à SWCH n'est
permise.

Revue des quatre contrats sans référence d'objectif parsable dans les traces
compactes (source : leurs dialogues L1 ; **jointure d'action non prouvée**) :

| Témoin | Objectif et dépendance nécessaires | Nœuds génériques candidats | Sous-logique à vérifier avant couverture 100 % |
|---|---|---|---|
| FITE | survivre à l'horizon observé ; établir contrôle et cases praticables, préserver une vie et une suite possible | représentation → effet → route bornée → réconciliation | garde de survie, mémoire des transitions bloquées et contrainte d'horizon dans DRM/SRC |
| MEMO | après le tutoriel, identifier à chaque écran l'unique objet non choisi réapparaissant, indépendamment de sa position ; dix progrès avec quinze clics au plus | correspondance → mémoire delta → action → réconciliation | exclusion causale des objets déjà choisis, ambiguïté conservée et budget de clics |
| SKBN | pousser chaque corps sur une cible distincte ; établir contrôle, absence de traction, cases d'appui et poussées sans impasse | grille/objets → effet → route bornée → réconciliation | prédicats génériques de case morte, affectation caisse–cible et accès à l'appui, sans recherche non bornée |
| SWCH | provoquer la révélation de la scène, puis déplacer le curseur confirmé vers la sortie | représentation → effet → route bornée → réconciliation | statut causal de l'interrupteur, besoin réel du voyant et continuité de la route après chaque delta |

Cette table est un programme de revue, **pas** quatre branches par jeu. Chaque
ligne devra être reliée à des prémisses observées, à une demande de perception
lazy, à un falsificateur et à une sélection SRC/DRM réellement suivie ; sinon
elle demeure `unknown` même si la trace témoin termine le niveau.

Six autres dialogues n'ont pas non plus de projection compacte d'objectif,
de workflow et de SRL, même si leur contrat humain est maintenant extrait
avec ses lignes de provenance. Les jointures ci-dessous sont des **propositions
de revue**, pas des branches nommées par jeu dans le runtime :

| Témoin | Objectif et dépendance causale | Nœuds génériques candidats | Condition/falsificateur à prouver avant activation |
|---|---|---|---|
| GORI | faire toucher une cible fixe par un corps lancé ; distinguer direction, force et courbure gravitationnelle par effets | `interpretation.correspondence_and_effect` → `control.discriminating_probe` → `control.bounded_route` | ne pas assimiler impact sur mur à contact cible ; conserver les deux paramètres et les alternatives après un raté |
| HANO | transférer une famille ordonnée sur le support terminal ; apprendre sélection puis transfert par deux effets de pointage | `representation.scene_model` → `control.discriminating_probe` → `reasoning.objective_frontier` → `control.bounded_route` | une sélection n'est pas un progrès ; chaque état intermédiaire conserve l'ordre et un seul membre accessible est transféré |
| LS19 | rendre compatibles les aspects du corps contrôlé avec un contenant ; atteindre puis vérifier le modificateur d'aspect avant l'entrée finale | `interpretation.correspondence_and_effect` → `reasoning.objective_frontier` → `control.bounded_route` | obstacle, transformation attendue absente ou comparaison finale incompatible ; le contrat du guide attend encore la revue de Yannick |
| MIND | reconstruire une séquence cachée ; apprendre le contrôle tutoré, soumettre une proposition complète puis préserver les contraintes de retour par valeur et position | `control.discriminating_probe` → `reasoning.revisable_claims` → `reasoning.objective_frontier` | soumission incomplète ou retour contredisant une contrainte ; les contours blancs/gris sont des faits du dialogue, non des rôles de palette codés en Python |
| SEQN | terminer la suite visuellement focalisée ; apprendre puis réutiliser la correspondance action–symbole seulement après effet | `interpretation.correspondence_and_effect` → `memory.compact_reuse` → `control.release_and_reconcile` | le foyer n'avance pas, une position achevée régresse ou la correspondance n'était que morphologique |
| VALV | conduire un flux borné via un relais utile jusqu'à la cible ; respecter capacité, direction et ressources restantes | `representation.scene_model` → `reasoning.objective_frontier` → `control.bounded_route` | voie source–relais–cible rompue, impulsion gaspillée ou débordement ; la preuve terminale reste score/niveau plus cible remplie |

Ces six jointures complètent l'inventaire des dix contrats sans projection
cognitive compacte, **pas** la preuve 100 % : il manque encore, pour chaque
jeu, l'attestation des objectifs réellement poursuivis et de leurs demandes
de perception/mémoire sur une exécution du nouveau parcours.

### Règle blanche, explicitement conservée dans le sous-arbre

La présence de pixels blancs ne devient jamais directement `white = selected`.
Elle ouvre au maximum les alternatives déclarées `tutorial_marker` et
`selection_invitation` dans la famille
`interpretation.correspondence_and_effect`. Le parcours est ensuite :

```text
WHITE_SIGNAL at blocked_frontier
├─ 1 causal_or_morphological_support_for_selection
│  └─ keep selection_invitation as revisable supposition
├─ 2 no_discriminating_evidence_yet
│  └─ preserve tutorial_marker + selection_invitation, demand minimal probe
└─ 3 sterile_or_contradictory_white_test
   └─ falsify only selection_invitation; preserve independent claims
```

La couleur seule ne fixe donc ni le rôle, ni la cible, ni le trajet. Une
progression spatiale causale peut fermer un objectif sans que le signal blanc
soit encore résolu.

### Correspondance automatique vers les preuves L1

Le catalogue exact est généré par
`tools/extract_l1_objective_tree.py --write-catalog`. Il conserve chaque
référence et son état `used_or_action_bound`, `consumed_as_input`,
`candidate_only_in_compact_trace` ou `observed_only`. Le regroupement en
familles est une proposition éditable, jamais une conversion silencieuse en
règle runtime :

- l1_objective_trace_ledger.json — `l1_objective_trace_ledger.json` conserve la
  chronologie complète ;
- l1_objective_contract_catalog.json — `l1_objective_contract_catalog.json`
  conserve les références exactes et leurs familles ;
- l1_objective_contract_review.md — `l1_objective_contract_review.md` expose les
  regroupements à valider ensemble.

Une famille n’est validée qu’après vérification de ses prémisses, de sa
perception lazy, de son delta mémoire, de son effet attendu, de ses invariants
et de son falsificateur. Si l’un de ces champs reste inconnu, la branche reste
`unknown` et ne peut pas remplacer le workflow actuel.

### Audit de nécessité avant activation d'un nœud

Un événement présent dans le journal ne prouve pas que son calcul était utile.
Une référence `consumed_as_input` prouve un transport, pas que la décision aurait
changé sans elle. Pour chaque nœud candidat, l'extraction doit maintenant
produire les quatre preuves suivantes avant de le rendre obligatoire :

| preuve | question à résoudre |
|---|---|
| déclencheur observable | Quel fait présent, absent ou changé autorise ce nœud dès les premières frames ? |
| consommateur causal | Quelle sélection d'objectif, stratégie, action ou réconciliation lit effectivement son résultat ? |
| porte négative | Quand le fait déclencheur manque, quel calcul est omis, sans perdre une action nécessaire ni une alternative encore valide ? |
| falsificateur | Quel cas L1 ou test discriminant montre que cette omission serait incorrecte ? |

Le parcours proposé est `porte observable → demande DRM → mesure lazy → décision
SRC → delta mémoire`. Si la porte est fermée, la mesure et sa synthèse mémoire
ne sont pas exécutées. Si une entrée est déjà valide sous son empreinte exacte,
le nœud consomme le résultat mémorisé. Une contradiction ne réveille que les
dépendances invalidées. Les trois états `preuve de nécessité`, `utile mais non
nécessaire` et `nécessité inconnue` sont distincts ; seul le premier autorise
une coupe définitive du parcours.

Exemples de portes à établir sur les traces, sans les promouvoir encore en
règles runtime :

| nœud coûteux | porte candidate présente | si absente | vérification requise |
|---|---|---|---|
| effet temporel | une action a produit une nouvelle frame comparable | omettre la comparaison avant/après | préserver tous les probes qui établissent un effet |
| correspondance de formes | au moins deux objets comparables sont disponibles et un objectif la demande | différer la comparaison détaillée | vérifier les objectifs qui naissent après un changement de scène |
| recherche de route | objectif, opérateur et contraintes de mouvement sont engagés | différer BFS/simulation | aucune route témoin nécessaire ne doit disparaître |
| perception après `continue` | fin de série ou écart terminal déclaré | omettre toute perception entre actions | une unique réconciliation finale couvre le contrat engagé |

AR25 illustre la limite de l'extraction actuelle : 420 événements SRL, 202
workflow et 110 événements d'objectif, avec 55 références d'objectif observées,
mais **zéro lien d'objectif consommé** établi par la jointure compacte actuelle.
Ce zéro signifie « lien non démontré par ce format », pas « objectifs inutiles ».
L'audit doit revenir aux dépendances exactes des décisions et aux tests
contrefactuels avant d'élaguer ces branches.

## Lecture par autorité

| Élément de l’arbre | Auteur | Python autorisé |
|---|---|---|
| type de demande de perception | DRM/Logos | valider, hacher, exécuter |
| objectif, hypothèses, falsificateurs | TERM/CLAIM + DRM | transporter le delta |
| ordre des nœuds et trois branches | SRC | interpréter le résultat déclaré |
| action à libérer | SRC après engagement DRM | dispatcher l’action exacte |
| résultat causal | environnement + capacité pure | mesurer et réduire |
| synthèse mémoire | SRC/DRM | borner à 10 KiB et stocker le delta |

## Couverture des objectifs suivis dans les L1

La couverture n’est **pas** un matching rigide action-par-action. Les traces
L1 sont des témoins non exhaustifs. L’unité de matching est le contrat
d’objectif :

`objectif terminal, préconditions, effet attendu, invariants préservés,
falsificateur, preuve de réconciliation`.

Une action `ACTION2` et une action dynamique peuvent donc suivre la même
branche si elles testent ou réduisent le même objectif. L’identité exacte,
l’ordre ou le nombre d’actions ne deviennent obligatoires que si le contrat
sémantique le démontre.

L’extraction attendue pour chaque occurrence est :

```text
for observed_step in every_l1_trace:
    objective = extract_declared_objective(observed_step)
    contract = (objective, prerequisites, expected_effect,
                preserved_invariants, falsifier)
    branch = match_objective_contract(contract)
    assert branch is not None
    assert reconcile(observed_step.delta).supports(contract)
```

La feuille `release_declared_action` couvre donc toute action discrète
disponible, y compris les familles observées dans les L1 (`ACTION1` à
`ACTION7`) et les identifiants dynamiques, sans créer une branche par
identifiant. Les identifiants particuliers restent des données de scène,
jamais des branches de l’arbre.

La matrice d’extraction publiée est
`l1_objective_contract_matrix.md` — `l1_objective_contract_matrix.md`. Elle joint
les références observées aux nœuds génériques et conserve les lacunes au lieu
de les inventer. Les 50 jeux possèdent une feuille d’action témoin ; dans les
artefacts actuels, 46 ont des références symboliques d’objectif/stratégie.
Quatre n’en ont pas : FITE, MEMO, SKBN et SWCH possèdent maintenant une
section de contrat humain en prose, celle de SWCH étant une extraction
créateur-side explicite de ses observations et de son run réussi. Cette
classification corrige la confusion précédente entre « pas de référence
parsable » et « pas d’objectif documenté ». Elle ne prouve pas encore la
jointure de chaque action à un objectif suivi.

L'audit direct des journaux SRL confirme la limite : 451 occurrences `ACTION`
sur 40 jeux, aucune avec `goal.*`/`objective.*` dans l'action ou sa dernière
attente locale ; dix jeux n'ont pas de journal SRL dans l'index disponible.
Les attentes et workflows voisins sont des contextes, pas des liens d'objectif
prouvés. La couverture 100 % demande encore la jointure avec le contrat humain
et la sélection SRC/DRM, puis l'effet réconcilié ; une ligne `unknown` reste
obligatoire en l'absence d'un de ces maillons.

Correction de l'inventaire des actions SRL : l'extracteur conserve maintenant
les **451/451** événements `ACTION`. Avant cette correction, seuls 313 étaient
inscrits comme `executed_actions` ; 138 dispatchs de composants dynamiques
étaient omis faute d'un identifiant `ACTIONn` explicite. Ils portent désormais
leur `dispatch_ref` source, avec `action_ref = null` et le statut « identité
primitive non démontrée ». Aucun des 451 événements ne porte directement une
référence `goal.*`/`objective.*` : ce constat ne nie pas les objectifs, il
interdit seulement d'annoncer une jointure causale que le journal ne donne pas.
Les dix jeux sans SRL restent couverts par leurs témoins/oracles humains, avec
la même obligation de revue.

Audit de la jointure SRC/SRL disponible : 279/451 ACTION ont une contrepartie
de même référence dans les `ACT` de probe, 172 n'en ont pas et 62 `ACT` de
probe restent en surplus. Dix-huit jeux portent 171 de ces 172 absences car
leurs projections ne contiennent aucun `ACT` de probe ; la dernière référence
est un dispatch `symmetric-affine` hors de cette famille. L'outil
`tools/audit_l1_action_workflow_join.py` n'infère **aucun** objectif depuis
ces nombres : une identité de composant peut servir à plusieurs occurrences.
La chaîne occurrence → intention → objectif → effet reste à établir avant de
déclarer la couverture sémantique.

Le parseur de pseudocode post-run couvre désormais les 40 fichiers disponibles,
y compris les blocs `text` et R11L rédigé en paragraphes impératifs. Ses lignes
restent des **indices non revus** ; 45 listes d'actions sont marquées comme
témoins seulement. Ce progrès d'inventaire ne transforme pas les gros ledgers
créateur-side en arbre éditable ni ne valide les contrats.

La matrice complète devra joindre à chaque étape L1 :

`game, level, step, action_ref, objective_ref, active_node, reasoning_ref,
perception_demands, prerequisites, expected_effect, preserved_invariants,
falsifier, reconciliation_result`.

Une étape sans contrat objectif reste une lacune bloquante pour la preuve de
couverture sémantique, même si le niveau réussit. Elle ne crée pas une branche
artificielle : le runtime reste arrêté sur l’objectif non documenté. Plusieurs
actions peuvent partager une seule ligne de contrat objectif si elles sont des
variantes équivalentes ; elles ne doivent pas gonfler le nombre de branches.

## Invariants de performance

- Une perception lazy absente de la branche active n’est pas appelée.
- Une perception dont l’empreinte d’entrée est identique est un cache hit.
- Un delta sans intersection avec l’invalidation d’une demande ne la réveille
  pas.
- `CONTINUE` ne fait aucun calcul cognitif ; il déclenche la série déjà engagée.
  Aucun `CALL`, `SELECT`, `OBSERVE` ou calcul perceptif ne se produit entre deux
  actions ; une seule observation terminale vérifie le contrat. Si elle ne
  correspond pas, le parcours va à `retrospection`.
- La réconciliation ne reconstruit pas les `FrozenMap` ni le workflow complet.
### Sous-arbre d'interaction sur grille retenue

```text
RETAINED_GRID_INTERACTION                         (2 branches)
├─ unique_new_adjacent_repeated_pattern + nonlocal_delta
│  └─ SCENE full
│     └─ POINTS enumerate_all
│        └─ RETAINED_CELL_JOIN                    (2 branches)
│           ├─ exactly_one_candidate_on_retained_grid_cell
│           │  └─ RELEASE point → RECONCILE
│           └─ zero_or_ambiguous_candidates
│              └─ PRESERVE full_agenda
└─ no_unique_structural_demand
   └─ KEEP retained_grid_motion
```

Le curseur ne choisit pas la grille et la couleur ne choisit pas le clic. Le
premier nœud consomme uniquement le delta cellulaire ; le second joint la cellule
demandée aux candidats déjà complètement énumérés. Après une ouverture
réconciliée, les points restent complets pendant une décision afin d'examiner
l'accès révélé avant de reprendre une commande directionnelle.
