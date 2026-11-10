# Lot 4A : séquences et retours discriminants, candidat natif 0.50

## État de la livraison

L’entrée **`observed_feedback_sequence`** est raccordée à **Logos Engine**. Le composant reconnaît une interface ordonnée, acquiert les effets de saisie effectivement observés, soumet un essai complet et utilise les retours publics pour choisir l’essai suivant. Les hypothèses portent à la fois sur les valeurs possibles et sur les lois d’interprétation du retour. La décision reste conditionnée par la palette, le préfixe courant et les preuves acquises.

**Le transfert et sa contribution sur MIND sont vérifiés sur le candidat gelé 0.50.0. La validation du coût et la publication restent à compléter.** La campagne commune atteint trois niveaux naturels en **31 actions et 20 préfixes**. Le rejeu de la famille Python originale, démarrée à vide, concorde sur **51/51 appels**. Retirer uniquement l’historique acquis change le choix dans **trois des huit contextes** examinés ; cinq choix restent identiques. Le [reçu de contribution publique](lot4a-evidence/final/feedback-public-contribution.json) conserve ces résultats et leurs limites.

Le delta formel passe **548/548 tests dans 29 fichiers**, ainsi que **5/5 contrôles du projet, compilation comprise**. Les quatre régressions sur retours enregistrés passent **68/68 contrôles**. Le contrôle fonctionnel dans le navigateur est **bloqué par l’infrastructure** : aucune réussite navigateur, Pause ou pas à pas dans l’interface n’est revendiquée. Les portées de ces preuves sont séparées ci-dessous.

## Référence, gel et compteurs

| Identité | Référence publiée | Candidat exécuté |
| --- | --- | --- |
| Publication Site | **78** | À compléter après publication effective |
| Version native | **0.49.0** | **0.50.0**, provisoire jusqu’à clôture |
| Commit de départ | `8fa6b261b8b23ac8d232e60c9c179e2f3407d82f` | Branche isolée issue de cette référence |
| Fichiers natifs | **268** | **271** |
| Digest natif | `d6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054` | `66be0948fdff5abe10b12d253bb4583db067aab2f5b7248632c9f9d443bc53fe` |

La [provenance de la référence](lot4a-evidence/baseline/provenance.json), le [manifeste du candidat](lot4a-evidence/final/source-manifest.json) et l’[inventaire de son archive](lot4a-evidence/final/source-archive.json) identifient les octets concernés. Le manifeste de la campagne `diagnostic/candidate-01` est identique octet pour octet au manifeste final. Le reçu de contribution vérifie également que les sources de la campagne et du comparateur correspondent à ce gel. La campagne déjà réalisée constitue donc une preuve pour ce candidat précis ; elle n’est pas présentée comme une seconde exécution finale.

Le [gel de livraison après revue du registre](lot4a-evidence/final-release/source-manifest.json) conserve les mêmes 271 fichiers natifs. Seul le test historique du compteur a été corrigé après le premier gate 536/536 ; le gate final 548/548 dans 29 fichiers couvre cet inventaire final des tests. Le [reçu de réutilisation exacte](lot4a-evidence/final-release/evidence-reuse.json) explique pourquoi le build, les quatre régressions et la campagne MIND sont conservés sans réexécution. Leur gel natif et leurs entrées d’exécution n’ont pas changé. Le [contrôle d’intégrité de livraison](lot4a-evidence/final-release/delivery-integrity.json) vérifie ces identités.

| Compteur après transfert | État | Portée |
| --- | ---: | --- |
| Entrées DRM raccordées | **54/76**, aucune partielle | Une entrée ajoutée ; 22 restent ouvertes |
| Workflows compilés | **37** | Le lot consomme un workflow déjà compilé |
| Modules de composant vérifiés | **164** | Vérification dans les périmètres déclarés |
| Modules partiellement transférés | **144** | Héritages ou opérations restant incomplets |
| Modules en attente | **1 061** | Périmètre source restant |
| Modules entièrement vérifiés | **0** | Aucune clôture de migration globale |

Le [registre des entrées](v6-entry-point-progress.json), l’[audit de couverture](v6-coverage.json) et la [carte de transfert](../../migration/v6-transfer-map.json) comptent des objets différents. Le raccordement d’une entrée ne vaut pas parité complète de l’appelant. `fullV6Parity` et les portes de complétude globale restent ouverts.

