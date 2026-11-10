# Lot 3F : ReferencePopulation, moteur natif 0.47

## État de la livraison

Le transfert de `reference_population_plan` est raccordé au propriétaire commun. Le périmètre fonctionnel passe **2 086 tests sur 2 086**, les cinq contrôles du projet et **51 contrôles de régression sur 51**. Une campagne froide VOIS atteint **trois niveaux en 78 actions et 42 préfixes**, avec arrivée au niveau 4. La trajectoire propre concorde avec les méthodes Python originales inchangées ; sa contribution aux décisions est établie par des ablations des connaissances réellement acquises. Les [tests formels](lot3f-evidence/final/validation/delta-tests-run.json), les [régressions](lot3f-evidence/final/regressions/regression-summary.json), le [reçu de campagne](lot3f-evidence/final/vois-population-session/execution-vois.json) et la [comparaison originale](lot3f-evidence/diagnostic/vois-public-parity.json) documentent ces résultats séparément.

Le navigateur confirme également les trois niveaux et les compteurs **78 actions / 42 plans**, après Pause, action isolée et reprise. **3F est clôturé dans son périmètre annoncé : fonctionnel vérifié, intégrité finale conforme et coût global accepté sur les deux jeux.** La fenêtre officielle donne **STCK −0,405643 % et SMLP −1,789668 %**, avec **16/16 critères agrégés** et une revue arithmétique **231/231**. Les limites de source, les résultats défavorables de cohorte et les pointes de latence restent publiés. Cette clôture ne concerne ni le lot 3 entier ni la migration complète.

## Périmètre et version de référence

Le point de départ est la publication privée **74 / moteur 0.46.0**, commit `a6edbb838670785733155262ae95f69892a236fc`. Son gel natif est `5adf58cb9bd0802dd083812e7591c53cb786410ad23c14a29814d870ef67276c`, avec 260 fichiers natifs. Le [reçu de provenance](lot3f-evidence/baseline/provenance.json) identifie ce checkout publié, distinct du candidat.

Le candidat **0.47.0** est gelé sous le digest `54d8742300a04dcdf0cb1b038bc62b947d4a1c60f70da4ee80e6971b0f021165`. Le [manifeste](lot3f-evidence/final/source-manifest.json) contient **263 fichiers natifs** ; l’[archive du gel](lot3f-evidence/final/source-archive.json) conserve **274 fichiers**, dont les entrées passives nécessaires à la campagne. Le [manifeste des fragments](lot3f-evidence/final/source-archive-parts.json) permet le transport de cette archive sans modifier son contenu.

La nouvelle branche porte sur la population mesurée, la référence visible, l’affectation injective de cellules, la sélection expérimentale d’un membre, les contrôles acquis par déplacement et la revalidation de l’occupation courante. Le moteur exécuté reste TypeScript. Les originaux Python servent de référence de développement et de comparaison ; aucun module d’agent Python ne décide les actions de la campagne native. Les scripts de preuve relisent les observations publiques conservées et ne fournissent ni solution ni état attendu à la session. La [filiation détaillée](lot3f-reference-population-lineage.md) relie chaque contrat à sa source et à sa cible native.

## Ce que mesurent les compteurs de migration

| Mesure | Résultat dans 0.47 | Signification |
| --- | ---: | --- |
| Branches déclarées d’`observed_composition_services` | **6/6** | Panel, Chamber, Exposed, RootedLine, ReceptionService et ReferencePopulation sont raccordés dans la façade commune. |
| Entrées des quatre listes DRM ordonnées | **51/76**, aucune entrée partiellement raccordée | Compteur de raccordement des fournisseurs déclarés ; 25 entrées restent à raccorder. |
| Workflows compilés | **37** | Compteur de compilation, distinct de la consommation effective et de la parité comportementale. |
| Modules avec contrats de composant vérifiés | **159** | `component_verified`, sans promotion automatique en transfert complet. |
| Modules partiellement transférés | **142** | `partial_transfer`, dont les fermetures héritées incomplètes. |
| Modules en attente | **1 068** | Périmètre restant de l’inventaire source. |
| Modules déclarés entièrement vérifiés | **0** | La migration complète n’est pas revendiquée. |

