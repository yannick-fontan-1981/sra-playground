# Lot 3F : filiation de la population et de la référence observées

## Périmètre et dénominateurs

Le lot transfère la couche propre `reference_population_plan`, sixième branche déclarée d'`observed_composition_services`, dans `SharedSeriesConstraint`. Les originaux restent ceux du commit **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**. L'exporteur vérifie les empreintes des **1 786 fichiers originaux avant et après** ses appels, sans les modifier.

Le transfert comprend la mesure d'une population de carrés et de sa référence affichée, la revalidation de la projection retenue, les points de sélection, les chemins finis, l'appariement injectif, les sondages et déplacements conditionnels, les gardes, les observations locales, l'acquisition propre et sa restauration. Le calcul V5 consommé est limité à l'appariement augmentant et au pas cardinal d'un membre sélectionné, avec sa validation d'occupation et ses bornes de travail.

La classe originale hérite de Reception, RootedLine, Panel, Chamber, Exposed et d'autres couches dont le transfert reste partiel. Les oracles comparent la couche propre avec **un digest parent original explicitement opaque**. Ils ne certifient ni le digest hérité complet, ni la sélection complète de l'agent Python, ni un workflow V5 entier. Le raccordement testé des six branches et de l'enveloppe commune permet de compter l'entrée de registre comme raccordée : **6/6 branches et 51/76 entrées raccordées** sont des métriques de raccordement. Le module commun conserve `partial_transfer`, `fullV6Parity = false` et les autres réserves de parité héritée. Ces dénominateurs restent distincts des workflows compilés et des contrats intégralement transférés.

## Sources et cibles

| Source originale | Contrat consommé | Cible native | Portée |
| --- | --- | --- | --- |
| V6 `laya_proto/reference_population_access.py` | `scene`, `point`, suffixe propre de `input_candidates`, `paths`, `local_relations` | [v6-reference-population-observation.ts](../../src/logos-engine/v6-reference-population-observation.ts) | Projection fraîche et retenue, entrées propres et chemins finis |
| Même module V6 | `ReferencePopulationAccess` : proposition, gardes, acquisition, `apply_event` et suffixe de digest | [v6-reference-population-access.ts](../../src/logos-engine/v6-reference-population-access.ts) | Couche propre vérifiée ; digest parent à frontière opaque |
| V5 `capabilities/injective_matching.py` | `maximum_injective_matching` et ordre des visites | [v5-reference-population-calculus.ts](../../src/logos-engine/v5-reference-population-calculus.ts) | Témoin d'appariement maximal, sur le domaine portable consommé |
| V5 `capabilities/neighborhood_pattern_construction.py` | Modèles d'occurrence, d'état et d'entrée ; `_occupancy` ; seule branche `move` de `_physical` | Même module natif V5 | Mouvement cardinal conditionnel d'une identité active, collisions et occupation courante complète |
| V5 `capabilities/mechanical_family_contracts_d.py` | `DWorkBudget` : borne de nœuds, temps et compteur des visites | Même module natif V5 | Bornes consommées ; interruptions natives supplémentaires nommées séparément |
| V6 `laya_proto/common_observed_compositions.py` | Enveloppe des six branches, points liés, journal, propriété et restauration | [v6-shared-series.ts](../../src/logos-engine/v6-shared-series.ts) | Six branches propres raccordées ; héritage et appelant Python complet toujours partiels |
| V6 `morphology_policy/strategy.drm` | `reference_population_question`, raisons et rôles déclarés | Configuration source consommée par le propriétaire commun | Aucun nom de jeu, rôle fixe de couleur, commande directionnelle supposée ou trajet mémorisé |

La sélection cyclique, les entrées de point V5, la comparaison de motifs, la construction, la recherche de programmes et les lois complètes de voisinage ou de couleur de `neighborhood_pattern_construction.py` ne sont pas transférées par ce lot. Le fait d'exécuter son pas physique consommé ne permet pas de compter toute cette façade comme portée.

## Projection fraîche et projection retenue