## Source et fermeture effectivement transférée

La référence immuable est le commit **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**. Le transfert porte sur `morphology_policy/feedback_sequences/family.py`, `visual.py`, `finite.py`, leur DRM et leur SRC. Il consomme la fermeture V5 nécessaire de `capabilities/feedback_code_identification.py` : filtrage des couples secret/loi et partitionnement des essais avec les rangs révélés et l’historique courant. L’ajustement de protocoles, les politiques d’identification à plusieurs tentatives, les transactions et les jointures d’historiques V5 restent hors de cette portée. La [filiation détaillée](lot4a-feedback-sequences-lineage.md) relie chaque contrat aux producteurs, callbacks, états et preuves natifs.

Le workflow **`v6.feedback_sequences.choose`** exécute l’ordre source : poursuivre un essai lié, tester une proposition complète, discriminer les codes compatibles, puis acquérir un ajout. Ses callbacks `sequences.begin/offer/advance/finish` produisent les reçus SRC comparés à ceux de l’original. Le code de production TypeScript utilise les mesures et domaines publics existants. Aucun identifiant de jeu ou de niveau, aucune signification préparée de couleur, aucun secret ni trajet de solution ne sélectionne une règle.

Les styles visibles restent des signatures opaques. Le calcul conserve les interprétations exact/ailleurs/absent compatibles, ainsi que les ordres d’allocation gauche-droite et droite-gauche. Il réserve les occurrences exactes avant les occurrences déplacées. Une palette qui retire une valeur restreint les essais réalisables ; elle ne démontre pas que le secret exclut les répétitions. Le nombre de secrets distincts, le nombre de lois compatibles et le nombre de partitions restent des mesures distinctes.

## Cycle de proposition, action et acquisition

| Étape | Comportement conservé | Conséquence pour la décision |
| --- | --- | --- |
| Mesure | Reconnaître une palette et les lignes ordonnées dans l’observation courante ; refuser une interface ambiguë | Une ressemblance insuffisante ne devient pas un plan |
| Saisie expérimentale | Un contrôle encore inconnu autorise une action ; les ajouts observés établissent son rôle | Les suites plus longues reposent sur une saisie attestée, notamment sur deux valeurs distinctes |
| Préfixe conditionnel | Lier chaque valeur au point courant, remesurer la palette et vérifier les valeurs déjà saisies | Une palette compactée peut déplacer l’adresse suivante ; une contradiction ferme la continuation |
| Soumission | Tester le contrôle avec une ligne complète et s’arrêter à son retour non mesuré | Le résultat de la soumission est acquis avant toute nouvelle discrimination |
| Discrimination | Filtrer les hypothèses puis comparer les partitions des essais préservant le préfixe | Choisir le plus petit pire résidu non gagnant selon les critères DRM et les départages source |
| Retour et frontière | Conserver l’ajout, le retour interprétable, l’effacement de suffixe ou la frontière réellement observés | Recalculer depuis l’état acquis ; un essai périmé n’est pas poursuivi |

Une même instance `FeedbackSequences`, exposée par `feedbackSequenceFamily`, sert les deux chemins de l’appelant : **`goal_access / observed_feedback_sequence`** et **`information_goal`**, ce dernier selon la configuration source `feedback_sequences_first`, après la consultation de VisualSequences lorsque celle-ci est activée. Les deux chemins partagent le propriétaire `family_state:feedback_sequences`.

Lorsqu’une proposition Feedback est sélectionnée, l’acquisition commune lui retourne chaque primitive réelle une seule fois et conserve `feedback_sequence_event:<revision>`. Lorsqu’une autre famille choisit l’action, l’acquisition passive Feedback reçoit les cinq arguments publics source, sans la proposition étrangère. Elle intervient après ReactiveContact et avant les acquisitions de départ morphologiques. Le passage passif n’est pas répété après une acquisition sélectionnée Feedback. Ces contrats sont exercés dans les [tests de la fabrique commune](../../tests/v6-feedback-sequences-integration.test.ts).

### État propre et rappel après frontière

