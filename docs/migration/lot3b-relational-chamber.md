# Lot 3B : chambre relationnelle, moteur 0.39.0

## État vérifié et périmètre

**Le fonctionnel de 3B est validé : CATR réussit ses trois premiers niveaux en 12 actions et huit préfixes, dans une seule session.** Le transfert générique de `chamber_relation_plan` est gelé ; la validation formelle passe **1 077 tests sur 1 077**, dans **29 fichiers**, et la preuve de contribution est réussie. Le navigateur confirme le même résultat. Le rejeu RSWP conserve sa trajectoire publique ; son contrôle strict reste à **16/17, en échec**, avec une extension de compteur vide qualifiée séparément. **Le coût officiel ne valide pas le budget : 15/16 critères agrégés sont conformes, avec une hausse de restauration STCK de +18,686 %.** Le fonctionnel est livrable avec cette réserve ; **le sous-lot 3B reste ouvert**.

La base est la **publication 66**, moteur **`0.38.0`**, commit `b5d95c59bda43e5a5ee83dd067a0f28767205ab0`. Le nouveau moteur **`logos-engine.typescript.v6.native-migration/0.39.0`** est identifié par le [manifeste gelé](lot3b-evidence/final/source-manifest.json) de **248 fichiers natifs**, digest SHA-256 **`49648e72cf7d3d719addfe4a6bebd8c29842a0f618664a45ef3929a5d17132b1`**. Son [archive source](lot3b-evidence/final/source-archive.json) conserve les entrées vérifiées.

Le sous-lot reprend les observations et mécanismes V5/V6 existants. Les décisions utilisent le raster public courant, les commandes disponibles, les cibles mesurées, les tables acquises et leurs contre-exemples. Aucun identifiant de jeu, niveau préparé, rôle de couleur imposé ou parcours enregistré ne détermine une décision de production.

## Sources reprises et comportement obtenu

Les originaux sont ceux du commit **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**, conservés sans modification. La [filiation détaillée](lot3b-relational-chamber-lineage.md) décrit les contrats, producteurs, consommateurs et limites.

| Source | Réutilisation dans le moteur commun |
| --- | --- |
| V5 `capabilities/finite_relation_network.py` | `_network_domain` et `_indexed_combination` énumèrent les affectations compatibles avec les relations connues et les lignes encore inconnues, dans l'ordre et les budgets source. |
| V6 `laya_proto/relational_chamber_projection.py` | Mesure les chambres, corps, cibles, axes, commandes par paire et points de clic à partir de leur géométrie et des couleurs observées. |
| V6 `laya_proto/relational_chamber_access.py` | Apprend les tables, conserve les contradictions, choisit une expérience ou une contribution conditionnelle et revalide chaque action. |
| V6 `laya_proto/common_observed_compositions.py` | Fournit l'enveloppe commune, les supports de points, le budget d'actions et les règles de continuation. |
| V6 `morphology_policy/strategy.drm` | Conserve le rang de l'entrée, les motifs des questions et les bornes de la recherche. |

Une ligne observée relie un tuple ordonné de valeurs de commandes à la valeur d'un axe, dans un contexte déterminé. Une confirmation ajoute son témoin ; une contradiction conserve l'ancien fait et le retour contraire. Les contextes actuellement contredits bloquent une nouvelle contribution. Une ligne absente d'un modèle partiel reste inconnue ; elle ne devient pas une relation physique supposée.

Le noyau V5 recherche une affectation compatible avec les cibles courantes. Le classement conserve le nombre de lignes inconnues, le nombre de commandes à changer, puis l'ordre des références. Un changement de commande non encore confirmé ou une projection inconnue limite le préfixe à une expérience. Une transition déjà acquise et une projection connue permettent une continuation conditionnelle, sous garde après chaque retour réel.

