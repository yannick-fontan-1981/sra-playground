# Lot 3A : correction générique du coût, moteur 0.38.0

## Résultat fonctionnel et périmètre

**Logos Engine `0.38.0` conserve les trois premiers niveaux de RSWP, en 19 actions et 11 préfixes.** La correction reprend une optimisation exacte de V5 omise dans le port TypeScript, réduit les allocations de l'observateur V6 et réutilise des copies de diagnostic dont l'immutabilité profonde est vérifiée. Les décisions, propriétaires de connaissances et autorisations restent ceux du moteur commun.

La base fonctionnelle est la **publication 65**, commit `24c15cc5c147a8e2d639a6e0e3fe25bc632537f0`, moteur `0.37.0`. Le gel corrigé contient **245 fichiers natifs**, inventaire SHA-256 **`f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff`**. Le [manifeste](lot3a-cost-evidence/final/source-manifest.json) et l'[archive source](lot3a-cost-evidence/final/source-archive.json) identifient les octets vérifiés.

**Le coût du lot 3A est clôturé dans le périmètre annoncé : les 16/16 médianes agrégées respectent le budget +10 %, sans dépassement agrégé non résolu.** Les huit sessions de chaque jeu et version sont toutes conservées. La première cohorte passe 16/16 ; la seconde garde deux dépassements STCK, explicitement documentés. La décision finale était définie avant mesure sur l'ensemble des huit sessions, sans choix de cohorte ni hausse du seuil. Les quatre dépassements historiques de 0.37 restent intacts.

## Trois transformations bornées

### Comptage périodique repris de V5

La source V5 `capabilities/frame.py` possède déjà un comptage exact par identifiants de fragments horizontaux. Le port TypeScript reconstruisait et sérialisait encore chaque sous-matrice pour chaque paire d'axes candidate. La correction encode la palette, attribue des identifiants exacts aux fragments, puis compare des sous-chaînes de largeur fixe. Deux cellules de mêmes dimensions ont la même clé si et seulement si leurs pixels sont égaux.

Les axes, scores, ordres, choix de candidats et indicateur de troncature restent inchangés. Les tableaux d'encodage sont temporaires et propres à l'appel ; aucun cache de connaissance ni hypothèse de solution n'est ajouté. Huit attentes exportées des originaux V5 couvrent notamment **2 781 fragments distincts**, donc des identifiants sur deux octets, ainsi que les variations de palette, de motifs, de bordures et d'options. Les entrées non ordinaires conservent le chemin JSON antérieur.

### Parcours géométrique avec moins d'allocations

L'observateur utilise des offsets privés constants pour les quatre ou huit voisins et conserve provisoirement les indices linéaires des pixels. Il ne reconstruit les paires de coordonnées qu'au moment du masque final. L'ordre des visites, les lectures du raster, les composantes, masques, échelles, signatures et refus restent inchangés. Aucun résultat de perception n'est mémorisé par identité du raster.

### Copies de service réutilisées sous preuve d'immutabilité

Le service conserve une copie détachée et figée d'une proposition ou d'une entrée de trace seulement si toute sa structure ordinaire est profondément immuable. Les métadonnées courantes, la racine du snapshot et sa liste de traces restent fraîches. Les valeurs mutables, accesseurs et objets non ordinaires gardent la copie complète antérieure. Les tickets continuent de vérifier l'identité du graphe courant ; le transport worker copie toujours chaque réponse.

La [filiation de la correction](lot3a-cost-lineage.md) précise les sources, les producteurs et consommateurs, les replis, les limites des caches faibles et la qualification des identités internes d'objets.

## Réussite conservée et contribution

| Niveau terminé | Actions | Préfixes |
| --- | ---: | ---: |
| 1 | 3 | 3 |
| 2 | 8 | 4 |
| 3 | 8 | 4 |
| **Total** | **19** | **11** |

La [nouvelle exécution froide](lot3a-cost-evidence/final/rswp-regression/execution-rswp.json) arrive naturellement au niveau 4 en `NOT_FINISHED`. Le moteur acquiert les 19 transitions dans une seule session ; le protocole conserve un chargement initial, 19 avances et dix reprises. La [comparaison publique](lot3a-cost-evidence/final/rswp-regression/public-comparison-v2.json) vérifie exactement **19 commandes, 20 paquets publics et 221 images, animations comprises**, ainsi que les frontières, acquisitions, types de propositions et requêtes concernés.

L'égalité stricte des traces complètes reste fausse avec leur provenance de version distincte. L'égalité stricte des propositions conservées reste également fausse ; leurs références de session et de version sont conservées dans la comparaison. L'égalité des paquets et celle des champs métier annoncés sont vérifiées séparément, sans normaliser les commandes ni les pixels. La preuve causale de l'acquisition Panel reste celle du [lot 3A fonctionnel](lot3a-observed-panel.md) ; cette correction est une non-régression fonctionnelle, pas une nouvelle capacité de jeu revendiquée.

