# Lot 2B : de la décision morphologique au contrôle et au retour d’attention

## Périmètre livré

La base vérifiée est **SRA Playground 61**, commit `b288fef0f6ec7898e6e6ea6de56c3e2af2d5cf19`, moteur `0.33.0`. Le lot 2B poursuit la [feuille de route](v6-delivery-roadmap.md) à partir des mesures courantes du lot 2A. Le transfert global V5/V6 reste en cours.

L’implémentation est gelée sous **`logos-engine.typescript.v6.native-migration/0.34.0`** : **240 fichiers natifs**, inventaire SHA-256 **`17252e294212a1563b75037a0b0dd782c2ecbc8cc4e1997a4f2bb2103bdf4e8b`**. Le [manifeste](lot2b-evidence/final/source-manifest.json) et les [parties de l’archive exacte](lot2b-evidence/final/source-archive-parts.json) conservent cette identité.

La lacune de V61 était située entre les producteurs et leurs consommateurs. Une décision morphologique sans route disparaissait, même lorsque la politique retenait une composition dont le contrôle restait à mesurer. Les groupes `attention_parent_return` et `acquire_control_for_target` n’avaient pas de fournisseur. Les questions d’information ne recevaient pas les conditions de conservation de ce parent.

## Ce qui change dans la décision

Le résultat complet de la politique est maintenant conservé avant le refus d’une route absente. Comme dans `StrategyRouter.choose`, **`morph.last` appartient uniquement au choix courant**. Le début du choix suivant et la restauration le remettent à zéro. La lecture vérifie observation, époque, score et image ; elle rend une copie. Ce résultat ne devient pas une mémoire historique supplémentaire.

Une décision `retained / control_not_currently_attested` peut maintenant demander l’une des trois expériences source : répéter une translation depuis une autre origine, essayer une commande publique encore inutilisée, ou répéter une translation après un blocage dont le contexte diffère. Les directions éventuellement rappelées restent des prédictions à éprouver dans la portée actuelle. Les expériences et les commandes gardent leurs priorités source et leurs tris stables.

Le nouveau module de translation contextuelle réutilise les snapshots, le recalage, les signatures et les empreintes déjà transférés. Il exige une seule piste cohérente, une empreinte pleine, une origine de réussite antérieure, un blocage et une origine actuelle encore non testée. La surface visée doit correspondre à un succès et se distinguer des blocages. Il n’ajoute ni rôle de couleur, ni direction présumée, ni filtre de score absent de la source.

Les questions d’information inspectent cette acquisition quand elles ont des offres à examiner. Une question différente sans retour lié peut être différée pour conserver le parent ou son témoin de contrôle. La même commande peut servir les deux questions et reçoit `also_tests_current_control`. Un retour lié n’est pas arbitrairement interdit. Les motifs de report et la référence d’attention sont conservés dans le reçu de stratégie.

Après un retour réel, le fournisseur `attention_parent_return` exige la même paire que la nouvelle décision morphologique, puis reprend la même fonction d’acquisition du contrôle. Les résultats `matched`, `contradicted` et `unobserved` sont tous traités selon le contrat source. Le retour est consommé une fois ; une ancienne observation, une autre paire ou une frontière ne donne pas un permis supplémentaire.

L’ordre reste celui de la stratégie originale : `morphology`, `attention_parent_return`, `returned_branch_contrast`, `information_goal`, `acquire_control_for_target`, `view`, `view_continuity`, `observed_frontier`. La proposition finalement sélectionnée reçoit la décision morphologique courante même lorsqu’elle vient d’un autre fournisseur. Une famille sélectionnée avant l’évaluation morphologique garde le reçu `not_evaluated / prior_family_selected`.

## Propriétaires, gardes et filiation V5/V6

| Élément | Propriétaire ou contrat consommé |
| --- | --- |
| Histoire des transitions et snapshots | `caller:goal`, acquisition commune existante |
| Contacts, essais et sorties morphologiques | `family_state:morphology`, journal du lot 2A |
| Prévision de jauge et collecte | Contexte d’inventaire existant, observation idempotente |
| Décision courante sans route | Résultat éphémère de `NativeMorphologyFamily` |
| Témoin et retour d’attention | `caller:attention`, canal de mouvement existant |
| Méthode issue d’un score | `caller:counters.targetMethod`, rappel conditionnel existant |
| Essais disponibles, proposition et garde | `ObservedFrontier` commun |
| Libération, acquisition et analyse | WHY/ACT, Kernel et OP29/OP30/OP31 existants |