Le [registre des entrées](v6-entry-point-progress.json) et le [journal d’audit de migration](lot3f-evidence/final/validation/migration-audit-output.log.gz) donnent ces dénominateurs. Les six branches complètes de la façade ne font pas disparaître le statut `partial_transfer` du module commun : EphemeralMap, les fermetures héritées et la parité de l’appelant original complet restent qualifiés séparément. `fullV6Parity` reste faux.

Les six portes de complétude du [registre de transfert](../../migration/v6-transfer-map.json) restent toutes à **false** : `allRequiredCapabilitiesTransferred`, `fullCommonCallerDifferentialParity`, `allDeclaredFamiliesIntegrated`, `commonGraphEditingCoversExecutedPrograms`, `pythonNumericSemanticsCovered` et `fullCampaignRegression`. Le succès d’un cas, l’égalité d’une trajectoire propre et le raccordement d’une façade ne suffisent à valider aucune de ces six portes.

## Fonctionnement transféré et propriété des connaissances

La projection fraîche cherche une zone et une référence visibles compatibles avec une grille de carrés. Elle déduit le pas, les cellules du domaine, la population et les cellules cibles depuis les pixels publics. La revalidation retenue relit la population complète et le rectangle de référence ; un marqueur d’un pixel est accepté uniquement après avoir été effectivement observé. Un carré non uniforme qui ne respecte pas la règle du marqueur appris n’est pas compté comme membre. La réutilisation échoue si le nombre de membres comptés diffère de la population retenue, ou si le rectangle de référence a changé. Une variation ailleurs, notamment sur une cellule vide ou dans le cadre retenu, ne provoque pas nécessairement un refus. Les couleurs demeurent des apparences observées : aucun rôle de couleur propre à un jeu n’est installé. Voir la [projection native](../../src/logos-engine/v6-reference-population-observation.ts) et les règles détaillées dans la [filiation](lot3f-reference-population-lineage.md).

Les contrôles de déplacement viennent des retours acquis. Pour les membres restant hors cible, la branche calcule des chemins dans le domaine mesuré, en tenant compte des autres cellules occupées. Le sous-calcul V5 consommé construit un appariement injectif maximal ; la recherche par plafonds croissants des longueurs conserve un témoin complet lorsque le domaine courant le permet. Il ne s’agit pas d’une garantie d’ordonnancement global optimal de tous les membres. Le pas physique V5 transféré vérifie seulement le déplacement cardinal conditionnel d’une identité active, avec collisions et occupation complète. Les autres opérations de construction, cycle, point, couleur et recherche de programmes de la façade V5 restent hors de ce lot. Voir le [calcul natif consommé](../../src/logos-engine/v5-reference-population-calculus.ts).

Une sélection par point est une expérience. Elle peut acquérir un marqueur ou placer une cellule en attente, mais l’identité contrôlée n’est confirmée que par un déplacement effectivement observé. Quand une unique cellule disparaît et une autre apparaît après une commande non ponctuelle, un déplacement cardinal unitaire acquiert le contrôle et ses références avant/après. Le journal retient aussi les essais antérieurs et les relations locales d’apparence, avec `observed_samples_only_no_complete_law`. L’[accès propre](../../src/logos-engine/v6-reference-population-access.ts) conserve explicitement la différence entre sélection, sondage et déplacement prévu.

Le propriétaire commun appelle les propositions et gardes dans l’ordre Population, Reception, RootedLine, Panel, Chamber, Exposed, puis les ancêtres transférés. L’acquisition de Population vient après Reception et avant l’enregistrement public commun. Chaque événement `observed_reference_population` a un seul propriétaire. Planifier laisse ce propriétaire inchangé ; un retour sans plan propre, une frontière d’époque ou une revalidation manquante peut produire **zéro événement propre**. Cette absence reste un résultat vérifiable et ne doit pas être remplacée par une acquisition fictive.

La restauration reconstruit les réducteurs temporaires, valide les couches et le digest, puis publie l’état atomiquement. Identité, révision et témoin structurel de la mémoire Population participent au certificat commun. Le suffixe Population n’entre dans le digest commun qu’après sa première acquisition, ce qui conserve les checkpoints 0.46 sans cette couche ; la classe originale ajoute son suffixe même à vide. Cette adaptation de compatibilité est distincte du digest propre comparé sur un parent opaque. Les [huit checkpoints antérieurs](../../tests/fixtures/v6-reference-population-legacy-checkpoints.json.gz), produits par le checkout publié 0.46, couvrent les états vide, Pair, Panel, Chamber, Exposed, RootedLine, Reception et combiné. La [revue d’intégration](lot3f-evidence/diagnostic/shared-integration-review.json) conserve ces qualifications de propriété et de restauration.