La mesure fraîche cherche deux cadres disjoints de même couleur. L'un contient une grille rectangulaire complète de carrés uniformes de même taille ; l'autre contient des carrés homologues formant la référence. Le pas est la taille du carré plus une unité. Une séparation horizontale couvrant la largeur de l'image fournit une limite inférieure ; les cellules alignées au-dessus constituent le domaine de déplacement inféré. La population observée doit avoir exactement autant de membres que la référence. Les couleurs restent des apparences observées, et les cellules de la référence sont traduites dans le repère de la zone.

L'ordre des composantes, les égalités de fréquence du fond et l'ordre des permutations de cadres restent ceux de la source. Le renderer des tests fournit uniquement de petites images synthétiques satisfaisant ou réfutant cette grammaire ; il ne représente aucun moteur ni aucune solution de jeu.

La revalidation retenue relit chaque carré de l'ancien domaine. Elle accepte un carré uniforme ou un carré dont **un seul pixel différent correspond à un marqueur déjà observé**. Un carré non uniforme qui ne respecte pas la règle du marqueur appris n’est pas compté comme membre. La réutilisation échoue si le nombre de membres comptés diffère de la population retenue, ou si le rectangle de référence a changé. Une variation ailleurs, notamment sur une cellule vide ou dans le cadre retenu, ne provoque pas nécessairement un refus. Le digest porte sur tous les pixels de ce rectangle de référence, bordure comprise. Une variation d'apparence des membres peut rester admissible : la loi de couleur est encore inconnue.

**Limite conservée :** la revalidation ne reconstruit pas séparément le cadre de réception, son domaine ou ses cellules cibles. Elle reprend `zone_box`, `floor` et `target` de la scène retenue. Un coin de ce cadre modifié après la première action peut donc rester admis si la population et la référence satisfont encore les conditions retenues. Le cas `before:source_continuation_zone_corner_not_revalidated` conserve cette limite ; aucune garantie de revalidation complète du cadre à chaque continuation n'est revendiquée.

## Appariement et mouvement conditionnel

Les membres déjà sur une cellule cible sont retirés de la question d'affectation. Pour chaque membre restant, une recherche en largeur parcourt le domaine mesuré, avec les autres membres comme cellules occupées. Les commandes sont triées selon l'ordre source ; les destinations sont triées par longueur du chemin puis par coordonnées. Aucune direction ne provient du nom d'une commande.

Le calcul V5 fournit un appariement injectif maximal. Son callback visite chaque arête tentée, y compris les références répétées avant le test de visite. Les indices non affectés décrivent le témoin obtenu ; ils n'identifient pas nécessairement des membres intrinsèquement impossibles à affecter. Si l'appariement est complet, le calcul est répété avec des plafonds croissants sur les longueurs de chemins. Le premier plafond complet donne **un témoin minimisant la plus grande longueur de chemin dans les domaines courants**, sans revendiquer un ordonnancement global optimal de tous les membres.

Un membre actif avec destination affectée donne un préfixe de déplacement. Un membre actif dont une commande reste inconnue donne un sondage. Une sélection en attente donne un premier essai non ponctuel. À défaut, la proposition sélectionne un membre restant avec un point `ACTION6`. Le point constitue une expérience : l'identité contrôlée reste inconnue jusqu'à un déplacement effectivement observé.

Le sous-calcul physique V5 vérifie un domaine fini unique, les identités et cellules courantes uniques, l'appartenance au domaine, l'identité active, l'absence de terminaison officielle et un déplacement cardinal unitaire déclaré. Une destination occupée ou extérieure conserve toute la population. Le domaine natif portable exige une à 128 occurrences, des références non vides et des coordonnées entières sûres ; il n'imite pas toutes les coercitions Python. Les opérations de point, cycle et couleur de la façade V5 restent hors de cette cible native.

## Proposition, gardes et acquisition

