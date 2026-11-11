# Lot 4C : correspondances et exemples de faces

## Fonctionnel validé et coût accepté en 0.57 ; publication en attente

Les branches simples et composées de `facet_example` sont transférées et fonctionnellement validées dans le runtime commun. Le [gel final native 0.57.0](lot4c-evidence/integrated-final/source-manifest.json), digest `eebd099808672be934389020c8f9061df4fdacab28cd7d60c00cd1b080464c04`, contient **298 fichiers natifs** ; son [archive d'exécution](lot4c-evidence/integrated-final/source-archive.json) conserve **309 fichiers**, au commit de gel `6065d67c18b1ad85bd62b60c36c6962f18bfeab3`. La référence Python reste `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

Le prédécesseur effectivement publié est **10A / Site 91 / native 0.56.0**, commit `5659ddc9420c7624df4865f0afc628782296a186`, déploiement confirmé le **10 novembre 2026 à 21:42:39 UTC−03**. Le [reçu Site 91](lot4c-evidence/planning/published-predecessor-site91.json) et la [réconciliation Sites 90–91](lot4c-evidence/planning/published-predecessor-source-closure.json) vérifient la même archive d'application et une clôture uniquement documentaire ; le gel 0.57 reste inchangé. **Le coût officiel 4C est accepté pour les deux jeux ; sa publication reste en attente. Aucun numéro de publication future n'est attribué.**

La [filiation source](lot4c-facet-examples-lineage.md) détaille les contrats. Le [répertoire de preuves](lot4c-evidence/README.md) distingue les essais de développement, la validation intégrée et les mesures officielles.

## Comportement transféré

Le propriétaire unique `facet_examples` occupe la première entrée du groupe `surface`, sous la sous-question `facet_example`, et utilise le workflow déjà compilé `v6.facet_examples.choose`. Une réponse nulle laisse continuer les autres fournisseurs du groupe. L'acquisition concerne exclusivement une proposition Facet sélectionnée, liée à son observation et à sa commande exactes.

Une correspondance visible peut proposer un germe ou une intervention sur une face. Le retour permet de distinguer une absence d'effet, une translation de face, une extension des côtés, une modification extérieure et une frontière officielle. Le germe observé, le déplacement mesuré et la frontière constituent les conditions de rappel d'une méthode portable. Les compositions revalident leur stencil, leur référence et leur préfixe visible avant chaque intervention.

Une composition visuellement conforme sans progrès officiel est conservée comme `compound_visual_candidate_not_accepted`. Sa portée est réfutée pour éviter de répéter la même composition sans justification. Le moteur ne déduit aucune propriété cachée de la seule apparence.

## Mémoire et effet des connaissances

Les sept champs durables sont `failed`, `events`, `method`, `epoch`, `portable`, `compound_methods` et `refuted_compounds`. Un changement d'époque efface les essais et méthodes locaux, puis conserve l'historique et la méthode portable. Le cache de recherche composée est recalculable et ne fait pas partie de cette mémoire.

La méthode simple et les méthodes composées locales peuvent enrichir les justifications sans changer le point géométrique proposé. Les ablations doivent donc distinguer un changement d'action ou de refus, un changement de métadonnées et un résultat inchangé. La méthode portable et les exclusions acquises peuvent, elles, déterminer l'admissibilité de la proposition suivante.

Le raccordement commun conserve un événement source, écrit l'état du propriétaire puis restaure réellement ce même propriétaire. Une acquisition Feedback ou d'une autre famille ne doit pas acquérir de connaissance Facet.

## Adaptations TypeScript délimitées

La géométrie conserve l'ordre d'insertion des valeurs numériques, la division entière Python vers moins l'infini, l'ordre consommé des différences d'ensembles et la moyenne compensée Python des rapports de largeur. Les nombres fractionnaires utilisent la représentation déjà disponible dans le magasin natif. Le cache n'ajoute ni borne d'éviction ni limite à l'historique source.

La recherche composée conserve ses limites configurées : cinq unités, 1 024 états, dénominateur d'échelle maximal de huit et trois décalages d'échantillonnage. `bounded_incomplete` reste un refus, même lorsqu'un candidat partiel a déjà été trouvé.

## Coût global accepté selon la règle autorisée

La [fenêtre officielle A1/B1/B2/A2](lot4c-evidence/performance-integrated/window.json), du **10 novembre 2026, de 22:11:49 à 22:20:32 UTC−03**, compare une référence fraîche **Site 91/native 0.56** au gel final 0.57. Les **32 sessions mesurées et 400 actions** restent intégralement conservées ; seules les huit chauffes déclarées, soit 24 actions, sont exclues. La [revue indépendante](lot4c-evidence/performance-integrated/owner-growth-review.json) passe **7 630/7 630 contrôles**, avec **2/2 jeux acceptés**, `accepted: true` et `globalAccepted: true`.

| Jeu | Médiane de session complète 0.56, ms | Médiane 0.57, ms | Variation globale | Décision |
| --- | --- | --- | --- | --- |
| STCK | 11 253,251434999998 | 11 046,9208325 | **−1,833520 %** | Accepté |
| SMLP | 16 297,509763000002 | 16 272,070031000007 | **−0,156096 %** | Accepté |

Les huit sessions par jeu et version sont regroupées avant le calcul de la médiane. Chaque jeu reste **strictement sous +10 %**, sans compensation entre jeux, suppression de session mesurée, soustraction de coût, somme de phases imbriquées ni moyenne de ratios. Une phase au-dessus de 10 % est acceptée sous ce critère global, sans modifier son diagnostic.

Les diagnostics agrégés restent **15/16**, `budget_review_required` : la restauration SMLP augmente de **+25,066387 %**. Les deux cohortes restent **15/16 chacune**, avec nouvelle décision STCK **+10,782328 %** dans la première et restauration SMLP **+42,839691 %** dans la seconde. Le p95 de restauration STCK augmente de **+13,878385 %** en agrégat et de **+22,824004 %** en cohorte 2. Le [rapport complet](lot4c-evidence/performance-integrated/results.md) conserve toutes les valeurs, dispersions, inspections, pauses et observations mémoire ; les p95 sous vingt observations restent indisponibles, notamment pour les huit durées de session.

Le [refus de l'agrégateur historique](lot4c-evidence/performance-integrated/aggregation-failure.json), code de sortie **1**, demeure un échec d'identité intégrale des métadonnées de travail. L'analyse complémentaire conserve **432 écarts structurels** dans les quatre chemins qualifiés avant mesure : `observations[*].nodeCount`, `inspection[*].graphNodes`, `final.nodeCount` et `final.graphRevision`. La [qualification fonctionnelle non chronométrée](lot4c-evidence/performance-integrated/owner-graph-attribution.json) attribue **37 deltas et passe 64/64 contrôles** ; le [contrôle préalable](lot4c-evidence/performance-integrated/static-preflight.json) passe **65/65**. Chaque chauffe et session mesurée doit correspondre exactement à sa forme déclarée ; les autres champs restent strictement comparés. L'identité des feuilles privées des graphes mesurés n'est pas déduite de ces compteurs publics.

L'[intégrité de livraison](lot4c-evidence/integrated-final/delivery-integrity.json) est passée sur **298 fichiers natifs, 309 entrées d'archive, 684 entrées source/tests, 363 entrées de build et dix entrées de rejeu**, avec **1 786 originaux inchangés**. L'[isolation clôturée](lot4c-evidence/performance-integrated/coordinated-isolation-completion.json) confirme le verrou tenu sur toute la fenêtre, les signaux des autres fils inchangés et l'intégrité finale passée. Le [premier essai de préparation post-mesure](lot4c-evidence/performance-integrated/post-window-analysis/preparation-attempt-01.json) conserve son `FileNotFoundError` : l'orchestration cherchait les sorties des comparaisons de cohortes avant leur exécution. Ces comparateurs déjà déclarés ont ensuite été exécutés, sans répéter de mesure ni modifier les données, outils, règles ou entrées.

STCK et SMLP mesurent ces parcours de boucle commune, hors moteur du jeu, réseau de production et rendu navigateur. Ces résultats ne démontrent ni le coût de longues compositions Facet, ni une stabilité de plusieurs heures, ni une interruption immédiate de toute recherche par Pause. Les observations corrélées, les variations de GC/JIT et d'ordonnancement restent des limites du rapport. L'acceptation du coût ne clôt pas la parité de l'appelant complet. **La publication effective de 0.57 reste à réaliser.**

## Validation intégrée finale

Les reçus suivants concernent le même gel 0.57. Les dates visibles sont exprimées en **UTC−03** ; les horodatages bruts des preuves restent inchangés.

| Contrôle | Résultat effectivement conservé | Preuve |
| --- | --- | --- |
| Périmètre formel déclaré | **4 838/4 838 tests dans 121 fichiers**, sans échec, annulation, test ignoré ni TODO | [Suite finale](lot4c-evidence/integrated-final/validation/delta-tests-run.json) |
| Contrôles de livraison | **5/5** : typage, audit des entrées, audit de migration, contrôle de diff et build | [Reçu des contrôles](lot4c-evidence/integrated-final/validation/checks-run.json) |
| Dix rejeux stricts | **170/170 contrôles** ; **357 actions, 275 préfixes, 367 paquets publics, 1 676 images d'animation, 632 requêtes et 30 frontières naturelles** | [Résumé final](lot4c-evidence/integrated-final/regressions/regression-summary.json) |
| LKEY partiel, séparé | **157/157 contrôles**, 25 actions et deux niveaux ; le résultat brut reste `failed`, avec `frontier_unknown` au troisième niveau | [Qualification partielle](lot4c-evidence/integrated-final/lkey-partial/qualification.json) |
| Comparaison avec Python froid | **48 appels**, dont douze propositions, **24 gardes et douze acquisitions**, puis **36 restaurations natives effectivement observées**, douze préfixes et treize observations ; **zéro différence** | [Diagnostic final](lot4c-evidence/integrated-final/isos-facet-source-parity-diagnostic.json), [rapport complet](lot4c-evidence/integrated-final/isos-facet-source-parity.json.gz) |
| Navigateur réel 0.57 | **Trois niveaux ISOS, douze actions et douze plans**, en une seule session froide continue | [QA navigateur](lot4c-evidence/integrated-final/browser/browser-qa.json), [capture finale](lot4c-evidence/integrated-final/browser/isos-three-levels.png) |

Les dix rejeux calculent les commandes avant de recevoir les retours archivés. Ils passent avec un seul rejeu simultané et des entrées et sources inchangées ; ils n'ajoutent pas dix nouvelles réussites de jeu. La comparaison Python finale consomme la capture du rejeu natif ISOS et reconstruit sa propre mémoire depuis une instance froide. Elle ne lance ni nouveau jeu ni nouvel agent natif et conserve les **1 786 originaux inchangés**. Les trois premières propositions sont simples et les neuf suivantes composées. Les **60 ablations** donnent **neuf changements d'action ou de refus, quatre changements de métadonnées seulement et 47 propositions inchangées**, dont 41 interventions sur un champ déjà vide. Retirer `portable` supprime les neuf propositions composées ; ces contrefactuels de composant ne sont pas des campagnes privées de leur mémoire ni une preuve de parité de l'appelant complet.

La QA réelle, consignée le **10 novembre 2026 à 21:58:31 UTC−03**, confirme Pause à une action, puis le passage exact à deux actions par le bouton d'action unique. Les frontières naturelles surviennent à **3, 7 et 12 actions**, sans nouvelle session de raisonnement, saut manuel de niveau ou état appris injecté. Le jeu a six niveaux ; l'arrêt après trois n'est pas une victoire complète. Le preview a été arrêté.

Le [registre](v6-entry-point-progress.json) atteint **61/76 entrées raccordées, soit 80,3 %**, zéro entrée partielle et **15 ouvertes** : `goal_access` 10/12, `window_constraints` 21/21, `surface` 10/10 et `factored_material_return` 20/33. L'[audit de migration](v6-coverage.json) conserve **189 composants vérifiés, 147 transferts partiels, 1 033 modules en attente et zéro module entièrement vérifié**. Les six conditions de migration complète restent fausses ; ce pourcentage décrit les entrées déclarées, pas la parité globale.

## Référence publiée bornée et horloge ISOS

La [référence froide native 0.56](lot4c-evidence/reference-isos-056/reference-case-execution.json), exécutée sur le commit réellement publié de Site 90 puis conservé par Site 91, garde sa borne de **huit actions et zéro niveau acquis**. Le [journal public](lot4c-evidence/development/isos-reference-056-public-diagnostic.json) contient neuf paquets, dont les huit retours effectifs, sans changement des rasters observés. L'arrêt externe intervient avant l'acceptation du huitième retour par le contrôleur ; son résumé conserve sept préfixes. Le résultat brut `failed` reste inchangé. Cette observation bornée n'établit ni une incapacité générale de 0.56 ni une comparaison complète de performances.

L'[horloge cumulative ISOS](lot4c-evidence/case-clock.json) est clôturée après l'intervalle 04, le **10 novembre 2026 à 22:02:29 UTC−03**, à **1 259,938444409 secondes sur 2 400**, avec **1 140,061555591 secondes restantes**, sans remise à zéro. Le cumul inclut la sélection publique, le développement, les comparaisons échouée et corrigée, la référence bornée, le rejeu final, son diagnostic et la QA réelle. Les intervalles 02 et 03 qui se chevauchent restent intégralement facturés de façon conservatrice. Aucun nouvel essai ISOS n'est requis pour cette clôture fonctionnelle.

## Historique de développement conservé

Les [99 tests de composant](lot4c-evidence/development/oracle-attempt-03/resume-run.json) passent après régénération des attentes originales. Les [13 contrôles communs et le contrôle TypeScript](lot4c-evidence/development/integration-attempt-01/execution.json) passent également. La chaîne froide commune exerce le germe, l'extension, la frontière puis la composition non acceptée ; deux essais étrangers vérifient que Feedback et l'exploration acquièrent leurs retours sans acquisition Facet parasite.

Le [balayage des 100 observations publiques initiales](lot4c-evidence/candidate-selection.json) sélectionne uniquement ISOS, sans action ni saut de niveau. La [campagne de développement](lot4c-evidence/development/isos-live-01/execution-isos.json), gel `0b9b31611486da90658d888e3c8e2d8151a24bffaf0f796a7a6cf9b65a23262e`, réussit trois niveaux en douze actions et douze préfixes, dans une seule session froide. Les frontières surviennent après les actions 3, 7 et 12. Le plafond de 48 actions n'est pas atteint. Cette campagne ajoute Facet à Site 89/native 0.55 ; elle précède l'intégration finale du prédécesseur 10A.

| Étape observée | Expérience et retour | Connaissance et choix suivant |
| --- | --- | --- |
| Niveau 1, première action | Le germe reproduit la correspondance visible | Le stencil devient portable sous conditions ; le déplacement vertical reste à mesurer |
| Niveau 1, deuxième action | La face se déplace de six pixels vers le haut, avec extension mesurée des deux côtés et préservation extérieure | Le déplacement mesuré est acquis ; la nouvelle projection détermine l'intervention suivante |
| Niveau 1, troisième action | Le jeu confirme la première frontière officielle | Le témoin officiel complète les conditions de rappel de la méthode portable |
| Niveau 2, quatre actions | Un germe et des extensions composées correspondent aux rendus prédits ; une frontière officielle suit | Le préfixe courant est remesuré avant chaque intervention ; la portée suivante peut rappeler la méthode |
| Niveau 3, cinq actions | Nouvelle composition, extensions confirmées puis troisième frontière officielle | La cible des trois niveaux est atteinte ; l'arrêt au niveau 4 conserve la session et les connaissances |

La [comparaison originale froide](lot4c-evidence/development/isos-live-01/isos-facet-source-parity-attempt-02.json.gz) passe 48 appels complets : douze propositions, 24 gardes et douze acquisitions sélectionnées. Elle compare aussi 36 restaurations réellement appelées, douze états de préfixe et treize observations publiques. Les 1 786 originaux et les entrées sont inchangés. Les trois premières propositions sont simples ; les neuf suivantes sont composées.

Les 60 interventions sur la mémoire conservent neuf changements d'action ou de refus, quatre changements de justification seulement et 47 propositions inchangées ; 41 interventions portent sur un champ déjà vide. Retirer `portable` supprime les neuf propositions composées. Retirer les méthodes simple ou composées locales modifie quatre justifications, sans changer ces actions. Il s'agit d'interventions de composant au même état public, pas d'une nouvelle campagne privée de sa mémoire ni d'une ablation de l'appelant complet.

Le [premier essai du comparateur](lot4c-evidence/development/isos-live-01/isos-facet-source-parity-attempt-01.json.gz) reste en échec. Ses deux différences concernaient `boundary_ref` dans une proposition historique immuable, comparée par erreur à un objet Python vivant après acquisition. La [correction documentée](lot4c-evidence/development/isos-live-01/isos-facet-source-parity-snapshot-correction.json) conserve une copie complète de l'offre originale au retour de `propose` pour cette seule preuve historique, et garde l'objet original vivant pour les gardes et acquisitions. Les mutations ultérieures de son alias restent visibles. Aucun champ n'est supprimé ou normalisé ; aucun code de production ni journal du jeu n'a changé.

Les refus, changements extérieurs, absences d'effet et compositions visuellement terminées mais non acceptées sont exercés dans les preuves synthétiques. Ils ne sont pas présentés comme des événements de cette campagne réussie. Le jeu entier possède six niveaux ; l'arrêt après trois niveaux ne vaut pas victoire complète.

## Contrôle des entrées avant publication

Le [contrôle final des entrées](lot4c-evidence/integrated-final/publication-inputs.json) passe sur **920 entrées liées**, avec le même gel, **684 sources/tests, 363 entrées de build**, les cinq contrôles, les dix rejeux et les coûts acceptés. La [première tentative](lot4c-evidence/publication-preflight/record-publication-inputs-execution.json) reste en échec : le lecteur adapté de 10A attendait des champs supplémentaires absents du reçu officiel des cinq contrôles de 4C. La [correction de compatibilité](lot4c-evidence/publication-preflight/record-publication-inputs-correction.json), relue indépendamment, conserve les vérifications de sources, tests, build et régressions. Les journaux gelés des audits sont reliés aux résumés des rapports actuels ; aucune empreinte historique absente n'est inventée. La [deuxième tentative](lot4c-evidence/publication-preflight/attempt-02/record-publication-inputs-execution.json) passe avec les mêmes arguments et les reçus d'origine inchangés. Aucun moteur, test, build ou outil de mesure n'a été modifié par cette correction.

## Limites à conserver

Une parité de composant, même exercée dans l'appelant natif commun, n'est pas une preuve de parité de toutes les priorités de l'appelant Python complet. Une réussite de trois niveaux n'est pas une victoire sur tout un jeu. Une campagne partielle reste partielle. Les portes de migration complète restent distinctes du raccordement de cette entrée.

Le périmètre fonctionnel intégré est validé et le coût global est accepté pour les deux jeux. La clôture de livraison exige encore la publication du même candidat validé, la vérification du déploiement effectif et la conservation de l'accès privé. Le fil **5B prépare native 0.58 en parallèle** et attend la publication effective de 4C avant son intégration finale ; ce travail ne fait pas partie de la présente livraison.
