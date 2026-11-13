# Lot 2C : clôture du contrôle de coût

## Base et portée

Cette étape reprend la publication **63**, commit `1193377f1d574451740a7409a4102833ef868310`, moteur natif `0.35.0`. Cette version a livré les méthodes et la continuation morphologiques, avec trois niveaux LS20 réussis, mais son contrôle de coût reste historiquement non conforme : 14/16 médianes initiales dans le budget, puis cinq dépassements STCK sur huit au suivi frais. Les [résultats antérieurs](lot2c-evidence/performance/results.md) restent intacts.

Le candidat `logos-engine.typescript.v6.native-migration/0.36.0` est gelé sur **242 fichiers natifs**, digest **`ac7225dd2e5f51551881f0c1d5eba284c64c2f019b08f00e572900319e89255b`**. Son [archive de source](lot2c-cost-evidence/final/source-archive.json) conserve 253 entrées, avec leurs parties vérifiables. Ce changement optimise des représentations et des lectures du runtime commun ; il n'ajoute pas une entrée DRM ni une nouvelle famille de raisonnement.

**Statut du contrôle officiel : réussi, 16 médianes sur 16 dans le budget de +10 %.** La réserve de coût du sous-lot 2C est clôturée pour le périmètre déclaré. Le [comparateur inchangé](lot2c-cost-evidence/performance/comparison.json) ne conserve aucun dépassement non résolu pour le candidat 0.36.0. Les résultats historiques 0.35.0 restent inchangés et ne sont pas requalifiés.

## Travaux redondants supprimés

### Valeur persistée et restauration

Chaque preuve reste acquise avec son propre delta, sa révision, son statut et ses relations. Lorsque l'encodage complet d'une valeur est exactement égal à celui déjà conservé, le store partage désormais cette valeur immuable. L'ajout d'une preuve à une famille passive ne force donc plus le décodage du même contenu métier.

Le cache de décodage exige encore la même valeur, le même type, la même portée et l'identité actuelle de **tous** les fragments utilisés. Un fragment changé, manquant ou corrompu repasse par les vérifications ordinaires. Les familles conservent leur restauration et leurs remises à zéro transitoires. Une transaction échouée reste atomique.

### Autorisation courante et trace

Avant chaque retour d'action, le service compare toujours le ticket au graphe et au programme actuellement autoritaires. Le runtime propose maintenant une lecture de ces deux identifiants, sans reconstruire tout l'instantané diagnostique. Les backends sans cette interface utilisent le chemin historique par snapshot. Une identité malformée ferme la session ; une identité périmée empêche l'acquisition.

Chaque entrée de trace est déjà copiée et profondément figée lors de son insertion. Les snapshots internes créent une nouvelle liste partageant ces entrées immuables. Les anciens snapshots restent stables. Le service conserve la copie indépendante et la validation du snapshot public sortant.

### Signatures géométriques aux octets identiques

L'observateur V6 construit un record interne fermé contenant `area`, `normalized_mask`, `palette_value` et `scale`. Les coordonnées, aires et échelles proviennent de la géométrie validée. Le nouveau helper privé sérialise ce record dans l'ordre canonique exact des quatre clés ASCII, puis calcule le même SHA-256. Le contrôle du scalaire de palette conserve notamment le refus du zéro négatif. Les API générales de canonicalisation, la géométrie, les masques, les identités et les règles d'ambiguïté restent conservés.

Le [diagnostic de composant](lot2c-cost-evidence/diagnostic/observer-results.md), déclaré et exécuté avant le patch, vérifie les octets, signatures et observations sur quatre paquets publics STCK et quatre références source. Sur les quatre paquets mesurés, les médianes d'observation complète passent de **13,952–14,778 ms** à **5,099–5,660 ms**, soit **61–63 % de réduction observée**. Les 560 appels mesurés comprennent sept méthodes distinctes, vingt répétitions et quatre paquets ; les coûts imbriqués ne s'additionnent pas. Ce diagnostic chaud ne remplace pas la mesure du service et de la session complète.

La [filiation de cette étape](lot2c-cost-closure-lineage.md) relie les producteurs, consommateurs, invariants et contre-exemples. Les quatre corrections travaillent sur des structures générales ; aucun identifiant de jeu, trajet, niveau ou rôle de couleur ne commande leur comportement.

## Diagnostic d'intégration et connaissance conservée

Le profil direct du service utilise une session STCK froide de dix actions. Il distingue observation/continuation, snapshots, gardes, checkpoints et décodage des familles. La baseline V63 et le candidat emploient exactement le même script, protocole, trace et déclarations. Les métriques sont imbriquées, leur instrumentation est explicite et le contrôleur, le transport worker et le rendu restent exclus. Le bref chevauchement initial avec un typecheck dans la baseline est conservé dans son reçu ; aucune référence plus favorable n'est sélectionnée.