La configuration source limite la chambre à **douze variables binaires**, **4 096 affectations énumérées** et **65 536 vérifications de relation**. Les limites d'états et de vérifications, les conditions de table complète ou partielle, le partage d'une même ligne inconnue déterministe et les offsets sont conservés. Le module natif refuse explicitement les indices, budgets ou produits de domaines hors des entiers sûrs JavaScript. Ce refus ne restreint pas le domaine consommé ici, limité à 4 096 combinaisons.

La géométrie du cadre et les cibles restent des **hypothèses de bibliothèque**. Le moteur ne reçoit pas une formule de force ni une loi terminale du jeu. Le transfert ne comprend pas toute la façade V5 du réseau fini : propagation, discrimination, compilation et autres opérations non consommées conservent leur statut ouvert.

## Propriétaire, gardes et conservation

`RelationalChamberMemory` est une couche du propriétaire existant **`SharedSeriesConstraint`**, dans la famille `public_occurrence_recall`. Elle conserve `relation_memory` et `relation_events`. Le journal commun acquiert chaque transition une seule fois et route l'événement `observed_chamber_relations` vers cette couche.

Les ordres source sont conservés : **Panel puis Chamber** pour proposer et vérifier ; **ancêtres puis Chamber puis Panel** pour acquérir et composer les digests détenus. Les points mesurés sont ajoutés dans l'ordre Chamber puis Panel. Une enveloppe mêlant des plans ne contourne pas la priorité de son ancêtre.

La garde vérifie l'identité du plan et ses commandes, la portée, le contrôle disponible, la scène, les pixels et la référence d'observation. Une continuation exige la projection précédente attendue et le même support courant. Une frontière de niveau ferme la comparaison de portée et ne sert pas de preuve d'une loi de commande.

La restauration reconstruit toutes les couches avant de remplacer l'état courant. Les anciens checkpoints restent compatibles : une nouvelle couche n'entre dans le digest natif qu'après son premier événement. Le certificat vérifie l'identité, la révision et le témoin structurel de la couche ; une mutation directe invalide sa réutilisation. Cette enveloppe de migration native ne revendique pas l'identité du graphe privé complet de la hiérarchie Python.

Les centres et le quantum sont calculés comme des flottants Python, même lorsqu'ils valent des entiers. Un encodage typé local préserve leurs écritures `25.0` ou `3.0` dans les identités de scène et de plan. Le digest générique partagé reste inchangé ; les attentes originales ne sont pas normalisées pour masquer cette distinction.

## Validation formelle

| Contrôle | Résultat et portée |
| --- | --- |
| Noyau V5 | **43 tests** : parité du sous-ensemble consommé, ordres, relations partielles, déterminisme, contraintes, offsets et budgets. |
| Couche Chamber V6 | **58 tests** : 35 cas propres, 18 gardes, six enveloppes communes et comparaison des 100 rasters initiaux publics archivés. |
| Intégration de la couche | **12 tests** : enveloppe source, priorités, acquisition unique, journal, anciens checkpoints, certification et restauration atomique. |
| Delta formel complet | **1 077/1 077 tests**, **29 fichiers**, aucun échec, skip ou annulation ; [périmètre](lot3b-evidence/final/release-scope.json), [reçu](lot3b-evidence/final/validation/delta-tests-run.json). |
| Contrôles du projet | Typecheck, audits des entrées et de migration, contrôle du diff et build réussis ; [reçu](lot3b-evidence/final/validation/checks-run.json). |
| Sources de référence | Les **1 786 fichiers originaux** sont vérifiés avant et après les exports de parité. |

Le delta couvre les contrats modifiés et leurs intégrations concernées. Il n'est pas présenté comme l'ensemble de la suite historique. Les rasters modifiés et mémoires préparées des fixtures sont des **contrats synthétiques de composant**, jamais des niveaux de jeu réussis. Les exporteurs n'exécutent aucun jeu, aucune action physique et ne lisent aucune source de jeu, spécification, solution ou oracle.

## Référence CATR et horloge conservée