## Limites conservées et adaptations natives

| Limite ou comportement constaté | Traitement et portée de la livraison |
| --- | --- |
| Le cadre de réception n’est pas entièrement reconstruit à chaque continuation. | La garde retenue peut accepter un coin de ce cadre modifié si la population et la référence restent valides. Le contre-exemple original est conservé. La liaison initiale porte toujours sur l’image complète. |
| Une commande de déplacement prévue peut ne produire aucun déplacement. | La garde ferme le préfixe, mais la couche source ne révoque pas automatiquement le contrôle déjà acquis. Le transfert ne prétend pas apprendre une réfutation générale absente de la source. |
| Les contrôles acquis survivent au changement d’époque. | L’état courant est réinitialisé pour la nouvelle époque ; les contrôles globaux disponibles sont conservés selon la source. Cela ne prouve pas l’universalité de leur loi entre niveaux. |
| Toutes les cellules cibles peuvent être occupées sans loi d’apparence ou de terminaison connue. | La branche garde le refus `reference_occupancy_prepared_color_relation_or_terminal_unknown`. Elle ne produit pas elle-même une victoire officielle. |
| Une image retenue tronquée ou une sélection en attente sans entrée non ponctuelle peut provoquer une exception Python. | Les trois exceptions originales sont archivées. Le natif refuse par `RangeError` sur ces cas, sans revendiquer une égalité des noms et messages d’exception entre langages. |
| La source peut proposer `ACTION6` indisponible et accepte les tranches de limite nulle ou négative. | Les résultats source sont conservés. La garde refuse une commande indisponible ; l’enveloppe commune impose un budget positif et un préfixe au plus égal à 16 actions. |
| La proposition originale n’a pas son propre budget de chemins et d’appariement. | L’option `native_reference_population_bounds` ajoute des refus de domaine, travail et échéance. Les bornes consommées par défaut sont 4 096 cellules, 100 000 visites et 2 000 ms, avec au plus 128 occurrences ; l’échéance de niveau peut être plus proche. Un refus reste inconnu et n’acquiert aucune loi physique. |
| Python admet un domaine de valeurs et de conversions plus large. | Les sous-calculs natifs déclarent leur domaine JSON portable, leurs entiers sûrs et leurs erreurs propres. Les conversions générales Pydantic, les entiers Python arbitraires et toute la sémantique numérique Python ne sont pas déclarés transférés. |
| Le parent de ReferencePopulation conserve une fermeture héritée partielle. | Le rejeu exact de la couche propre compare son suffixe sur un digest parent opaque. Il ne certifie pas l’ensemble du contrôleur original ni les adaptations natives héritées de Reception. |

Ces réserves sont des contrats de portée, pas des résultats retirés de la validation. Les cas contradictoires, les limites de domaine, les refus et les exceptions restent dans les [fixtures originales](../../tests/fixtures/v6-reference-population-reference.json.gz), la [filiation](lot3f-reference-population-lineage.md) et les tests correspondants. Aucun succès de campagne ne les annule.

## Oracle indépendant et validation formelle

L’[export original](lot3f-evidence/diagnostic/source-oracle-export.json) vérifie les 1 786 fichiers de référence avant et après génération. Il conserve **89 cas propres** — scènes, points, entrées, chemins, relations, propositions, acquisitions et rejeux —, **24 gardes**, **3 exceptions**, **10 cas d’appariement V5** et **19 cas du pas physique consommé**. Deux acquisitions forment une chaîne froide cohérente : le retour réellement calculé de la sélection devient l’entrée du sondage suivant. Les autres graines synthétiques couvrent les branches indépendantes des contrats et ne servent pas à initialiser une campagne.

La validation formelle du gel 0.47 passe **2 086/2 086 tests dans 60 fichiers**, sans échec, annulation, test ignoré ou TODO. Le reçu conserve les empreintes des sources et des tests avant/après. C’est le périmètre affecté déclaré pour cette livraison ; ce nombre ne désigne pas toute la suite historique. Les [résultats structurés](lot3f-evidence/final/validation/delta-tests-run.json) et le [journal complet](lot3f-evidence/final/validation/delta-tests-output.log.gz) sont conservés.

