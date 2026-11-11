# Revue du port reconstruit Window : géométrie et noyau V5

## Provenance et statut

Ce port a été reconstruit dans le checkout de récupération de Site 95 à partir des fichiers de référence réellement présents, épinglés au commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Les anciens commits et leurs preuves ne sont pas disponibles dans ce checkout. Aucun résultat antérieur de test, de campagne ou de coût ne vaut validation de cette reconstruction.

Sources relues intégralement pour ce périmètre :

- `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/window_question/geometry.py` ;
- `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v5/capabilities/window_processing_d.py` ;
- les modèles, le budget et les fonctions de résultat/validation de `agents/yf_arc3_v5/capabilities/mechanical_family_contracts_d.py` ;
- les contrats `FrozenModel` et `Ref` de `agents/yf_arc3_v5/logos/types.py`.

Les deux fichiers reconstruits sont `src/logos-engine/v6-window-question-geometry.ts` et `src/logos-engine/v5-window-processing.ts`. Les tests indépendants seront générés et exécutés à nouveau. Cette note constitue une revue de source, pas un reçu d'exécution.

## Périmètre réellement consommé

La géométrie V6 appelle les modèles `TrainRankD`, `WindowReceiverD`, `WindowBeatStateD` ainsi que les fonctions privées `_window_eligibility` et `_process_one_beat`. `BeatPulseD` est construit dans cette dernière. Le port expose les normaliseurs correspondants, `windowEligibility` et `processOneBeat`.

Les wrappers publics `measure_homogeneous_window_eligibility_d` et `measure_same_beat_activation_closure_d`, leurs requêtes D complètes et leur enveloppe de validation/résultat ne sont pas revendiqués comme transférés. En particulier, le contrôle de `domain_bound` et l'appel à `budget.finish()` présents dans ces wrappers ne sont pas ajoutés aux fonctions privées consommées par V6. Le domaine du budget reste une donnée ; ces deux fonctions privées ne le contrôlent pas.

Le port réutilise `components`, `RecolorWorkBudget` et `RecolorComputationInterrupted` de `v6-topological-recolor-geometry.ts`. Aucun de ces helpers communs n'a été modifié pour Window. Le digest utilise `symbolicDigest` sur les structures JSON du domaine admis.

## Mesure et déterminisme

La mesure conserve l'ordre des composantes, la reconnaissance de bordure complète, les proportions des cadres et l'unité déterminée par leur hauteur. Les `Counter.most_common(1)` deviennent des comptes conservant l'ordre de première apparition : une égalité ne change donc pas arbitrairement la couleur de fond ou de champ.

La lecture des capacités conserve les séquences de colonnes, la distinction entre cases pleines et capacité fixe, le motif bicolore exigé pour cette dernière et le préfixe actif contigu. Un mélange incompatible est refusé. Les domaines ne sont pas dédupliqués ni triés artificiellement.

Les champs conservent le cœur uniforme, les alternatives verticales dans leur ordre observé, les overlays triés en coordonnées XY et les points centraux. Un patch multicolore admissible demeure une hypothèse wildcard. Un second champ réel reste un second rôle possible ; il n'est pas transformé en seconde capture. Les cadres sont finalement triés par ligne puis colonne.

Le mot supérieur doit former une seule rangée candidate de carrés régulièrement espacés, avec au moins trois occurrences et deux couleurs distinctes. Les filtres explicites doivent appartenir à ses couleurs. Une image vide ou nulle retourne l'abstention ; les rasters non conformes au domaine du validateur commun ne sont pas acceptés silencieusement.

## Rangs persistants, refus et événements

Les identités et rangs du train sont uniques, restent stables et ne sont jamais compactés après une capture. L'ordre de visite doit contenir exactement les récepteurs déclarés. Les parents déclarés doivent les précéder ; un événement d'un autre beat ne satisfait jamais une dépendance courante.

L'éligibilité conserve l'ordre des refus : occasion déjà dépensée, rang manquant/capturé, homogénéité, filtre, maximalité, puis parent absent. Le wildcard ne dispense pas d'une fenêtre homogène. Le contrôle de maximalité examine les deux rangs adjacents persistants, en ignorant ceux déjà capturés.

Le passage visite les récepteurs dans l'ordre fourni. Une peinture peut rendre éligible un récepteur ultérieur du même passage. CAPTURE conserve les couleurs et marque les rangs ; PAINT conserve les identités et change la couleur ; PULSE conserve le train. Chaque tir ajoute son événement courant et sa position de tir. Les récepteurs dépensés et tirés sont triés selon l'ordre Unicode source dans le résultat.