L'état local d'une ancienne époque est abandonné lors de la proposition suivante. Les **contrôles globaux acquis survivent au changement d'époque**, conformément à la source ; seuls ceux dont la commande est disponible sont utilisés. Cette conservation ne constitue pas une preuve que la loi de déplacement reste universelle entre niveaux. Une projection retenue devenue invalide produit un refus bloquant, même si la question de politique vient d'être désactivée, car la source revalide avant de tester cette configuration.

Lorsque toutes les cellules cibles sont occupées, la proposition reste `unknown` avec `reference_occupancy_prepared_color_relation_or_terminal_unknown`. La couche ne transforme ni cette occupation ni les apparences locales en succès officiel.

La garde initiale lie l'identité du plan, les commandes du plan et du bundle, l'époque, le score, la disponibilité de la commande, le digest de l'image complète et la référence d'observation. Une continuation exige l'ensemble exact des cellules occupées attendu et la scène retenue revalidée. Elle conserve les limites de cadre et d'apparence décrites plus haut. Après action, une frontière d'époque ou de score ferme le préfixe. Une commande sans effet prévu ferme également le préfixe ; une projection prévue doit correspondre exactement à l'ensemble de cellules attendu.

L'acquisition propre nécessite un plan de cette couche, la même époque avant et après et deux scènes revalidées. Une frontière d'époque ne crée aucun événement propre. Une variation de score seule ferme le préfixe dans la garde mais n'empêche pas, à elle seule, l'acquisition du retour. Une sélection qui change exactement un pixel du membre visé acquiert ce marqueur pour les revalidations suivantes. Une sélection stationnaire peut établir `pending` sans marqueur ; elle ne confirme pas l'identité contrôlée.

Si exactement une cellule disparaît et une autre apparaît sous une commande sans point, un déplacement cardinal unitaire acquiert la commande et ses références d'observation, place l'identité active à la destination réellement observée et vérifie le pas physique V5 consommé. Un sondage conserve aussi la paire commande/cellule essayée. Chaque événement propre garde les masques de voisinage cardinal, leurs degrés et les apparences observées avec `observed_samples_only_no_complete_law`.

**Autre limite conservée :** un déplacement prévu qui ne produit aucun déplacement observé ferme le préfixe via la garde, mais la couche source ne supprime pas le contrôle déjà acquis. Le cas `record:planned_move_no_displacement_keeps_control` conserve cette absence de réfutation propre. Le transfert ne prétend donc pas réviser automatiquement toute loi de mouvement contrariée.

## Exceptions conservées et adaptations natives

| Comportement original constaté | Traitement et portée |
| --- | --- |
| Une image retenue trop courte en lignes ou en colonnes peut lever `IndexError` pendant la lecture des carrés. | Les deux exceptions figurent dans `sourceExceptions`. Le natif refuse aussi l'entrée par `RangeError` ; la classe et le message d'exception ne sont pas déclarés identiques entre langages. |
| Une sélection en attente avec aucune entrée non ponctuelle peut lever `IndexError`. | L'exception source est conservée. Le natif lève explicitement `RangeError`, sans inventer une commande de remplacement. |
| La proposition peut offrir `ACTION6` lorsque cette commande est indisponible. | Le résultat source est conservé ; la garde de disponibilité refuse ensuite l'action. Le suffixe de candidats de point, lui, n'est ajouté que si `ACTION6` est disponible. |
| La méthode propre ignore l'échéance et le nombre d'actions restantes ; les tranches Python acceptent aussi une limite nulle ou négative. | Les cas source sont conservés. L'enveloppe commune impose un budget positif, une échéance courante et un préfixe borné ; ces cas ne donnent pas permission d'agir hors budget au runtime. |
| Les chemins et appariements de proposition n'ont pas de budget propre dans la méthode originale. | L'option commune `native_reference_population_bounds` ajoute des bornes de domaine, de travail et d'échéance. Elle produit un refus `unknown` bloquant avec cause explicite, sans acquisition. L'API propre par défaut reste disponible pour les comparaisons exactes à la source. |
| La classe V5 accepte son domaine Python et ses erreurs de prérequis. | Le sous-calcul natif déclare son domaine JSON portable et ses erreurs propres. Les 19 cas source comparent les résultats, causes de refus et nombres de visites pertinents ; ils ne revendiquent pas toutes les conversions et erreurs Python. |

