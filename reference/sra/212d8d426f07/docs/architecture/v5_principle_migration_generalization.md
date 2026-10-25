# Migration et généralisation de tous les principes V5

Date : 2026-08-26 — clôture auditée le 2026-08-27

Statut : migration M0–M9 et hardening de baseline terminés ; ledger exhaustif
source-current et gates shardés validés.

Portée initiale obligatoire : les 195 principes inventoriés avant M0 dans
`docs/v5/principle_consolidation_audit.md`. Portée finale : 237 principes,
incluant les 42 noyaux/variantes génériques ajoutés pendant la migration. Le
ledger source-current est
`docs/v5/principle_usage/principle_migration_ledger.md`.

## 1. Objectif

Améliorer chaque principe V5 afin qu'il soit :

- lisible et porté par la bonne couche d'autorité ;
- générique sans perdre ses conditions causales ;
- paramétrable lorsqu'une différence ne porte que sur un aspect, un rôle, une
  action, une relation ou une cardinalité ;
- explicitement relié à un critère DRM, à un workflow SRC approprié et à une preuve ;
- activable et falsifiable dans des jeux différents ;
- réutilisable inter-level sans transporter de fait d'instance ;
- compact dans les payloads et inspectable avant chaque action.

La migration ne cherche pas à réduire artificiellement le nombre de principes.
Elle cherche à distinguer correctement :

```text
loi commune
  + paramètres typés
  + variantes causales réelles
  + workflow partagé éventuel
  + preuves et limites
```

## 2. Autorité non négociable

| Couche | Possède pendant la migration |
|---|---|
| Logos | termes, principes communs, opérateurs, structure épistémique, falsificateurs, engagements |
| DRM | suppositions morphologiques, rôles, buts, variantes, éligibilité, priorités, stratégies et métaplanning |
| SRC | ordre, branche, release d'une primitive, checkpoint, continuation et réconciliation |
| Python | inventaire, diff, signatures, paramètres mesurés, recherche/simulation bornée, transport et projection mécanique |

Python peut proposer mécaniquement des intersections ou des différences. Il ne
décide jamais que deux principes sont « le même principe » et ne sélectionne
jamais leur variante sémantique.

### 2.1 Frontière de portée : refactoring utile maintenant, hardening après M9

M0–M9 migrent les principes et peuvent refactoriser les workflows SRC qui les
ordonnent lorsque ce refactoring rend explicite un lifecycle commun, supprime
une duplication démontrée ou rétablit la frontière d'autorité. Le lot reste
piloté par la famille de principes en cours : il ne devient pas un audit général
de SRC.

Un refactoring SRC réalisé dans M0–M9 doit donc :

- être directement relié aux principes du lot courant ;
- conserver le comportement validé hors de ce lot ;
- rester limité au plus petit lifecycle, branche, checkpoint, continuation ou
  reconciliation réellement partagé ;
- posséder des tests positifs, négatifs et de non-régression proportionnels.

Le hardening systématique des workflows vient après M9, sur une baseline de
principes validée. Il couvrira notamment l'audit transversal de durabilité,
reprise, idempotence, bornes, attestations, diagnostics et cohérence du
scheduler. Les dettes observées pendant M0–M9 qui ne sont pas nécessaires à la
factorisation du lot courant sont consignées pour cette phase ultérieure.

## 3. Doctrine culturelle : `white`, couleurs vives et repli paramétrable

Le blanc et les couleurs vives restent dans le noyau de connaissance culturelle.
Ils ne sont pas des hacks d'instance : ce sont des priors visuels généraux
révisables, utiles pour proposer focus, contour, état actif, bouton, invitation
au clic ou carrier sélectionné.

Le modèle cible est :

```text
cultural_attention_cue
  ├─ white_fill_or_contour
  ├─ vivid_or_high_saturation_color
  ├─ strong_local_contrast
  └─ culturally_familiar_control_morphology

fallback_distinctive_visual_aspect
  ├─ rare_aspect
  ├─ local_contrast
  ├─ luminance_extremum
  ├─ saturation_extremum
  ├─ topology_or_texture_exception
  ├─ symmetry_exception
  └─ relation_exception
```

Règles :

1. les cues culturels sont essayés en premier lorsqu'ils existent ;
2. ils ouvrent une supposition, jamais un rôle causal final ;
3. une transition action-conditionnée confirme ou falsifie leur signification ;
4. `distinctive_visual_aspect` intervient si les cues culturels sont absents,
   ambigus, multiples, déjà stériles ou incompatibles avec les effets ;
5. le repli reste paramétré par les aspects mesurés et ne devient pas un score
   opaque de salience ;
