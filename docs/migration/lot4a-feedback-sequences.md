# Lot 4A : séquences et retours discriminants, livraison native 0.51

## État de la livraison

L’entrée **`observed_feedback_sequence`** est raccordée à **Logos Engine**. Le composant reconnaît une interface ordonnée, acquiert les effets de saisie effectivement observés, soumet un essai complet et utilise les retours publics pour choisir l’essai suivant. Les hypothèses portent à la fois sur les valeurs possibles et sur les lois d’interprétation du retour. La décision reste conditionnée par la palette, le préfixe courant et les preuves acquises.

**La livraison intégrée 0.51.0 réunit Feedback et la livraison 3I effectivement publiée dans Site 79. Son delta passe 3 566/3 566 tests dans 90 fichiers et 5/5 contrôles, compilation comprise.** Sa nouvelle campagne MIND atteint trois niveaux en **31 actions et 20 préfixes**, avec une parité de famille originale de **51/51 appels** et **trois choix changés sur huit ablations**. Les **cinq régressions** contre la référence publiée 0.50 passent **85/85 contrôles**, sur **240 actions et 169 préfixes**. Ces résultats sont rattachés au nouveau gel par les [tests intégrés](lot4a-evidence/integrated-051/validation/delta-tests-run.json), les [contrôles intégrés](lot4a-evidence/integrated-051/validation/checks-run.json), le [reçu de contribution live](lot4a-evidence/integrated-051/feedback-live-contribution.json) et le [reçu des régressions](lot4a-evidence/integrated-051/regressions/regression-summary.json). **La décision de coût respecte la règle globale pour 2/2 jeux, sous qualification de l’ajout du propriétaire : STCK −9,093642 %, SMLP +4,601522 %. La consolidation stricte demeure en échec ; la qualification structurelle est distincte et déclarée après mesure. La première publication 4A est confirmée dans Site 80, avec déploiement `succeeded` et accès privé conservé.**

Le **premier candidat 4A isolé, étiqueté 0.50.0**, conserve ses preuves historiques : **548/548 tests dans 29 fichiers**, **5/5 contrôles**, quatre régressions et **68/68 comparaisons**. Sa campagne MIND atteint trois niveaux naturels en **31 actions et 20 préfixes** ; le rejeu de la famille Python originale concorde sur **51/51 appels**. Retirer uniquement l’historique change le choix dans **trois des huit contextes** examinés ; cinq restent identiques. Le [reçu de contribution historique](lot4a-evidence/final/feedback-public-contribution.json) identifie précisément ce candidat. **Ces résultats ne sont pas annoncés comme de nouvelles exécutions du candidat intégré 0.51.**

Le nouveau [contrôle navigateur intégré](lot4a-evidence/integrated-051/browser/browser-qa.json) est **bloqué par l’infrastructure**, avec zéro action de jeu et aucun comportement de l’interface 0.51 vérifié. Les preuves de composant, de campagne, de régression et de coût gardent leurs périmètres propres. Les **2 053 assertions de jointure** du reçu de contribution, réparties en sept groupes, ne s’ajoutent pas au décompte des 3 566 tests.

## Référence, gel et compteurs

### Référence publiée et livraison intégrée actuelles

| Identité | Référence effectivement publiée | Livraison intégrée vérifiée |
| --- | --- | --- |
| Publication Site | **79**, livraison 3I ; déploiement `succeeded` | **80**, première publication 4A ; déploiement `succeeded` |
| Version native | **0.50.0** | **0.51.0** |
| Commit de la première publication | `6d03c2adda9f60b1c97304f5491a428cfbec7a6c` | `a52ef3d8396eb051d6d42d3388072fe0bf2a2d9e` |
| Fichiers natifs | **270** | **273** |
| Digest natif | `e039a62b5dbb563a6c25f5469228e0025ffb66f243a4e09fdf27caeaeef2bf87` | `c1e3dbdba85929dee4a287bc2f5cb6a011457ba43e9a67078f2764f659b603b7` |

Le gel fonctionnel a été vérifié sur la fusion `025b8000265f75441aaf57e62514c0b580b62218`. Les commits de preuves et de transport qui suivent conservent exactement ses entrées natives, de tests et de build.

La [provenance de la référence intégrée](lot4a-evidence/baseline-integrated/provenance.json) lie le commit Site 79, le déploiement réussi et le checkout distinct `/workspace/sites/sra-lot4a-base79` à l’inventaire publié. Le [manifeste intégré](lot4a-evidence/integrated-051/source-manifest.json) et l’[archive intégrée de 284 fichiers](lot4a-evidence/integrated-051/source-archive.json) identifient le candidat réellement vérifié. L’identité de version 0.50 de Site 79 désigne les octets de 3I ; elle est distincte de l’étiquette provisoire 0.50 du premier candidat isolé 4A.

### Départ et candidat isolé conservés

Le travail 4A a commencé depuis **Site 78 / native 0.49.0**, commit `8fa6b261b8b23ac8d232e60c9c179e2f3407d82f`, avec **268 fichiers natifs** et le digest `d6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054`. Sa [provenance initiale](lot4a-evidence/baseline/provenance.json) reste conservée.

Le premier candidat 4A isolé **0.50.0** contient **271 fichiers natifs**, digest `66be0948fdff5abe10b12d253bb4583db067aab2f5b7248632c9f9d443bc53fe`. Ses [manifeste](lot4a-evidence/final/source-manifest.json) et [archive](lot4a-evidence/final/source-archive.json) restent historiques. Le manifeste de `diagnostic/candidate-01` est identique octet pour octet à ce gel, ce qui rattache la première campagne MIND et sa comparaison source à ces mêmes octets.

Le [gel isolé après revue du registre](lot4a-evidence/final-release/source-manifest.json) conserve ces 271 fichiers natifs. Seul le test du compteur a été corrigé après le premier gate 536/536 ; le gate 548/548 dans 29 fichiers couvre l’inventaire final de ses tests. Le [reçu de réutilisation exacte](lot4a-evidence/final-release/evidence-reuse.json) et le [contrôle d’intégrité isolé](lot4a-evidence/final-release/delivery-integrity.json) justifient la conservation de ses campagnes, contrôles et régressions sans réexécution **à l’intérieur de ce même gel**. Ils n’étendent pas ces résultats au gel intégré `c1e3dbdb…`.

| Compteur | Candidat isolé 4A 0.50 | Candidat intégré 0.51 | Portée |
| --- | ---: | ---: | --- |
| Entrées DRM raccordées | **54/76** | **55/76**, aucune partielle | Feedback et RecurrentSeries réunis ; 21 entrées restent ouvertes |
| Workflows compilés | **37** | **37** | Consommation de workflows déjà compilés |
| Modules de composant vérifiés | **164** | **166** | Vérification dans les périmètres déclarés |
| Modules partiellement transférés | **144** | **142** | Héritages ou opérations restant incomplets |
| Modules en attente | **1 061** | **1 061** | Périmètre source restant |
| Modules entièrement vérifiés | **0** | **0** | Aucune clôture de migration globale |

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