Au [navigateur](lot3a-cost-evidence/final/browser/rswp-verification.json), le résultat est de nouveau **19 actions, trois niveaux et 11 plans**. Pause est observée à zéro action, puis après le retour réel de la sixième action, avec reprise de la même session. Les compteurs aux frontières sont 3, 11 et 19 actions. Aucun reset, saut de niveau ou nouvelle session de raisonnement n'est utilisé. La [capture](lot3a-cost-evidence/final/browser/rswp-browser.png) conserve cet état final.

## Validation

| Contrôle | Résultat et portée |
| --- | --- |
| Tests du périmètre affecté | **964/964**, **26 fichiers**, aucun échec, skip ou annulation ; [reçu formel](lot3a-cost-evidence/final/validation/delta-tests-run.json) |
| Contrôles du projet | Typecheck, audits des entrées et de migration, contrôle du diff et build réussis ; [reçu](lot3a-cost-evidence/final/validation/checks-run.json) |
| Sources natives et tests | Inchangés pendant la validation ; mêmes octets natifs pour la campagne et le build |
| Diagnostic SMLP | 15 commandes, quatre états de propriétaires et champs annoncés des 24 requêtes identiques ; [contrôle limité](lot3a-cost-evidence/diagnostic/scoped-behavior.json) |
| Profils | Avant/après conservés intégralement, avec leurs limites et la hausse de restauration du diagnostic ; [résultats](lot3a-cost-evidence/diagnostic/results.md) |

Le diagnostic localise un travail retiré ; ses temps instrumentés ne valident pas le budget. La validation formelle couvre les contrats modifiés et leurs intégrations concernées, sans être présentée comme l'ensemble de la suite historique.

## Coût officiel et suite

Le [protocole déclaré](lot3a-cost-evidence/performance/protocol.md) fixe huit sessions par jeu et par version, en deux cohortes de quatre dans l'ordre A1, B1, B2, A2. A désigne une référence **0.36.0 fraîche**, B cette correction 0.38 gelée. Les mêmes seize médianes STCK10/SMLP15 sont soumises au seuil **+10 %**. Les chauffes annoncées restent seules exclues ; les données 0.37 restent historiques et distinctes.

La [comparaison agrégée](lot3a-cost-evidence/performance/combined-comparison.json) est `passed`, avec **16/16 critères conformes** et `unresolved: []`. Les [résultats complets](lot3a-cost-evidence/performance/results.md) conservent les effectifs, dispersions, p95 et résultats des deux cohortes.

| Phase | STCK, variation de médiane | SMLP, variation de médiane |
| --- | ---: | ---: |
| Session complète | +0,851 % | **−28,209 %** |
| Nouvelle décision | −3,569 % | **−13,941 %** |
| Service de continuation | **−10,649 %** | **−16,386 %** |
| Requête de continuation avec transport | −9,004 % | −15,724 % |
| Garde de continuation | −0,367 % | −5,751 % |
| Acquisition et persistance | **+6,050 %** | −45,700 % |
| Persistance | −4,220 % | −1,649 % |
| Restauration | −11,325 % | −5,709 % |

La session SMLP passe de **24,218 s à 17,387 s** ; STCK passe de **10,874 s à 10,966 s**. La hausse agrégée maximale est celle de l'acquisition/persistance STCK, **+6,050 %**, sous le seuil. Les deux dépassements de la seconde cohorte restent visibles : acquisition/persistance STCK **+11,028 %**, persistance STCK **+13,234 %**. Ils ne sont pas retirés du bilan. Les hausses de p95 STCK restent aussi conservées ; le p95 n'était pas un critère budgété supplémentaire.

Les diagnostics Pause et inspection restent séparés des seize critères. Sur STCK, l'attente jusqu'à une frontière sûre augmente d'environ 0,1 seconde, et le total d'inspection passe de 326,754 à 330,878 ms. Ces résultats ne sont pas présentés comme une amélioration uniforme de toutes les latences.

Ces résultats valident le budget observé annoncé sur STCK10/SMLP15. Ils ne prouvent ni la stabilité sur plusieurs heures, ni une latence identique sur toutes les machines, ni la parité globale V5/V6. Aucune mesure supplémentaire n'a été choisie après examen des résultats.

Le registre reste **50/76 entrées raccordées**, avec `observed_composition_services` explicitement partielle, **une branche sur six**, et **37 workflows compilés**. **3A est clôturé dans son périmètre fonctionnel et de coût ; le lot 3 complet reste ouvert.** La prochaine étape est **3B, `chamber_relation_plan`**, avec les fonctions relationnelles V5 effectivement consommées. Le candidat CATR reprend **107,399326 secondes** déjà cumulées. La [feuille de route](v6-delivery-roadmap.md) conserve les onze lots, les sous-lots 2A/2B/2C et la séparation entre raccordement, validation de composants et parité globale.