6. plusieurs cues peuvent rester concurrents jusqu'à contradiction.

Propositions de termes à examiner dans Logos :

```text
cultural_attention_cue
white_attention_cue
vivid_color_attention_cue
distinctive_visual_aspect
attention_cue_supposition
action_conditioned_attention_cue_validation
```

## 4. Unité de migration : la fiche de principe

Chaque principe doit recevoir une fiche versionnée :

```text
principle_ref
owner_layer
family_ref
abstraction_level: common | parameterized_core | causal_variant
statement
typed_role_parameters
aspect_parameters
action_family_parameters
relation_parameters
cardinality_parameters
premises
applicability
invariants
expected_effect_classes
falsifiers
shared_operator_refs
selection_declaration_refs
workflow_refs
reconciliation_refs
positive_test_refs
negative_test_refs
activation_evidence_refs
known_counterexamples
migration_disposition
migration_status
```

Les dispositions autorisées sont :

- `keep_common` : loi transversale déjà correctement abstraite ;
- `keep_specific` : loi causalement distincte, conservée sans faux ancêtre ;
- `parameterize` : même causalité, aspects ou rôles variables ;
- `core_plus_variants` : noyau commun et variantes causalement distinctes ;
- `share_operator` : mutualiser seulement la transformation mécanique ;
- `share_workflow` : mutualiser le lifecycle SRC directement partagé par les
  principes du lot courant ;
- `defer_workflow_hardening` : consigner une dette SRC transversale qui relève
  du hardening post-M9 plutôt que de la migration du principe courant ;
- `compose` : garder deux principes mais déclarer leur composition ;
- `split` : une déclaration mélange plusieurs lois indépendantes ;
- `clarify_reference` : principe réalisé indirectement, lien canonique manquant ;
- `quarantine_pending_evidence` : sens plausible mais preuve insuffisante ;
- `retire_after_proof` : uniquement après preuve d'équivalence ou d'obsolescence.

Aucun principe n'est supprimé parce qu'il est `not_explicitly_referenced`.

## 5. Gates individuels applicables aux 195 principes initiaux et aux additions

Un principe est migré seulement si les douze cases suivantes sont remplies :

1. la question symbolique qu'il résout est nommée ;
2. les prémisses sont des claims observables ou dérivés explicitement ;
3. l'applicabilité ne contient aucun fait d'instance ;
4. les paramètres variables sont typés ;
5. les invariants ne dupliquent pas un lifecycle commun ; celui-ci est factorisé
   s'il appartient au lot courant, sinon la dette de hardening est consignée ;
6. les falsificateurs sont exécutables ou observables ;
7. le critère DRM évaluateur est relié ;
8. la sélection DRM et le pourquoi sont reliés ;
9. le workflow SRC qui ordonne l'application est relié, factorisé si nécessaire
   dans le périmètre du lot, et sa dette transversale restante est consignée ;
10. au moins un test positif et un test négatif existent ;
11. un contre-exemple plausible empêche la sur-généralisation ;
12. une activation compacte peut être indexée sans état brut.

## 6. Vagues de migration couvrant les 195 principes initiaux

La somme des lots initiaux ci-dessous est exactement 195. Les additions
génériques font évoluer la baseline finale à 237. Le ledger exhaustif
source-current est généré depuis les DRM ; aucun identifiant ne peut disparaître
silencieusement.

| Vague | Modules / nombre | Objet principal |
|---|---:|---|
| M0 | infrastructure, hors compte | registre source-current, références manquantes, statut précis |
| M1 | `arc3` 8 + `ontology` 3 | noyau épistémique et extension bornée |
| M2 | `morphology` 21 | cues culturels, aspects distinctifs, rôles révisables |
| M3 | `metaplanning` 11 | ordre des stratégies et élimination des priorités trop absolues |
| M4 | `alignment` 10 + `geometry` 3 | buts multi-aspects et relations géométriques paramétrées |
| M5 | `resources` 6 + `retrodiction` 4 | ressources symboliques et responsabilité prédictive |
| M6 | `transport` 10 + `oriented_transport` 8 | mouvement, rigidité, orientation, capacité et support |
| M7 | `temporal_replay` 5 + `symbolic_editing` 3 | état configurable, phases, replay et validation |
| M8 | `interaction` 103 | décomposition du grand module mixte |
| M9 | preuves transversales, hors compte | activation, falsification, composition et held-out |

### M0 — Réparer l'autorité de l'inventaire

Livrables :

- `validate` reconstruit les sources en mémoire et compare les hashes ;
- les artefacts versionnés contiennent les 195 principes d'origine et toute
  addition générique explicitement confirmée ;