La [sélection](lot3b-evidence/candidate-selection.json) repose sur l'admission de la scène publique initiale par la projection source. Elle reprend **107,399326 secondes** déjà cumulées sur CATR. Le temps de préparation, diagnostic et nouvel essai depuis la sélection du **10 novembre 2026 à 00:06:23 UTC** s'ajoute à ce compteur. La limite de quarante minutes correspond à **00:44:35,600674 UTC** ; elle ne peut pas être remise à zéro.

La [référence froide 0.38](lot3b-evidence/baseline/catr-reference/summary.json) s'arrête naturellement après **une action acquise, un préfixe et aucun niveau réussi**, au niveau 1 avec `frontier_unknown`. Le processus dure **6,283 secondes**, dont **2,206 secondes actives** rapportées par l'appelant. Ni la limite d'actions ni le watchdog ne sont atteints. Rapport, trace et journal public sont conservés ; ce résultat reste un échec de l'objectif de trois niveaux.

## Nouvelle réussite CATR et contribution observée

La [campagne froide corrigée](lot3b-evidence/final/catr-session/execution-catr.json) utilise le moteur gelé, l'hôte de jeu opaque et le chemin commun. Elle termine les trois premiers niveaux sans état appris importé, action attendue, solution, reset ni saut de niveau fourni au moteur.

| Niveau terminé | Actions du niveau | Préfixes du niveau | Actions cumulées |
| --- | ---: | ---: | ---: |
| 1 | 3 | 2 | 3 |
| 2 | 4 | 3 | 7 |
| 3 | 5 | 3 | 12 |
| **Total** | **12** | **8** | **12** |

L'arrivée au niveau 4 est naturelle et l'état reste **`NOT_FINISHED`** : trois niveaux sont réussis, sans revendication d'une victoire complète. Les **douze transitions sont acquises dans une session**, avec un chargement initial, douze avances, sept reprises et deux réconciliations de frontière avant continuation. Le temps actif rapporté est **12,805 secondes** ; cette durée de campagne n'est pas un ratio de performance officiel.

La campagne termine le **10 novembre 2026 à 00:21:46,292401 UTC**. Avec les **107,399326 secondes** antérieures et toute la préparation depuis la sélection, l'horloge atteint **1 030,691727 secondes**, environ **17 min 10,7 s**. La sélection réussit donc avant la limite de quarante minutes, sans changement de jeu ni remise à zéro du compteur.

La [preuve de contribution](lot3b-evidence/final/catr-session/chamber-contribution.json) reconstruit **les huit plans sélectionnés et les douze acquisitions** depuis les seuls événements antérieurs de la couche, en repartant d'une mémoire vide. Les commandes et plans propres sont exactement reproduits. La restauration de la couche est vérifiée aux huit décisions ; les admissions et retours sont recalculés et identifiés comme contrôles de composant.

La mémoire finale conserve **deux contextes, six lignes observées, deux transitions de commande et trois frontières**. Des ablations pures, appliquées uniquement aux champs de tables ou de transitions acquis dans les contextes de décision réels, produisent **24 résultats conservés**. Huit changent une commande ou un refus ; quatorze changent la projection de décision et dix la laissent inchangée. Les résultats négatifs restent au bilan. Ces ablations établissent une contribution aux décisions concernées, sans prouver la nécessité de chaque action ni une seconde campagne contrefactuelle réussie.

## Vérification indépendante au navigateur

Le [reçu navigateur](lot3b-evidence/final/browser/browser-verification.json) confirme **12 actions, trois niveaux et huit plans**, avec arrivée naturelle au niveau 4, dans la même session de raisonnement. L'inspection reste fermée ; aucune action manuelle sur le jeu, aucun reset, saut de niveau ou remplacement de session n'est utilisé. La [capture finale](lot3b-evidence/final/browser/catr-browser.png) conserve l'état observé.