Les bornes natives supplémentaires ne modifient pas les résultats attendus de l'oracle. Les tests d'interruption et de budget les vérifient séparément. Les états et contrôles synthétiques qui servent à couvrir les branches des contrats ne sont jamais utilisés pour initialiser une campagne réelle.

## Propriétaire commun et restauration

| Opération | Ordre et propriété du périmètre transféré |
| --- | --- |
| Proposition et gardes | ReferencePopulation, Reception, RootedLine, Panel, Chamber, Exposed, puis ancêtres transférés |
| Candidats de point | Candidats hérités conservés, puis suffixe propre des membres de la population fraîche, avec liaison courante des points par l'enveloppe commune |
| Acquisition | Couches antérieures, Reception, ReferencePopulation, puis paquet public commun |
| Journal | Les seuls événements `observed_reference_population` appartiennent à cette mémoire propre |
| Digest | Suffixe propre après Reception, ajouté dans le propriétaire commun seulement après la première acquisition propre ; la classe originale ajoute son suffixe même à vide |
| Restauration | Réducteurs temporaires, validation de toutes les couches et publication atomique ; identité, révision et témoin structurel de la nouvelle mémoire participent au certificat commun |

Le suffixe conditionnel commun préserve les checkpoints antérieurs sans événement de cette couche. Le réducteur propre restaure les événements acquis dans leur ordre, y compris les contrôles, la scène retenue, les marqueurs, les états `pending` et `active` et leurs références. Il ne déduit pas de nouveaux contrôles pendant le restore. Une restauration refusée ne doit pas modifier le propriétaire courant ni les autres mémoires.

La source `common_observed_compositions.py` déclare six clés de plan, filtre un budget restant nul, exige une échéance courante et enveloppe les points avant leur exécution. Le raccordement complet de ces six branches ne supprime pas les réserves d'EphemeralMap, des fermetures héritées et du digest complet de l'appelant Python. Les tests communs et les checkpoints antérieurs sont des preuves supplémentaires de cette intégration, distinctes de l'oracle de composant décrit ici.

## Oracles indépendants et admission publique