Les douze champs persistés correspondent à la source : `layout`, `active`, `repeatable`, `entry_evidence`, `history`, `submit`, `clear_evidence`, `last`, `blocked`, `palette_background`, `entry_method` et `transfer_refuted_epoch`. Feedback reste propriétaire de cette mémoire ; elle ne devient pas une couche de SharedSeries. Le miroir `feedback_sequence_state` est conservé lorsque **`layout` ou `entry_method`** existe. La restauration reconstitue cet état sans rejouer d’action ni d’acquisition. Les diagnostics de recherche restent recalculables et ne sont pas ajoutés à la mémoire acquise.

À une frontière officielle, l’interface, l’essai actif et l’historique local sont effacés. La méthode d’entrée portable reste une **hypothèse à revalider dans la nouvelle époque**. Sur MIND, les trois frontières conservent cette méthode alors que `layout` et `last` sont nuls et que l’historique est vide. Après les deux premières frontières, une proposition réclame la revalidation et l’ajout suivant reçoit `active_rank_row_confirmed`. La campagne s’arrête à sa cible après la troisième frontière : aucune confirmation de rôle au quatrième niveau n’est annoncée. Une réfutation de transfert reste locale à l’époque ; elle ne nie pas un ajout actuellement observé.

### Bornes et adaptations natives

La configuration source borne la recherche à **4 096 codes candidats**, **256 essais**, **65 536 évaluations** et **16 actions par suite**. Les statuts de borne, contradiction, préfixe sans essai admissible et budget d’entrées insuffisant restent distincts. Aucune recommandation n’est émise à partir d’une énumération inachevée. Le minimax porte sur la prochaine expérience ; il ne garantit pas une résolution en plusieurs tentatives.

Le calcul déterministe et le calcul coopératif partagent le même générateur. Le runtime vérifie le signal d’annulation et l’échéance aux frontières de travail, et rend la main après au plus 16 tranches ou lorsque le seuil de 8 ms est atteint. Une interruption produit **`native_feedback_search_incomplete`**, `domain_complete: false` et `recommendation: null`. Elle ne devient ni impossibilité ni réfutation acquise. Ces seuils de planification ne constituent pas une garantie de préemption à chaque pixel ou à chaque instruction de mesure.

L’autre adaptation explicite concerne un lieu dont les pixels ont disparu : la mesure native échoue proprement et permet à la garde de refuser ce lieu, là où un accès hors raster Python pourrait lever une exception. Les contrats source dans leur domaine mesuré restent comparés exactement.

## Contribution réelle sur MIND

La [résolution du cas](lot4a-evidence/final/mind-resolution.json) conserve une seule session froide réussie, sans action manuelle ni saut de niveau. Les niveaux demandent respectivement **8, 8 et 15 actions**. Les **20 sélections** passent toutes par `goal_access / observed_feedback_sequence`. Les **31 acquisitions** Feedback sont toutes des acquisitions de famille sélectionnée : **24 `observed_append`**, **4 `observed_submission_feedback`** et **3 `official_boundary`**. Le résultat final est `NOT_FINISHED`, avec l’arrêt déclaré `target_levels_completed` : la preuve concerne les trois niveaux visés, pas la fin du jeu.

L’horloge commence le **10 novembre 2026 à 17:54:17,338639 UTC**, avec un plafond de 2 400 secondes. Le premier lancement échoue avant toute action parce que des ressources Python générées, vérifiées par empreinte, sont absentes. Ce reçu est conservé ; leur restauration ne réinitialise pas l’horloge. La campagne suivante atteint la cible. La résolution du dossier intervient à **18:05:49,869631 UTC**, soit **692,530992 secondes cumulées**, incluant les diagnostics, la référence et l’essai de préparation navigateur. Cette durée de dossier n’est pas une mesure du surcoût relatif du moteur.

La référence publiée **0.49.0**, exécutée séparément avec un plafond déclaré de huit actions, s’arrête après **une action et aucun niveau** sur `nested_control_effect_requires_composition`, avant d’atteindre ce plafond. Ce résultat borné décrit le comportement de cette référence dans ce contexte. Il ne prouve pas une impossibilité générale de résoudre MIND avec un autre déroulement.

### Quatre retours publics et décisions suivantes