- les tests ne codent plus un compte obsolète sans hash de baseline ;
- les sept références sans déclaration sont résolues ;
- les statuts distinguent référence explicite, sélection, activation et
  falsification ;
- une dérive source/registre fait échouer le gate.

Progression au 2026-08-26 :

- M0 mécanique terminé : reconstruction source-current, comparaison exacte des
  sept artefacts générés, statuts `explicitly_referenced` et
  `not_explicitly_referenced`, suppression des comptes de corpus figés dans les
  tests ;
- les 197 principes et 321 déclarations courantes sont maintenant indexés ;
- les sept références sans déclaration ont été résolues : deux principes
  génériques confirmés ont été ajoutés, six occurrences réemploient un principe
  existant et quatre étiquettes de rapport non autoritaires ont été retirées ;
- `docs/v5/principle_usage/reference_integrity.json` ne contient plus aucune
  référence de production sans déclaration ;
- la proposition M0-B détaillée est écrite dans
  `docs/v5/principle_usage/m0_undeclared_reference_resolution_proposal.md` :
  deux principes génériques nouveaux, une réutilisation et quatre assertions
  Python supprimées ; elle a été confirmée par l'utilisateur puis intégrée ;
- M0 est terminé. Aucun prior culturel (`white`, couleurs vives), workflow SRC,
  ordre de sélection ou action runtime n'a été modifié.

### M1 — Noyau épistémique

Principes concernés : tous ceux de `arc3.drm` et `ontology.drm`.

Travail :

- factoriser `evidence_before_commitment`, `preserve_live_alternatives`,
  `extend_only_after_scoped_gap` et la construction/instanciation de principe
  dans un lifecycle épistémique commun ;
- distinguer activation explicite, seuil mécanique et confirmation causale ;
- relier chaque étape aux workflows `construct_applied_principle` et
  `instantiate_general_principle` ;
- définir la réduction locale de portée après contradiction ;
- tester une vraie alternative conservée puis falsifiée.

Progression au 2026-08-26 :

- M1-A terminé : `schema.epistemic_principle_lifecycle` et
  `principle.grounded_epistemic_lifecycle` factorisent l'engagement fondé sur les
  preuves, la conservation des alternatives et la généralisation révisable ;
- la contradiction est réduite à sa portée explicite par
  `principle.contradiction_revises_only_falsified_scope` et par une réduction
  Python purement mécanique et immutable ;
- seuil mécanique, événement d'activation et confirmation causale sont séparés
  par un principe général dont l'ancien principe d'activation est une
  spécialisation ;
- le workflow SRC commun construit d'abord le principe appliqué, puis produit
  seulement une proposition de principe général pour revue ;
- cette factorisation SRC illustre la portée autorisée en 2.1 : un lifecycle
  commun directement requis par la famille de principes en cours, sans ouvrir
  un hardening transversal du scheduler ;
- les gates locaux sont verts : 24 tests d'index, 114 tests DRM/SRC/autorité,
  garde déclarative PASS ;
- le gate Level 1 offline shardé est vert avant et après le lot : 25/25 jeux,
  3/3 shards, `coverage_ok=true`, `proof_ok=true` ;
- le détail et l'incertitude restante sont consignés dans
  `docs/v5/principle_usage/m1_epistemic_lifecycle.md` ;
- ce point constituait le checkpoint historique avant M1-B ; la classification
  et le gate M1-B sont documentés immédiatement ci-dessous.

Progression M1-B au 2026-08-26 :

- les quinze principes sont classifiés dans
  `docs/v5/principle_usage/m1b_principle_classification.md` ;
- quatre nouveaux rattachements réels sont intégrés : observation
  action-conditionnée, graphe de contrôle fini, effet régional et support
  multimatière ;
- quatre principes restent volontairement autonomes : release par sagesse,
  état d'outil factorisé, réparation de différence et plan régional réversible ;
- le registre DRM valide les ancêtres, refuse les cycles et projette un contrat
  effectif ancêtre→spécialisation ;
- deux obligations dupliquées sont retirées de leurs spécialisations et restent
  disponibles par héritage effectif ;
- les contrats de workflow nomment désormais leurs principes gouvernants ;
- les gates larges sont verts : 130 tests, index sémantique PASS et garde
  déclarative PASS ;
- le gate Level 1 offline shardé post-M1-B est vert : 25/25 jeux, 3/3 shards,
  `coverage_ok=true`, `proof_ok=true` ;
- M1 est terminé. Le prochain lot de migration est M2 — morphologie, culture et
  signification, en conservant `white` et les couleurs vives dans le noyau et en
  ajoutant le repli paramétrable `distinctive_visual_aspect`.