Le [reçu d'export](lot3f-evidence/diagnostic/source-oracle-export.json) lie le [générateur](../../scripts/export-v6-reference-population-reference.py), la [fixture](../../tests/fixtures/v6-reference-population-reference.json.gz), les empreintes des sources et les contrôles des 1 786 originaux. Les résultats attendus proviennent des originaux Python inchangés ; aucun résultat natif ne sert à les fabriquer.

| Preuve | Contenu conservé |
| --- | --- |
| Cas propres | **89** : 30 scènes, 3 points, 4 suffixes d'entrées, 8 chemins, 4 relations locales, 20 propositions, 18 acquisitions et 2 rejeux d'événements |
| Gardes source | **24** : liaison initiale, commandes, disponibilité, époque, score, observation, référence, population, continuation, absence et divergence |
| Exceptions source explicites | **3** : deux images retenues tronquées et une sélection en attente sans entrée non ponctuelle |
| Appariement V5 | **10** cas, avec domaines vides, insuffisance de capacité, réaffectation, arêtes répétées, ordre des domaines et traces exactes des visites |
| Pas physique V5 consommé | **19** cas de déplacement, collision, sortie du domaine, terminaison, identité, cardinalité, loi manquante, occupation et bornes, avec les compteurs de travail |
| Projection publique initiale | **97** images déjà archivées ; **zéro action et zéro saut de niveau** ; CWSE, SK48 et FOGW exclus avant tout appel |

Les cas `record:common_cold_selection` et `record:common_cold_control` forment une chaîne propre depuis mémoire vide : chaque proposition utilise exactement l'observation ensuite passée comme entrée à l'acquisition, et le retour de sélection devient l'entrée du sondage suivant. Les événements attendus de cette chaîne proviennent du même objet source original, sans état natif ni contrôle préinstallé. Les autres graines synthétiques couvrent les branches indépendantes du contrat.

La taille et l'empreinte SHA-256 de la fixture comprimée déterministe figurent dans le reçu d'export. Les cas publics proviennent du corpus initial archivé, dont l'empreinte est également conservée dans le reçu d'admission.

Le [scan public](lot3f-evidence/diagnostic/reference-population-public-admission.json) trouve un seul cas admis par la projection originale parmi ces 97 images : **VOIS**. Cette admission est structurelle. Elle ne fournit ni proposition de l'appelant complet, ni solution, ni succès de niveau, ni résultat de campagne. Aucun moteur, spécification, route ou solution de jeu n'entre dans l'oracle. Le choix formel du cas, son horloge cumulative et toute exécution réelle relèvent des reçus de campagne séparés.

Les résultats de la validation commune, des anciens checkpoints, de la campagne réelle, du navigateur et des coûts doivent être lus dans les reçus de livraison correspondants. Aucun verdict de succès de jeu, de clôture du lot ou de coût global n'est déduit de cette filiation de composant.

## Rejeu froid du trajet public VOIS

Après le gel de la version native et la fin de la campagne autorisée, le [rejeu Python froid](lot3f-evidence/diagnostic/vois-public-source-replay.json.gz) relit uniquement les commandes et retours publics déjà capturés. Son [script générique](lot3f-evidence/diagnostic/replay-reference-population-public.py) exige un répertoire explicite ; il ne charge aucun jeu et n'a aucun cas par défaut. `ReferencePopulationAccess` part vide. Chaque proposition provient de l'original inchangé et chaque état suivant de ses propres acquisitions sur les retours réels. Le champ `state` d'une proposition native capturée ne sert jamais à amorcer la mémoire source.

L'observateur original reconstruit les **79 observations complètes** à partir des paquets publics et les compare aux captures Inventory. Les commandes, observations avant/après et résultats sont liés aux transitions scellées de la campagne. Seuls les champs documentés de l'enveloppe commune sont retirés pour comparer la proposition propre ; les champs propres, y compris son état, sont comparés intégralement après leur calcul indépendant.

**L'original inchangé concorde sur les 42 préfixes et les 78 retours**, sans exception ni différence. Il produit **75 événements propres**. Les trois retours de frontière, aux actions **14, 36 et 78**, restent des acquisitions vides conformément à la source ; ils ne sont ni omis du rejeu ni transformés en événements de population. Les gardes et leurs résultats capturés, les projections retenues, les événements, les contrôles et les états correspondent. Les **43 reconstructions propres** retrouvent les états et suffixes de digest attendus.

Le [checker natif indépendant](lot3f-evidence/diagnostic/check-reference-population-public-parity.mjs) repart également d'une mémoire propre vide, recalcule ses propositions et acquisitions et reconstruit sa mémoire après chaque préfixe. Son [reçu de comparaison](lot3f-evidence/diagnostic/vois-public-parity.json) passe **3 434 contrôles**, avec zéro échec. Les **1 786 originaux** sont vérifiés avant et après chacun des deux rejeux ; les fichiers natifs sont reliés au manifeste gelé de la campagne. Le [reçu d'exécution](lot3f-evidence/diagnostic/vois-public-replay-execution.json) conserve les commandes, codes de sortie, journaux et empreintes des scripts et résultats.

Cette preuve porte sur la trajectoire propre sélectionnée réellement exécutée. Le parent reste une frontière de digest opaque ; sa mémoire héritée complète n'est pas déclarée reconstruite. Les délais physiques et interruptions de recherche natives ne sont pas simulés dans ce rejeu déterministe d'un travail terminé. `completeSelectedOwnTrajectoryParity` vaut vrai et `fullInheritedCallerParity` reste faux. Le rejeu ajoute **zéro action de jeu**, ne mesure aucun coût global et ne déduit aucun succès supplémentaire.
