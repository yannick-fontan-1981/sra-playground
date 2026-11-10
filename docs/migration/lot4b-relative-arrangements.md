# Lot 4B : arrangements relatifs et effets mesurés

## État de la livraison

Le développement de **`relative_arrangement`** part de **Site 81 / Logos Engine 0.51.0**, commit `4dafc40c53ed4406ee7cd148e3e6995a2eb4185e`. Le candidat intégré conserve 4A, 7A et la publication effective 5A. Sa référence finale est **[Site 85](lot4b-evidence/planning/published-predecessor85.json)**, commit `a009e1f138bb18251d697f49647bacc615ee514f`, native **0.53.0**, digest `d30dedc767c588b0fdf33ea398a4ad207b07b027e8b3642b3b262c625c52387f`. Le sous-lot 4C, `facet_example`, reste non implémenté.

Le **candidat 0.54.0** est gelé sous `f25d56d1c63dc929b01bb31b3898b84cecc69e6e412d535c0d122170ea401ce9` : **[286 fichiers natifs](lot4b-evidence/integrated-final/source-manifest.json)** et **[297 fichiers d'archive](lot4b-evidence/integrated-final/source-archive.json)**. La validation formelle corrigée passe **4 048/4 048 tests sur 108 fichiers**, les cinq contrôles du projet passent, et les huit rejeux stricts passent **136/136 comparaisons**. LKEY conserve séparément sa trajectoire partielle. Une QA navigateur réelle atteint trois niveaux TRIA en 17 actions et vérifie Pause puis une action supplémentaire. La parité froide finale concorde sur **68/68 appels de famille**, et l'intégrité finale passe. **Le coût global est accepté sur 2/2 jeux sous la qualification structurelle déclarée avant mesure : STCK −1,812977 %, SMLP +2,735461 %.** Le contrôle des entrées de publication passe ; **la publication 4B seule reste en attente**, sans déploiement revendiqué à ce stade.

Le premier gel de développement reste `852d5ff7cdaa15534d22fcd610043cd348bb8aa241e290ae67d75adcaeaf8f9f` : 276 fichiers natifs et 287 fichiers d'archive. Son identifiant de runtime hérité `0.51.0` n'en fait pas la version 0.51 publiée. Les preuves de composant, le caller synthétique, la campagne de développement, les rejeux et la QA finale gardent leurs identités et leurs portées distinctes.

## Source, comportement et propriété

La référence demeure `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Les trois modules propres de `morphology_policy/relative_arrangements` — `family.py`, `geometry.py`, `planner.py` — sont transférés dans trois modules TypeScript. La [filiation](lot4b-relative-arrangements-lineage.md) décrit aussi la stratégie et l'appelant commun originaux. Les infrastructures V5 consommées sont déjà prises en charge par les composants compatibles ; aucune nouvelle règle spécialisée V5 de jeu n'est introduite.

Le workflow compilé existant **`v6.relative_arrangements.choose`** exécute ses callbacks `arrangement.measure`, `arrangement.compose`, `arrangement.bind`. Le moteur mesure le plateau, ses participants, le modèle relatif visible et les actionneurs. Il choisit une expérience locale sous hypothèses explicites. Un effet attribuable exige le déplacement d'un seul participant sélectionné et celui d'un seul marqueur d'actionneur, avec préservation des autres participants. Une ressemblance avec la cible reste une hypothèse jusqu'à la frontière officielle.

| Contrat | Raccordement et effet |
| --- | --- |
| Domaine non reconnu | Les sous-questions suivantes et le repli de symétrie restent disponibles. |
| Arrangement courant reconnu, aucune expérience admissible | Arrêt du reste de `window_constraints`, symétrie comprise. Les autres groupes de stratégie continuent. |
| Proposition sélectionnée | Commande, point, observation initiale, époque, image et palette sont liés ; les gardes et WHY/ACT précèdent l'action. |
| Retour mesuré | Acquisition par le seul propriétaire `relative_arrangements`, conservation de l'événement et du miroir source `relative_arrangement_state`, puis restauration commune. |
| Retour d'une autre famille | Aucun appel passif à `RelativeArrangements`. Le contrat passif de Feedback reste propre à Feedback. |
| Changement d'époque | La mesure remet `models`, `failed` et `selection_ref` à zéro ; le journal `events` reste conservé. |
| Modèle acquis | Usage conditionnel pour le même actionneur, la même sélection et la même valeur de participant ; un gain contradictoire ferme les offres de cet actionneur. |

L'état durable possède les cinq champs source : **`models`, `events`, `failed`, `selection_ref`, `epoch`**. La projection et les diagnostics courants sont transitoires. Seul l'ordre de transport de `failed`, ensemble non ordonné en Python, est rendu déterministe ; les ordres de parcours, permutations, cibles, options et rangs restent stricts.

L'arrêt local est attesté par l'observation, l'époque et le hash d'image courants. Les deux préférences natives capables de rechercher un fournisseur plus tardif vérifient cette barrière avant sa proposition et son admission. La continuation acquise consulte d’abord son témoin conservé et sa corroboration Kernel ; cette lecture ne donne aucune autorité à une proposition bloquée. Ces raccordements préservent la portée source de l'arrêt au sein d'un runtime qui possède déjà des extensions de coordination ; ils ne constituent pas une revendication de parité complète du routeur Python.

## Trace publique lisible

Dans le deuxième niveau de la [campagne TRIA de développement](lot4b-evidence/development/tria-live-01/tria-campaign.json.gz.parts.json), sur le gel `852d5ff7…`, les deux participants aux positions de grille `(12,9)` et `(12,11)` sont déjà à préserver. Le participant sélectionné est en `(13,6)` et la cible relative courante demande `(13,10)`.

| Étape réellement observée | Hypothèse ou expérience | Retour et conséquence |
| --- | --- | --- |
| Proposition, appel 40 | Déplacer d'un cran vertical le marqueur d'un actionneur encore non mesuré pour cette sélection. L'hypothèse initiale prédit `(13,7)`. | La proposition conserve les alternatives : absence d'effet, sens opposé, autre gain, effet couplé ou transition de bord. |
| Acquisition, appel 43 | Le marqueur passe de `(1,1)` à `(1,2)`. | Le participant passe de `(13,6)` à `(13,1)`, soit **−5 cases**. Les deux autres restent inchangés. Le modèle conditionnel conserve le sens et le gain observés, avec les références du retour. |
| Décision suivante, appel 44 | Avec ce modèle restauré, déplacer le marqueur de `(1,2)` à `(1,0)`. | La prédiction devient `(13,11)` : deux crans en sens inverse du gain observé. L'offre cite le retour précédent et n'utilise plus l'hypothèse de gain unitaire pour cet axe. |
| Acquisition, appel 47 | Le mouvement choisi est exécuté après liaison et garde. | Le participant arrive bien en `(13,11)`, soit **+10 cases**, et les deux autres sont encore préservés. |
| Proposition puis frontière | Un autre actionneur déjà mesuré propose le dernier déplacement de `(13,11)` à `(13,10)`. | Le retour suivant augmente officiellement le nombre de niveaux terminés. La conformité visuelle seule n'avait pas été comptée comme un succès. |

Ces coordonnées décrivent la preuve publique, pas des constantes utilisées par le moteur. Les nouveaux modules de production ne sélectionnent aucune règle par identifiant de jeu, numéro de niveau, palette fixe ou solution enregistrée.

## Preuves de composant et d'appelant

Le [générateur](../../scripts/export-v6-relative-arrangements-reference.py) exécute les originaux inchangés et leur observateur sur des interfaces publiques synthétiques. La fixture comprend 16 interfaces initiales, 28 cas de planification, cinq sessions et neuf variantes d'acquisition. Les **81 tests différentiels** passent : propositions complètes, reçu SRC à quatre champs source, mesures, options ordonnées, gardes, événements, état et décisions après restauration.

Les cas couvrent les palettes et translations, les gains fractionnaires, négatifs, nuls ou contradictoires, les collisions, les supports non uniques, l'absence d'action accessible, les retours multi-participants ou multi-actionneurs, les époques, les limites d'assignation et les essais refusés. Les assertions du générateur empêchent qu'un scénario annoncé positif ou refusé soit en réalité vide. Le premier lancement a échoué sur une faute de syntaxe du générateur avant import ; son journal et ses octets sont conservés dans `development/relative-oracle-01*`. Le second produit la fixture vérifiée. Les **1 786 fichiers originaux du manifeste** sont identiques avant et après ; les caches Python préexistants restent identifiés séparément et n'ont pas été modifiés.

Le [test d'intégration](../../tests/v6-relative-arrangements-integration.test.ts) possède **12 cas vérifiés**. Les sessions de lifecycle emploient une variante déclarée de configuration qui isole l'entrée, avec les vrais fournisseurs, mémoire, propositions, gardes et WHY/ACT. La factory complète et son ordre sont contrôlés séparément. Les retours `unit` et `opposite` acquièrent des modèles différents et produisent des commandes suivantes différentes après restauration depuis le graphe.

Les barrières ordinaires couvrent l'arrangement déjà conforme, `ACTION6` absente et l'interface non reconnue. Les deux parcours de préférence natifs sont également exercés. Pour la continuation acquise, une famille de contrat synthétique reçoit réellement un retour public de frontière dans le caller : le test vérifie ses `prefix_evidence` et `transition_evidence`, puis observe la vraie corroboration Kernel. Il ne fabrique pas un succès en écrivant directement dans la mémoire. La reconnaissance relative sans offre interdit encore le fournisseur tardif ; le cas non reconnu le laisse passer. Cette preuve synthétique de routage ne se substitue pas à la campagne en jeu.

Après intégration de 7A effectivement publié, les quatre fichiers hérités ciblant les deux aides de préférence, la préparation acquise et la portée des refus passent **120/120 tests** sur le gel intermédiaire `31850e3a…`. La seule liste exhaustive d’enregistrement devenue périmée a été actualisée ; les commandes, appels réellement visités, gardes et assertions de comportement restent conservés. Le [reçu](lot4b-evidence/development/priority-regression-01/validation/delta-tests-run.json) atteste l’intégrité des sources et des tests pendant cette vérification. Il ne remplace pas le périmètre final après 5A.

## Contribution en jeu et limites du cas

La première campagne froide **TRIA réussit trois niveaux en 17 actions et 17 préfixes**. Une seule session atteint naturellement le niveau 4, sans saut de niveau ni commande manuelle. Les 17 actions sont sélectionnées par `relative_arrangements`. Le journal conserve **68 appels** : 17 propositions, 17 gardes avant, 17 gardes après et 17 acquisitions. Les retours comprennent **5 sélections observées, 9 déplacements attribuables et 3 frontières officielles**.

La référence effectivement publiée **Site 81 / native 0.51** atteint la borne externe préannoncée de **8 actions sans niveau terminé**. Les sept préfixes déjà scellés appartiennent à ObservedFrontier, RegularFieldCorrespondence et InformationGoal ; le huitième retour acquis est dans le journal, conformément au contrat du harnais borné. Ce résultat est conservé comme référence finie, sans verdict d'impossibilité générale.

Les deux premiers essais et leur analyse partagent l'[horloge TRIA](lot4b-evidence/tria-case-selection.json) de 2 400 secondes. Aucun budget n'est réinitialisé. Les rejeux intégrés décrits plus bas emploient des retours enregistrés ; la QA navigateur constitue une nouvelle période live, ajoutée séparément au même cumul.

Le [rejeu froid de la famille Python originale sur la campagne de développement](lot4b-evidence/development/tria-live-01/tria-relative-arrangement-source-parity-02.json.gz) passe **68/68 appels, 34 gardes, 17 états de préfixe et 17 restaurations**, avec zéro différence. Il reconstruit 18 observations publiques et conserve 16 choix suivants ; le dernier retour n’a pas de proposition ultérieure capturée. Les états et plans natifs sont des comparands, jamais une amorce de l'oracle. Les 1 786 originaux restent inchangés avant et après.

Les **51 ablations** restent toutes dans le rapport : **deux interventions changent l'action au même appel 44**, quatre ne changent que les autres données de la proposition et 45 la laissent entièrement inchangée. Retirer `models` ou effacer `selection_ref` remplace la commande observée `(35,49)` par `(17,57)`. Il s'agit d'une seule décision distincte sensible à deux aspects de la mémoire ; aucune ablation de campagne entière n'est revendiquée. **`failed` est vide aux 17 choix** : l'influence des essais refusés est prouvée par les cas synthétiques, pas par ce trajet live.

Le [premier rapport de comparaison](lot4b-evidence/development/tria-live-01/tria-relative-arrangement-source-parity-01.json.gz) reste en échec : ses 68 différences portent exclusivement sur `composition_target_tree`, annotation ajoutée par l'appelant après la proposition de famille. Le second comparateur en délimite explicitement la portée, vérifie sa liaison au contexte et conserve son contenu intégral. Les annotations de premier niveau `field_subquestion`, `strategy_receipt` et `morphology` sont également identifiées. Aucun champ du plan d'arrangement ni reçu SRC n'est retiré, aucune normalisation récursive n'est appliquée. Les nombres JSON sont comparés par leur valeur, sans assimiler booléens et entiers. Ce contrôle de famille ne prouve pas la parité de l'appelant Python entier.

La [résolution du cas](lot4b-evidence/tria-case-resolution.json) clôt cette première période à **374,140910 secondes cumulées**, sans remise à zéro, avec les deux tentatives et les deux comparaisons conservées.

## Validation du candidat intégré 0.54

### Tests formels et contrôles du projet

La [première exécution formelle](lot4b-evidence/integrated-final/validation/delta-tests-run.json) reste en échec à **4 047/4 048 tests sur 108 fichiers**. Son unique échec porte sur une liste exhaustive des entrées fenêtre dans `v6-coupled-pair-planning.test.ts` : elle omettait `relative_arrangement`, pourtant déjà raccordé et déclaré dans l'ordre source. La [correction conservée](lot4b-evidence/integrated-final/test-expectation-correction/correction.json) insère cette seule entrée dans l'attente, soit **24 octets**. La [revue indépendante](lot4b-evidence/integrated-final/test-expectation-correction/correction-source-review.json) conserve les autres assertions, notamment les 16 propriétaires de rappel partagé, ainsi que le périmètre complet des 108 fichiers. Aucun code natif n'est modifié.

La [relance formelle complète](lot4b-evidence/integrated-final/test-expectation-correction/validation/delta-tests-run.json) est désormais terminée : **4 048/4 048 réussites**, zéro échec, annulation, test ignoré ou TODO. Le digest natif `f25d56d1…` et les entrées de cette relance restent inchangés pendant son exécution. Ce périmètre explicite de contrats et d'intégration ne prétend pas être toute la suite historique du dépôt.

Les [cinq contrôles du projet](lot4b-evidence/integrated-final/validation/checks-run.json) passent : typage, audit des entrées, audit de migration, contrôle du diff et build. Leur reçu est [recopié à l'identique](lot4b-evidence/integrated-final/test-expectation-correction/validation/checks-run.json) dans le dossier de correction ; ses sorties et son identité d'origine restent conservées. Cette copie ne revendique ni second build ni seconde QA navigateur.

### Huit rejeux publics stricts

Le [résumé terminal](lot4b-evidence/integrated-final/regressions/regression-summary.json) atteste **8/8 trajectoires et 136/136 comparaisons**, sur le même gel natif. Le moteur commun recalcule chaque commande avant que l'hôte ne fournisse le retour public archivé correspondant. Les huit cas totalisent **309 actions, 317 paquets publics complets, 1 487 images d'animation, 227 préfixes, 536 requêtes et 24 frontières naturelles de niveau**.

| Trajectoire enregistrée | Actions | Préfixes | Niveaux conservés | Comparaisons |
| --- | ---: | ---: | ---: | ---: |
| CATR | 12 | 8 | 3 | 17/17 |
| RSWP | 19 | 11 | 3 | 17/17 |
| FOGW | 50 | 27 | 3 | 17/17 |
| VOIS | 78 | 42 | 3 | 17/17 |
| CONN | 21 | 21 | 3 | 17/17 |
| MIND | 31 | 20 | 3 | 17/17 |
| WEAV | 81 | 81 | 3 | 17/17 |
| TRIA, campagne de développement 4B | 17 | 17 | 3 | 17/17 |
| **Total** | **309** | **227** | **24** | **136/136** |

Les comparaisons portent sur les commandes, paquets publics, animations, frontières, décisions et champs de coordination déclarés, préfixes, époques, événements de séries, compteurs de l'appelant et résultat public final. Seuls les préfixes d'identifiants de session d'observation fraîche sont normalisés dans les champs sélectionnés ; les temps, libellés d'implémentation et de statut de migration sont exclus. L'égalité intégrale des états de fournisseurs, des identités dérivées ou des chaînes et révisions du graphe n'est pas revendiquée. Les rapports complets restent conservés. **Ce sont des rejeux de retours enregistrés, pas huit nouvelles réussites live ni une comparaison de vitesse.**

Le rejeu TRIA du gel intégré conserve donc la trajectoire publique de développement. Sa [comparaison froide finale avec la famille Python](lot4b-evidence/integrated-final/tria-relative-arrangement-source-parity.json.gz) concorde sur **68/68 appels, 34 gardes, 17 acquisitions sélectionnées et 17 restaurations**, avec **18 observations, 35 comparaisons publiques et zéro différence**. L'oracle repart à froid ; les états natifs restent des comparands. Cette preuve porte cette fois sur le gel intégré `f25d56d1…`, distinct de la preuve de développement.

Les **51 ablations finales** restent conservées : **deux interventions de la catégorie action/refus au seul appel 44**, quatre changements de métadonnées et 45 résultats identiques. Les deux interventions ne deviennent pas deux décisions indépendantes ; la réserve sur `failed`, vide dans cette trajectoire, demeure. La parité est celle de la famille et des contrôles publics déclarés, pas celle de l'appelant Python entier.

### LKEY : conservation exacte d'une trajectoire partielle

La [qualification finale distincte](lot4b-evidence/integrated-final/lkey-partial/qualification.json) passe **157/157 contrôles** avec le statut `partial_trajectory_preserved`. Elle conserve **25 commandes calculées avant retour, 26 paquets publics, 25 préfixes, 51 requêtes et deux frontières naturelles**. Le rapport brut reste **`failed`** : deux niveaux terminés, puis arrêt au **troisième niveau avec `frontier_unknown`**. La cible de trois niveaux n'est pas atteinte.

Le contrat vérifie aussi les 49 appels Workshop de cette trajectoire, dont 25 acquisitions — 14 sélectionnées et 11 passives — dans leur portée déclarée. Les commandes et paquets publics ne sont pas normalisés. Ce résultat n'entre pas dans les huit trajectoires strictes réussies et ne prouve ni une nouvelle réussite live, ni une égalité complète des états de propriétaires, ni une parité globale du caller.

Les tentatives de développement 01 et 02, refusées avant campagne sur les enveloppes de commandes, restent conservées. La tentative 03 reste qualifiée `failed` à 149/150 contrôles : son observateur attendait le libellé `completed-level`, alors que l'événement produit conservait `sealed_prefix` et portait le champ `completedLevel`. Sa revue des données et le correctif prospectif ne requalifient pas cette ancienne exécution. Le résultat final de 157/157 appartient à une exécution séparée sur le gel 0.54.

## QA navigateur réelle et horloge cumulative

La [QA finale](lot4b-evidence/integrated-final/browser/browser-qa.json) observe le candidat **0.54.0 / `f25d56d1…`** dans le navigateur géré, sur le serveur de développement du gel ; le build de production est vérifié séparément. TRIA démarre à froid au niveau 1, sans état appris injecté, saut de niveau ou action manuelle sur le plateau. Une même session de raisonnement termine **trois niveaux en 17 actions et 17 plans**, avec frontières aux actions **2, 13 et 17**, puis affichage du niveau 4.

Les contrôles **Pause** et **une action** sont réellement observés. Après une pause à deux actions et un niveau terminé, une action supplémentaire donne exactement trois actions et trois plans, avec le message `One action completed.`. Cela ne mesure pas une latence et ne garantit pas une interruption immédiate d'un calcul.

La preuve conservée est une [transcription structurée des sorties d'accessibilité AX](lot4b-evidence/integrated-final/browser/observed-states.json). **Aucune capture d'écran n'est revendiquée.** Le reçu conserve aussi la réinitialisation initiale du noyau après inactivité et l'expiration d'une attente de texte : la première commande « une action » avait effectivement terminé un niveau, donc affiché `Level completed.`. Cette frontière réelle et l'erreur de l'observateur restent consignées ; la session de jeu est conservée pour les contrôles suivants.

La [continuation d'horloge](lot4b-evidence/integrated-final/browser/browser-qa-continuation.json) facture l'intervalle complet du **10 novembre 2026, 22:16:42.221510 à 22:23:11.817264 UTC**, essais et attente expirée inclus : **389,595754 secondes**. Elle s'ajoute aux **374,140910 secondes** de la résolution initiale, qui reste inchangée, soit **763,736664 secondes cumulées sur 2 400**, sans reset. L'attente entre les périodes closes n'est pas présentée comme du temps de jeu actif.

Les reçus de [liaison au contrôle formel corrigé](lot4b-evidence/integrated-final/browser/browser-qa-test-correction-binding.json) et de [liaison de sa continuation](lot4b-evidence/integrated-final/browser/browser-qa-continuation-test-correction-binding.json) conservent les mêmes observations, dates, compteurs et cumul. Ils pointent vers le reçu de build identique ; aucune seconde QA n'est déduite de ce rattachement.

## Intégrité finale et transport des preuves

Le [contrôle d'intégrité final](lot4b-evidence/integrated-final/delivery-integrity.json) passe sur **286 fichiers natifs, 297 membres d'archive, 657 entrées source/tests, 351 entrées de build et les 1 786 originaux épinglés**. Il vérifie également le transport de **neuf rapports représentant 60 210 836 octets en 72 parties**. Ce découpage conserve les octets des rapports d'origine ; il ne remplace pas une exécution ni n'en modifie le verdict. Les preuves fonctionnelles, leurs échecs conservés et leurs liens sont ainsi rattachés au candidat gelé ; aucun déploiement n'est déduit de cette intégrité.

## Coût officiel accepté sous qualification structurelle

La [fenêtre officielle](lot4b-evidence/performance-integrated/window.json) est terminée, avec statut et intégrité `passed`, du **10 novembre 2026 à 22:38:57.430443 au même jour à 22:47:33.071790 UTC**. Elle conserve l'ordre **A1/B1/B2/A2**, une référence fraîche **Site 85 / native 0.53**, **32 sessions mesurées et 400 actions**. Les huit chauffes préannoncées, soit 24 actions, restent exclues ; aucune session mesurée ni valeur extrême n'est retirée. Chaque jeu et version fournit huit sessions à l'agrégat. Aucune durée d'une fenêtre antérieure n'est réutilisée.

La [revue indépendante](lot4b-evidence/performance-integrated/owner-growth-review.json) passe **3 960/3 960 contrôles** et accepte **2/2 jeux**, statut `accepted_under_predeclared_owner_cost_rule`. Les médianes ci-dessous reproduisent les nombres du JSON ; les pourcentages seuls sont arrondis à six décimales pour l'affichage.

| Jeu | Médiane complète 0.53, ms | Médiane complète 0.54, ms | Variation globale |
| --- | ---: | ---: | ---: |
| STCK | 10 986,992674000001 | 10 787,801006499998 | **−1,812977 %** |
| SMLP | 16 041,944504 | 16 480,765659999997 | **+2,735461 %** |

Le [protocole](lot4b-evidence/performance-integrated/protocol.md) et la [politique globale](lot4b-evidence/performance-integrated/global-budget-policy.json) sont déclarés avant mesure. Le critère porte sur `session_elapsed` : **pour chaque jeu, médiane(B) / médiane(A) − 1 doit rester strictement inférieur à 10 %**. Une égalité à +10 % échoue. Aucun jeu ne compense l'autre ; les ratios de cohortes ne sont pas moyennés et les phases imbriquées ne sont pas additionnées.

Les [diagnostics agrégés](lot4b-evidence/performance-integrated/owner-growth-comparison.json) restent à **14/16**, statut `budget_review_required`. Les deux dépassements sont **SMLP `known_prefix_guard` +12,069030 %** et **restauration +29,830670 %** ; leur classification `over_budget_with_noise_unresolved` reste conservée. Les [deux](lot4b-evidence/performance-integrated/cohort1/comparison.json) [cohortes](lot4b-evidence/performance-integrated/cohort2/comparison.json) gardent chacune **15/16 diagnostics**. La première conserve notamment la restauration SMLP à **+42,231325 %** ; la seconde, la garde de préfixe connu SMLP à **+14,624866 %**. Elles ne sont ni sélectionnées ni corrigées pour produire la décision globale.

Les hausses de p95 agrégés supérieures à +10 % restent explicites : **service de préfixe connu STCK +32,773109 %**, **requête de préfixe connu STCK +26,838601 %**, **garde SMLP +23,351327 %** et **acquisition/persistance SMLP +12,278213 %**. Le [rapport complet immuable](lot4b-evidence/performance-integrated/results.md) conserve aussi tous les autres p95, dispersions, diagnostics de cohorte, observations d'inspection et de Pause, ainsi que les échantillons mémoire. Le p95 des huit durées globales n'est pas disponible selon la règle d'effectif déclarée. Ces mesures ne prouvent ni stabilité sur plusieurs heures ni interruption immédiate d'une recherche arbitrairement longue.

### Refus strict et qualification préalable conservés

**L'agrégation historique stricte reste en échec**, avec son [reçu réel](lot4b-evidence/performance-integrated/aggregation-failure.json), son code de sortie 1 et son journal complet. L'ajout du propriétaire RelativeArrangements change les métadonnées structurelles du graphe ; aucun succès de cet agrégateur n'est revendiqué.

Le [contrat](lot4b-evidence/performance-integrated/owner-growth-contract.json), la [fixture fonctionnelle](lot4b-evidence/performance-integrated/owner-structural-fixture.json) et son [attribution](lot4b-evidence/performance-integrated/owner-structural-attribution.json) sont figés **avant toute mesure**. La qualification structurelle passe **64/64 contrôles**. La consolidation complémentaire et sa revue indépendante vérifient ensuite **432 différences structurelles** sur les quatre chemins déclarés, avec chaque chauffe et session mesurée conforme à sa forme fonctionnelle propre. Les autres métadonnées de travail restent exactes entre versions, et les signatures complètes restent identiques au sein de chaque version pour une même forme de session.

Les captures fonctionnelles distinctes ne prouvent pas rétroactivement les feuilles privées non capturées des 400 actions mesurées. Aucune égalité intégrale des valeurs privées des graphes n'est revendiquée. **Les outils déclarés, règles, seuils, populations, données et durées sont conservés ; tout le coût du nouveau propriétaire reste inclus.** La qualification structurelle et la revue arithmétique ne transforment pas l'échec strict en réussite et n'établissent pas, à elles seules, une causalité pour les écarts de temps. STCK/SMLP mesurent la boucle commune ; la contribution propre de RelativeArrangements reste celle des preuves TRIA séparées.

### Incidents de préparation et clôture d'isolation

Le [premier préflight statique](lot4b-evidence/performance-integrated/static-preflight-attempt1.json) reste en échec : deux liens de dépendances manquaient dans le checkout de référence. Les seuls liens `node_modules` et `public/vendor/pyodide` ont ensuite été créés vers les dépendances du candidat. Le même outil inchangé passe **65/65 contrôles** au [nouveau préflight](lot4b-evidence/performance-integrated/static-preflight.json), avec son [reçu de recontrôle](lot4b-evidence/performance-integrated/static-preflight-recheck.json). Cette préparation ne modifie ni source, ni règle de coût, ni mesure ; le premier refus reste conservé.

La [première clôture d'isolation](lot4b-evidence/performance-integrated/isolation-completion-attempt1.json) reste également en échec : son assertion exigeait l'égalité des octets du fichier de statut 7B avant et après la fenêtre. Seules les notes textuelles `own_agents` et `preparation` avaient changé ; l'engagement explicite de silence, l'étape déclarée et l'absence de commande lourde active restaient conservés. Le [reçu de clôture distinct](lot4b-evidence/performance-integrated/coordinated-isolation-completion.json) garde ces changements précis et l'échec initial. La commande ABBA sous verrou a terminé avec code 0, puis libéré le verrou. Aucune mesure n'est écartée ou répétée ; aucun outil ni règle de coût n'est modifié par cette correction du contrôle de clôture.

## Publication en attente

Le [contrôle des entrées de publication](lot4b-evidence/integrated-final/publication-inputs.json) est passé, statut `integrity_verified_with_predeclared_owner_cost`. Il lie le gel, les 286 fichiers natifs, 297 membres d'archive, 657 entrées source/tests, 351 entrées de build, les dix entrées d'exécution des régressions, les preuves fonctionnelles et les reçus du coût qualifié. Il conserve explicitement `historicalStrictPassed: false` et l'absence d'égalité intégrale des métadonnées entre versions. La vérification des empreintes et du transport n'exécute ni moteur, ni jeu, ni mesure supplémentaire.

**La publication 4B seule reste en attente.** Aucun déploiement ou numéro de Site 4B n'est déduit de ce contrôle préalable. Les résultats de coût sont terminaux pour le candidat gelé ; les limites LKEY, de parité de l'appelant, d'accumulation et de migration globale restent ouvertes.

## Limites et suite

Les gains restent locaux : une nouvelle sélection, un autre axe, un bord ou une saturation peuvent les invalider. Un effet mesuré n'établit pas une loi universelle ni une garantie de retour. Plus de six participants d'une même valeur, ou un produit d'assignations dépassant 1 024 pour une cible, produit le refus global prévu par la source ; aucune solution d'une recherche partielle n'est publiée. Les autres éléments sont préservés selon les observations effectivement comparées.

Le premier gel de développement atteint **56/76 entrées**, dont **21/21 dans la liste fenêtre**. Après intégration effective de 7A / Site 83, le compteur intermédiaire est **57/76** ; 28 tests de coexistence et le typage passent sur le gel `31850e3a…`. L'[audit du candidat 0.54](v6-entry-point-progress.json), après intégration de 5A, atteint **58/76 entrées raccordées, zéro partielle et 18 ouvertes**. Ces compteurs décrivent des compositions et des gels distincts. Les trois modules propres ajoutent trois `component_verified`, sans aucun module déclaré entièrement vérifié et sans fermer les portes de migration complète.

La suite concrète de ce fil reste **4C, `facet_example`** : correspondance visible, expérience sélectionnée, acquisition d'une méthode conditionnelle, réfutation après retour et revalidation des branches portables/composées. Le refus officiel d'une composition visuellement conforme devra rester acquis. Ce travail n'est pas implémenté dans 4B.