Pour lire cette trace, **A = 8, B = 14, C = 9 et D = 6** désignent uniquement les valeurs mesurées dans cette scène. **X** et **Y** abrègent deux signatures visuelles de retour ; aucune signification exact/ailleurs/absent ne leur est assignée. Les comptes ci-dessous proviennent des propositions complètes conservées dans le [reçu de contribution](lot4a-evidence/final/feedback-public-contribution.json).

| Retour acquis | Essai soumis et hypothèses avant retour | Observation publique | Hypothèses restantes | Essai choisi ensuite | Effet du retrait de l’historique |
| --- | --- | --- | --- | --- | --- |
| Niveau 1 | **A B C**, 27 codes | Marques **X Y Y** ; premier rang révélé **A** | **2 codes**, 4 lois compatibles | **A C B** ; pire résidu non gagnant **1** | Le rang révélé reste présent ; 9 codes, choix **A B C** : décision changée |
| Niveau 2 | **A B D**, 64 codes | Marques **Y Y Y** ; aucun rang révélé | **4 codes**, 12 lois compatibles | **B D A** ; pire résidu **2** | 64 codes, mais même choix **B D A** : décision inchangée |
| Niveau 3, premier retour | **A B D C**, 256 codes | Marques **Y Y X Y** ; troisième rang révélé **D** | **3 codes**, 4 lois compatibles | **B C D A** ; pire résidu **2** | Le troisième rang reste présent ; 64 codes, choix **B A D C** : décision changée |
| Niveau 3, second retour | **B C D A**, 3 codes | Même motif **Y Y X Y**, appliqué à d’autres valeurs ; troisième rang **D** | **2 codes**, 4 lois compatibles | **C A D B** ; pire résidu **1** | Les deux lignes d’historique sont retirées ; 64 codes, choix **B A D C** : décision changée |

La soumission complète utilise ici le contrôle public `ACTION5`. Chaque nouvelle suite est relocalisée par les points `ACTION6` mesurés dans la palette courante. Les suites ne sont pas des chemins préparés : la même coordonnée peut correspondre à une valeur différente après compactage. La dernière soumission retenue au troisième niveau franchit la frontière officielle.

### Ablation locale de l’historique

Le comparateur retire uniquement `history` d’un clone restauré depuis l’état **acquis par le rejeu original froid**. Il conserve les rangs actuellement révélés, les autres champs du propriétaire et tout essai déjà lié. Aucun état natif ne sert à initialiser l’original. Les huit contextes admissibles sont tous retenus, sans erreur.

- **Trois choix changent**, aux appels 8, 37 et 44 : action et essai ordonné diffèrent.
- **Cinq choix restent identiques**, aux appels 12, 22, 26, 42 et 49. L’appel 22 change le compte des hypothèses mais conserve l’essai choisi ; les quatre autres sont des soumissions déjà liées.
- Les **huit propositions complètes** diffèrent au sens JSON strict, notamment parce que leurs références de preuve changent. Ce nombre ne représente pas huit changements de décision.

Cette intervention établit une dépendance locale du choix à l’historique acquis dans trois contextes réels. Elle ne démontre pas qu’un appelant complet sans Feedback échouerait, gagnerait plus tard ou rencontrerait les mêmes états intermédiaires.

## Parité avec la famille originale et limites du domaine

Le [comparateur conservé](../../scripts/compare-feedback-public-parity.py) démarre une instance originale vide, puis rejoue les arguments publics enregistrés. Il compare **20 propositions et 31 acquisitions**, ainsi que les **51 états avant et 51 états après**. Les propositions complètes incluent les reçus SRC. La comparaison JSON exacte ne normalise aucun champ : **51/51 appels concordent, zéro différence**. L’observateur original remesure **32 observations publiques**. Les **1 786 fichiers source** sont vérifiés avant et après ; les originaux et les entrées de comparaison restent inchangés.

Des contrôles indépendants sur la campagne conservée confirment les **31 commandes acquises**, les **31 résultats de niveau/score/état**, les **30 liens de révision consécutifs** et les **20 états retenus aux préfixes**. Ces vérifications relient les appels de la famille au flux d’actions réellement exécuté ; elles ne créent pas une nouvelle campagne.

