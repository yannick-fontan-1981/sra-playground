# Lot 3A : compositions observées, service de panneaux

## Résultat

Le moteur **Logos Engine `0.37.0`** transfère la branche `panel_service_plan` d'`observed_composition_services` dans le propriétaire partagé existant. **RSWP réussit ses trois premiers niveaux en 19 actions et 11 préfixes**, dans une seule session froide du caller commun. Le jeu arrive naturellement au début du niveau 4 en `NOT_FINISHED` ; aucune victoire sur le jeu entier n'est annoncée.

La base est la publication **64**, commit `3b5cb28a594e8570253371aeeb24444361df3cb0`, moteur `0.36.0`. Le nouveau gel contient **245 fichiers natifs**, inventaire SHA-256 `f3f795a3c813b72803e3f26bd207eed032853ae03d60582a33392f52a1bf8e7d`. Les [sources gelées](lot3a-evidence/final/source-archive.json), le [protocole préalable](lot3a-evidence/protocol.md) et la [filiation détaillée](lot3a-observed-panel-lineage.md) définissent le périmètre.

## Logique transférée et caractère générique

La mesure originale V6 reconnaît des panneaux répétés, leurs matériaux courants, leurs contrôles, les silhouettes d'opérateurs, les services affichés et les marqueurs de salle. La branche choisit une contribution actuellement mesurée parmi trois formes : matériau compatible avec un récepteur local, réécriture affichée préparant ce récepteur, ou expérience de transfert vers une salle possédant un récepteur compatible. Une ambiguïté bloque la proposition.

La première sélection reste un essai isolé. Un retour dont la projection correspond à l'attente acquiert `selection_observed`. Cette connaissance autorise ensuite un préfixe de préparations gardées, borné par le budget courant et 16 primitives. Quand la configuration est prête, une commande d'application publique est choisie selon l'ordre source ; son résultat reste inconnu et impose une nouvelle observation. Une configuration contredite ou une application sans information est retenue pour empêcher la répétition du même essai dans le même contexte.

Les décisions n'utilisent aucun nom de jeu, numéro de niveau, rôle fixe de couleur, coordonnée préparée ou solution. Les bornes de grammaire visuelle proviennent des originaux et restent déclarées comme hypothèses structurelles. Les essais de palette et de translation vérifient le transfert dans d'autres observations. La branche reprend directement **V6** et le socle commun déjà porté ; elle n'introduit pas un nouveau noyau numérique V5. Les dépendances V5 des prochaines branches sont identifiées dans la filiation.

## Mémoire, exécution et restauration

`SharedSeriesConstraint`, exposé sous `public_occurrence_recall`, possède la nouvelle mémoire et son journal. Les entrées observed, coupled et graph interrogent la même chaîne de planification. L'acquisition des ancêtres précède celle de Panel ; les acquisitions de paquets suivent. Le runtime garde sa distinction entre acquisition sélectionnée et passive, sans exécuter le propriétaire deux fois.

Chaque primitive revalide les commandes, la disposition, l'époque, le score, l'observation initiale, le point courant et les projections intermédiaires de tous les panneaux. Un changement de frontière, une contradiction ou une réponse inconnue scelle le préfixe. Les refus bloquants sont transmis avant les filtres de résultats.

Les événements Panel participent à la reconstruction et au certificat de mémoire de travail. Une restauration altérée est refusée avant de remplacer les mémoires valides ; les anciens acquis restent présents. Un checkpoint inchangé conserve son chemin sans rejeu. La compatibilité du digest des anciens checkpoints est maintenue jusqu'au premier événement Panel. Ce choix qualifie l'enveloppe native ; il n'est pas assimilé au digest de toute la chaîne d'héritage Python.

## Campagne réelle et contribution

| Niveau réussi | Actions du niveau | Préfixes du niveau | Composition observée |
| --- | ---: | ---: | --- |
| 1 | 3 | 3 | Correspondances directes |
| 2 | 8 | 4 | Réécritures affichées |
| 3 | 8 | 4 | Paramètres de salle |
| **Total** | **19** | **11** | **Une seule session** |