| Séquence observée | État constaté |
| --- | --- |
| Run puis Pause au départ | `Paused`, zéro action |
| Deux actions unitaires | Une puis deux actions acquises ; préfixe conservé partiellement exécuté |
| Run puis Pause | Frontière naturelle à trois actions, un niveau ; l'écran affiche `Level completed`, sans revendication d'un état `Paused` à cette frontière |
| Une action unitaire, puis Run/Pause | Quatre actions, puis `Paused` à **cinq actions, un niveau et trois plans** |
| Reprise | Frontière à **sept actions, deux niveaux et cinq plans** |
| Dernière reprise | Frontière à **douze actions, trois niveaux et huit plans** |

Cette séquence vérifie la reprise du préfixe et de la session à travers les frontières. Elle ne mesure pas une préemption arbitraire de recherche ni le budget de latence.

## RSWP : trajectoire conservée, extension d'observation qualifiée

Le rejeu froid utilise les retours publics archivés de 0.38 et recalcule chaque commande avant de recevoir son paquet. Il conserve **19 actions, trois niveaux, onze préfixes et une session**. Les **19 commandes, 20 paquets publics complets et 221 images, animations comprises**, ainsi que les frontières et compteurs hérités concernés, restent identiques dans le périmètre comparé.

Le [résumé strict](lot3b-evidence/final/regressions/strict-regression-summary.json) conserve néanmoins son statut **`failed`, 16 contrôles sur 17 réussis**. Le seul écart est l'ajout du champ `chamberRelationEventCount` dans les compteurs d'événements. Le résumé a seulement été renommé, avec ses octets et son échec préservés par le [reçu de déplacement](lot3b-evidence/final/regressions/strict-summary-relocation.json). Aucun résultat 17/17 n'est revendiqué.

La [qualification séparée de l'extension vide](lot3b-evidence/final/regressions/empty-series-extension-qualification.json), de statut `passed`, reproduit les contrôles stricts inchangés et examine chacun des **onze préfixes** : le nouveau compteur est un entier égal à zéro, la nouvelle liste d'événements acquis est exactement vide, aucun plan ni capture Chamber n'est présent, et tous les compteurs hérités sont égaux après projection de ce seul ajout déclaré. Cette qualification ne modifie ni le comparateur historique ni ses résultats.

Ce contrôle établit une conservation fonctionnelle publique avec extension d'observation explicitement vide. Il ne revendique pas l'identité du rapport entier, des propositions, des états privés ou du graphe, et il ne constitue pas une nouvelle réussite live ni une mesure de vitesse.

## Coût officiel : réserve de restauration STCK

Le [protocole préalable](lot3b-evidence/performance/protocol.md), déclaré avant mesure, compare **0.38.0 fraîche** à **0.39.0 gelée** sur STCK10 et SMLP15. Les deux cohortes de quatre sessions par jeu/version sont exécutées dans l'ordre **A1, B1, B2, A2**, soit huit sessions par jeu/version et **32 sessions mesurées** au total. Les trois actions de chaque chauffe restent les seules exclusions annoncées ; aucune session mesurée ni cohorte défavorable n'est retirée.

**La [comparaison agrégée](lot3b-evidence/performance/combined-comparison.json) conserve le statut `budget_review_required` : 15/16 médianes respectent le seuil +10 %, une reste non résolue.** Le budget n'est donc pas validé. La baisse du temps total de session ne compense pas le dépassement d'une phase locale.

| Phase | STCK, médiane 0.38 → 0.39 | Variation | SMLP, médiane 0.38 → 0.39 | Variation |
| --- | ---: | ---: | ---: | ---: |
| Session complète | 11 001,673 → 10 953,022 ms | −0,442 % | 18 275,983 → 18 112,458 ms | −0,895 % |
| Nouvelle décision | 302,175 → 291,009 ms | −3,695 % | 386,507 → 392,281 ms | +1,494 % |
| Service de continuation | 8,704 → 8,243 ms | −5,293 % | 9,660 → 9,366 ms | −3,050 % |
| Requête de continuation | 10,380 → 10,176 ms | −1,965 % | 11,993 → 11,983 ms | −0,090 % |
| Garde de continuation | 0,221 → 0,217 ms | −1,756 % | 0,353 → 0,340 ms | −3,744 % |
| Acquisition et persistance | 975,618 → 979,262 ms | +0,373 % | 979,026 → 935,763 ms | −4,419 % |
| Persistance | 174,755 → 182,823 ms | +4,617 % | 146,039 → 146,091 ms | +0,036 % |
| **Restauration** | **9,104383 → 10,805602 ms** | **+18,686 %, hors budget** | 4,858142 → 4,860754 ms | +0,054 % |

La restauration STCK comprend **96 échantillons par version**. Sa médiane augmente de **1,701219 ms**, soit **+18,685719834 %**. La [première cohorte](lot3b-evidence/performance/cohort1/comparison.json) conserve **15/16**, avec la restauration **9,104383 → 11,093095 ms, +21,843 %**. La [seconde cohorte](lot3b-evidence/performance/cohort2/comparison.json) passe **16/16**, avec la restauration **9,743807 → 8,843511 ms, −9,240 %**. Le résultat favorable de la seconde ne remplace pas l'agrégat préannoncé.

La dispersion ne supprime pas le dépassement et n'augmente pas la tolérance. Le p95 de restauration STCK passe de **64,059772 à 63,913278 ms**. Celui de SMLP augmente de **22,611702 à 29,389767 ms**, environ **+29,98 %**, malgré sa médiane proche de la référence. Le p95 n'était pas un critère budgété supplémentaire ; cette hausse reste une limite observée. Les [résultats complets](lot3b-evidence/performance/results.md) conservent les effectifs, distributions, hausses, contrôles de Pause/inspection et qualifications de la mesure.

Les phases imbriquées ne s'additionnent pas. Le temps de jeu, le rendu navigateur, l'inspection après rejeu et les diagnostics de Pause gardent leurs périmètres distincts. Ces sessions finies ne démontrent pas une stabilité de plusieurs heures. **La cause de la hausse de restauration n'est pas établie ici.** Aucun diagnostic causal résolu, effet attribué avec certitude à la nouvelle couche ou écart rejeté comme simple bruit n'est revendiqué.

## Index et intégrité de livraison

L'[index de preuves](lot3b-evidence/final/campaign-evidence-index.json) lie les artefacts de source, validation, campagne, contribution, navigateur, régression stricte, qualification séparée et coût. Le [reçu d'intégrité](lot3b-evidence/final/delivery-integrity.json) doit être produit après finalisation de ces preuves, par vérification des inventaires et reconstruction des archives. Son statut postérieur fait foi pour ce contrôle ; le présent rapport ne le présume pas réussi. L'intégrité ne transforme ni le coût 15/16 ni la régression stricte 16/17 en succès complets.