Dans le candidat intégré, RecurrentSeries reste rattaché au propriétaire existant `public_occurrence_recall`, à sa place DRM dans `window_constraints`. Ses preuves et projections ancestrales appartiennent à SharedSeries. Feedback garde son propriétaire indépendant et ses deux chemins. Le runtime conserve les deux exclusions de double acquisition : une action sélectionnée par un propriétaire peut être observée passivement par l’autre selon son contrat, sans répéter l’acquisition propre. La fusion conserve aussi le nouvel argument de configuration RecurrentSeries et le contrôle de l’entrée exacte ; les tests de couverture attendent **55/76**, avec **10/12, 20/21, 8/10 et 17/33** pour les quatre listes source.

### État propre et rappel après frontière

Les douze champs persistés correspondent à la source : `layout`, `active`, `repeatable`, `entry_evidence`, `history`, `submit`, `clear_evidence`, `last`, `blocked`, `palette_background`, `entry_method` et `transfer_refuted_epoch`. Feedback reste propriétaire de cette mémoire ; elle ne devient pas une couche de SharedSeries. Le miroir `feedback_sequence_state` est conservé lorsque **`layout` ou `entry_method`** existe. La restauration reconstitue cet état sans rejouer d’action ni d’acquisition. Les diagnostics de recherche restent recalculables et ne sont pas ajoutés à la mémoire acquise.

À une frontière officielle, l’interface, l’essai actif et l’historique local sont effacés. La méthode d’entrée portable reste une **hypothèse à revalider dans la nouvelle époque**. Dans la nouvelle campagne MIND intégrée, les appels source `record` d’indices 13, 27 et 50 conservent cette méthode sans interface ni historique local ; les états retenus aux trois préfixes correspondants sont vérifiés par le [reçu de contribution intégré](lot4a-evidence/integrated-051/feedback-live-contribution.json). Après les deux premières frontières, les appels source `propose` d’indices 14 et 28 réclament la revalidation, puis les appels source `record` d’indices 15 et 29 acquièrent l’ajout avec `active_rank_row_confirmed`, comme le conserve la [comparaison source intégrée](lot4a-evidence/integrated-051/mind-live-01/mind-feedback-source-parity.json.gz). La campagne s’arrête à sa cible après la troisième frontière : aucune confirmation de rôle au quatrième niveau n’est annoncée. Une réfutation de transfert reste locale à l’époque ; elle ne nie pas un ajout actuellement observé.

### Bornes et adaptations natives

La configuration source borne la recherche à **4 096 codes candidats**, **256 essais**, **65 536 évaluations** et **16 actions par suite**. Les statuts de borne, contradiction, préfixe sans essai admissible et budget d’entrées insuffisant restent distincts. Aucune recommandation n’est émise à partir d’une énumération inachevée. Le minimax porte sur la prochaine expérience ; il ne garantit pas une résolution en plusieurs tentatives.

Le calcul déterministe et le calcul coopératif partagent le même générateur. Le runtime vérifie le signal d’annulation et l’échéance aux frontières de travail, et rend la main après au plus 16 tranches ou lorsque le seuil de 8 ms est atteint. Une interruption produit **`native_feedback_search_incomplete`**, `domain_complete: false` et `recommendation: null`. Elle ne devient ni impossibilité ni réfutation acquise. Ces seuils de planification ne constituent pas une garantie de préemption à chaque pixel ou à chaque instruction de mesure.

L’autre adaptation explicite concerne un lieu dont les pixels ont disparu : la mesure native échoue proprement et permet à la garde de refuser ce lieu, là où un accès hors raster Python pourrait lever une exception. Les contrats source dans leur domaine mesuré restent comparés exactement.

## Contribution MIND du candidat intégré 0.51

La [nouvelle campagne live](lot4a-evidence/integrated-051/mind-live-01/mind-campaign.json.gz) exécute le candidat réuni dans **une session froide**, conservée aux frontières naturelles. Les niveaux demandent respectivement **8, 8 et 15 actions**, soit **31 actions et 20 préfixes**. Les **20 sélections** passent toutes par `goal_access / observed_feedback_sequence`. Les **31 acquisitions** Feedback sont toutes des acquisitions de famille sélectionnée : **24 `observed_append`**, **4 `observed_submission_feedback`** et **3 `official_boundary`**. Le résultat final est `NOT_FINISHED`, avec l’arrêt déclaré `target_levels_completed`, au niveau 4 : la preuve concerne les trois niveaux visés, pas la fin du jeu.

Le [reçu intégré de contribution](lot4a-evidence/integrated-051/feedback-live-contribution.json) rattache la campagne, sa [trace publique](lot4a-evidence/integrated-051/mind-live-01/mind-public-trace.json.gz), son [journal public réellement exécuté](lot4a-evidence/integrated-051/mind-live-01/mind-actual-public-journal.jsonl.gz), sa comparaison source et le gel `c1e3dbdb…`. Les manifestes live et gelé sont identiques octet pour octet et identifient les **273 fichiers natifs**. Le flux comporte **32 paquets publics**, **32 entrées de journal** et **31 transitions acquises** par l’appelant commun. L’égalité des états Feedback retenus est vérifiée aux **20 préfixes**, y compris les trois états de méthode sans interface.

Les sept groupes du reçu sont tous `passed`. Ils totalisent **2 053 assertions de jointure**, présentées séparément des tests unitaires et d’intégration :

| Groupe du reçu intégré | Assertions | Portée |
| --- | ---: | --- |
| Sélection et horloge cumulée | 32 | Cas choisi, plafond conservé et clôture |
| Provenance live et gelée | 355 | Liens entre manifeste, archive et campagne |
| Journal, trace, actions et acquisition commune | 367 | Cohérence du flux public effectivement exécuté |
| Acquisition Feedback unique et états retenus | 1 198 | Un retour par primitive et mémoire aux préfixes |
| Parité exacte des appels capturés de la famille originale froide | 72 | Résultats et états de la comparaison source conservée |
| Ensemble des ablations d’historique | 26 | Huit contextes, y compris les décisions inchangées |
| Entrées et originaux inchangés | 3 | Conservation des entrées et de la référence |
| **Total** | **2 053** | **Sept groupes conformes ; aucun ajout au nombre de tests** |

Ce vérificateur rapproche des preuves déjà produites par la campagne intégrée et le comparateur source. Il ne lance lui-même ni nouveau jeu, ni nouveau rejeu source, ni recalcul des propositions contrefactuelles. Il contrôle l’inventaire complet des ablations, leurs résultats retenus et leur provenance. Il ne transforme pas une dépendance locale de décision en gain causal sur tout le jeu.

### Horloge cumulée du cas

