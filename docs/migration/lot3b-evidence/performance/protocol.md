# Lot 3B : protocole préalable de coût

Déclaré le **10/11/2026 à 00:08:40 UTC**, avant toute mesure officielle du lot 3B.

## Objet et références

Vérifier l’intégration générique **Logos Engine 0.39.0** contre une référence **0.38.0 fraîchement mesurée**, avec les mêmes seize critères et le même budget **+10 %** que pour le lot 3A. La référence est la publication **66**, commit `b5d95c59bda43e5a5ee83dd067a0f28767205ab0`, inventaire natif de **245 fichiers**, digest `f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff`.

L’intégration doit être gelée avant le début de la fenêtre officielle. Son manifeste, son archive et son digest seront conservés avec les preuves de livraison. La fenêtre enregistrera le digest de chaque version, les commandes, les chemins, les débuts et fins d'exécution, les codes de sortie et les empreintes des rapports. Le `gitHead` d'un rapport indique la base Git ; le manifeste natif identifie les octets réellement mesurés.

Le [bilan précédent 0.38](../../lot3a-cost-evidence/performance/combined-comparison.json), ses deux cohortes et leurs résultats restent inchangés. Aucun échantillon historique n’est mélangé aux nouvelles mesures. Une réussite du lot 3B ne requalifie pas un résultat historique.

## Effectif et ordre fixés avant mesure

Deux cohortes de **quatre sessions mesurées par jeu et par version** sont prévues dès maintenant. Les quatre exécutions se suivent dans cet ordre, sans chevauchement :

| Ordre | Exécution | Version | Sessions mesurées par jeu |
| --- | --- | --- | ---: |
| 1 | A1, référence de la cohorte 1 | 0.38.0 | 4 |
| 2 | B1, correction de la cohorte 1 | 0.39.0 gelée | 4 |
| 3 | B2, correction de la cohorte 2 | Même 0.39.0 gelée | 4 |
| 4 | A2, référence de la cohorte 2 | Même 0.38.0 | 4 |

Chaque exécution utilise le même [manifest des cas](cases.json), dans l'ordre **STCK puis SMLP**. L'ordre A1, B1, B2, A2 est fixé pour limiter une dérive temporelle simple ; il n'établit pas l'identité des conditions de GC, de JIT ou d'ordonnancement.

Les deux cohortes sont exécutées quelle que soit l'issue de la première comparaison. Le bilan final regroupe **toutes les huit sessions par jeu et par version** : **32 sessions mesurées au total**, soit **200 actions mesurées par version** et **400 pour les deux versions**. Aucun suivi supplémentaire ne sera choisi en fonction des résultats pour obtenir une comparaison favorable. Un changement ultérieur de code constituerait une nouvelle révision, avec un nouveau gel et un nouveau protocole.

## Travail et chauffe

| Cas | Actions par session mesurée | Niveaux visés | Chauffe préalable par exécution du cas |
| --- | ---: | ---: | --- |
| STCK | 10 | 3 | Une session de **3 actions** |
| SMLP | 15 | 3 | Une session de **3 actions** |

`warmupActions: 3` signifie **trois actions dans une unique session de chauffe**, pas trois sessions. Le runner crée un worker Node séparé pour chaque cas de chaque exécution. Ce worker sert la chauffe puis les quatre sessions mesurées ; chaque session reçoit un nouveau runtime et une mémoire de connaissances froide. Le processus et le JIT ne sont donc pas redémarrés entre toutes les sessions d'un même cas.

Les seules exclusions sont les chauffes annoncées : deux sessions de chauffe par jeu et par version sur les deux cohortes. Aucun échantillon mesuré, session défavorable ou valeur extrême ne sera retiré. Les traces publiques, leurs empreintes, le nombre d'actions, les niveaux visés et les trois actions de chauffe sont ceux des contrôles du lot 3A. Aucun état appris n'est importé. Le moteur calcule ses commandes ; le rejeu ne retourne le paquet public enregistré qu'après avoir vérifié que la commande calculée correspond.

## Mesures et règle de décision

Le runner `scripts/measure-native-loop-costs.mjs` et le comparateur `scripts/compare-native-loop-costs.mjs` restent inchangés. Le [fichier de politique](comparison-policy.json) conserve huit phases pour chacun des deux jeux :

