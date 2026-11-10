# Lot 3D : `rooted_line_plan` dans le moteur commun

## Résultat et réserve fonctionnelle

Le moteur natif **0.45.0** raccorde `rooted_line_plan` et le sous-graphe conditionnel V5 qu'il consomme au propriétaire commun. Le gel est **`5b5e59e14e4d417d92cacd6e79d21b6e8e833d715c8d05df2b74806bb09b40f3`**, avec **256 fichiers natifs** et une archive de **267 fichiers**. La base est la publication privée **72**, moteur **0.44.0**, commit **`a39997bffdca1ce080879d967d3f5eb95a88d544`**, digest `e914399487992c3f53b3058ee734c470d738594e7344285799203462fac6a255`.

**Le transfert et ses contrats sont vérifiés. La cible fonctionnelle SK48 de trois niveaux reste non atteinte : 12 actions, zéro niveau terminé, cinq préfixes.** Le port et les originaux Python produisent les mêmes décisions, acquisitions et refus sur cette trajectoire. Le modèle conditionnel est contredit par le douzième retour ; le moteur conserve le contre-exemple, ferme le préfixe et suspend la composition. Ce résultat est distinct de la validation des contrats et du budget de coût.

La façade `observed_composition_services` passe de **3/6 à 4/6 branches**. Le registre conserve **50/76 entrées complètement raccordées**, une entrée partielle, et **37 workflows compilés**. La migration complète reste ouverte. Les preuves sont regroupées dans [l'index de livraison](lot3d-evidence/README.md) ; la [filiation source](lot3d-rooted-line-lineage.md) détaille les frontières du transfert.

## Ce que le moteur acquiert et réutilise

La projection mesure une racine creuse, sa ligne, les pièces et une référence homologue à partir du seul raster public. Les labels des commandes restent opaques. Les déplacements et variations d'étendue sont acquis après leur exécution réelle, puis utilisés pour calculer un préfixe conditionnel. Les couleurs observées distinguent des types mesurés ; aucun identifiant de jeu, numéro de niveau, rôle de couleur fixe, coordonnée préparée ou solution n'intervient dans la production.

Le sous-graphe V5 transféré comprend les contrats JSON consommés, les intersections, les buts d'ordre et la simulation/recherche non étagée. Les demandes étagées et les continuations non transférées sont refusées explicitement. Les lois de poussée, d'entrée, d'attachement et de transport restent des hypothèses de la configuration source. Une projection qui concorde ne transforme pas ces hypothèses en lois universelles apprises.

La recherche conserve les bornes source et reçoit une interruption native explicite. Son échéance effective est le minimum de la limite de travail et de celle du niveau courant. Une interruption expose une frontière ouverte, ne présente pas un effet incomplet comme un plan terminé et conserve uniquement les témoins déjà validés. Les contrats annoncent leur domaine JSON fini, avec entiers sûrs ; ils ne prétendent pas remplacer toute la coercition Pydantic ou les entiers Python arbitraires.

Le propriétaire commun propose et garde les branches dans l'ordre RootedLine, Panel, Chamber, Exposed, puis les ancêtres transférés. L'acquisition suit l'ordre inverse des couches propres : Exposed, Chamber, Panel, RootedLine, avant l'acquisition du paquet commun. Chaque retour sélectionné appartient à un seul journal. La proposition n'acquiert pas de retour futur.

La mémoire conserve les contrôles, essais, preuves, configuration courante et réfutations. Un changement d'époque efface les essais et la configuration courante, tout en conservant les effets appris et l'histoire. Une calibration sans déplacement n'invente pas de contrôle. Un retour dépourvu de scène conserve son événement et ses références sans inventer d'effet. La restauration reconstruit dans des propriétaires temporaires, vérifie le digest, puis publie l'état atomiquement. L'identité, la révision et le témoin structurel de RootedLine participent au certificat de réutilisation.

## Validation source et intégration

| Périmètre | Résultat et portée |
| --- | --- |
| Noyau V5 consommé | **85/85 tests**, dont **77 résultats exacts** des originaux : 6 contrats, 46 simulations, 10 buts, 4 intersections et 11 recherches |
| Couche propre V6 | **91/91 tests** ; 53 cas source, 19 gardes et 99 projections initiales publiques comparées |
| Propriétaire commun | **12/12 tests**, dont six checkpoints produits et rechargés par le véritable moteur publié 0.44, passage par le magasin de connaissances, invalidation et refus atomique |
| Périmètre formel complet du lot | **1 724/1 724 tests dans 50 fichiers**, aucun test ignoré, annulé ou TODO ; sources et inventaire de tests inchangés pendant la relance finale |
| Contrôles du projet | **5/5** : typage, audit des entrées, audit de migration, contrôle des différences et compilation |
| Régressions enregistrées | **CATR/RSWP 34/34 contrôles**, sur les rapports 0.44 et les mêmes retours publics historiques |
| Rejeu indépendant de SK48 | **126/126 contrôles**, cinq propositions, douze retours et vingt-quatre gardes, états propres, digests et restauration |

Les exporteurs vérifient les **1 786 fichiers originaux avant et après** leurs appels. Les fixtures attendues sont calculées par les sources Python inchangées. Les comparaisons de composant et de suffixe de digest ne revendiquent pas la fermeture complète de l'héritage ni l'égalité de tout l'appelant V5/V6.

Le [premier résultat formel](lot3d-evidence/final/validation/delta-tests-run.json), **1 722/1 724**, est conservé. Ses deux échecs portaient sur des attentes de métadonnées encore fixées à trois branches et à l'ancien libellé de périmètre. Seules ces attentes ont été actualisées. La [réconciliation](lot3d-evidence/final/test-expectation-reconciliation.json) conserve leurs empreintes avant/après et la [relance complète](lot3d-evidence/final/revalidation/validation/delta-tests-run.json). Le code natif, les assertions de comportement, les oracles et les comparateurs sont restés inchangés. Le reçu de compilation réussi est repris à l'identique ; il ne représente pas une seconde compilation.

Les rejeux CATR/RSWP sont des non-régressions sur des réponses enregistrées, avec chaque commande recalculée avant son retour. Ils conservent respectivement **12 actions, trois niveaux, huit préfixes**, et **19 actions, trois niveaux, onze préfixes**. Ils ne constituent pas de nouvelles victoires live ni une preuve de contribution de RootedLine.

L'audit recense **156 modules vérifiés au niveau composant**, **138 transferts partiels** et **1 075 modules encore en attente**, sur 1 369 modules Python conservés. Aucun module n'est déclaré entièrement vérifié au niveau global et aucune porte de migration complète n'est franchie.

## Campagne SK48, contre-exemple et contribution

Le projecteur original a examiné **99 observations initiales publiques déjà conservées**, avec zéro action et zéro saut de niveau. CWSE a été exclu avant la projection. SK48 est le seul cas admis dans cet ensemble ; cette admission motive sa sélection, sans recours à son moteur ou à une solution.

La [référence 0.44](lot3d-evidence/baseline/sk48-bounded-reference/execution-sk48.json) est une session froide limitée extérieurement à **16 actions**. Elle ne termine aucun niveau. La limite externe interrompt le diagnostic après acquisition du dernier retour, avant son acceptation complète par le contrôleur ; le résumé des préfixes peut donc avoir une transition de retard. Cette référence bornée ne permet pas d'affirmer que 0.44 échouerait dans une campagne complète.

La [campagne 0.45](lot3d-evidence/final/sk48-rooted-session/execution-sk48.json) vise trois niveaux avec les budgets de production inchangés. Elle apprend quatre contrôles, puis sélectionne un plan conditionnel. Les sept premières étapes de cette composition correspondent aux projections prévues. La huitième, **action globale 12**, contredit le déplacement prévu de deux pièces. Trois commandes restantes du plan ne sont pas exécutées. L'état commun s'arrête avec `frontier_unknown` ; le refus propre est `conditional_contact_model_refuted`, avec `block_unrelated_probe: true`.

Le [diagnostic indépendant](lot3d-evidence/diagnostic/sk48-public-parity.md) reconstruit cette trajectoire depuis une mémoire vide, alimentée uniquement par les observations et retours antérieurs. Aucun `proposal.memory` natif n'amorce le rejeu. Les originaux Python produisent exactement les mêmes plans, acquisitions et refus. La racine, la pointe et une pièce concordent ; deux autres pièces se déplacent de six pixels là où le modèle en prévoyait quatre et deux. Le retour conserve leurs espacements, tandis que le modèle nominal les réduit au contact. Ce contre-exemple ne suffit pas à sélectionner une nouvelle loi générale de transport ou de poussée.

La [preuve de contribution](lot3d-evidence/final/sk48-rooted-session/rooted-line-contribution.json) vérifie **cinq préfixes, douze actions, douze acquisitions et six restaurations propres**. Elle conserve **26 ablations**, dont 17 modifient effectivement la connaissance retenue. **Dix changent une action ou un refus ; seize conservent la décision.** Les contrôles appris et la réfutation acquise contribuent aux décisions. Les ablations isolées de `current` et de `tried` n'établissent aucune contribution dans les contextes retenus. Sept différences limitées à la proposition stricte ne sont pas comptées comme des contributions d'action. Le premier tirage de cette preuve reste conservé ; sa qualification des supports prédits a été précisée sans changer les faits ni les résultats.

Une session distincte dans le navigateur confirme **Pause à zéro action**, l'exécution d'**une seule action**, puis la reprise jusqu'au même arrêt **12 actions, zéro niveau, cinq plans**. L'inspecteur est resté fermé. La [preuve d'interface](lot3d-evidence/final/browser/browser-qa.json) et sa capture sont séparées de la campagne instrumentée, de l'oracle et du chronométrage.

L'[horloge SK48](lot3d-evidence/final/sk48-resolution.json) conserve **667,35444 secondes cumulées**, soit 11 min 7,35 s, et **1 732,64556 secondes restantes** sur quarante minutes. Elle n'est pas épuisée et devra être reprise à ce cumul lors d'un futur diagnostic. Aucun autre essai SK48 n'a été lancé dans cette livraison. **CWSE conserve 2 399,683865 secondes et sa cible non atteinte ; aucun nouvel essai ou diagnostic CWSE n'a été effectué.**

## Coût officiel

**Coût accepté sur 2/2 jeux selon la règle globale autorisée.** La [décision](lot3d-evidence/performance/global-budget-decision.json) compare une référence 0.44 fraîche au gel 0.45, avec deux cohortes dans l'ordre **A1/B1/B2/A2**, **32 sessions mesurées et 400 actions**. Huit chauffes et leurs vingt-quatre actions sont exclues comme prévu ; aucune session mesurée ni valeur extrême n'est exclue.

| Jeu | Médiane 0.44 fraîche (ms) | Médiane 0.45 (ms) | Variation globale | Décision |
| --- | ---: | ---: | ---: | --- |
| STCK | 9947,561916 | 10903,447822 | **+9,609248 %** | Accepté, strictement sous +10 % |
| SMLP | 17185,212258 | 16749,405550 | **−2,535940 %** | Accepté, strictement sous +10 % |

La règle, [déclarée avant le lancement](lot3d-evidence/performance/declaration.json), porte sur la médiane des huit sessions de chaque jeu et version réunies entre cohortes. Chaque jeu doit passer séparément. Une baisse SMLP ne compense pas une hausse STCK. Les phases s'imbriquent et ne sont pas additionnées pour fabriquer la durée globale.

Le classement historique des seize mesures demeure **12/16**, `budget_review_required`. Les quatre dépassements STCK sont conservés :

| Jeu | Phase | Variation de médiane | Qualification conservée |
| --- | --- | ---: | --- |
| STCK | Service de continuation connue | **+24,858250 %** | `over_budget_with_noise_unresolved` |
| STCK | Requête de continuation connue | **+25,726153 %** | `over_budget_with_noise_unresolved` |
| STCK | Garde de continuation connue | **+20,964611 %** | `over_budget_with_noise_unresolved` |
| STCK | Restauration | **+13,672589 %** | `over_budget_with_noise_unresolved` |

STCK n'a que **0,390752 point de pourcentage de marge** sous le seuil global. La **seconde cohorte STCK atteint +15,844198 %** sur sa propre médiane de session ; elle est conservée intégralement dans l'agrégat annoncé. Les classements propres des cohortes restent **13/16 et 10/16**. L'acceptation ne prétend donc pas que chaque cohorte ou chaque phase est sous +10 %.

La [revue indépendante](lot3d-evidence/performance/consolidation-review.json) passe **231/231 contrôles**. Le reviewer global vérifie la déclaration préalable, les effectifs et la multiplicité des sessions avant d'appliquer séparément le seuil strict. Les [résultats complets](lot3d-evidence/performance/results.md) conservent les seize mesures, les dispersions, les p95 disponibles et leurs hausses, y compris celles qui n'apparaissent que dans une cohorte.

Cette fenêtre mesure le moteur natif, son service et son contrôleur sur des retours publics enregistrés identiques. Elle exclut le moteur de jeu live, le rendu navigateur et le réseau de production. Les distributions d'une fenêtre ne prouvent pas une cause des variations ni leur stabilité future. L'acceptation du coût ne clôt pas la cible fonctionnelle SK48.


## Décision de périmètre et suite

Le transfert propre RootedLine et son noyau V5 consommé sont vérifiés, avec confirmation et contradiction acquises puis consommées. **La cible SK48 de trois niveaux reste ouverte**, et le lot 3 global n'est pas clôturé. Toute révision ultérieure du modèle devra être générique, issue de retours mesurés et vérifiée face aux cas contraires, avec conservation de l'horloge.

Le prochain transfert autonome de la feuille de route est **3E, `reception_service_plan`**, puis **3F, `reference_population_plan`**. Le premier doit notamment expliciter le partage historique du nom `reception_events` avec Exposed, les attentes bornées, les retours et leur budget cumulé. Le suivi du modèle RootedLine demeure distinct, avec sa réserve fonctionnelle et son budget restant. Le suivi CWSE reste suspendu à sa limite déjà consommée. Les branches restantes, la fermeture EphemeralMap et la parité complète de l'appelant restent en attente.