La [reprise déclarée](lot4a-evidence/mind-integrated-051-resumption.json) conserve les **692,530992 secondes** déjà closes lors du candidat isolé. Le nouvel intervalle commence le **10 novembre 2026 à 19:22:59,174932 UTC** et se termine avec la vérification à **19:26:12,714289 UTC** : **193,539357 secondes** supplémentaires sont comptées, incluant comparaison source et vérification. Le reçu intégré clôt donc **886,070349 secondes cumulées** sur un plafond de 2 400 secondes, avec **1 513,929651 secondes restantes** et `clockReset: false`. Ce temps de traitement du cas ne mesure pas le surcoût relatif du moteur.

### Quatre retours publics et décisions suivantes

Pour lire la **trace intégrée actuelle**, **A = 8, B = 14, C = 9 et D = 6** désignent uniquement les valeurs mesurées dans cette scène. **X** et **Y** abrègent deux signatures visuelles de retour ; aucune signification exact/ailleurs/absent ne leur est assignée. Les comptes et choix ci-dessous proviennent des quatre `publicReturns` et des huit `historyAblation.cases` du [reçu intégré](lot4a-evidence/integrated-051/feedback-live-contribution.json). Les retours arrivent aux **actions 4, 12, 21 et 26**, acquis aux appels **7, 21, 36 et 43**, puis suivis des propositions **8, 22, 37 et 44**. Ces repères relient le tableau au journal et aux appels source de cette nouvelle session.

| Retour acquis | Essai soumis et hypothèses avant retour | Observation publique | Hypothèses restantes | Essai choisi ensuite | Effet du retrait de l’historique |
| --- | --- | --- | --- | --- | --- |
| Niveau 1 | **A B C**, 27 codes | Marques **X Y Y** | **2 codes**, 4 lois compatibles | **A C B** ; pire résidu non gagnant **1** | 9 codes, choix **A B C** : décision changée |
| Niveau 2 | **A B D**, 64 codes | Marques **Y Y Y** | **4 codes**, 12 lois compatibles | **B D A** ; pire résidu **2** | 64 codes, mais même choix **B D A** : décision inchangée |
| Niveau 3, premier retour | **A B D C**, 256 codes | Marques **Y Y X Y** | **3 codes**, 4 lois compatibles | **B C D A** ; pire résidu **2** | 64 codes, choix **B A D C** : décision changée |
| Niveau 3, second retour | **B C D A**, 3 codes | Même motif **Y Y X Y**, appliqué à d’autres valeurs | **2 codes**, 4 lois compatibles | **C A D B** ; pire résidu **1** | Les deux lignes d’historique sont retirées ; 64 codes, choix **B A D C** : décision changée |

La soumission complète utilise ici le contrôle public `ACTION5`. Chaque nouvelle suite est relocalisée par les points `ACTION6` mesurés dans la palette courante. Les suites ne sont pas des chemins préparés : la même coordonnée peut correspondre à une valeur différente après compactage. La dernière soumission retenue au troisième niveau franchit la frontière officielle.

### Ablation locale de l’historique

Le comparateur retire uniquement `history` d’un clone restauré depuis l’état **acquis par le rejeu original froid**. Il conserve les rangs actuellement révélés, les autres champs du propriétaire et tout essai déjà lié. Aucun état natif ne sert à initialiser l’original. Les huit contextes admissibles sont tous retenus, sans erreur.

- **Trois choix changent**, aux appels 8, 37 et 44 : action et essai ordonné diffèrent.
- **Cinq choix restent identiques**, aux appels 12, 22, 26, 42 et 49. L’appel 22 change le compte des hypothèses mais conserve l’essai choisi ; les quatre autres sont des soumissions déjà liées.
- Les **huit propositions complètes** diffèrent au sens JSON strict, notamment parce que leurs références de preuve changent. Ce nombre ne représente pas huit changements de décision.

Cette intervention établit une dépendance locale du choix à l’historique acquis dans trois contextes réels. Elle ne démontre pas qu’un appelant complet sans Feedback échouerait, gagnerait plus tard ou rencontrerait les mêmes états intermédiaires.

## Parité intégrée avec la famille originale et limites du domaine

Pour la nouvelle campagne du candidat intégré `c1e3dbdb…`, le [comparateur conservé](../../scripts/compare-feedback-public-parity.py) démarre une instance originale vide, puis rejoue les arguments publics enregistrés. Le [nouveau reçu de parité](lot4a-evidence/integrated-051/mind-live-01/mind-feedback-source-parity.json.gz), terminé à **19:24:14 UTC**, compare **20 propositions et 31 acquisitions**, ainsi que les **51 états avant et 51 états après**. Les propositions complètes incluent les reçus SRC. La comparaison JSON exacte ne normalise aucun champ : **51/51 appels concordent, zéro différence**. L’observateur original remesure **32 observations publiques**. Les **1 786 fichiers source** sont vérifiés avant et après ; les originaux et les entrées de comparaison restent inchangés. Aucun état natif ne sert à amorcer l’original.

Le reçu de contribution relie cette comparaison aux **31 acquisitions uniques**, aux **32 observations publiques** et aux **20 états retenus aux préfixes** de la nouvelle campagne intégrée. Ces vérifications n’ajoutent ni action ni session à la campagne et ne réutilisent pas les résultats historiques comme résultats d’une nouvelle exécution.

La portée reste celle de **FeedbackSequences sur les arguments publics capturés**. L’appelant Python complet n’a pas été exécuté. Les listes de commandes candidates sont celles fournies par l’appelant natif ; elles ne sont pas recalculées par ce rejeu. L’inspection des domaines original et natif retrouve l’admission des commandes non pointées `ACTION1` à `ACTION5`, avec des lieux `ACTION6` observés et bornés. L’inspection détaillée documentée dans la preuve historique constate que MIND expose initialement `ACTION5`, `ACTION6` et `ACTION7`, mais fournit un `ACTION5` et 22 `ACTION6` dans les candidats initiaux, sans `ACTION7` dans ses 20 contextes de proposition. La nouvelle parité de composant ne constitue pas une vérification complète de ce domaine et n’évalue pas les alternatives exclues par l’appelant.

La campagne live ne sélectionne pas Feedback par `information_goal` et n’exerce pas son acquisition passive. Ces deux contrats, les contrôles inconnus et l’effacement de suffixe sont couverts par les preuves de composant et d’appelant synthétique, avec leur portée propre.

## Contribution historique du candidat isolé 0.50

La [résolution historique](lot4a-evidence/final/mind-resolution.json) et le [reçu de contribution historique](lot4a-evidence/final/feedback-public-contribution.json) restent attachés au gel `66be0948…`, distinct du gel intégré. Ils conservent trois niveaux en **31 actions et 20 préfixes**, **51/51 appels** comparés à l’original et **trois choix changés, cinq inchangés sur huit ablations**. L’égalité de ces comptes avec ceux de la nouvelle campagne n’en fait pas une seule exécution : les journaux, sessions, manifestes et reçus restent distincts.