La comparaison initiale des empreintes ne démontre pas une identité binaire du graphe complet : l'identité de version et les traces horodatées diffèrent. Le contrôle sémantique distinct conserve les graphes et les traces décodées intégrales. Sa [qualification séparée](lot2c-cost-evidence/diagnostic/semantic-qualification.json) explique les **3 834 différences de feuilles**, avec **zéro différence métier non qualifiée** : les dix commandes et les quatre états de propriétaires concordent ; les 24 traces ne diffèrent que sur `created`, dont les bits Float64 sont reliés aux encodages réels. Le manifeste de provenance est reconstruit exactement dans chaque version. Les 842 deltas de chaque graphe, leurs liens, les nœuds finaux et l'identité d'exécution sont vérifiés.

Les deux comparaisons strictes restent `strict_identity_failed`. La qualification porte seulement sur cette trajectoire publique STCK de dix actions ; elle ne réinterprète pas rétroactivement les corps absents du premier profil et ne revendique aucune identité binaire générale des graphes. Une relecture indépendante du comparateur a confirmé que les exceptions sont des chemins fermés liés aux valeurs observées, sans suppression de sous-arbre métier.

## Validation du candidat gelé

Le [delta formel](lot2c-cost-evidence/final/validation/delta-tests-run.json) passe **947/947 tests dans 26 fichiers**, avec zéro échec, annulation ou test ignoré. Il couvre les contrats 2C conservés, les contre-exemples du store, les tickets et snapshots, les références V5/V6 de l'observateur, le caller, les gardes et l'intégration. Ce périmètre explicite n'est pas présenté comme toute la suite historique.

Le [reçu des contrôles](lot2c-cost-evidence/final/validation/checks-run.json) confirme le typage, les audits d'entrées et de migration, le diff et la construction de production. Les entrées de source, test et build sont conservées sous empreinte. L'audit reste à **151 composants vérifiés, 130 partiels, 1 088 en attente**, avec **50/76 entrées** et **37 workflows compilés**. Les six conditions de migration complète restent fausses.

## Conservation du résultat LS20 et contrôle navigateur

La [campagne froide LS20](lot2c-cost-evidence/final/ls20-regression/results.md) atteint les trois niveaux demandés en **142 actions et 58 préfixes**, dans une seule session native. Les niveaux consomment respectivement **17, 67 et 58 actions**, avec **169,949 s actives** au total. Le solveur s'arrête sur `target_levels_completed`, au niveau 4 ; l'état officiel reste `NOT_FINISHED`. Ce résultat conserve le succès antérieur, sans revendiquer une nouvelle capacité ni une victoire sur le jeu entier.

La [comparaison publique exhaustive](lot2c-cost-evidence/final/ls20-regression/public-comparison.json) trouve les **142 commandes et les 143 paquets publics exactement identiques** à ceux de la campagne 0.35.0. Elle conserve la seule différence `/sourceDigest`, liée au nouveau code. `strictTraceEqual=false` reste explicite. Aucune commande attendue, mémoire apprise, solution ou implémentation de jeu n'entre dans le solveur ; la comparaison est effectuée après la campagne.

La [résolution de l'horloge](lot2c-cost-evidence/final/ls20-resolution.json) utilise la fin réelle, à **21:23:24.948343 UTC**. Elle conserve **1 251,193258 s** antérieures et ajoute **215,519107 s**, soit **1 466,712365 s cumulées**, environ **24 min 27 s**, sous le plafond de 40 minutes. Le compteur n'a pas été remis à zéro.

Le [contrôle navigateur STCK](lot2c-cost-evidence/final/browser/stck-verification.json), exécuté dans l'aperçu géré sur le build de production gelé, réussit aussi **trois niveaux en 35 actions et 15 plans**. Les frontières apparaissent à 3, 10 et 35 actions. La même session est conservée, sans action de jeu manuelle ni saut de niveau ; l'interface reste arrêtée à la frontière du niveau 4. La capture et l'état d'accessibilité sont archivés. Ses **49,7 s actives affichées** ne constituent pas une mesure officielle de performance. L'aperçu est arrêté avant la fenêtre de coût.

## Budget de coût

Le [protocole de clôture](lot2c-cost-evidence/performance/README.md) conserve le runner, le manifeste, les seize médianes STCK/SMLP et le seuil **+10 %**. Une référence V62 fraîche puis le candidat gelé rejouent chacun STCK10, SMLP15 et LIFE49 sur trois sessions après échauffement. Les commandes sont recalculées avant restitution du retour public correspondant. LIFE reste un diagnostic de session plus longue.

La [comparaison officielle](lot2c-cost-evidence/performance/comparison.json) passe **16/16 médianes**, avec `unresolved=[]`. Le runner, les entrées, l'environnement décrit et les quantités de travail concordent ; les sources natives restent inchangées dans chaque version. La [fenêtre d'exécution](lot2c-cost-evidence/performance/window.json) conserve un seul passage complet V62 puis 0.36, soit **18 sessions froides et 444 actions mesurées** au total, plus 18 actions d'échauffement. Aucun test, build, campagne, export ou jeu navigateur du projet ne chevauche les mesures ; l'activité extérieure de l'hôte partagé n'est pas isolée.