### M2 — Morphologie, culture et signification

Principes concernés : les 21 de `morphology.drm` et les principes d'attention
visuelle actuellement dans `interaction.drm`.

Travail :

- conserver les priors `white` et couleurs vives ;
- ajouter le repli `distinctive_visual_aspect` ;
- factoriser `compact_complexity` et `compact_isotropy` par aspects typés ;
- séparer mesure morphologique, supposition de rôle et confirmation par effet ;
- paramétrer surface, séparateur, interface, support, répétition et centre ;
- ajouter les contre-exemples « même morphologie, autre fonction » et « même
  fonction, autre morphologie » ;
- tester permutation de palette sans supprimer la connaissance culturelle.

Progression M2 au 2026-08-26 :

- M2 est terminé et documenté dans
  `docs/v5/principle_usage/m2_morphology_cultural_attention.md` ;
- le noyau culturel conserve explicitement `white`, les couleurs vives, le
  contraste local et les morphologies de contrôle culturellement familières ;
- `distinctive_visual_aspect` fournit un repli paramétrable sans score opaque ;
- mesure, supposition de rôle et confirmation action-conditionnée sont séparées
  par deux principes communs et des spécialisations héritables ;
- `compact_isotropy` et `compact_complexity` partagent le même noyau tout en
  conservant leurs aspects et alternatives propres ;
- les 21 principes morphologiques antérieurs ont une disposition explicite,
  sans rattachement artificiel pour améliorer un compteur de consommateurs ;
- 143 tests sont verts, 57 workflows SRC et leurs contrats sont validés,
  l'index sémantique et la garde déclarative passent ;
- le gate Level 1 offline shardé post-M2 est vert : 25/25 jeux, 3/3 shards,
  `coverage_ok=true`, `proof_ok=true`, rapport
  `docs/v5/performance/principle_migration_m2_l1_offline_sharded_20260826.json` ;
- le prochain lot est M3 — métaplanning.

### M3 — Métaplanning

Principes concernés : les 11 de `metaplanning.drm` et les priorités génériques
de `interaction.drm`.

Travail :

- remplacer les priorités absolues par des conditions d'éligibilité explicites ;
- conserver l'ordre plan exact → résiduel vérifié → expérience discriminante ;
- paramétrer les familles d'action sans réduire la doctrine à click/direction ;
- distinguer coût de ressource, gain d'information et progrès d'objectif sans
  score fusionné ;
- préserver les alternatives à coût égal ;
- tester qu'une exception prédite précède un probe aléatoire.

Progression M3 au 2026-08-26 :

- M3 est terminé et documenté dans
  `docs/v5/principle_usage/m3_metaplanning.md` ;
- l'audit a trouvé douze principes courants plutôt que les onze annoncés par le
  plan initial ; les douze ont une disposition et un ancêtre effectif ;
- chaque tier exige maintenant une preuve d'éligibilité et une phase explicite ;
- l'ordre est plan exact → résiduel vérifié → expérience discriminante, avec
  exception structurelle prédite avant probe générique ;
- coût de ressource, gain d'information et progrès d'objectif restent trois
  dimensions non fusionnées ; les alternatives de même coût sont préservées ;
- `action_family_parameters` généralise point, direction, transformation,
  sélection, exécution, ressource et route composite ;
- une dette M1 révélée par l'audit HTTP est corrigée : les deux sous-workflows
  épistémiques disposent d'un dispatch runtime vers leur source exacte ;
- le pseudocode proposé et l'intégré sont strictement identiques après
  validation ;
- 446 tests sont verts, 57 workflows SRC et leurs contrats sont validés,
  l'index et la garde passent, l'audit HTTP fresh-server passe ;
- le gate Level 1 offline shardé post-M3 est vert : 25/25 jeux, 3/3 shards,
  `coverage_ok=true`, `proof_ok=true`, rapport
  `docs/v5/performance/principle_migration_m3_l1_offline_sharded_20260826.json` ;
- le prochain lot est M4 — alignement et géométrie.

### M4 — Alignement et géométrie

Principes concernés : les 10 de `alignment.drm`, les 3 de `geometry.drm` et les
principes d'alignement d'`interaction.drm`.

Travail :

- représenter un but comme ensemble de relations ouvertes ;
- généraliser row/column/both vers un ensemble d'aspects requis ;
- distinguer arrivée dans une région, contact, contenance et satisfaction
  terminale ;
- généraliser la bijection vers une affectation sous capacités ;
- conserver forme exacte comme cue fort, mais permettre topologie, effet,
  orientation et cardinalité ;