L’intervalle historique commence le **10 novembre 2026 à 17:54:17,338639 UTC**. Le premier lancement échoue avant toute action parce que des ressources Python générées, vérifiées par empreinte, sont absentes. Ce reçu est conservé ; leur restauration ne réinitialise pas l’horloge. La campagne suivante atteint sa cible. La clôture historique à **18:05:49,869631 UTC** totalise **692,530992 secondes**, incluant diagnostics, référence et essai de préparation navigateur. Ce cumul est reporté intégralement dans le nouvel intervalle, sans compter la pause close entre les deux.

La référence publiée **0.49.0** du travail initial, exécutée séparément avec un plafond déclaré de huit actions, s’arrête après **une action et aucun niveau** sur `nested_control_effect_requires_composition`, avant d’atteindre ce plafond. Ce résultat borné décrit cette référence dans ce contexte ; il ne prouve pas une impossibilité générale de résoudre MIND avec un autre déroulement. Il ne décrit pas non plus un nouveau passage de la référence Site 79 / native 0.50.

## Validation formelle et persistance

### Gate du candidat intégré 0.51

Le [reçu du delta intégré](lot4a-evidence/integrated-051/validation/delta-tests-run.json) donne **3 566 tests réussis sur 3 566**, dans **90 fichiers**, sans échec, annulation, test ignoré ou TODO. Les sources natives et les entrées des tests sont inchangées pendant cette exécution. Les [contrôles intégrés](lot4a-evidence/integrated-051/validation/checks-run.json) sont terminés : **5/5**, pour le typage, l’audit des entrées, l’audit de migration, le contrôle du diff et la compilation de production. Le build se termine le **10 novembre 2026 à 19:12:21 UTC**. Les reçus lient ces résultats au digest `c1e3dbdba85929dee4a287bc2f5cb6a011457ba43e9a67078f2764f659b603b7`. Ces contrôles techniques restent distincts des reçus MIND et de régression, ainsi que du verdict de coût qualifié distinct désormais acquis. Les 2 053 assertions du vérificateur de contribution ne sont pas comptées comme des tests supplémentaires.

### Gate historique et contrats Feedback

Le [reçu du delta isolé](lot4a-evidence/final-release/validation/delta-tests-run.json) conserve **548/548 tests dans 29 fichiers**. Les [contrôles isolés](lot4a-evidence/final/validation/checks-run.json) conservent **5/5** pour le gel `66be0948…`. Ces comptes ne s’ajoutent pas aux 3 566 tests du gate intégré et ne les remplacent pas.

L’[exporteur de référence](../../scripts/export-v6-feedback-sequences-reference.py) appelle les originaux inchangés. Les [tests différentiels](../../tests/v6-feedback-sequences-reference.test.ts) couvrent notamment les 13 cas de calcul fini, la reconnaissance, les sessions de saisie, les retours, les refus, les liaisons, les gardes et la restauration. Ils comparent les propositions et reçus complets, sans prendre une sortie native comme attente. La [fixture](../../tests/fixtures/v6-feedback-sequences-reference.json.gz.parts.json) est conservée en deux parties ; `readEvidenceSync` permet aux deux fichiers de test Feedback de la lire sans restauration préalable du fichier compressé.

Les [sept tests d’intégration](../../tests/v6-feedback-sequences-integration.test.ts) exercent la fabrique commune, l’ordre et les deux chemins, le partage d’un propriétaire, l’acquisition sélectionnée/passive sans doublon, les points après compactage de palette, les suites différentes après retours discriminants, une contradiction fermant le préfixe et la méthode restaurée sans interface. Le test coopératif couvre un signal déjà annulé, une échéance atteinte et une annulation au premier rendu de main ; les trois résultats conservent une recherche incomplète sans recommandation.

Le delta intégré inclut les tests communs de persistance, checkpoints, graphe d’état, hydratation, identité, copie et mémoire incrémentale. Dans le premier candidat isolé, les cinq sources communes de séries partagées, stockage, graphe d’état, types et service étaient inchangées depuis Site 78. **Cette description ne s’applique plus à SharedSeries dans le candidat réuni** : le transfert 3I introduit son propriétaire RecurrentSeries et conserve les deux emplacements ancestraux du digest. Les [tests RecurrentSeries intégrés](../../tests/v6-recurrent-series-integration.test.ts) vérifient ses checkpoints historiques de propriétaire, ses alias, ses certificats de réutilisation et la restauration atomique.

Ces preuves de propriétaires et de restauration courante ne revendiquent pas l’import et le rejeu d’un **graphe de checkpoint historique complet** : l’initialisation du protocole crée un nouveau magasin et les reprises restaurent l’état du runtime courant. L’ancien harnais CrossedPrefix épinglé sur 0.48 reste également distinct de cette portée.

## Régressions publiques enregistrées

### Candidat intégré 0.51 contre référence publiée 0.50 : cinq cas conformes

Le [manifeste intégré](lot4a-evidence/integrated-051-regression-cases.json) déclare **cinq cas** : CATR, RSWP, FOGW, VOIS et WEAV. Il pointe vers les rapports de référence 3I produits par la version publiée 0.50 et vers leurs traces publiques conservées. La [provenance des cas](lot4a-evidence/planning/integrated-051-regression-provenance.json) et le [reçu intégré des régressions](lot4a-evidence/integrated-051/regressions/regression-summary.json) lient les nouvelles exécutions au gel `c1e3dbdb…`. Le reçu est **`passed` : 5/5 cas et 85/85 contrôles**, avec sources natives et entrées immuables avant et après chaque cas.

| Cas | Actions comparées | Préfixes | Contrôles | Résultat intégré |
| --- | ---: | ---: | ---: | --- |
| CATR | 12 | 8 | 17/17 | Conforme |
| RSWP | 19 | 11 | 17/17 | Conforme |
| FOGW | 50 | 27 | 17/17 | Conforme |
| VOIS | 78 | 42 | 17/17 | Conforme |
| WEAV | 81 | 81 | 17/17 | Conforme |
| **Total** | **240** | **169** | **85/85** | **5/5** |

Le périmètre prévalidé contient **245 paquets publics complets, 705 images d’animation, 409 requêtes et 15 frontières naturelles**. Chaque commande courante est calculée avant que l’hôte ne fournisse le retour enregistré attendu. Les 17 comparaisons héritées par cas sont conservées, notamment pour les commandes, paquets, animations, frontières primitives, sélections, gardes, préfixes, ancres, comptes d’acquisition et résultat public final.

Les rejeux sont séquentiels. La préparation des rapports historiques, le runtime natif et la comparaison utilisent des processus séparés sans recouvrement ; la sortie Node brute est conservée dès son démarrage. Le plafond de tas de **1 536 Mio** appartient à ce harnais de régression et ne s’applique pas au banc officiel de coût. La préparation de l’hôte ne modifie ni les retours publics archivés ni les 17 critères de comparaison.