| Médiane contrôlée | STCK : V62 → 0.36 | Écart | SMLP : V62 → 0.36 | Écart |
| --- | ---: | ---: | ---: | ---: |
| Session complète | 12 999,340 → 11 483,395 ms | **−11,66 %** | 26 070,602 → 25 813,489 ms | **−0,99 %** |
| Nouvelle décision | 328,136 → 289,484 ms | −11,78 % | 521,854 → 508,526 ms | −2,55 % |
| Continuation du service | 21,730 → 13,000 ms | **−40,18 %** | 25,892 → 11,183 ms | **−56,81 %** |
| Requête de continuation | 23,842 → 15,177 ms | −36,34 % | 28,645 → 13,401 ms | −53,22 % |
| Garde de continuation | 0,272 → 0,188 ms | −30,97 % | 0,440 → 0,358 ms | −18,74 % |
| Acquisition et persistance | 1 130,428 → 947,964 ms | −16,14 % | 1 980,001 → 1 878,149 ms | −5,14 % |
| Persistance | 197,502 → 182,124 ms | −7,79 % | 172,378 → 167,141 ms | −3,04 % |
| Restauration | 14,550 → 10,509 ms | −27,77 % | 5,268 → 5,355 ms | **+1,65 %** |

Le diagnostic LIFE conserve une hausse de session de **119 159,573 à 123 195,011 ms, soit +3,39 %**. Ses médianes de décision, acquisition/persistance et persistance augmentent respectivement de **2,61 %, 1,03 % et 1,01 %** ; sa continuation du service baisse de **22,49 %**. Ces hausses restent dans le [rapport complet](lot2c-cost-evidence/performance/results.md), avec tous les effectifs, les dispersions, les p95 admissibles, l'inspection et les points Pause. LIFE garde sa portée diagnostique distincte du contrôle STCK/SMLP.

Le délai médian jusqu'à la frontière sûre après Pause sur la première action LIFE augmente également de **835,741 à 1 009,530 ms, soit +20,80 %**, sur trois mesures par version. Ce point est extérieur aux seize critères prédéclarés et reste un résultat diagnostique à suivre. Certains p95 augmentent aussi, notamment ceux de persistance/restauration STCK. La clôture porte sur les médianes annoncées et ne constitue pas une promesse d'amélioration de toutes les latences.

Les métriques imbriquées ne s'additionnent pas. Les ratios décrivent ces relectures publiques contrôlées sur l'hôte observé ; les temps d'exécution du jeu, le rendu navigateur et la publication sont exclus. Les optimisations de travaux redondants préexistants ne prouvent pas une cause unique de toutes les variations historiques V62/V63. La mémoire sur plusieurs heures et l'interruption arbitraire de toute recherche ne sont pas établies par ces sessions finies.

## Intégrité de la livraison

Le [contrôle final d'intégrité](lot2c-cost-evidence/final/delivery-integrity.json) lie le gel natif, les entrées des validations et du build, le worker produit et les preuves de campagne indexées. Les parties du rapport LS20 sont restaurées dans un répertoire temporaire initialement vide et comparées octet par octet. Les deux captures sémantiques extérieures à ce dossier ont leur [reçu séparé de transport](lot2c-cost-evidence/final/diagnostic-byte-transport.json), conservant les originaux et leurs huit parties exactes. Les indices de [campagne](lot2c-cost-evidence/final/campaign-evidence-index.json), [performance](lot2c-cost-evidence/final/performance-evidence-index.json) et [diagnostic](lot2c-cost-evidence/final/diagnostic-evidence-index.json) maintiennent les périmètres et les empreintes des reçus.

## Suite du chantier

La [feuille de route](v6-delivery-roadmap.md) conserve ses onze lots. **Le sous-lot 2C est livré dans son périmètre déclaré, avec sa réserve de coût clôturée. Le prochain chantier est le lot 3**, en commençant par `observed_composition_services`, puis `framed_window_composition`, `coupled_prefix_reference` et `recurrent_series`. Il doit réutiliser leurs contrats V5/V6 chez les propriétaires communs et montrer qu'une connaissance acquise change effectivement une décision, puis se révise sur un retour contraire. La fermeture complète du domaine morphologique et la parité de l'appelant historique complet restent des objectifs distincts.