Les **5/5 contrôles** passent : TypeScript, audit des entrées, audit de migration, vérification du diff et compilation. Le [reçu des contrôles](lot3f-evidence/final/validation/checks-run.json) lie chaque exécution au même gel natif. Les contrats propres vérifient notamment l’immuabilité des propositions et exports, l’absence d’acquisition anticipée, les refus bornés, la restauration et les anciens checkpoints. La revue commune a corrigé avant gel une assertion de qualification devenue ancienne et renforcé le contrôle d’identité des propriétaires après restauration refusée ; les journaux de développement correspondants restent conservés dans le [reçu de revue](lot3f-evidence/diagnostic/shared-integration-review.json).

## Régressions CATR, RSWP et FOGW

Les trois rejeux publics conservent **81 actions archivées**, avec **17 contrôles stricts par cas**, soit **51/51**. Chaque commande est recalculée avant que l’hôte fournisse le retour public attendu. Les sources natives et les entrées de rejeu restent inchangées pendant les exécutions.

| Cas | Actions conservées | Préfixes conservés | Niveaux conservés | Contrôles |
| --- | ---: | ---: | ---: | ---: |
| CATR | 12 | 8 | 3 | 17/17 |
| RSWP | 19 | 11 | 3 | 17/17 |
| FOGW | 50 | 27 | 3 | 17/17 |
| Total | **81** | **46** | — | **51/51** |

La [synthèse](lot3f-evidence/final/regressions/regression-summary.json) et les comparaisons [CATR](lot3f-evidence/final/regressions/catr-046-comparison.json), [RSWP](lot3f-evidence/final/regressions/rswp-046-comparison.json) et [FOGW](lot3f-evidence/final/regressions/fogw-046-comparison.json) détaillent les commandes, paquets, frontières, sélection, coordination et compteurs couverts. Ces rejeux ne constituent pas de nouvelles victoires en direct ni une mesure de vitesse. Les payloads complets de chaque fournisseur, tous les identifiants dérivés, les chaînes du graphe et la parité de l’appelant original complet restent hors des assertions de ce comparateur historique. La présence passive d’un nouveau propriétaire n’est pas assimilée à une contribution de ses décisions.

## Campagne réelle VOIS

Le choix du cas vient du [scan de projection original](lot3f-evidence/diagnostic/reference-population-public-admission.json) sur **97 images initiales déjà archivées**, sans action ni saut de niveau. VOIS est le seul cas admis par cette projection. L’admission est géométrique ; elle ne fournit aucun trajet et ne prédit pas la réussite de la campagne.

La référence publiée 0.46 s’arrête après **une action, un préfixe et zéro niveau**, avec `frontier_unknown`. Le plafond extérieur préparé était de 16 actions ; il n’est pas atteint. Ce résultat est conservé dans le [rapport de référence](lot3f-evidence/baseline/vois-bounded-reference/vois-campaign.json.gz), sa [trace publique](lot3f-evidence/baseline/vois-bounded-reference/vois-public-trace.json.gz) et son [reçu d’exécution](lot3f-evidence/baseline/vois-bounded-reference/execution-vois.json). Il décrit l’arrêt observé de cette version et ne mesure pas un rapport de vitesse entre les moteurs.

Le candidat 0.47 réussit **trois niveaux en une seule session froide**, sans saut de niveau ni réinitialisation entre les niveaux. Il termine au niveau 4, état `NOT_FINISHED`, avec la raison `target_levels_completed`. Une victoire sur la totalité du jeu n’est donc pas revendiquée.

| Niveau terminé | Actions du niveau | Préfixes / plans du niveau | Actions cumulées |
| --- | ---: | ---: | ---: |
| 1 | 14 | 9 | 14 |
| 2 | 22 | 12 | 36 |
| 3 | 42 | 21 | 78 |
| Total | **78** | **42** | **78** |

Les plafonds de la campagne restent **600 actions et 360 secondes actives par niveau**. Le [rapport de campagne transporté par fragments](lot3f-evidence/final/vois-population-session/vois-campaign.json.gz.parts.json), la [trace complète](lot3f-evidence/final/vois-population-session/vois-public-trace.json.gz), le [journal public indépendant](lot3f-evidence/final/vois-population-session/vois-actual-public-journal.jsonl.gz) et le [reçu d’exécution](lot3f-evidence/final/vois-population-session/execution-vois.json) conservent les 78 commandes et les 79 paquets publics. Le paquet initial complet et les empreintes des ressources opaques du jeu concordent avec la référence. La campagne déclare zéro module d’agent Python et un code natif inchangé.