La portée reste celle de rejeux froids de l’appelant commun sur des retours enregistrés. Seuls les préfixes frais de session d’observation sont normalisés dans les champs sélectionnés ; temps, étiquettes d’implémentation et statuts de migration sont exclus. Ni les payloads complets des fournisseurs, ni les chaînes et révisions des graphes, ni l’appelant Python complet, ni l’égalité du nouvel état Feedback ne sont affirmés. Aucune présence passive Feedback n’est imposée sur des interfaces non reconnues. Ces cinq résultats ne constituent pas cinq nouvelles réussites live ni une mesure de vitesse.

### Candidat isolé 4A 0.50 contre référence 0.49 : résultats conservés

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

## Contrôle navigateur intégré : blocage d’infrastructure

Le [nouveau reçu navigateur](lot4a-evidence/integrated-051/browser/browser-qa.json), enregistré à **19:26:09 UTC**, porte **`blocked_infrastructure`** pour la version **0.51.0** et le digest intégré `c1e3dbdb…`. Le preview géré du checkout intégré a démarré à `http://127.0.0.1:4173/`. La tentative CDP sur l’onglet existant échoue précisément avec **`Emulation.setFocusEmulationEnabled timed out`**, sans navigation terminée.

La capture du bureau montre l’onglet Chromium Motivation préexistant à `motivation.html#content`, affichant **« Cannot open this page », code 9**. La tentative de navigation native par Sky reste bloquée : le fournisseur **AT-SPI est indisponible**, avec zéro connexion au registre. Cette erreur de l’onglet préexistant n’est pas attribuée au moteur 0.51. Le preview a ensuite été arrêté par **`sites-preview stop`** ; le [reçu de préparation de la fenêtre de coût](lot4a-evidence/performance-integrated/readiness.json) confirme son arrêt.

Le reçu conserve **zéro action de jeu navigateur et aucun contrôle fonctionnel validé**. Aucun comportement de l’interface 0.51, jeu, Pause/reprise ou pas à pas, n’est vérifié dans le navigateur. La compilation de production, la campagne live froide de l’appelant commun et les tests d’annulation gardent leurs périmètres propres. Aucun pilote de contournement, changement du code applicatif ou changement de permission n’a été introduit.

Le [reçu navigateur historique](lot4a-evidence/final/browser/browser-qa.json), attaché au candidat isolé `66be0948…`, reste également conservé. Ses erreurs CDP `Page.enable` et `Page.getFrameTree` appartiennent à cette tentative antérieure ; elles ne remplacent pas l’erreur précise du contrôle intégré.

## Coûts : règle globale respectée sous qualification de l’ajout du propriétaire

**La fenêtre 0.50 publiée → 0.51 intégré est terminée, avec 32 sessions et 400 actions mesurées.** La [décision globale qualifiée](lot4a-evidence/performance-integrated/owner-qualified-global-budget-decision.json) est **`accepted_under_user_global_rule_with_owner_addition_qualification` : 2/2 jeux conformes** au seuil strict de 10 %. La première cohorte conserve **16/16 diagnostics dans le seuil historique** ; la seconde, **13/16** ; le calcul groupé qualifié conserve **15/16**. L’agrégateur strict a échoué sur l’égalité des métadonnées de graphe et cet échec demeure conservé. **La qualification de comparabilité structurelle a été déclarée après mesure ; elle ne transforme pas la consolidation stricte en réussite.** Le [rapport complet de coût](lot4a-evidence/performance-integrated/results-qualified.md) conserve les deux cohortes, tous les diagnostics défavorables, les dispersions, Pause et la mémoire.

Le dossier `performance/` conserve le [protocole initial](lot4a-evidence/performance/protocol.md), sa [déclaration préalable](lot4a-evidence/performance/declaration.json) et sa [politique globale](lot4a-evidence/performance/global-budget-policy.json) pour la comparaison **0.49.0 → candidat isolé 0.50.0**. Il est désormais historique, **`superseded-before-measurement`** : le [reçu de remplacement avant mesure](lot4a-evidence/performance/superseded-before-measurement.json) porte le statut `superseded_before_any_measurement`, avec **zéro session, zéro action mesurée et aucun échantillon de coût**. Ce dossier reste conservé sans exécution ni remplacement de ses preuves.

L’ordre effectif est **3I → 4A → 7A**. La livraison 3I est publiée dans **Site 79**, au commit `6d03c2adda9f60b1c97304f5491a428cfbec7a6c`, avec un déploiement réussi ; sa [provenance vérifiée](lot4a-evidence/baseline-integrated/provenance.json) fournit la référence de la nouvelle fenêtre. Feedback a été intégré et gelé en 0.51. Les scénarios alternatifs de premier créneau ne sont plus le cadre de cette livraison.

La comparaison **0.50.0 publiée → 0.51.0 intégré** est déclarée dans `performance-integrated/`. Sa [déclaration](lot4a-evidence/performance-integrated/declaration.json), finalisée le **10 novembre 2026 à 19:10:19,797626 UTC**, précède toute mesure. Le [protocole intégré](lot4a-evidence/performance-integrated/protocol.md), la [politique globale intégrée](lot4a-evidence/performance-integrated/global-budget-policy.json) et le [contrôle du protocole](lot4a-evidence/performance-integrated/protocol-check.json) identifient A par `e039a62b…` et B par `c1e3dbdb…`. Les deux checkouts distincts ont fourni des exécutions fraîches ; aucune durée historique ne devient un échantillon.

### Fenêtre, isolation et population effectivement exécutées

La [fenêtre officielle intégrée](lot4a-evidence/performance-integrated/window.json) s’étend du **10 novembre 2026 à 19:29:44,705499 UTC** au **19:38:19,167985 UTC**. Elle porte `status: passed` et `finalIntegrity: passed` pour l’exécution et la conservation des entrées. Ces statuts ne valent pas acceptation de la consolidation ou du budget.

La [préparation attestée](lot4a-evidence/performance-integrated/readiness.json) conserve l’arrêt du preview et des autres charges 4A, la fin des charges 3I et l’acquittement d’attente 7A. Le [verrou exclusif](lot4a-evidence/performance-integrated/lock-acquisition.json) est acquis à **19:29:44,668217 UTC**. Le [reçu d’exécution coordonnée](lot4a-evidence/performance-integrated/coordinated-window-execution.json) atteste sa détention pendant tout le processus officiel, terminé avec le code 0, puis sa libération à **19:38:19,179622 UTC**. Les seuls travaux de ce fil pendant la fenêtre étaient la rédaction et la lecture légère de petits reçus ; le verrou seul n’est pas présenté comme preuve suffisante d’isolation.

L’ordre exécuté est **A1/B1/B2/A2**, STCK puis SMLP dans chaque série : quatre sessions froides par jeu et série, soit **huit sessions par jeu et version**, **32 sessions et 400 actions mesurées**. Les huit chauffes séparées de trois actions, soit **24 actions**, restent conservées et exclues selon la règle préalable. Aucune session mesurée ni valeur extrême n’est retirée.