La portée reste celle de **FeedbackSequences sur les arguments publics capturés**. L’appelant Python complet n’a pas été exécuté. Les listes de commandes candidates sont celles fournies par l’appelant natif ; elles ne sont pas recalculées par ce rejeu. L’inspection des domaines original et natif retrouve l’admission des commandes non pointées `ACTION1` à `ACTION5`, avec des lieux `ACTION6` observés et bornés. MIND expose initialement `ACTION5`, `ACTION6` et `ACTION7`, mais les candidats initiaux contiennent un `ACTION5` et 22 `ACTION6`, sans `ACTION7`. Les 20 contextes de proposition restent sans candidat `ACTION7`. Cette limite du domaine existant est conservée ; le lot n’évalue pas les alternatives qu’elle exclut.

La campagne live ne sélectionne pas Feedback par `information_goal` et n’exerce pas son acquisition passive. Ces deux contrats, les contrôles inconnus et l’effacement de suffixe sont couverts par les preuves de composant et d’appelant synthétique, avec leur portée propre.

## Validation formelle et persistance

Le [reçu du delta](lot4a-evidence/final-release/validation/delta-tests-run.json) donne **536 tests réussis sur 536**, dans **29 fichiers**, sans échec, annulation, test ignoré ou TODO. Les sources natives et les entrées des tests sont inchangées pendant l’exécution. Le [reçu des contrôles](lot4a-evidence/final/validation/checks-run.json) donne **5/5** : typage, audit des entrées, audit de migration, contrôle du diff et compilation de production. Il s’agit du périmètre formel déclaré, pas d’une réexécution de toute la suite historique.

L’[exporteur de référence](../../scripts/export-v6-feedback-sequences-reference.py) appelle les originaux inchangés. Les [tests différentiels](../../tests/v6-feedback-sequences-reference.test.ts) couvrent notamment les 13 cas de calcul fini, la reconnaissance, les sessions de saisie, les retours, les refus, les liaisons, les gardes et la restauration. Ils comparent les propositions et reçus complets, sans prendre une sortie native comme attente. La [fixture](../../tests/fixtures/v6-feedback-sequences-reference.json.gz.parts.json) est conservée en deux parties ; `readEvidenceSync` permet aux deux fichiers de test Feedback de la lire sans restauration préalable du fichier compressé.

Les [sept tests d’intégration](../../tests/v6-feedback-sequences-integration.test.ts) exercent la fabrique commune, l’ordre et les deux chemins, le partage d’un propriétaire, l’acquisition sélectionnée/passive sans doublon, les points après compactage de palette, les suites différentes après retours discriminants, une contradiction fermant le préfixe et la méthode restaurée sans interface. Le test coopératif couvre un signal déjà annulé, une échéance atteinte et une annulation au premier rendu de main ; les trois résultats conservent une recherche incomplète sans recommandation.

Le delta inclut les tests communs de persistance, checkpoints, graphe d’état, hydratation, identité, copie et mémoire incrémentale. Les cinq sources communes de séries partagées, stockage, graphe d’état, types et service sont inchangées depuis Site 78. **Aucun import et rejeu d’un graphe de checkpoint complet produit par 0.49 n’est revendiqué ici** : l’initialisation du protocole crée un nouveau magasin et les reprises restaurent l’état du runtime courant. L’ancien harnais CrossedPrefix épinglé sur 0.48 ne constitue pas une preuve supplémentaire de compatibilité complète 0.49 pour ce lot.

## Régressions publiques enregistrées

Le [manifeste des cas](lot4a-evidence/recorded-regression-cases.json) lie les traces historiques aux rapports de référence **0.49**. Les noms historiques `*-048-replay.json.gz` désignent les rapports produits lors du lot 3H contre sa propre référence 0.48 ; ils ne changent pas l’identité 0.49 utilisée ici. Le [reçu final des régressions](lot4a-evidence/final/regressions/regression-summary.json) confirme **4/4 cas et 68/68 contrôles**, avec sources et entrées immuables pour chaque cas.

| Cas | Actions comparées | Préfixes | Contrôles | Résultat |
| --- | ---: | ---: | ---: | --- |
| CATR | 12 | 8 | 17/17 | Conforme |
| RSWP | 19 | 11 | 17/17 | Conforme |
| FOGW | 50 | 27 | 17/17 | Conforme |
| VOIS | 78 | 42 | 17/17 | Conforme |
| **Total** | **159** | **88** | **68/68** | **4/4** |