Les visites répétées exigent leurs droits et certificats de terminaison. Les visites, refus et événements restent cumulés dans leur ordre réel. Atteindre la borne de passage sans passage de quiescence produit `BEAT_VISITATION_BOUND`, même si aucun résultat partiel ne doit être livré. Le port ne transforme pas cette interruption en fermeture complète.

Les normaliseurs appliquent les valeurs par défaut seulement aux champs absents ; `null` explicite reste distinct. Ils conservent les invariants des modèles et les coercitions scalaires JSON usuelles supportées ici, dont entier booléen/chaîne numérique et booléen 0/1. Les entiers hors du domaine sûr JavaScript, les objets Python et l'ensemble non borné des coercitions Pydantic restent hors de la promesse. Les classes et textes d'exception Python ne sont pas reproduits à l'identique.

## Couverture, énumération et budgets

La couverture exige exactement l'hypothèse d'ordre visuel et `one_use_for_run is True`. Les récepteurs sont traités dans l'ordre des cadres. Pour chaque cadre, les positions initiales sont essayées du premier au dernier rang ; seule la première fenêtre admissible est projetée. Les captures précédentes restent des trous fixes pour les cadres suivants.

Chaque appel de `coverage` construit un nouveau `RecolorWorkBudget` de **4 096 visites, 1 000 ms et domaine déclaré 4 096**. Ce même budget couvre tous ses récepteurs et tous les essais de rang. La vérification préalable d'éligibilité et le passage interne consomment chacun leur visite, comme la source. La couverture n'appelle pas `finish()`. Son horloge propre n'est pas remplacée par celle du scheduler natif.

Le succès signifie uniquement que tous les rangs visibles sont capturés par la projection conditionnelle. Les reçus conservent `conditional_static_coverage_not_observed_no_real_beat_inferred`. Ils n'acquièrent ni loi de capture, ni rail, ni cadence, ni réussite officielle.

Les configurations suivent exactement le produit des dimensions capacité, filtre puis sortie de chaque cadre, la dimension la plus à droite variant le plus vite. L'énumération native est paresseuse pour éviter la matérialisation inutile des produits intermédiaires, mais son ordre et son nombre sont identiques. Pour chaque configuration admissible, les éditions restent ordonnées : second champ, capacité, filtre, cadre par cadre. Le nombre d'appuis conserve le modulo positif et la première occurrence recherchée dans chaque domaine. Le coût reste `len(edits) + 1`.

La cardinalité est calculée en `BigInt` avant comparaison à la borne entière sûre déclarée. Pour les entiers sûrs, le résultat reste la paire source : candidats et `{truncated, domain}`. Lorsqu'un domaine dépasse `Number.MAX_SAFE_INTEGER`, il est nécessairement tronqué sous cette borne admise ; aucun plan n'est produit et le nombre exact est transporté en chaîne décimale avec `native_domain_format: 'exact_decimal_integer'`. Il n'est jamais remplacé par `Infinity`, une estimation ou un plafond arbitraire.

## Adaptation coopérative séparée

`plans` reste synchrone. `plansCooperative` utilise les mêmes dimensions, la même énumération et le même constructeur de candidat. Sans contexte d'exécution, il délègue au calcul synchrone. Avec un contexte courant, il vérifie l'annulation/deadline avant la recherche, entre les configurations et après la dernière couverture, et cède le contrôle toutes les 32 configurations terminées.

Une interruption de cette enveloppe retourne zéro candidat avec `truncated: true` et `native_search_incomplete`, contenant `reason` (`native_abort` ou `native_deadline`) et `frontier.completed_configurations`. Le préfixe déjà calculé ne devient pas une offre. Une exception du budget source `RecolorComputationInterrupted` continue de remonter : seule l'enveloppe native de la famille peut la qualifier comme refus courant. Aucun signal, délai ou diagnostic de scheduler ne devient un état source ou une réfutation apprise.

## Validation à produire

La validation nouvelle doit confronter les mesures, couvertures, plans, digests, normaliseurs et noyaux à l'original inchangé ; distinguer les adaptations natives ; couvrir les frontières exactes de budget, les rangs capturés, PAINT avant CAPTURE, parents de beat, refus ordonnés, configuration tronquée et cardinalité décimale exacte. Les preuves de raccordement, d'acquisition, de décision, de campagne, de coût et de publication restent séparées et ne sont pas établies par cette revue.

Le premier diagnostic indépendant de cette reconstruction a ensuite été lu dans `recovery/diagnostic/window-oracle/reference-01.tap` : **170 tests, 170 réussis, zéro échec, annulation, saut ou todo**. Il comprend notamment les contrats de produit ordonné, interruption coopérative sans plans partiels et deadline après dernière couverture. Ce reçu neuf ne remplace ni le gel ni les validations finales du candidat et n'est pas une reprise du compteur historique perdu.
