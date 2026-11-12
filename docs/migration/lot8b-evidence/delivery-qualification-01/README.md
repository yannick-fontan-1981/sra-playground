# Lot 8B : qualification fonctionnelle de livraison

## Périmètre et identité des sources

Ce jalon exécute le [plan déclaré avant les essais](plan.json), sauvegardé au commit `4ac627502763ce7aca6b602a154eea0fd52be866`. Il complète le [raccordement commun](../common-integration-01/README.md) par trois populations de preuves distinctes : formes communes appariées, régressions de retours publics enregistrés et chaînes synthétiques de contribution BranchRouting. Leur état final sera consigné dans `validation-summary.json` après clôture des trois phases.

Le code et les tests qualifiés au commit `2583d81d856c13295040db88f5df8b3a99906bdc` sont conservés. Les **524 tests et sous-tests dans 23 modules**, le typage, les audits et le build du jalon précédent ne sont pas réexécutés ni additionnés aux contrôles de ce dossier.

| Rôle | Source | Fichiers natifs | Digest canonique |
| --- | --- | ---: | --- |
| Publié, Site 107 / native 0.66.0 | `4ff7bf45286a8a19d34401988adca587253ae41e` | 329 | `ab674682f3345b09bec94959174fbb5bf0f1bd06154693697e5814987b572316` |
| Candidat BranchRouting non publié | Même code natif que le raccordement commun qualifié | 331 | `3ff1d9ad56e22aedc0fee3a0da6a3af50a1da0bc14a0ba01cb38272ba85234be` |

Les manifestes complets sont [baseline-native.json](baseline-native.json) et [candidate-native.json](candidate-native.json). Le [reçu de réconciliation](source-digest-reconciliation.json) montre que le digest historique `76a403016d2b28287194b7498f10e14727b7e3fb3f214d2f79cb0292390d54bf` représente les **mêmes 331 chemins et empreintes**. Seul l'ordre de sérialisation diffère : tri des composants de `Path` dans le reçu historique, tri lexical des chemins complets dans les outils communs. Les octets natifs et les reçus antérieurs ne sont pas modifiés.

Le candidat raccorde **69/76 entrées, dont 26/33 entrées matérielles**. Le publié reste à **68/76**. Le littéral de développement demeure 0.66.0 ; aucun nouveau numéro n'est réservé et aucun déploiement 8B n'a lieu dans ce jalon. Les six portes de migration complète restent fausses.

La [préparation du baseline](baseline-preparation.json) conserve ses deux premières tentatives : index non matérialisé dans le checkout neuf, puis diagnostic de l'ordre des chemins du digest. Elles n'exécutent aucun runtime ni jeu. Le checkout publié est séparé du checkout et de la branche propres au candidat.

## Formes STCK/SMLP appariées : qualifiées