## Couverture et suite

Le raccord porte `observed_composition_services` à **deux branches sur six**, Panel et Chamber. Le compteur d'entrées complètes reste **50/76** ; les **37 workflows compilés** ne deviennent pas une parité globale. L'audit courant recense **153 composants vérifiés**, **133 transferts partiels** et **1 083 éléments en attente**. Aucun élément n'est déclaré `fully_transferred`, et les six conditions de migration complète restent fausses.

Le lot 3 reste ouvert. **La prochaine étape prioritaire est la correction générique du coût de restauration de 3B** : diagnostiquer le chemin commun de restauration, puis optimiser avec des contrôles complets d’identité, révision et invalidation, en conservant les gardes, acquisitions et restaurations. La correction exigera un nouveau gel, un nouveau protocole et une validation fonctionnelle et de coût **contre une référence 0.38 fraîche**, pour résoudre le dépassement actuel. Le seuil reste inchangé ; aucune mesure supplémentaire ad hoc de la même 0.39 ne remplace son échec. **3C, `exposed_reception_plan`, vient après cette clôture**, avec reprise des effets mesurés et de l'expansion conditionnelle V5. Les quatre branches encore ouvertes sont `exposed_reception_plan`, `rooted_line_plan`, `reception_service_plan` et `reference_population_plan`. Les trois autres entrées du lot 3 et les lots 4 à 11 restent dans la [feuille de route](v6-delivery-roadmap.md).