## Concordance exacte avec l’original sur la trajectoire propre

Le [rejeu Python indépendant](lot3f-evidence/diagnostic/vois-public-source-replay.json.gz) repart de `ReferencePopulationAccess` vide. Chaque proposition est calculée par l’original inchangé ; chaque état ultérieur provient de son acquisition des retours publics réels. Le contenu de `state` dans les plans natifs capturés n’amorce jamais cette mémoire. Le calcul n’exécute aucun jeu et n’ajoute aucune action.

Le résultat concorde sur **42 préfixes, 78 retours et 75 événements propres**, avec **zéro différence et zéro exception**. Les acquisitions restent vides aux trois frontières, actions **14, 36 et 78**. Les **79 observations complètes** re-mesurées par l’observateur original correspondent aux captures Inventory. Gardes, commandes, résultats capturés, projections retenues, événements, contrôles, états et suffixes de digest sont comparés dans le périmètre propre.

Le [checker natif](lot3f-evidence/diagnostic/check-reference-population-public-parity.mjs) réalise **3 434 contrôles, tous réussis**, et **43 reconstructions**. Il repart lui aussi de la mémoire vide et reconstruit celle-ci après chaque préfixe. Les [résultats](lot3f-evidence/diagnostic/vois-public-parity.json) distinguent `completeSelectedOwnTrajectoryParity: true` et `fullInheritedCallerParity: false`. Les **1 786 originaux** sont vérifiés avant et après les rejeux ; le [reçu d’exécution](lot3f-evidence/diagnostic/vois-public-replay-execution.json) conserve les empreintes, commandes et journaux.

Cette égalité porte sur les décisions et acquisitions propres effectivement sélectionnées. Le parent demeure une frontière de digest opaque. Les échéances de temps réel et les interruptions de travail natives ne sont pas simulées dans ce rejeu déterministe d’un calcul terminé. La preuve ne mesure pas les coûts et ne remplace pas une comparaison de l’appelant original complet.

## Contribution des connaissances réellement acquises

La [preuve de contribution](lot3f-evidence/final/vois-population-session/reference-population-contribution.json.gz) recalcule indépendamment les **42 plans, 78 actions, 75 acquisitions, 3 retours vides et 43 restaurations**. Les **79 observations re-mesurées** correspondent toutes aux captures Inventory. La proposition transmise à l’acquisition est celle recalculée pendant le rejeu. Aucune mémoire d’un plan capturé, aucun événement courant ou futur et aucune solution ne préparent la décision.

Les ablations ne changent que des champs nommés du dernier état déjà acquis. Elles conservent les événements plus anciens, les détails de transition et le journal public réel. Les résultats sans effet restent dans le rapport.

| Mesure des ablations | Résultat |
| --- | ---: |
| Interventions conservées | **252** |
| Interventions modifiant effectivement la connaissance retenue | **200** |
| Changements d’action ou de refus | **100** |
| Changements de projection de décision | **148** |
| Changements de proposition stricte | **194** |
| Changements de proposition stricte sans changement de projection de décision | **46** |
| Projections de décision inchangées | **104** |

Les contrôles acquis, l’identité active, la sélection en attente et les marqueurs observés ont un effet d’action ou de refus démontré sur cette trajectoire. Aucun effet d’action n’est observé pour `tried`. Ce résultat négatif reste publié ; il ne prouve pas que le champ est inutile dans tous les contextes. Les 46 différences limitées à la proposition stricte ne comptent pas comme contribution aux décisions. Les 252 interventions ne sont pas des tentatives supplémentaires de jeu.

Le [script générique](../../scripts/prove-observed-reference-population-contribution.mjs) fixe l’horloge du rejeu pour éviter la variation temporelle tout en gardant les bornes finies de domaine et de nœuds. Il prouve la reconstruction et les effets des interventions, pas la consommation de temps réel. Le [reçu de transport](lot3f-evidence/contribution-transport.json) atteste la compression déterministe et la restitution octet pour octet du résultat original : SHA-256 `6d61dbea3376060da97436362ae3d888087122c740c6961a01747a761565b225`, **1 100 208 octets** avant compression. La qualification de réussite du jeu reste celle de la campagne ; un statut de preuve `passed` n’ajoute aucun niveau réussi.

## Horloge cumulative et incidents de préparation