Les mesures d’enceintes héritées de V5 sont celles du lot 2A ; les consommateurs et l’ordre viennent du V6 original épinglé au commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. La [filiation détaillée](lot2b-control-attention-lineage.md) donne les chemins, champs, gardes et limites. Les fichiers originaux restent inchangés. Aucune décision du code de production ne dépend d’un identifiant de jeu, d’un numéro de niveau, d’une coordonnée préparée ou d’une solution enregistrée.

Une branche morphologique hors du domaine transféré conserve son refus natif et ne fournit aucune décision aux nouveaux consommateurs. Les autorisations restent celles des propositions et gardes communes ; l’inspection d’une expérience ne propose ni ne libère d’action.

## Validation des contrats

La [validation formelle du delta](lot2b-evidence/final/validation/delta-tests-run.json) passe **623 tests sur 623 dans 14 fichiers**, sans échec, annulation ou test ignoré. Son inventaire lie le résultat au code natif et aux tests inchangés pendant l’exécution.

| Preuve | Résultat | Portée |
| --- | --- | --- |
| [Consommateurs de stratégie](../../tests/fixtures/v6-control-attention-reference.json.gz) | 38 cas, 44 choix, 17 scènes ; 41 tests de référence | `StrategyRouter.choose` inchangé ; doubles explicites pour familles hors périmètre, décision morphologique et transport de frontière |
| [Translation contextuelle](../../tests/fixtures/v6-contextual-translation-reference.json.gz) | 45 cas, 21 positifs, 101 rasters ; 47 tests | Original inchangé, observations synthétiques publiques, gardes positives et contraires |
| [Intégration Kernel](../../tests/v6-control-attention-kernel.test.ts) | 2 actions autorisées et 2 acquisitions, mémoire initiale vide | Factory, producteur morphologique, caller, frontière et WHY/ACT réels ; entrée constituée uniquement de pixels et de commandes publiques disponibles |
| [Cycle de décision](../../tests/v6-morphology-family.test.ts) | Décision sans route consommable, portée et copies vérifiées, reset et restauration | Pas de sérialisation d’un ancien `morph.last` ; proposition engagée préservée |

Les deux exporteurs source vérifient les **1 786 fichiers originaux avant et après**. Le test Kernel part d’une image synthétique, libère un contrôle inédit, reçoit une translation publique, puis libère sa réplication depuis une autre origine. Il vérifie l’acquisition unique et les analyses communes. Cette intégration ne revendique aucun niveau ARC réussi.

Les cas de référence exercent aussi les deux reports de curiosité, le partage d’une commande, les trois résultats de retour, la mauvaise paire, la portée périmée, le rappel d’axes et la restauration complète. Les consommateurs concordent avec les originaux dans ces cas.

### Limite précise de l’ordre à plusieurs rôles

L’original construit les rôles de `replicate_translation` par une intersection d’ensembles Python, dont l’ordre dépend du hachage. Le natif parcourt les rôles de l’observation. `AttentionMemory.observe`, original comme natif, s’arrête au premier rôle absent ou contradit. Si ces deux situations coexistent dans un même retour, le libellé peut donc être `unobserved` ou `contradicted` selon l’ordre.

Deux références explicites vérifient ces deux ordres avec les mêmes rasters. Les deux reprennent le parent et consomment le retour une fois, y compris après restauration. La consommation est fidèle pour un ordre donné ; le lot ne prétend pas reproduire un ordre de hash-set Python dans ce cas mixte. Aucun changement de priorité de libération ou contournement de garde n’est introduit pour masquer cette nuance.

## Campagnes réelles et contribution

### SYME : trois premiers niveaux réussis

Une session neuve de Logos Engine `0.34.0` réussit les **trois premiers niveaux de SYME**, sans réinitialisation de mémoire, saut de niveau ou action manuelle. Elle s’arrête naturellement à l’entrée du niveau 4 avec `target_levels_completed` et l’état officiel `NOT_FINISHED` : il ne s’agit pas d’une victoire complète sur les six niveaux.

| Niveau | Actions du niveau | Actions cumulées | Préfixes acquis du niveau |
| --- | ---: | ---: | ---: |
| 1 | 9 | 9 | 6 |
| 2 | 12 | 21 | 3 |
| 3 | 15 | **36** | 5 |
| Total | **36** | **36** | **14** |