- inférer les pivots de rotation au lieu de présumer une ancre ;
- généraliser moyenne égale vers relation affine exacte ;
- ajouter des tests de satisfaction partielle sans score.

Progression M4 au 2026-08-26 :

- huit noyaux relationnels communs sont intégrés et documentés dans
  `docs/v5/principle_usage/m4_alignment_geometry.md` ;
- `relation_parameters` et `cardinality_parameters` sont hérités par le contrat
  effectif et couverts par l'index ;
- les dix principes d'alignement et trois principes géométriques antérieurs sont
  classifiés, y compris les trois connaissances volontairement autonomes ;
- huit spécialisations réellement relationnelles d'`interaction.drm` héritent
  des noyaux communs ;
- les tests M4 ciblés et la garde déclarative sont verts ;
- le pseudocode proposé et le pseudocode intégré sont synchronisés après
  validation complète ;
- le gate Level 1 offline shardé post-M4 est vert : 25/25 jeux, 3/3 shards,
  `coverage_ok=true`, `proof_ok=true`, rapport
  `docs/v5/performance/principle_migration_m4_l1_offline_sharded_20260826.json` ;
- le prochain lot est M5 — ressources et rétrodiction.

### M5 — Ressources et rétrodiction

Principes concernés : 6 ressources, 4 rétrodiction et leurs variantes dans
`interaction.drm`.

Travail :

- unifier coût, capacité, stock, verrou, occupation et ressource partagée sous
  des types distincts ;
- rendre la viabilité et la preuve de verrou paramétrables par ressource ;
- réévaluer le coût après chaque transition ;
- faire porter à chaque mécanisme une couverture prédictive et un domaine ;
- exiger un premier point de divergence rétrodictif ;
- préserver les lois inter-level mais oublier coûts et identités de scène.

Progression M5 au 2026-08-26 :

- quatre noyaux de ressources et trois noyaux de rétrodiction sont intégrés et
  documentés dans `docs/v5/principle_usage/m5_resources_retrodiction.md` ;
- `resource_parameters` et `prediction_domain_parameters` sont hérités par le
  contrat effectif et couverts par l'index ;
- les six principes de ressources et quatre principes de rétrodiction
  antérieurs ont tous une disposition et un ancêtre effectif ;
- trois spécialisations réellement liées aux ressources dans
  `interaction.drm` héritent des noyaux, tandis que les faux positifs de
  composition et de configuration restent autonomes ;
- les tests ciblés et l'index sont verts ;
- le guard, les contrats SRC et l'audit HTTP fresh-server sont verts ;
- le pseudocode proposé et le pseudocode intégré sont synchronisés après
  validation complète ;
- le gate Level 1 offline shardé post-M5 est vert : 25/25 jeux, 3/3 shards,
  `coverage_ok=true`, `proof_ok=true`, rapport
  `docs/v5/performance/principle_migration_m5_l1_offline_sharded_20260826.json` ;
- le prochain lot est M6 — transport.

### M6 — Transport

Principes concernés : 10 transport, 8 transport orienté et les variantes de
route d'`interaction.drm`.

Travail :

- factoriser translation, co-translation, réflexion et mouvement rigide sous
  des relations de delta paramétrées ;
- séparer opérateur mécanique, signification du rôle et but ;
- rendre l'orientation, le front, le support et l'attachement explicites ;
- généraliser le packing vers capacité et affectation ;
- mutualiser le lifecycle de route engagée ;
- conserver au plus trois témoins globaux, un premier plus court par ordre ;
- ajouter des falsificateurs de rigidité, de support, de collision et de
  disponibilité du front.

Progression M6 au 2026-08-26 :

- sept noyaux de transport et route sont intégrés et documentés dans
  `docs/v5/principle_usage/m6_transport.md` ;
- les dix principes de transport et huit principes orientés antérieurs ont tous
  une disposition et un ancêtre effectif ;
- douze spécialisations réellement liées au transport ou à une route engagée
  dans `interaction.drm` héritent des noyaux, sans absorber les frontiers de
  viewport ou d'attention ;
- packing réutilise l'affectation sous capacité M4 et le coût de route réutilise
  la réévaluation par révision M5 ;
- les tests ciblés et l'index sont verts ;
- le guard, les contrats SRC et l'audit HTTP fresh-server sont verts ;
- le pseudocode proposé et le pseudocode intégré sont synchronisés après
  validation complète ;
- le gate Level 1 offline shardé post-M6 est vert : 25/25 jeux, 3/3 shards,
  `coverage_ok=true`, `proof_ok=true`, rapport
  `docs/v5/performance/principle_migration_m6_l1_offline_sharded_20260826.json` ;
- le prochain lot est M7 — configuration, symboles et temps.