| Cohorte conservée | Statut original | Diagnostics dans le seuil historique | Résultats défavorables conservés |
| --- | --- | ---: | --- |
| [A1/B1](lot4a-evidence/performance-integrated/cohort1/comparison.json) | `passed` | **16/16** | Aucun diagnostic de médiane hors seuil dans cette cohorte |
| [A2/B2](lot4a-evidence/performance-integrated/cohort2/comparison.json) | `budget_review_required` | **13/16** | STCK `new_decision` : **+11,793 %** ; SMLP `acquisition_and_persistence` : **+16,036 %** ; SMLP `restoration` : **+10,190 %** |

Les trois dépassements de la seconde cohorte portent `over_budget_with_noise_unresolved`. Le bruit observé n’augmente pas le seuil et ne justifie aucune exclusion. Ces diagnostics de phases restent distincts de la règle globale par jeu ; ils ne permettent pas de choisir une cohorte favorable.

### Échec strict conservé et qualification structurelle vérifiée

Le [reçu de l’échec strict](lot4a-evidence/performance-integrated/aggregation-failure-reproduced.json) conserve le code de sortie **1**, l’absence de sortie `combined-comparison.json`, le journal et les entrées inchangées. L’erreur est **`Within-cohort work metadata changed`**. La reproduction de cet échec relit les rapports existants ; elle ne relance aucune mesure.

L’[analyse des métadonnées de travail](lot4a-evidence/planning/feedback-cost-work-delta.json) énumère **432 écarts de la signature hors durées** : **344** comptes de nœuds d’observation, **48** comptes d’inspection, **20** comptes finaux et **20** révisions finales. Le compte de nœuds augmente toujours de **trois** ; la révision finale augmente de **`3 + cycles`**, soit **+9 pour STCK**, **+12 pour SMLP** et **+6 pour chaque chauffe**. Tous les autres champs de la signature officielle restent égaux, et chaque forme de travail est stable entre cohortes à version fixe. La signature mesurée ne contient pas les feuilles privées des graphes ; les captures ultérieures ne les prouvent pas rétroactivement.

La [qualification des graphes](lot4a-evidence/performance-integrated/owner-addition-qualification.json) attribue exactement les trois installations à **`family_state:feedback_sequences`**, **`family_activation:feedback_sequences`** et **`program:v6.feedback_sequences.choose`**, sans retrait de nœud. L’état, son contrôle d’activation et son programme exécutable ont des consommateurs réels. À chaque préfixe scellé, la persistance conserve aussi la provenance du propriétaire, même lorsque sa valeur acquise reste inchangée. Supprimer ces nœuds ou leurs révisions pour égaliser les compteurs modifierait le contrat ; aucune modification de production n’a été faite dans ce but.

La [qualification supplémentaire](lot4a-evidence/performance-integrated/owner-addition-declaration.json) est déclarée à **19:46:27,114239 UTC**, **après la fenêtre et son échec strict**, mais avant les captures de graphes et le regroupement qualifié. Son [protocole distinct](lot4a-evidence/performance-integrated/owner-addition-protocol.md) exige la vérification des chaînes Kernel, des identités et révisions des nœuds, des causes et de l’ordre des deltas. Il ne change ni la règle numérique préalable, ni les outils officiels, ni les durées, ni la population.

Le reçu termine à **19:58:00,124 UTC** avec **`qualified_owner_addition_verified`**, **315 920 assertions** dans quatre groupes, **104 points capturés** formant **52 paires**, et **33 deltas supplémentaires du propriétaire** dans les quatre sessions B. Chaque graphe est reconstruit et vérifié contre sa propre chaîne complète. Les identités, types, révisions et métadonnées communes déclarées, ainsi que les causes et l’ordre des deltas communs, sont comparés exactement. Les valeurs privées encodées restent intégralement conservées ; leur égalité complète entre versions n’est pas revendiquée. Le reçu maintient **`workMetadataExact: false`** et **`strictAggregationReclassified: false`**.

### Captures de graphes hors mesure

Les [captures A](lot4a-evidence/performance-integrated/owner-graphs-A-01.receipt.json) et [B](lot4a-evidence/performance-integrated/owner-graphs-B-01.receipt.json) sont terminées avec le statut **`captured_and_raw_shapes_verified`**. Chaque côté exécute quatre sessions froides : chauffe de trois actions et trajet complet de dix actions pour STCK ; chauffe de trois actions et trajet complet de quinze actions pour SMLP. Au total, **huit sessions et 62 actions diagnostiques** sont rattachées aux **40 essais bruts** correspondants, chauffes et mesures incluses. Sources, générateur et entrées restent inchangés.

Le [capteur](lot4a-evidence/capture-cost-owner-graphs.mjs) utilise le vrai runtime et le service commun WHY/ACT, avec des identités de session fixes identiques entre A et B. Il vérifie chaque commande avant de fournir son retour public et conserve les nœuds réels après `init` et chaque `advance`/`resume`, ainsi que tous les nouveaux deltas. Le point terminal n’ajoute aucun `resume` après le plafond. Les observations brutes officielles n’exposent la révision du graphe qu’au terminal : les révisions intermédiaires capturées sont liées au graphe réel, sans inventer de référence intermédiaire dans les mesures.

Les deux captures de graphes sont archivées en **92 parties exactes**, **46 pour A et 46 pour B**, avec leurs index [A](lot4a-evidence/performance-integrated/owner-graphs-A-01.json.gz.parts.json) et [B](lot4a-evidence/performance-integrated/owner-graphs-B-01.json.gz.parts.json). Ces captures ne mesurent pas la vitesse et ne fournissent aucun échantillon à la fenêtre. Leurs sessions et actions ne s’ajoutent pas aux **32 sessions / 400 actions mesurées**. Les **315 920 assertions structurelles**, les **274 contrôles arithmétiques** et les **2 053 assertions de jointure MIND** restent des vérifications distinctes ; aucune ne s’ajoute aux **3 566 tests**.

### Décision globale qualifiée et résultats défavorables conservés

L’acceptation exige, **pour chacun des deux jeux**, une augmentation strictement inférieure à **10 %** de la médiane regroupée des sessions complètes : `médiane(B) / médiane(A) - 1`. Les jeux ne se compensent pas. Les phases imbriquées ne s’additionnent pas. Une hausse de phase peut rester admissible lorsque le budget global passe, mais elle et les queues de distribution restent visibles. Le p95 empirique n’est rapporté qu’avec au moins vingt échantillons ; huit sessions ne justifient pas un p95 de session.