Les quatre formes froides de chaque rôle ont été exécutées au commit documentaire stable `0830ca822e2e4330fa3ffb68d333167b3389fc26`, sous le [plan d'exécution figé](work-forms-execution-plan.json). Les commandes sont comparées avant de fournir les retours publics archivés. Les 689 entrées déclarées restent identiques avant et après chaque commande.

| Forme, par rôle | Actions | Requêtes capturées | Inspections finales | Niveaux acquis dans la forme |
| --- | ---: | ---: | ---: | ---: |
| STCK, préparation | 3 | 6 | 0 | 1 |
| STCK, complète déclarée | 10 | 16 | 3 | **2** |
| SMLP, préparation | 3 | 6 | 0 | 1 |
| SMLP, complète déclarée | 15 | 24 | 3 | **3** |

Cela représente **31 retours par rôle, 62 au total**. STCK à dix actions conserve `reason=null` pour une cible déclarée de trois niveaux ; SMLP à quinze actions atteint `target_levels_completed`. Les mots historiques `warmup` et `measured` désignent les longueurs des formes. Les durées instrumentées ne sont pas des échantillons de performance officielle.

Le [lecteur des graphes](work-qualify-01/graph-review.json) passe **64 contrôles sur 58 points appariés** et consigne **522 rapprochements de checkpoints propriétaires**. Il reconstruit les graphes depuis tous les deltas, valide les chaînes et hashes avec le Kernel/store propre à chaque rôle et hydrate les racines modifiées. Le [journal brut](work-qualify-01/graph-review.differences.jsonl.gz) conserve les **22 312 occurrences de différences** :

| Attribution vérifiée | Occurrences |
| --- | ---: |
| Identité `origin.source_digest` du rôle | 21 249 |
| Valeur exacte de `created`, rattachée à l'horloge source et aux intervalles réels des appels | 1 055 |
| Racines BranchRouting ajoutées à l'initialisation des quatre sessions du candidat | 8 |
| **Non attribuées** | **0** |

Les huit ajouts sont précisément `family_state:branch_routing` et `family_activation:branch_routing` dans chacune des quatre sessions. L'attribution d'horloge ne retire pas globalement les timestamps ni les valeurs privées. Les captures complètes sont conservées pour [le publié](work-baseline-01/baseline.json.gz) et [le candidat](work-candidate-01/candidate.json.gz).

L'[inventaire réel](work-inventory-01/owner-source-inventory.json) passe de **61 à 62 propriétaires**, avec le seul ajout de BranchRouting et conservation des **28 programmes installés par les familles**. Binding, SelectedRigid, Motif et OrderedRecruitment sont présents dans les deux rôles. Les 31 appels Recruitment par rôle sont observés sur la véritable méthode `OrderedRecruitment.recordSource` de l'instance d'acquisition enregistrée.

**Aucune acquisition sélectionnée Motif ou BranchRouting n'apparaît dans ces formes.** La présence, les restaurations et les refus de BranchRouting ne constituent pas sa preuve positive. Celle-ci relève des chaînes synthétiques distinctes ci-dessous.

La [synthèse des formes](work-forms-result-summary.json) et la [revue indépendante](work-forms-independent-review.json) conservent les réserves : `preparedOnly: true`, `officialPerformanceEligible: false`, `strictCommonGraphParity: false`. Toutes les différences observées sont attribuées dans le périmètre fonctionnel ; cela n'établit pas une égalité stricte des graphes entre versions ni la parité complète de l'appelant original.

## Onze régressions enregistrées : 11/11 et 187/187 projections conformes

Le [manifeste figé](../tools/delivery/regressions/cases.json) conserve les onze cas historiques : CATR, RSWP, FOGW, VOIS, CONN, MIND, WEAV, TRIA, CRAF, ISOS et KATA. Le comparateur historique et ses **17 projections par cas** restent inchangés. Le [résumé final](regressions-01/regression-summary.json) constate **11/11 cas et 187/187 projections conformes**, sans échec, interruption ou relance. Les entrées et les 331 fichiers natifs sont identiques avant et après ; tous les groupes de processus sont arrêtés.

La population déclarée compte **390 commandes, 401 paquets publics complets, 1 755 images d'animation, 289 préfixes, 679 requêtes et 33 frontières naturelles de niveau**. Il s'agit de retours enregistrés, sans exécution d'un moteur de jeu ni nouvelle réussite officielle.

| Cas | Commandes enregistrées | Préfixes | Projections passées |
| --- | ---: | ---: | ---: |
| CATR | 12 | 8 | 17/17 |
| RSWP | 19 | 11 | 17/17 |
| FOGW | 50 | 27 | 17/17 |
| VOIS | 78 | 42 | 17/17 |
| CONN | 21 | 21 | 17/17 |
| MIND | 31 | 20 | 17/17 |
| WEAV | 81 | 81 | 17/17 |
| TRIA | 17 | 17 | 17/17 |
| CRAF | 36 | 36 | 17/17 |
| ISOS | 12 | 12 | 17/17 |
| KATA | 33 | 14 | 17/17 |
| **Total** | **390** | **289** | **187/187** |

Les projections couvrent notamment les commandes, paquets et frontières de primitives, sélections retenues, gardes, compteurs communs et résultats publics. Elles ne comparent pas les payloads complets des familles, les graphes et leurs révisions, ni l'intégralité des nouveaux états privés. Le manifeste ne demande aucun propriétaire passif supplémentaire : un reçu de présence passive passé avec zéro préfixe contrôlé n'est pas une preuve d'acquisition. Les preuves positives BranchRouting restent séparées.

KATA conserve son libellé historique `fresh_current_native_self_consistency` et son archive épinglée. Cette exécution compare au rapport historique ; elle ne remplace pas la référence par une nouvelle autocomparaison. WEAV conserve l'hôte historique qui libère les gros objets de référence avant l'import natif. Les onze archives absentes ont été reconstituées par copie opaque de leurs parties Git exactes, sans décodage ni restauration récursive ; le [reçu de matérialisation](regression-reference-materialization.json) en conserve les empreintes.

La supervision limite à un le nombre de groupes actifs, sans relance automatique : prévalidation 300 s, rejeu 600 s par cas, comparaison 180 s par cas, budget actif de campagne 2 400 s, puis marges de terminaison et conservation déclarées. `--max-old-space-size=1536` limite le seul old-space Node, pas le RSS total ni la mémoire Python. Tous les rapports et journaux sont retenus. Les sauvegardes intermédiaires distinguent explicitement les cas terminés de la campagne encore en cours. La [revue indépendante finale](regressions-independent-review.json) confirme les onze résultats, les 23 phases et leurs groupes arrêtés, les 46 journaux et les empreintes des rapports. Elle précise que la libération préalable des racines historiques est démontrée pour WEAV seulement ; le libellé générique hérité des comparaisons ne doit pas être étendu aux dix autres cas.

## Cinq chaînes BranchRouting : exécution à constater

La [première tentative](branch-capture-01/receipt.json) est conservée au statut `failed`, après 1,033 s et avant toute création de runtime (`factoryCalls: 0`, zéro retour). Le [diagnostic](branch-capture-01-diagnosis.json) établit une erreur de frontière de l’outil : les 37 rasters du corpus sont en 26 × 28 ou 28 × 26, tandis que la façade publique exige 64 × 64. Les sources, les attentes, le corpus et les entrées figées sont inchangés. La correction utilisera de nouveaux outils, avec la vraie API du runtime commun ; elle ne qualifiera pas la façade publique, ses tickets ni le transport worker. Les anciens outils et leur plan restent intacts.

Les outils de capture et de lecture sont figés, contrôlés syntaxiquement et [revus indépendamment](branch-tools-independent-review.json). Le [plan d'exécution](branch-execution-plan.json) déclare cinq chaînes froides : positive simple, sélection et préfixe de deux mouvements, effet contraire, ablation d'acquisition sélectionnée et acquisition incomplète. La capture démarre après la fin des régressions, avec un plafond de 300 s par commande et les mêmes 353 entrées figées.

La population attendue reste prospective jusqu'au verdict du lecteur : **26 retours publics synthétiques, 23 acquisitions source réussies, un retour ablaté et deux retours incomplets**, 25 appels au wrapper `record`, 24 invocations de l'adaptateur réel et trois questions finales autorisées sans retour. Les quatre modes exécutés attendus sont 17 calibrations, deux sélections, six mouvements et une propagation.

Le corpus indépendant `component-reference-03`, SHA `e6ae197b7b982bd41f561b9df8e458436d7ce0797f39bbf86d972e55472b6769`, n'est pas régénéré. Le point commun (6,13) est distingué du point manuel (7,13) du composant. Certaines attentes de garde après calibration sont déduites de la règle source explicite `expected_after:null` ; elles ne sont pas de nouveaux appels à l'oracle original.

L'ablation omet seulement l'effet `record` sélectionné. L'interruption déplace l'horloge de niveau après la garde réelle du second mouvement, sans remplacer l'horloge globale. La restauration observée passe par les appels normaux du runtime et les racines du graphe ; elle ne répète pas l'effacement contrôlé de l'état déjà couvert par les huit tests communs. Les questions finales sans retour ne sont pas des commandes exécutées ; la propagation finale du cas triple n'est pas exécutée. Un état synthétique `finished:true` sans score n'est pas une victoire officielle.

## Coût et prochaine livraison

**Le coût officiel 8B n'est ni mesuré ni accepté.** Le critère est une augmentation de la médiane globale des sessions complètes **strictement inférieure à +10 % pour STCK et pour SMLP séparément**. Une phase peut dépasser +10 % si les deux critères globaux passent, sans compensation entre jeux. Tous les échantillons et diagnostics seront conservés.

Après clôture fonctionnelle, la suite est : **version distincte, gel final et réconciliation des preuves, protocole puis mesure officielle contre le prédécesseur réellement publié, publication**. Toute modification des entrées finales doit être reliée aux contrôles qu'elle affecte. Les réserves de coût des publications prioritaires 0.63 à 0.66 restent distinctes.

Le travail courant, les tests fonctionnels, les commits et les push s'exécutent sans verrou global, sur le checkout et la branche propres, sans attendre la disponibilité des autres lots. Une exclusivité courte reste réservée aux mesures officielles et à la publication ; le détenteur libère ses propres handles et ne supprime pas un fichier détenu. **LKEY demeure définitivement fermé.**