Le [reçu d’exécution](lot2b-evidence/final/syme-control-attention/execution-syme.json) lie la campagne au même code gelé. La [comparaison du préfixe source disponible](lot2b-evidence/final/syme-control-attention/syme-original-prefix-comparison.json) confirme la concordance des **36 commandes et 37 paquets publics**. Les trois franchissements de niveau sont naturels ; les deux reprises intermédiaires conservent la même session et ses connaissances.

Le [reçu d’attribution](lot2b-evidence/final/syme-control-attention/syme-control-attention-attribution.json) identifie `regular_field_correspondence`, sélectionné au groupe `window_constraints` pour les 14 préfixes. Les nouveaux fournisseurs de contrôle et d’attention ne sont pas sollicités. SYME possède une réussite historique : cette nouvelle exécution est une démonstration et une non-régression de la livraison, pas une première capacité attribuée au lot 2B.

La vérification indépendante dans le navigateur retrouve **36 actions, trois niveaux réussis et 14 plans** à l’entrée du niveau 4. Les trois commandes « Run to next level » poursuivent la même session ; aucun contrôle manuel du jeu, saut de niveau ou redémarrage ne fournit la solution. Le [reçu navigateur](lot2b-evidence/final/browser/syme-verification.json) et la [capture finale](lot2b-evidence/final/browser/syme-three-levels.png) conservent ce résultat sur le preview géré. Les [parties du rapport de campagne](lot2b-evidence/final/syme-control-attention/syme-campaign.json.gz.parts.json) permettent sa reconstruction exacte.

### LS20 : amélioration du premier niveau, limite conservée au deuxième

La [campagne froide](lot2b-evidence/final/ls20-control-attention/execution-ls20.json) réussit le premier niveau en **17 actions**, contre **28** dans V61 : **11 actions de moins**. Elle utilise six expériences de contrôle, puis onze actions morphologiques. Le navigateur reproduit indépendamment ce résultat : **17 actions, un niveau terminé, onze plans acquis**, inspecteur fermé. Le [reçu navigateur](lot2b-evidence/final/browser/verification.json) et sa [capture](lot2b-evidence/final/browser/ls20-first-level.png) conservent cette vérification sur le preview géré.

La session complète atteint ensuite **`GAME_OVER` au niveau 2** : **133 actions, 79 préfixes, un seul niveau terminé**. Le niveau 2 contient 116 actions. L’objectif de trois niveaux LS20 n’est donc pas atteint. Les résultats négatifs ne sont ni remplacés par un succès synthétique ni exclus du bilan.

Le [reçu d’attribution](lot2b-evidence/final/ls20-control-attention/ls20-control-attention-attribution.json) vérifie les journaux publics exacts, leurs empreintes et la source gelée. Il établit les contributions suivantes :

| Fournisseur sélectionné | Préfixes | Actions acquises |
| --- | ---: | ---: |
| `acquire_control_for_target` | 14 | 14 |
| `attention_parent_return` | 2 | 2 |
| `morphology` | 14 | 65 |
| `observed_frontier` | 24 | 24 |
| `view` | 11 | 14 |
| `view_continuity` | 14 | 14 |

Les seize questions de contrôle sélectionnées couvrent les trois expériences : **7 commandes inédites, 6 réplications et 3 réplications après blocage contextuel**. `information_goal` est évalué 63 fois sans gagner de préfixe, mais son admission diffère deux questions et préserve deux témoins d’attention. L’évaluation, la sélection et l’effet sur une autre décision sont comptés séparément.

Deux chaînes complètes sont visibles dans les retours réels : à l’action 22, le témoin préservé reçoit un retour `contradicted`, puis `attention_parent_return` est sélectionné à l’action 23. Un second retour contradictoire à l’action 24 est consommé à l’action 25 par une réplication après blocage contextuel. Chaque retour est acquis et consommé une seule fois ; les répétitions du même état dans les snapshots ne sont pas recomptées.

La [comparaison froide avec V61](lot2b-evidence/final/ls20-control-attention/v61-first-command-divergence.json) retrouve les deux premières commandes, puis diverge à la troisième : V61 libère `ACTION1` depuis `view`, la nouvelle campagne libère `ACTION2` pour son contrôle. Le test s’arrête avant de fournir un retour incompatible. Cette comparaison établit une différence de décision à contexte public identique ; elle ne simule pas une campagne V61 complète ni une causalité exclusive du succès.