Le périmètre contient également **163 paquets publics complets, 600 images d’animation, 247 requêtes et 12 frontières naturelles**. Chaque commande courante est calculée avant la fourniture de son retour enregistré. Les contrôles hérités comparent les commandes, empreintes de paquets, longueurs d’animation, frontières primitives, familles/groupes/sous-questions sélectionnés, champs nommés de coordination et de garde, préfixes, ancres d’époque, comptes d’événements et résultat public final.

Seuls les préfixes de session d’observation fraîche sont normalisés dans les champs sélectionnés. Les temps, étiquettes d’implémentation et statuts de migration sont exclus. La comparaison n’affirme ni égalité intégrale des payloads de fournisseurs et graphes, ni parité de l’appelant original, ni égalité du nouvel état Feedback. Aucune exigence de présence passive Feedback n’est imposée à des interfaces non reconnues. Ces rejeux ne sont ni quatre nouvelles réussites live ni une mesure de vitesse ; la preuve de propriété et de persistance Feedback vient des tests propres et de MIND.

## Contrôle navigateur : blocage conservé

Le [reçu navigateur](lot4a-evidence/final/browser/browser-qa.json) porte le statut **`blocked_infrastructure`**, pour le même digest natif. Le preview géré à `http://127.0.0.1:4173/` a démarré. La navigation CDP échoue sur **`Page.enable timed out`**, puis l’accès à l’état courant sur **`Page.getFrameTree timed out`**. La capture de bureau montre Chromium affichant **« Cannot open this page », code 9**, sur l’onglet Motivation préexistant. La navigation native est ensuite bloquée par l’indisponibilité du fournisseur AT-SPI, dont le registre signale zéro connexion.

Le reçu conserve **zéro action de jeu navigateur et aucun contrôle fonctionnel validé**. La compilation de production, les campagnes de l’appelant commun et les tests de Pause/annulation restent des preuves séparées. Ils ne certifient pas le jeu, Pause/reprise ou le pas à pas dans le navigateur. Aucun changement du moteur ni serveur de contournement n’a été introduit pour transformer ce blocage en validation.

## Coûts : protocole déclaré, verdict à compléter

**Les résultats et le verdict de coût ne sont pas encore intégrés à ce rapport.** Le [protocole](lot4a-evidence/performance/protocol.md), sa [déclaration préalable](lot4a-evidence/performance/declaration.json) et la [politique globale](lot4a-evidence/performance/global-budget-policy.json) fixent la comparaison avant mesure. A est la référence publiée 0.49.0 ; B est le candidat 0.50.0 gelé ci-dessus. Les anciennes durées ne fournissent aucun échantillon.

L’ordre déclaré est **A1/B1/B2/A2**, STCK puis SMLP dans chaque série : quatre sessions froides par jeu et série, soit huit sessions par jeu et version, **32 sessions et 400 actions mesurées**. Huit chauffes séparées, totalisant 24 actions, sont exclues selon la règle préalable. Aucune session mesurée ni valeur extrême ne doit être écartée. Les deux cohortes, incidents et résultats défavorables doivent rester conservés.

L’acceptation exige, **pour chacun des deux jeux**, une augmentation strictement inférieure à **10 %** de la médiane regroupée des sessions complètes : `médiane(B) / médiane(A) - 1`. Les jeux ne se compensent pas. Les phases imbriquées ne s’additionnent pas. Une hausse de phase peut rester admissible lorsque le budget global passe, mais elle et les queues de distribution doivent rester visibles. Le p95 empirique n’est rapporté qu’avec au moins vingt échantillons ; huit sessions ne justifient pas un p95 de session.

La fenêtre doit conserver les contrôles d’intégrité avant et après mesure, l’arrêt des autres charges et les acquittements d’isolation. Le verrou coopératif seul ne prouve pas cette isolation. Ce banc mesure la boucle commune sur des retours enregistrés ; il exclut le rendu navigateur, le moteur du jeu et le réseau, et ne démontre pas une stabilité sur plusieurs heures.