L’[agrégat qualifié](lot4a-evidence/performance-integrated/owner-qualified-comparison.json), de statut **`qualified_diagnostic_calculation`**, reproduit les deux comparaisons de cohorte avec les fonctions arithmétiques officielles inchangées, puis regroupe toutes les sessions mesurées. La [revue Python indépendante](lot4a-evidence/performance-integrated/owner-qualified-cost-review.json) recalcule les résultats et clôt **274 contrôles** avec **`owner_qualified_arithmetic_verified`**. La [décision globale](lot4a-evidence/performance-integrated/owner-qualified-global-budget-decision.json), enregistrée à **20:02:10,265114 UTC**, accepte **2/2 jeux** sous la qualification explicite du propriétaire ajouté.

| Jeu | Sessions par version | Médiane A, ms | Médiane B, ms | Variation de médiane | Règle globale stricte < +10 % |
| --- | ---: | ---: | ---: | ---: | --- |
| STCK | 8 | **10 800,922617** | **9 818,725429** | **−9,093642 %** | Conforme sous qualification structurelle |
| SMLP | 8 | **16 603,995727** | **17 368,032281** | **+4,601522 %** | Conforme sous qualification structurelle |

Les deux cohortes complètes et tout le coût des trois nœuds restent dans les durées originales, sans soustraction ni correction. Le diagnostic groupé reste **15/16**, avec le statut **`budget_review_required`** : la phase SMLP **`acquisition_and_persistence` augmente de 11,646641 %**, de **865,503 ms à 966,305 ms** de médiane sur **72 observations par version**, et garde **`over_budget_with_noise_unresolved`**. Ce dépassement reste visible malgré la conformité du budget global ; aucune marge de bruit n’est ajoutée.

Les queues défavorables restent également conservées dans le [rendu complet](lot4a-evidence/performance-integrated/results-qualified.md) : pour SMLP, le p95 de `known_prefix_service` passe de **18,126 à 20,979 ms**, soit **+15,739873 %**, et celui de `known_prefix_request` de **20,452 à 23,766 ms**, soit **+16,204141 %**. Les huit sessions par version ne fournissent aucun p95 de session. Les dispersions ne constituent ni un intervalle de confiance, ni une tolérance supplémentaire au budget.

Les contrôles de Pause conservent les acquittements et les frontières sûres à **zéro action pendant la planification initiale** et **une action lorsque celle-ci est déjà engagée**. Cette portée ne valide pas la préemption de toute recherche longue, ni l’interface navigateur bloquée. Les observations `heapUsed` et RSS de chaque cohorte sont conservées dans le rendu ; leur variabilité dépend aussi des processus, chauffes, allocations et GC. Elle n’établit pas, à elle seule, une fuite ou une cause propre à Feedback. Le banc mesure la boucle commune sur des retours enregistrés ; il exclut le rendu navigateur, le moteur du jeu et le réseau, et ne démontre pas une stabilité sur plusieurs heures.

Le [contrôle des entrées de publication qualifiées](lot4a-evidence/integrated-051/publication-inputs-owner-qualified.json) est **`integrity_verified_with_owner_qualified_cost`**, enregistré à **20:02:41,843604 UTC**. Il lie le gel natif, les inventaires de sources/tests/build, les cinq régressions, les preuves de coût et la conservation exacte des archives, notamment les **92 parties** des captures. Il vérifie les octets sans nouvelle campagne, mesure ou recalcul arithmétique, et maintient l’échec strict. **Ce reçu vérifie les entrées ; le déploiement d’hébergement est attesté séparément par le [reçu Site 80](lot4a-evidence/integrated-051/publication-site80.json).**

| Élément de décision | État du présent rapport |
| --- | --- |
| Ordre effectif | 3I publiée dans Site 79 ; 4A puis 7A |
| Référence publiée et candidat de la nouvelle fenêtre | A : 0.50.0 / `e039a62b…` ; B : 0.51.0 / `c1e3dbdb…`, identités gelées et vérifiées |
| Nouvelle déclaration de coût | Finalisée à 19:10:19 UTC dans `performance-integrated/`, avant mesure |
| Protocole initial `performance/` | Historique, remplacé avant toute mesure ; zéro session et zéro action mesurées |
| Fenêtre intégrée et population | Terminée : 32 sessions, 400 actions ; huit chauffes / 24 actions conservées séparément |
| Résultats des cohortes | 16/16 puis 13/16 diagnostics dans le seuil historique ; les trois dépassements restent conservés |
| Isolation et intégrité de la mesure | Verrou acquis puis libéré, acquittements et détention pendant le processus attestés ; intégrité finale de fenêtre `passed` |
| Consolidation stricte | Échec conservé, 432 écarts de signature hors durées ; aucune sortie officielle de remplacement |
| Captures de graphes | A et B réussies ; huit sessions / 62 actions diagnostiques, 40 essais bruts rattachés, 92 parties exactes |
| Qualification Kernel | Réussie : 315 920 assertions, 104 points, 33 deltas du propriétaire ; qualification distincte déclarée après mesure |
| Calcul groupé et revue indépendante | Agrégat qualifié conservé ; 274 contrôles Python réussis ; diagnostic groupé 15/16 |
| Médianes globales A/B, STCK et SMLP | STCK −9,093642 % ; SMLP +4,601522 % ; huit sessions par jeu et version |
| Phases, p95 admissibles, mémoire et Pause | Rendu complet conservé, dont SMLP acquisition/persistance +11,646641 % et deux hausses de p95 au-delà de 10 % |
| Décision de budget | 2/2 jeux acceptés selon la règle globale avec qualification du propriétaire ajouté ; consolidation stricte toujours en échec |
| Entrées de publication | Intégrité vérifiée avec coût qualifié ; première publication 4A confirmée dans Site 80, déploiement `succeeded` |

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
| [filiation](lot4a-feedback-sequences-lineage.md), [contribution publique historique](lot4a-evidence/final/feedback-public-contribution.json), [résolution MIND historique](lot4a-evidence/final/mind-resolution.json) | Contrats et contribution du candidat isolé 0.50 |
| [validation isolée](lot4a-evidence/final-release/validation/delta-tests-run.json), [contrôles isolés](lot4a-evidence/final/validation/checks-run.json), [régressions isolées](lot4a-evidence/final/regressions/regression-summary.json), [navigateur historique](lot4a-evidence/final/browser/browser-qa.json) | Reçus historiques liés au digest `66be0948…` |
| [provenance publiée Site 79](lot4a-evidence/baseline-integrated/provenance.json), [manifeste intégré](lot4a-evidence/integrated-051/source-manifest.json), [archive intégrée](lot4a-evidence/integrated-051/source-archive.json) | Référence 0.50 publiée et candidat 0.51 réuni |
| [validation intégrée](lot4a-evidence/integrated-051/validation/delta-tests-run.json), [contrôles intégrés](lot4a-evidence/integrated-051/validation/checks-run.json), [manifeste des cinq régressions](lot4a-evidence/integrated-051-regression-cases.json), [régressions intégrées](lot4a-evidence/integrated-051/regressions/regression-summary.json) | 3 566 tests, cinq contrôles et cinq cas de régression réussis sur le gel 0.51 |
| [contribution live intégrée](lot4a-evidence/integrated-051/feedback-live-contribution.json), [trace actuelle](lot4a-evidence/integrated-051/mind-live-01/mind-public-trace.json.gz), [journal actuel](lot4a-evidence/integrated-051/mind-live-01/mind-actual-public-journal.jsonl.gz), [parité source actuelle](lot4a-evidence/integrated-051/mind-live-01/mind-feedback-source-parity.json.gz) | Nouvelle session MIND, quatre retours discriminants, huit ablations et sept groupes de jointure |
| [navigateur intégré](lot4a-evidence/integrated-051/browser/browser-qa.json), [reprise du cumul MIND](lot4a-evidence/mind-integrated-051-resumption.json) | Blocage d’infrastructure conservé et intervalle cumulé sans remise à zéro |
| [déclaration de coût intégrée](lot4a-evidence/performance-integrated/declaration.json), [protocole intégré](lot4a-evidence/performance-integrated/protocol.md), [fenêtre officielle](lot4a-evidence/performance-integrated/window.json), [exécution coordonnée](lot4a-evidence/performance-integrated/coordinated-window-execution.json), [remplacement du protocole initial](lot4a-evidence/performance/superseded-before-measurement.json) | Mesure 0.50 → 0.51 terminée, isolation et intégrité attestées, dossier historique sans mesure conservé |
| [échec strict](lot4a-evidence/performance-integrated/aggregation-failure-reproduced.json), [analyse du travail hors durées](lot4a-evidence/planning/feedback-cost-work-delta.json), [déclaration de qualification](lot4a-evidence/performance-integrated/owner-addition-declaration.json), [protocole distinct](lot4a-evidence/performance-integrated/owner-addition-protocol.md) | Échec de consolidation conservé et qualification de l’ajout du propriétaire déclarée après mesure |
| [capture A](lot4a-evidence/performance-integrated/owner-graphs-A-01.receipt.json), [capture B](lot4a-evidence/performance-integrated/owner-graphs-B-01.receipt.json), [parties A](lot4a-evidence/performance-integrated/owner-graphs-A-01.json.gz.parts.json), [parties B](lot4a-evidence/performance-integrated/owner-graphs-B-01.json.gz.parts.json), [qualification Kernel](lot4a-evidence/performance-integrated/owner-addition-qualification.json) | Diagnostics structurels séparés des coûts et des tests ; chaînes et deltas du propriétaire vérifiés |
| [agrégat qualifié](lot4a-evidence/performance-integrated/owner-qualified-comparison.json), [revue indépendante](lot4a-evidence/performance-integrated/owner-qualified-cost-review.json), [décision globale](lot4a-evidence/performance-integrated/owner-qualified-global-budget-decision.json), [résultats complets](lot4a-evidence/performance-integrated/results-qualified.md) | Calcul et acceptation globale sous qualification explicite ; tous les résultats défavorables conservés |
| [entrées de publication qualifiées](lot4a-evidence/integrated-051/publication-inputs-owner-qualified.json) | Même gel et mêmes preuves exécutées, archives reconstituées à l’identique ; aucun déploiement attesté par ce reçu |