La [comparaison des composants avec les originaux](lot2b-evidence/final/ls20-control-attention/ls20-morphology-original-comparison.json.gz) passe sur **277 appels morphologiques réels**, **636 appels du contexte partagé**, **79 décisions mesurées** et **79 checkpoints scellés**. L’ancien comparateur conserve son périmètre de composant 2A : les nouveaux consommateurs stratégiques possèdent leurs références et traces distinctes. Les [parties du rapport complet](lot2b-evidence/final/ls20-control-attention/ls20-campaign.json.gz.parts.json) permettent de reconstruire ses octets sans réexécuter ni réinterpréter la partie.

### Autres essais et horloges

CATR s’arrête après **une action et aucun niveau**, sur `frontier_unknown`. Le moteur ne transforme pas cette absence de connaissance en loi de jeu. MOTO s’arrête à sa limite de calcul par niveau avec **109 actions acquises et aucun niveau**, puis le processus Node instrumenté manque de mémoire après l’événement terminal lors de la clôture du diagnostic. Le rapport complet MOTO est absent ; son reçu externe, sa sortie exacte et son journal public restent conservés. Aucune mesure générale de stabilité mémoire ne découle de cet essai. WEAV s’arrête également sur `level_active_time_budget`, après **97 actions acquises, 97 préfixes et aucun niveau**, pour 363,434 secondes de calcul actif. Son [reçu d’exécution](lot2b-evidence/final/weav-control-attention/execution-weav.json), son journal public et les [parties de son rapport complet](lot2b-evidence/final/weav-control-attention/weav-campaign.json.gz.parts.json) sont disponibles.

Les sélections et résolutions sont conservées à côté des campagnes. LS20 reprend les **475,601 secondes** de son essai précédent : le passage au candidat suivant intervient à **967,662 secondes cumulées**, bien avant 40 minutes. CATR est abandonné après 107,399 secondes de sélection et diagnostic ; MOTO après 500,457 secondes. WEAV est clôturé après 474,037 secondes, sans nouvel essai ni extension de budget. La démonstration SYME de trois niveaux étant acquise séparément, aucun essai LS19 n’est revendiqué. Ces horloges ne sont pas remises à zéro par une nouvelle tentative. Les temps des campagnes de validation, dont certaines se chevauchent, ne servent pas de comparaison de performance.

## Coûts et clôture

### Chemins communs et budget

La [comparaison avant/après](lot2b-evidence/performance/comparison.json) est **`passed`**, avec **16 médianes STCK/SMLP dans le budget de +10 %** et aucun dépassement non résolu. Le maximum observé est **+8,72 %** pour une nouvelle décision SMLP, de 529,392 à 575,578 ms sur 27 mesures. Le protocole, le runner, les traces publiques, les effectifs et les seuils sont identiques entre la base V61 et le code gelé 2B.

| Cas | Actions par session | Médiane avant | Médiane après | Variation observée |
| --- | ---: | ---: | ---: | ---: |
| STCK | 10 | 13,044 s | 11,821 s | −9,38 % |
| SMLP | 15 | 28,682 s | 28,098 s | −2,04 % |
| LIFE | 49 | 131,956 s | 128,367 s | −2,72 % |

Chaque version exécute trois sessions par cas, soit **222 actions mesurées et neuf actions de chauffe**. Les commandes sont recalculées avant la fourniture des retours publics archivés ; les trajectoires, les acquisitions et les points de Pause restent conformes. Les temps sont ceux du contrôleur et du service natifs sur ces retours, sans exécution du jeu, rendu du navigateur ou hébergement. LIFE fournit un diagnostic fini plus long, distinct des deux cas soumis au budget. Aucune baisse observée n'est présentée comme une optimisation générale.

Les hausses sont conservées même lorsque le budget des médianes passe. Sur STCK, la persistance passe de **179,800 à 192,292 ms** en médiane (**+6,95 %**, 39 mesures) ; son p95 passe de **395,986 à 427,666 ms**. La restauration des familles STCK passe de **69,959 à 81,991 ms au p95**, sur 36 mesures, malgré une médiane plus basse. Le budget de cette livraison porte sur les médianes annoncées ; il ne vaut pas promesse sur toutes les queues de distribution.

L'inspection STCK, mesurée séparément des seize métriques soumises au budget, augmente de **199,672 à 225,448 ms** côté service (**+12,91 %**, neuf mesures). Service et transport passent ensemble de 377,470 à 386,440 ms. Le rendu de l'inspecteur, l'acceptation et les copies du contrôleur ne sont pas compris. Cette hausse reste signalée ; l'effectif ne permet pas d'annoncer un p95 d'inspection.