Le [reçu d'exécution](lot3a-evidence/final/execution-rswp.json) atteste un chargement initial, 19 avances, dix reprises et deux frontières reprises. Le caller acquiert les 19 transitions. Le temps actif est **27,053 s** et le temps externe d'exécution **39,454 s** ; ces durées de campagne ne sont pas un ratio de vitesse par rapport à un autre parcours. Le délai conservateur entre la sélection du jeu et la réussite est **448,421 s**, soit **7 min 28 s**, préparation comprise. La limite de 40 minutes est respectée dans la [résolution](lot3a-evidence/final/rswp-resolution.json).

La [preuve de contribution](lot3a-evidence/final/panel-contribution.json) reproduit exactement les onze propositions propres à Panel depuis une mémoire froide, puis uniquement les événements réellement acquis précédents. Elle compte **19 acquisitions uniques**, **14 sélections confirmées** et **5 applications**, dont trois conduisent à une frontière officielle. Quatre ablations de composant changent seulement `selection_observed` : les préfixes des niveaux 2 et 3 passent chacun de **trois actions à une**, avec la même première action. Ces états contrefactuels ne sont jamais injectés dans le jeu réel.

### Référence 0.36 conservée avec son échec d'export

Le [journal de référence](lot3a-evidence/baseline/summary.json) contient **93 actions, 94 paquets publics contigus et aucun niveau terminé**. Le processus atteint `level_active_time_budget` à **363,044 s actifs**, puis épuise sa mémoire pendant la clôture du diagnostic, avec code de sortie **−6**. Les reçus, les sources gelées, la sortie et le journal public sont conservés ; le rapport complet et la trace consolidée sont absents.

Les paquets initiaux complets des deux sessions sont identiques. Les empreintes des assets et l'audit des modules Python de la référence ne sont pas disponibles : ils ne sont pas reconstitués. Cette comparaison décrit deux parcours observés ; l'ablation séparée établit l'effet causal de l'acquisition sur la longueur des nouveaux préfixes. Le problème d'export renforce le travail prévu au lot 11 et ne doit pas être présenté comme une preuve de fuite du moteur en production.

## Vérifications

| Vérification | Résultat | Preuve |
| --- | --- | --- |
| Contrats source Panel | **58/58 tests dédiés** : 100 rasters publics, 34 cas, 15 gardes, sept enveloppes communes, quatre références d'ensembles CPython | [Fixture source](../../tests/fixtures/v6-panel-service-parity.json.gz), [tests](../../tests/v6-panel-service.test.ts) |
| Delta formel affecté | **548/548 tests**, **18 fichiers**, aucun échec, skip ou annulation ; entrées source et tests inchangées | [Reçu formel](lot3a-evidence/final/validation/delta-tests-run.json) |
| Projet et production | Typecheck, audits des entrées et de migration, contrôle du diff et build réussis | [Contrôles](lot3a-evidence/final/validation/checks-run.json) |
| Navigateur | **19 actions, trois niveaux, 11 plans** ; Pause initiale à zéro action, Pause à cinq actions et reprise du préfixe, frontières à 3/11/19 actions | [Vérification](lot3a-evidence/final/browser/rswp-verification.json), [capture](lot3a-evidence/final/browser/rswp-browser.png) |
| Origines | **1 786 fichiers originaux inchangés** lors des exports ; aucun hôte ou oracle de jeu dans les générateurs de contrat | [Filiation](lot3a-observed-panel-lineage.md), [scan public](lot3a-evidence/public-candidate-scan.json) |

La campagne et le navigateur constituent des vérifications fonctionnelles distinctes du benchmark. Les contre-exemples contrôlés couvrent notamment l'absence d'effet, la contradiction de configuration, les pixels changés sans changement de projection, une commande altérée, une observation périmée et les frontières d'époque ou de score.

## Coûts

**Le fonctionnel est validé ; le coût reste ouvert.** Les huit sessions par jeu et par version, regroupant les cohortes de trois et cinq sans exclusion, donnent **12/16 médianes dans le budget +10 %**. Quatre dépassements subsistent : continuation STCK **+11,578 %**, garde STCK **+14,144 %**, nouvelle décision SMLP **+15,932 %**, continuation SMLP **+10,365 %**. Les sessions évoluent de **−1,001 %** sur STCK et **+2,585 %** sur SMLP. Les [résultats complets](lot3a-evidence/performance/results.md) conservent les écarts absolus, p95, dispersions, deux comparaisons d’origine, diagnostics et limites. Le code reste inchangé ; le sous-lot 3A n’est pas clôturé dans son ensemble.

## Couverture et prochaine étape

**Une branche sur six** d'`observed_composition_services` est transférée. Le registre reste **50/76 entrées raccordées**, avec **une entrée explicitement partielle** parmi les 26 restantes. Les cinq autres plans, le cumul complet des candidats hérités et les trois autres entrées du lot 3 restent ouverts.

L'audit distingue **152 composants vérifiés**, **131 transferts partiels**, **1 086 éléments en attente** et aucun transfert global complet. Les 37 workflows compilés et les six conditions de migration globale, toutes fausses, gardent leur portée. La prochaine étape prioritaire est **la clôture du coût 3A**, puis **3B : `chamber_relation_plan`**, avec reprise des fonctions V5 de réseau relationnel fini effectivement consommées et candidat public **CATR**, dont **107,399326 s** sont déjà à reprendre. La [feuille de route complète](v6-delivery-roadmap.md) conserve les onze lots et les sous-lots 2A, 2B et 2C.