### M7 — Configuration, symboles et temps

Principes concernés : 5 replay, 3 édition symbolique et leurs variantes dans
`interaction.drm`.

Noyau cible :

```text
configuration observable
→ aspects éditables factorisés
→ opérateur d'édition
→ configuration révisée
→ opérateur d'exécution
→ effets intermédiaires
→ validation ou falsification
```

Travail :

- paramétrer alphabet, traits, ordre, connecteurs et groupe de transformation ;
- distinguer phase, curseur, slot et état du monde ;
- représenter effets immédiats, différés et récurrents ;
- conserver la dernière observation d'un replay épuisé ;
- relier chaque phase à un checkpoint SRC ;
- tester une même loi sous autre alphabet, palette, rotation et disposition.

Progression M7 au 2026-08-26 :

- cinq noyaux de configuration et deux noyaux temporels sont intégrés et
  documentés dans `docs/v5/principle_usage/m7_configuration_temporal.md` ;
- `configuration_parameters` et `temporal_parameters` sont hérités par le
  contrat effectif et couverts par l'index ;
- les trois principes symboliques et cinq principes de replay antérieurs ont
  tous une disposition et un ancêtre effectif ;
- six spécialisations réellement liées à la configuration ou au temps dans
  `interaction.drm` héritent des noyaux, sans absorber la composition M9 ;
- les tests ciblés et l'index sont verts ;
- le guard, les contrats SRC et l'audit HTTP fresh-server sont verts ;
- le pseudocode proposé et le pseudocode intégré sont synchronisés après
  validation complète ;
- après une première panne transitoire de démarrage du shard 1, SU15 isolé puis
  le rerun complet ont réussi ;
- le gate Level 1 offline shardé post-M7 est vert : 25/25 jeux, 3/3 shards,
  `coverage_ok=true`, `proof_ok=true`, rapport terminal
  `docs/v5/performance/principle_migration_m7_l1_offline_sharded_20260826.json` ;
- le prochain lot est M8 — décomposition d'`interaction.drm`.

### M8 — Décomposer `interaction.drm`

Les 103 principes sont affectés à des familles sémantiques, sans déplacement
automatique de l'autorité :

| Sous-famille cible | Contenu |
|---|---|
| `interaction_evidence` | no-effect, transition, causalité, répétition, exception |
| `interaction_attention` | white, couleurs vives, singularité, aspect distinctif |
| `interaction_access` | blocage, ouverture, frontier, access unlocking |
| `interaction_route` | route cursor, zone-state graph, checkpoint, invalidation |
| `interaction_alignment` | marker, axis, overlay, extent, contact |
| `interaction_relation` | moyenne, assignment, cardinalité, correspondance |
| `interaction_configuration` | modules, state editor, construction, validation |
| `interaction_resource` | coûts, priorité, distribution, contraintes partagées |
| `interaction_viewport` | révélation, écran, underlay, translation du viewport |

Chaque déplacement doit conserver l'identifiant source jusqu'à ce qu'un alias
ou une migration de référence ait été validé.

Progression M8 au 2026-08-26 :

- les 103 principes sont affectés exactement une fois aux neuf familles et
  documentés dans `docs/v5/principle_usage/m8_interaction_decomposition.md` ;
- `family_ref` et `abstraction_level` sont deux métadonnées DRM couplées et
  validées ; chaque famille résout un schéma source-hashé ;
- aucun principe n'est déplacé : les 103 identifiants restent sous l'autorité
  source du module `interaction` ;
- `white`, couleurs vives et connaissance culturelle restent dans la famille
  attention ; `distinctive_visual_aspect` demeure le repli paramétré M2 ;
- les 124 tests contractuels, les 57 workflows SRC, l'index, le guard et l'audit
  HTTP fresh-server sont verts ;
- le pseudocode proposé et l'intégré sont synchronisés après validation complète ;
- le gate Level 1 offline shardé post-M8 est vert : 25/25 jeux, 3/3 shards,
  `coverage_ok=true`, `proof_ok=true`, rapport
  `docs/v5/performance/principle_migration_m8_l1_offline_sharded_20260826.json` ;
- M8 est terminé. Le prochain lot est M9 — preuve inter-familles.

### M9 — Preuve inter-familles

Après chaque famille :

- test positif canonique ;
- test négatif morphologiquement proche ;
- falsificateur explicite ;
- mutation de palette et de morphologie ;
- nouvelle identité avec même loi ;
- composition avec une seconde famille ;
- preuve inter-level continue ;
- activation compacte avec `principle_ref` canonique.

Progression M9 au 2026-08-26 :