Les fenêtres de mesure sont réservées au projet sans campagnes, tests, builds ni génération de références concurrents. Les activités externes de l'hôte et sa charge CPU ne sont pas enregistrées : cette coordination ne prouve pas l'isolation de la machine. Le [protocole](lot2b-evidence/performance/README.md), les [fenêtres](lot2b-evidence/performance/measurement-windows.json) et les [résultats détaillés](lot2b-evidence/performance/results.md) conservent les effectifs, étendues et variations entre répétitions. Les échantillons d'une session sont corrélés ; aucun p95 n'est annoncé sous 20 mesures. Les intervalles imbriqués ne s'additionnent pas. Pause est vérifiée au début du calcul et pendant la première action engagée, sans borne annoncée pour toute recherche longue. La persistance de LIFE ne prouve pas une stabilité mémoire sur plusieurs heures.

### Coût absolu des nouveaux consommateurs

Le [diagnostic de composant](lot2b-evidence/performance/component-costs.json.gz) passe ses six cas, avec **20 appels mesurés après trois chauffes par cas**. Les observations, décisions morphologiques et états proviennent d'une vraie acquisition par le Kernel sur un protocole public synthétique de deux actions, avec mémoire initiale vide. Chaque répétition restaure un état neuf. Les offres d'information supplémentaires constituent une entrée de frontière explicitement déclarée ; leur production naturelle par cette scène n'est pas revendiquée.

| Appel mesuré | Médiane | p95 | Résultat effectivement obtenu |
| --- | ---: | ---: | --- |
| Inspection d'une réplication | 0,515 ms | 8,311 ms | Expérience disponible, sans proposition |
| Proposition d'une réplication | 19,401 ms | 30,105 ms | Proposition de la frontière commune |
| Question différente sans retour lié | 0,742 ms | 5,411 ms | Report et préservation du témoin |
| Question utilisant la même action | 18,993 ms | 24,560 ms | Proposition annotée par le test de contrôle commun |
| Réplication liée à l'attention courante | 13,248 ms | 18,378 ms | Proposition liée au témoin courant |
| Reprise du parent après retour | 1,769 ms | 2,628 ms | Proposition d'un autre contrôle public encore inutilisé |

Ces temps isolent l'appel nommé ; la restauration et la préparation sont mesurées séparément. La restauration médiane se situe entre 27,627 et 31,011 ms selon le cas. Le recensement distinct observe **30 appels à `structuredClone` pour la restauration**, puis respectivement **0, 155, 1, 155, 155 et 7** pendant les six opérations ci-dessus. Il ne mesure ni les octets copiés, ni les copies par tableaux, étalement ou JSON. L'interception du recensement est désactivée pendant les mesures de temps.

Les propriétaires de frontière et d'attention sont réels. Dans le dernier cas, le retour observé est `matched`, la décision courante reste `retained / control_not_currently_attested`, et le retour consommé une fois mène bien à une nouvelle proposition. Ces appels ne mesurent pas toute la sélection du runtime, WHY/ACT, le transport worker ou un jeu réel. V61 n'avait pas ces consommateurs raccordés : aucune base de coût nulle ni ratio artificiel n'est créé. La réplication après blocage contextuel conserve ses preuves fonctionnelles et sa contribution LS20 ; elle n'est pas un septième cas de ce diagnostic de coût.

### Contrôles de livraison

Le [reçu des contrôles](lot2b-evidence/final/validation/checks-run.json) confirme typecheck, audit des entrées, audit de migration, contrôle du diff et build de production. L'audit réconcilié donne **151 composants vérifiés, 126 transferts partiels et 1 092 modules en attente**, sans module déclaré pleinement transféré. Les campagnes, leurs échecs, les contrôles navigateur et les mesures sont conservés avec leurs empreintes ; le [contrôle final d'intégrité](lot2b-evidence/final/delivery-integrity.json) lie leur transport au code validé sans rejouer ni réinterpréter les jeux.

## Prochaine étape

Le **lot 2C** reste ouvert : méthodes de station et d’entrée, retour d’accès, réassociation, réarmement et continuations conditionnelles. Les capacités gérées nécessitant une méthode non nulle restent hors du domaine 2A/2B. Les stations courantes déjà acquises ne suffisent pas à déclarer ces méthodes historiques transférées.

Le raccord des deux fournisseurs communs n’ajoute pas d’entrée aux quatre listes DRM : le compteur reste **50/76**, avec **26 entrées restantes** et **37 workflows compilés**. Le lot 2 global et les six conditions de migration complète demeurent ouverts. La feuille de route conserve les lots 3 à 11 et leurs dépendances propres.