1. `session_elapsed` : durée du rejeu complet par le contrôleur.
2. `new_decision` : appel natif à `plan`.
3. `known_prefix_service` : traitement complet d'une requête `advance` retournant une autre action du préfixe.
4. `known_prefix_request` : même requête, avec transport worker et ordonnancement jusqu'à son acceptation.
5. `known_prefix_guard` : appel à `authorize` lorsque l'index du préfixe est supérieur à zéro.
6. `acquisition_and_persistence` : appel à `seal`.
7. `persistence` : appel à `persistFamilies`.
8. `restoration` : appel à `restoreFamilies` ; les autres restaurations restent comprises dans leurs phases englobantes.

Les phases sont imbriquées ; leurs durées ne s'additionnent pas. L'instrumentation observe les appels sans changer leurs arguments, résultats ou ordre d'acquisition. Un changement d'effectifs, de placement des phases ou de travail doit être examiné, sans suppression d'échantillons pour obtenir l'égalité.

Chaque cohorte produit sa propre comparaison conservée. Puis `scripts/compare-native-cost-cohorts.mjs` reproduit exactement ses distributions, médianes, p95, dispersions et classifications avant d'agréger **tous les échantillons mesurés des deux cohortes**. L'agrégateur vérifie les manifestes, le runner, les entrées, l'environnement et les métadonnées du travail réel. Aucune moyenne de ratios de cohortes ne remplace les distributions réunies.

Pour chaque phase et chaque jeu, la variation est `médiane_après / médiane_avant - 1`. La clôture du budget exige **16/16 médianes au plus à +10 %**, un statut final `passed` et une liste `unresolved` vide. Un dépassement avec une dispersion élevée reste non résolu ; **le bruit n'ajoute aucune tolérance au seuil**. Une baisse de durée de session ne compense pas un dépassement local.

La médiane utilise la valeur centrale, ou la moyenne des deux valeurs centrales pour un effectif pair. Le p95 est le rang empirique `ceil(0.95 × n)` dans la liste ordonnée et reste absent lorsque **n < 20**. Les huit durées de session par version n'ont donc pas de p95 publié. Les phases ayant au moins vingt échantillons en ont un, avec la réserve que les observations d'une même session sont corrélées. Le p95 n'est pas un critère budgété supplémentaire. L'étendue relative des médianes par session décrit la dispersion observée, sans constituer un intervalle de confiance.

## Isolation et conservation

Tous les tests, profils, exports de source, builds, campagnes de jeu et contrôles navigateur doivent être terminés avant la fenêtre officielle. Aucun de ces travaux ne s'exécute en parallèle des mesures. Les quatre exécutions sont séquentielles ; seules une lecture légère ou la rédaction documentaire peuvent continuer. Les sources natives, le runner, les déclarations et les cas restent inchangés pendant toute la fenêtre.

Les mêmes octets du manifest et de la politique sont disponibles aux mêmes chemins relatifs dans les deux checkouts. Les rapports de référence sont recopiés sans modification dans le dossier de livraison pour la comparaison. Toutes les sorties, réussies ou en échec, sont conservées avec leur statut ; aucun rapport incomplet ne devient une cohorte complète. La mesure ne commence qu'après le feu vert du responsable de la livraison.

## Contrôles fonctionnels distincts

Le lot 3B doit montrer la contribution réelle de `chamber_relation_plan`, avec apprentissage des tables depuis des retours publics, maintien ou révision de la décision suivante, contradiction et refus, gardes de continuation, acquisition unique et restauration. Le candidat CATR reprend son horloge antérieure, conformément au [reçu de sélection](../candidate-selection.json). Une campagne froide vise au moins trois niveaux ; un échec reste un échec et la limite cumulée de 40 minutes impose de changer de jeu. La campagne RSWP de référence conserve son rôle de non-régression : trois niveaux, 19 actions, 11 préfixes et une session, avec comparaison de toutes les commandes et paquets publics. Tests de contrat, contribution, vérification navigateur et coût du chemin modifié restent distincts du présent budget STCK/SMLP.

Les durées ici mesurées excluent l'exécution du moteur de jeu, le réseau de production et le rendu du navigateur. L'inspection est déclenchée après chaque rejeu et reste hors des durées de rejeu. Pause vérifie l'accusé de réception du contrôleur et l'arrivée à une frontière sûre pendant la planification initiale et la première action engagée ; elle ne prouve pas une préemption arbitraire de toute recherche. Huit sessions finies par jeu et par version ne prouvent pas la stabilité de sessions de plusieurs heures.