L’[horloge VOIS](lot3f-evidence/diagnostic/vois-clock-start.json) est ancrée au **10 novembre 2026 à 13:48:47,319628 UTC**. Le [reçu de résolution](lot3f-evidence/final/vois-resolution.json) arrête le travail du cas à **14:05:44,789159 UTC**, soit **1 017,469531 secondes cumulées sur 2 400**. Il reste **1 382,530469 secondes** dans cette enveloppe. Le comptage inclut la préparation du lancement, la référence, la campagne, les comparaisons, les ablations et les deux tentatives navigateur, sans remise à zéro.

Le [reçu d’incident de lancement](lot3f-evidence/diagnostic/baseline-launch-preparation-error.json) conserve deux erreurs de préparation survenues avant la création de l’hôte du jeu : mauvais répertoire courant, puis manifeste absent. Elles ont exécuté zéro action. Le départ cumulatif a été placé plus tôt pour inclure leur temps, sans exclusion ni remise à zéro.

Les horloges antérieures restent conservées dans le même reçu : **CWSE 2 399,683865 s**, **SK48 667,35444 s**, **FOGW 951,320275 s**. Les limites et réserves de ces livraisons demeurent distinctes de la nouvelle campagne VOIS. Le présent rapport n’autorise aucune reprise de cas ni aucun essai supplémentaire.

Le travail VOIS est clos pour cette livraison. Tout diagnostic futur doit reprendre son compteur cumulatif conservé. Le transport des fichiers, la documentation, l’intégrité de livraison et la fenêtre STCK/SMLP sont enregistrés comme travail de livraison séparé ; ils n’ajoutent aucune tentative VOIS.

## Validation navigateur

Le [reçu navigateur](lot3f-evidence/final/browser/browser-qa.json) confirme une session froide continue de **78 actions, trois niveaux et 42 plans**, avec arrivée naturelle au niveau 4. La session commence à zéro action. Une Pause est observée après **8 actions**, puis la commande d’action isolée produit exactement la **9e action**. La reprise mène aux passages de niveau **14 / 36 / 78 actions**, avec **9 / 21 / 42 plans cumulés**. La [capture finale](lot3f-evidence/final/browser/vois-final.png) et l’[observation d’accessibilité](lot3f-evidence/final/browser/vois-final-ax.txt) sont conservées.

La vérification repose sur les contrôles visibles, les états accessibles et la capture. Aucun état caché d’agent ou de jeu n’a été inspecté ; aucune action manuelle de jeu, injection de mémoire ou commande de saut de niveau n’a été employée. Le gel et le build identifient le moteur 0.47 utilisé dans l’aperçu.

Une première tentative navigateur avait atteint deux niveaux avant d’être interrompue par un clic de l’opérateur sur un lien de navigation de la page. L’[incident](lot3f-evidence/final/browser/attempt1-navigation-interruption.json) est conservé séparément et ne compte pas comme une réussite de trois niveaux. Une seconde tentative, démarrée à froid depuis le niveau 1, fournit la continuité complète décrite ci-dessus. Les deux tentatives sont incluses dans l’horloge cumulative ; leur distinction n’efface aucun temps ni résultat.

## Intégrité de la livraison

Le [reçu d’intégrité](lot3f-evidence/final/delivery-integrity.json) est conforme : **263 fichiers natifs**, **274 fichiers d’archive**, **595 entrées de sources et tests**, **328 entrées de compilation** et **sept entrées d’exécution des régressions** correspondent aux empreintes enregistrées. Les quatre rapports découpés sont reconstructibles à l’identique depuis **24 parties**, soit **19 465 512 octets restaurés**. La contribution conserve séparément son JSON exact de **1 100 208 octets** dans un gzip déterministe, avec un [reçu de reconstruction](lot3f-evidence/contribution-transport.json). Cette vérification ne relance aucun test, jeu ou mesure.

## Coûts officiels — acceptés selon la règle globale

La [décision globale](lot3f-evidence/performance/global-budget-decision.json) accepte **2/2 jeux**, statut `accepted_under_user_global_rule`. Le [rapport complet](lot3f-evidence/performance/results.md) conserve les deux cohortes, leur agrégat, les distributions, les p95 disponibles, l’inspection, Pause et les échantillons mémoire. La [politique autorisée](lot3f-evidence/performance/global-budget-policy.json), le [protocole](lot3f-evidence/performance/protocol.md) et la [déclaration](lot3f-evidence/performance/declaration.json) ont été fixés avant la comparaison du gel 0.47 à la publication 0.46 remesurée. Les résultats historiques de 3E ne servent pas de nouvelle mesure.