| Élément à finaliser | État du présent rapport |
| --- | --- |
| Reçu d’ouverture et isolation effective | À référencer après vérification |
| Médianes globales A/B, STCK et SMLP | À compléter depuis les nouveaux reçus |
| Détails des phases, p95 admissibles, mémoire, Pause et incidents | À compléter, y compris résultats défavorables |
| Revue d’intégrité et décision de budget | À compléter ; aucune acceptation anticipée |

## Fichiers et preuves principales

| Fichier ou ensemble | Rôle |
| --- | --- |
| [v6-feedback-sequences.ts](../../src/logos-engine/v6-feedback-sequences.ts) | Workflow, propositions, liaisons, gardes, acquisition et mémoire propre |
| [v6-feedback-sequences-visual.ts](../../src/logos-engine/v6-feedback-sequences-visual.ts) | Mesure des lignes, valeurs, palette et styles publics |
| [v6-feedback-sequences-finite.ts](../../src/logos-engine/v6-feedback-sequences-finite.ts) | Filtrage, partitions, minimax et exécution coopérative |
| [v6-native-runtime.ts](../../src/logos-engine/v6-native-runtime.ts) | Adaptateur unique, deux chemins, acquisition passive et persistance de la méthode |
| [audit-v6-entry-points.ts](../../scripts/audit-v6-entry-points.ts), [registre](v6-entry-point-progress.json), [couverture](v6-coverage.json), [carte de transfert](../../migration/v6-transfer-map.json) | Déclaration du raccordement et de son périmètre |
| [exporteur original](../../scripts/export-v6-feedback-sequences-reference.py), [test de référence](../../tests/v6-feedback-sequences-reference.test.ts), [test d’intégration](../../tests/v6-feedback-sequences-integration.test.ts) | Attentes inchangées et validation dans l’appelant commun |
| [harnais de campagne](../../tests/helpers/v6-live-game-campaign.ts), [comparateur public](../../scripts/compare-feedback-public-parity.py) | Captures publiques et comparaison froide de la famille originale |
| [filiation](lot4a-feedback-sequences-lineage.md), [contribution publique](lot4a-evidence/final/feedback-public-contribution.json), [résolution MIND](lot4a-evidence/final/mind-resolution.json) | Contrats, effets observés, ablations et horloge |
| [validation](lot4a-evidence/final-release/validation/delta-tests-run.json), [contrôles du projet](lot4a-evidence/final/validation/checks-run.json), [régressions](lot4a-evidence/final/regressions/regression-summary.json), [navigateur](lot4a-evidence/final/browser/browser-qa.json) | Reçus séparés des vérifications et du blocage d’infrastructure |

## Suite de la roadmap et publication

| Sous-lot | État et prochain travail |
| --- | --- |
| **4A — `observed_feedback_sequence`** | Transfert et contribution MIND vérifiés sur le candidat. Finaliser le coût, l’identité effectivement intégrée et la publication, avec la réserve navigateur explicitement conservée. |
| **4B — `relative_arrangement`** | Planifié. Raccorder `v6.relative_arrangements.choose`, ses mesures, expériences sélectionnées, acquisition liée à l’observation initiale et restauration. Distinguer domaine non reconnu et arrangement reconnu sans expérience admissible : ce dernier clôt la chaîne de contraintes de fenêtre prévue par la source. Son contrat d’acquisition ne doit pas être remplacé par celui de Feedback. |
| **4C — `facet_example`** | Planifié. Raccorder `v6.facet_examples.choose`, les correspondances simples puis les branches composées selon la configuration originale. Préserver déplacement de face, extension de côtés, méthode portable et méthode composée locale, réfutations, changements hors région, absence d’effet et refus officiel malgré un rendu conforme. Distinguer connaissance acquise et caches recalculables. |

La [roadmap](v6-delivery-roadmap.md) conserve **4B comme prochain travail de ce fil après clôture de 4A**. La suite du lot 3 reste indépendante. 4C peut être scindé en livraisons simple et composée avec des statuts propres ; aucun de ces sous-lots n’est déclaré transféré par 4A.

**Publication à compléter.** Le présent rapport ne certifie aucune nouvelle version Site publiée. Le commit final, la version Site, la version native effectivement intégrée, leur lien au gel et le reçu de publication devront être ajoutés après vérification. Les résultats de cette livraison restent ceux du digest explicitement identifié ; une modification ultérieure des sources ne les étend pas automatiquement au nouveau code.