- les neuf familles M8 portent désormais un contrat de preuve complet et
  source-hashé : positif, négatif, mutation, transfert d'identité, composition,
  inter-level et activation compacte ;
- chaque famille expose un falsificateur explicite et compose avec une famille
  distincte sans fusionner leurs principes ;
- les preuves de mutation conservent la loi structurelle sous permutation de
  palette et changement morphologique, mais échouent dès qu'un falsificateur
  déclaré est présent ;
- le transfert inter-level conserve `principle_ref` et les prémisses, tout en
  interdisant la réutilisation des identités de scène ;
- les huit champs de preuve sont des métadonnées DRM : Python valide et indexe,
  sans modifier éligibilité, priorité, workflow ou action ;
- 134 tests contractuels sont verts ; registre 371, index 237 principes/49
  champs, zéro champ non classé, intégrité et couverture sémantique `PASS` ;
- le guard et l'audit HTTP fresh-server sont verts ;
- après une première exécution suspendue par un worker de bridge, un rerun propre
  du gate Level 1 offline shardé post-M9 est vert : 25/25 jeux, 3/3 shards,
  `coverage_ok=true`, `proof_ok=true`, rapport
  `docs/v5/performance/principle_migration_m9_l1_offline_sharded_20260826.json` ;
- le pseudocode proposé et l'intégré sont synchronisés après validation complète ;
- M9 et la migration M0–M9 sont terminés. La baseline passe maintenant au
  hardening SRC transversal séparé annoncé en 2.1.

## 7. Factorisations prioritaires

| Proposition | Principes sources | Type |
|---|---|---|
| `principle.attention_cue_opens_revisable_interaction_supposition` | compact complexity/isotropy, white contour, unique white center, vivid cue futur | noyau + variantes culturelles/aspect |
| `principle.partial_goal_satisfaction_preserves_open_terminal_relations` | axis success, target arrival, marker zero-axis | noyau commun |
| `principle.goal_relative_access_reconfiguration_precedes_unreachable_terminal_progress` | quatre familles access unlocking | noyau + variantes |
| `procedure.reconcile_effectful_checkpoint_then_resume_declared_subgoal` | trois effectful checkpoints, opened frontier | workflow SRC partagé dans le lot concerné |
| `procedure.committed_route_step_lifecycle` | route cursor, whole footprint, first shortest, provisional route | workflow SRC partagé dans le lot concerné |
| `principle.action_conditioned_rigid_relation` | composite rigid, anchored transform, same-delta pair | noyau + opérateurs |
| `principle.resource_viability_precedes_irreversible_commitment` | scarce resource, terminal lock, recovery, current cost | noyau ressource |
| `principle.factorized_configuration_requires_edit_execute_validate` | symbolic editor, instruction modules, construction validation | noyau configurable |
| `principle.capacity_constrained_relational_assignment` | exact bijection, equal cardinality, packing capacity, distribution | paramétrisation |
| `principle.observed_finite_transform_domain` | binary aspects, quarter-turn, successor/inverse, pose cycle | noyau transformateur |

Ces noms sont des propositions de consolidation, pas des décisions déjà
intégrées. Les deux propositions SRC peuvent être réalisées dans M0–M9 si leur
lot établit le lifecycle commun et ses non-régressions ; leur hardening
transversal reste hors de portée jusqu'après M9.

## 8. Généralisation par dimensions

Chaque principe est testé sur les dimensions pertinentes :

| Dimension | Variations obligatoires |
|---|---|
| Culture visuelle | blanc, couleur vive, contraste, absence de cue culturel |
| Palette | permutation sans changement de rôle causal |
| Morphologie | forme, topologie, taille, densité, symétrie, texture |
| Référentiel | écran, objet, gravité, local, rotation globale |
| Action | point, direction, édition, activation, sélection, exécution |
| Effet | local, distant, couplé, différé, partiel, conditionnel |
| Réversibilité | réversible, révisable, irréversible |
| Cardinalité | 1, 2, N, capacités hétérogènes |
| But | position, contact, contenance, activation, ordre, validation |
| Ressource | aucune, stock, capacité, coût, verrou, partage |
| Temps | immédiat, séquence, phase, replay, délai |
| Composition | séquentielle, parallèle, conflictuelle, non commutative |

## 9. Gates de migration

### Gate local par principe

- déclaration JSON valide et hashée ;
- référence unique ;
- fiche complète ;
- aucun fait d'instance ;
- test positif, négatif et falsificateur ;
- lien sélection/workflow/réconciliation ;
- garde déclaratif vert.

### Gate par famille

- tous les principes du lot possèdent une disposition ;
- les propositions de factorisation documentent différences résiduelles et
  plus petit contre-exemple ;