## Suite de la roadmap et publication

| Sous-lot | État et prochain travail |
| --- | --- |
| **4A — `observed_feedback_sequence`** | Candidat intégré 0.51 gelé : 3 566/3 566 tests, 5/5 contrôles et 5/5 régressions, avec 85/85 comparaisons. Nouvelle campagne MIND : trois niveaux, 31 actions, 20 préfixes et parité source 51/51 ; contribution locale vérifiée par les huit ablations. Coût global conforme pour 2/2 jeux sous qualification de l’ajout du propriétaire, échec strict et phase défavorable conservés. Intégrité des entrées vérifiée ; première publication Site 80 confirmée, blocage navigateur explicitement conservé. Les preuves du candidat isolé restent historiques. |
| **4B — `relative_arrangement`** | Planifié. Raccorder `v6.relative_arrangements.choose`, ses mesures, expériences sélectionnées, acquisition liée à l’observation initiale et restauration. Distinguer domaine non reconnu et arrangement reconnu sans expérience admissible : ce dernier clôt la chaîne de contraintes de fenêtre prévue par la source. Son contrat d’acquisition ne doit pas être remplacé par celui de Feedback. |
| **4C — `facet_example`** | Planifié. Raccorder `v6.facet_examples.choose`, les correspondances simples puis les branches composées selon la configuration originale. Préserver déplacement de face, extension de côtés, méthode portable et méthode composée locale, réfutations, changements hors région, absence d’effet et refus officiel malgré un rendu conforme. Distinguer connaissance acquise et caches recalculables. |

La [roadmap](v6-delivery-roadmap.md) conserve **4B comme prochain travail de ce fil après clôture de 4A**. L’ordre effectif est 3I → 4A → 7A ; 3I est publiée et intégrée. 4C peut être scindé en livraisons simple et composée avec des statuts propres ; aucun de ces sous-lots n’est déclaré transféré par 4A.

**Première publication 4A vérifiée dans Site 80.** Le [reçu d’hébergement](lot4a-evidence/integrated-051/publication-site80.json) confirme le déploiement `appgdep_6af37ad6579c8191a1a3b9559531deed`, de statut **`succeeded`**, à **20:13:29,074363 UTC le 10 novembre 2026**, sur [SRA Playground](https://sra-playground.yannick-fontan.chatgpt.site). Le commit source est **`a52ef3d8396eb051d6d42d3388072fe0bf2a2d9e`** ; l’archive enregistrée compte **29 706 240 octets**, SHA-256 **`6a81c5c07d33d053916d6e68532ce7226999969d0c68365808c3b1642355865f`**. L’accès privé du propriétaire reste inchangé.

Le premier envoi source, **130 Mio**, a été refusé par la limite serveur de **64 Mio par envoi**. Le [reçu de transport](lot4a-evidence/integrated-051/publication-source-transport.json) conserve cet échec et les cinq appels standard réussis qui ont transféré l’historique puis les preuves par étapes. Les commits originaux sont retenus ; l’arbre final est exactement celui du candidat complet avec son reçu d’incident. Aucun push forcé, retrait d’octets de preuve, changement natif ou déploiement intermédiaire n’a été effectué.

Cette publication initiale établit la livraison native **0.51.0**, gel **`c1e3dbdba85929dee4a287bc2f5cb6a011457ba43e9a67078f2764f659b603b7`**. La mise à jour documentaire qui ajoute ces reçus peut recevoir une version Site ultérieure, avec le même moteur validé. Les preuves historiques et intégrées restent attachées à leurs digests respectifs. Site 79 demeure la référence 3I/0.50 fraîche utilisée pour le coût ; le candidat 4A isolé provisoirement nommé 0.50 n’a pas été publié.