| Jeu | Médiane de session 0.46 fraîche | Médiane de session 0.47 | Variation | Décision |
| --- | ---: | ---: | ---: | --- |
| STCK | 10 051,918945 ms | 10 011,144032 ms | **−0,405643 %** | Accepté |
| SMLP | 17 016,049866 ms | 16 711,519103 ms | **−1,789668 %** | Accepté |

La règle de l’utilisateur est conservée : une phase dépassant +10 % peut être acceptée si le **coût global reste strictement sous +10 %**. Le global est la médiane des durées de session complètes, calculée séparément pour STCK et SMLP sur les huit sessions de chaque version. Les deux jeux satisfont ce critère ; aucun ne compense l’autre. Les médianes de phases imbriquées ne sont pas additionnées et les ratios des cohortes ne sont pas moyennés pour fabriquer le résultat global.

La [fenêtre](lot3f-evidence/performance/window.json) s’est déroulée le **10 novembre 2026 de 14:07:48 à 14:16:20 UTC**, dans l’ordre **A1 / B1 / B2 / A2**, soit deux cohortes, **32 sessions mesurées et 400 actions**. Les huit chauffes de trois actions sont les seules exclusions ; aucune session mesurée ni valeur extrême n’a été retirée. L’intégrité des deux sources, du harnais et des intrants est conforme avant, pendant et après les séries. La [revue indépendante](lot3f-evidence/performance/consolidation-review.json) passe **231/231 contrôles**.

Les **16 critères diagnostiques agrégés, sessions et phases comprises, passent**. La première cohorte conserve **16/16**, la seconde **14/16** : la restauration y augmente de **19,466359 % sur STCK** et de **23,450648 % sur SMLP**. Leurs classifications `over_budget_with_noise_unresolved` restent inchangées. Au niveau agrégé, ces restaurations sont respectivement à **+7,703109 %** et **−4,642440 %**. Cette distinction décrit les mesures conservées ; elle ne retire aucune observation de la décision globale.

Les pointes restent également visibles. Sur l’agrégat STCK, le p95 de service d’un préfixe connu passe de **11,940 à 20,996 ms**, celui de requête de **15,232 à 23,257 ms**, et celui de garde de **0,355195 à 0,425454 ms**. En cohorte 2, le p95 du garde SMLP passe de **0,883444 à 9,265536 ms** sur 24 observations par version, et celui de restauration STCK de **43,197 à 57,564 ms**. Le rapport complet conserve toutes les autres variations, même défavorables. Ces distributions n’établissent pas une cause ni une garantie de latence en production. Avec huit sessions par jeu et par version, aucun p95 de session n’est annoncé.

Cette fenêtre porte sur la boucle commune mesurée à partir de retours publics enregistrés, distincte du temps du jeu, du rendu, du réseau et du rejeu de contribution. Elle ne prouve pas que ReferencePopulation est la cause des baisses de médiane. Les [journaux transportés sans perte](lot3f-evidence/performance/log-transport.json) et le [reçu de rendu](lot3f-evidence/performance/results-render.json) lient les résultats à leurs fichiers originaux.

## Décision et suite

Les preuves établissent le transfert propre de ReferencePopulation, sa compatibilité de restauration, la conservation des trois régressions et son utilisation acquise sur trois niveaux VOIS. L’interface confirme ces résultats après Pause, action isolée et reprise, et le bilan cumulatif du cas est conservé. **Le fonctionnel, l’intégrité et les deux critères de coût global sont acquis : 3F est clôturé dans son périmètre annoncé.** Le prochain transfert autonome est **`framed_window_composition`**, puis **`coupled_prefix_reference`** et **`recurrent_series`**.

Le raccordement **6/6** achève les branches déclarées de cette façade. La suite de la migration doit toujours traiter les fermetures héritées et les entrées restantes selon la [feuille de route](v6-delivery-roadmap.md), en conservant les réserves de revalidation de cadre, de réfutation des contrôles, de portée entre époques et de lois d’apparence ou de terminaison. Les compteurs **51/76**, **37 workflows** et les six portes de complétude fausses restent les repères distincts de ce travail. Aucun nouveau statut global de migration n’est déduit du seul succès de la branche.