- aucune activation existante ne perd son pourquoi ;
- les variantes non fusionnées restent explicitement accessibles ;
- mutation de palette, morphologie et référentiel ;
- au moins deux jeux ou fixtures causalement distincts.

### Gate d'intégration

- registre source-current ;
- compilation SRC attestée ;
- chargement DRM unique et hashé ;
- tests focalisés et suite proportionnelle ;
- gate de niveau rapide puis checkpoint/merge si runtime modifié ;
- fresh-server live validation si comportement runtime modifié ;
- dette restante écrite explicitement.

## 10. Ordre d'exécution recommandé

```text
M0 registre et références
→ M1 noyau épistémique
→ M2 culture/morphologie
→ M3 métaplanning
→ M4 alignement/géométrie
→ M5 ressources/rétrodiction
→ M6 transport
→ M7 configuration/temps
→ M8 décomposition interaction
→ M9 preuves de composition et held-out
→ clôture et baseline validée principes + workflows directement factorisés
→ hardening SRC transversal, planifié depuis le registre de dette
```

La migration doit rester incrémentale : un seul noyau de principe ou lifecycle
SRC directement associé à la fois, puis tests et non-régression avant la
proposition suivante. Le hardening transversal ne commence qu'après M9.

Clôture du hardening post-M9 au 2026-08-27 :

- cinq applicabilités manquantes de `morphology.drm` ont été rendues explicites ;
- les 237 principes possèdent tous les cinq éléments du contrat sémantique ;
- les 57 workflows SRC compilent et les 53 sans principe gouvernant confirmé
  sont inventoriés sans faux consommateur dans
  `docs/v5/principle_usage/post_m9_hardening_audit.md` ;
- 998 tests unitaires V5, l'index et le guard sont verts sur la clôture auditée ;
- le gate shardé a été durci avec un cache et un `basetemp` isolés par worker
  après deux échecs de préparation Windows intermittents ;
- le gate terminal post-hardening est vert : 25/25 jeux, 3/3 shards,
  `coverage_ok=true`, `proof_ok=true`, rapport
  `docs/v5/performance/principle_migration_hardening_l1_offline_sharded_20260826.json` ;
- le gate frais de clôture est également vert : 25/25 jeux, 3/3 shards,
  `coverage_ok=true`, `proof_ok=true`, rapport
  `docs/v5/performance/principle_migration_completion_audit_l1_offline_sharded_20260827.json` ;
- la migration et son hardening de baseline sont terminés. Les 53 liaisons SRC
  et les familles RF0–RF15 + XL restent un programme de preuves, pas une
  autorisation de généralisation non confirmée.

## 11. Livrables versionnés attendus

- registre source-current des principes ;
- ledger source-current contenant les 237 fiches finales (les 195 fiches
  initiales plus les 42 noyaux/variantes ajoutés pendant M0–M9) ;
- propositions de factorisation avec contre-exemples ;
- matrice de composition ;
- matrice principe × workflow × test × activation × falsificateur ;
- registre de dette de hardening SRC observée, avec consommateurs, preuve,
  risque et plus petit test de comportement constant ;
- plan de hardening SRC post-M9, séparé des factorisations directement requises
  par les lots de principes ;
- fixtures de mutation par famille ;
- rapports compacts de preuves inter-jeux et inter-level ;
- liste des principes encore purement descriptifs avec justification.

État de livraison final :

| Livrable | Evidence source-current |
|---|---|
| registre et ledger exhaustifs | `static_registry.json` + `principle_migration_ledger.md`, 237/237 |
| propositions/factorisations | documents M1–M9 + table des noyaux communs du ledger |
| matrice de composition | `m9_inter_family_proof_matrix.md` |
| principe × workflow × test × activation × falsificateur | ledger exhaustif + `activation_index.jsonl` |
| dette SRC | `post_m9_hardening_audit.md`, 53/53 workflows sans lien inventé |
| mutations/falsificateurs | tests M2, M4–M9 et contrat +/- exhaustif du ledger |
| preuves inter-jeux/inter-level | rapports shardés M1–M9/hardening + matrice M9 |
| descriptifs/proof debt | statuts `migrated_activation_pending` et `*_falsifier_pending` du ledger |

## 12. Documents liés

- `docs/v5/principle_consolidation_audit.md`
- `docs/v5/principle_usage/migration_completion_audit.md`
- `docs/architecture/generalization_coverage_program.md`
- `docs/architecture/analogical_principle_reasoning_frontier.md`
- `docs/architecture/generic_unknown_game_discovery.md`
- `docs/architecture/missing_reasoning_families_coverage_plan.md`
