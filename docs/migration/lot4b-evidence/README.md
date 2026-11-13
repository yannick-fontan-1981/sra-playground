# Preuves du lot 4B

Référence source : `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. La preuve de composant, le contrat synthétique de l'appelant, la campagne live, le rejeu enregistré et la mesure de coût ont des portées distinctes.

**Moteur livré : native 0.54.0, première publication Site 86**, gel `f25d56d1c63dc929b01bb31b3898b84cecc69e6e412d535c0d122170ea401ce9`, **286 fichiers natifs et 297 membres d'archive**. La référence effectivement publiée est **Site 85**, commit `a009e1f138bb18251d697f49647bacc615ee514f`, native 0.53.0, digest `d30dedc767c588b0fdf33ea398a4ad207b07b027e8b3642b3b262c625c52387f`. Les preuves fonctionnelles, l'intégrité finale et le contrôle des entrées de publication passent. **Le coût global est accepté sur 2/2 jeux sous la qualification structurelle déclarée avant mesure : STCK −1,812977 %, SMLP +2,735461 %. La première publication 4B est vérifiée dans Site 86, commit `082ce553ce4dfbac37071a64497bcca129b7ced0`, statut `succeeded`.** 4C demeure non implémenté.

## Développement conservé

| Entrée | Résultat et portée |
| --- | --- |
| `planning/validation-plan.json` | Plan initial, base publiée Site 81, finalisation conditionnée aux prédécesseurs effectivement publiés. |
| `development/relative-oracle-01*` | Échec de syntaxe du générateur avant import, conservé. |
| `development/relative-oracle-02*` | Génération depuis Python original ; 16 initiales, 28 cas planner, cinq sessions, neuf variantes de record. |
| `development/relative-reference-test-01*` | 81 tests différentiels réussis, aucun échec/skip/TODO. |
| `development/relative-reference-source-integrity.json` | 1 786 fichiers originaux exacts avant/après ; caches préexistants identifiés séparément. |
| `development/integration-attempt1*`, `2*`, `3*` | 8 + 2 + 2 tests communs réussis : acquisition, mémoire, gardes, décisions, refus et deux chemins de priorité. Ce ne sont pas trois suites globales. |
| `development/typecheck-01.log` | Typage de développement réussi ; ne remplace pas le contrôle du gel final. |
| `development/merged-site82/` | Gel `31850e3a…`, également inchangé après Site 83 : 28 tests de coexistence et typage réussis. |
| `development/priority-regression-01/` | Quatre contrats hérités ciblés, 120/120 tests réussis sur le gel intermédiaire ; sources et tests inchangés pendant la vérification. |
| `development/lkey-partial-site83/attempt-01/`, `attempt-02/` | Deux refus de préflight du nouveau lecteur, avant import/campagne ; formes de commande source/publique corrigées, octets et journaux conservés. |
| `development/lkey-partial-site83/attempt-03/` | Trajet enregistré de 25 actions, 26 paquets, deux niveaux et arrêt connu ; qualification reste `failed`, 149/150 contrôles, à cause du lecteur de frontières. |
| `development/lkey-partial-site83/attempt-03-postrun-review.json` | Lecture indépendante des données : 14 comparaisons concordantes, sans requalification de l'essai 03. Le résultat final distinct du lecteur corrigé figure dans `integrated-final/lkey-partial/`. |
| `development/freeze-01/` | Gel `852d5ff7…`, 276 fichiers natifs, archive de 287 fichiers ; identifiant de version hérité à distinguer du Site 81 publié. |
| `development/tria-live-01/` | Une session froide, trois niveaux, 17 actions et 17 préfixes par RelativeArrangements. |
| `baseline-site81/` et `development/tria-baseline-site81/` | Source publiée 0.51 vérifiée, essai borné à huit actions, zéro niveau ; borne atteinte, aucun verdict général d'impossibilité. |
| `tria-case-selection.json`, `tria-*-phase.json`, `tria-case-resolution.json` | Une horloge de cas, 374,140910 secondes cumulées à sa première clôture ; aucun reset. |
| `development/tria-live-01/tria-relative-arrangement-source-parity-01*` | Premier échec de comparaison sur l'annotation de caller `composition_target_tree`, conservé. |
| `development/tria-live-01/tria-relative-arrangement-source-parity-02*` | 68 appels, 34 gardes, 17 états et 17 restaurations exacts ; 51 ablations conservées, une décision distincte modifiée par deux interventions. |

Les fichiers `*.json.gz.parts.json` décrivent les fragments binaires de l'original inchangé. Après récupération du dépôt, reconstruire seulement les preuves nécessaires avec `python -B scripts/evidence-byte-parts.py restore DIRECTORY`. Les archives de source ont leur propre manifeste et la commande `python -B scripts/freeze-v53-native-source.py restore DIRECTORY`. Aucun jeu, oracle ou calcul de coût n'est relancé pour restaurer ces octets.

## Gel final et validation formelle

| Entrée | Résultat et portée |
| --- | --- |
| [Publication précédente vérifiée](planning/published-predecessor85.json), `integrated-baseline/` | Site 85 / 0.53, commit `a009e1f…`, digest `d30dedc7…` ; référence finale réellement publiée. |
| [Manifeste natif](integrated-final/source-manifest.json), [archive](integrated-final/source-archive.json) et [parties](integrated-final/source-archive-parts.json) | Candidat 0.54 `f25d56d1…`, 286 fichiers natifs, archive de 297 fichiers. |
| [Premier résultat formel](integrated-final/validation/delta-tests-run.json) | **Échec conservé : 4 047/4 048 tests, 108 fichiers.** Une attente exhaustive d'enregistrement omettait `relative_arrangement`. |
| [Correction](integrated-final/test-expectation-correction/correction.json), [diff](integrated-final/test-expectation-correction/coupled-pair-registration.diff) et [revue](integrated-final/test-expectation-correction/correction-source-review.json) | Une insertion de 24 octets dans l'attente du test ; autres assertions et 16 enregistrements du même propriétaire de rappel partagé conservés. Aucun changement natif, même périmètre de 108 fichiers. |
| [Relance formelle complète](integrated-final/test-expectation-correction/validation/delta-tests-run.json) | **4 048/4 048 réussites**, zéro échec, annulation, test ignoré ou TODO ; sources et entrées de la relance inchangées. Périmètre explicite de contrats et d'intégration, pas toute la suite historique du dépôt. |
| [Contrôles du projet](integrated-final/validation/checks-run.json) et [copie identique](integrated-final/test-expectation-correction/validation/checks-run.json) | **5/5** : typage, audit des entrées, audit de migration, contrôle du diff, build. La copie conserve les octets et sorties d'origine ; elle ne signifie pas une nouvelle exécution. |
| [Intégrité finale](integrated-final/delivery-integrity.json) | **Passed** : 286 natifs, 297 membres d'archive, 657 entrées source/tests, 351 entrées de build, 1 786 originaux. Transport de neuf rapports : 60 210 836 octets en 72 parties. |

## Rejeux enregistrés du candidat final

Le [résumé terminal des régressions](integrated-final/regressions/regression-summary.json) passe **8/8 trajectoires et 136/136 comparaisons** : CATR, RSWP, FOGW, VOIS, CONN, MIND, WEAV et TRIA. Totaux : **309 actions, 317 paquets publics complets, 1 487 images d'animation, 227 préfixes, 536 requêtes et 24 frontières naturelles**. Chaque commande est recalculée avant transmission de son retour public archivé. Les sources et entrées d'exécution restent inchangées. Les temps et l'égalité intégrale des états de fournisseurs ou des chaînes du graphe ne sont pas des objets de cette comparaison. **Ces rejeux ne sont pas de nouvelles réussites live ni des mesures de vitesse.**

La [parité froide finale RelativeArrangements](integrated-final/tria-relative-arrangement-source-parity.json.gz) porte sur le gel `f25d56d1…` et concorde sur **68/68 appels, 34 gardes, 17 acquisitions sélectionnées, 17 restaurations, 18 observations et 35 comparaisons publiques**, avec zéro différence. Les **51 ablations** restent conservées : deux interventions de la catégorie action/refus au seul appel 44, quatre changements de métadonnées et 45 résultats identiques. `failed` est vide dans le trajet live. Les états natifs ne servent pas d'amorce à l'oracle. Cette parité de famille ne clôt pas celle du caller Python entier.

La [qualification LKEY finale](integrated-final/lkey-partial/qualification.json) est séparée : **157/157 contrôles**, statut `partial_trajectory_preserved`, 25 commandes calculées avant retour, 26 paquets, 25 préfixes, 51 requêtes et deux frontières. **Le rapport brut reste `failed`, avec deux niveaux terminés puis `frontier_unknown` au troisième** ; la cible de trois niveaux n'est pas atteinte. Les 49 appels Workshop, dont 25 acquisitions — 14 sélectionnées et 11 passives — sont conservés dans la portée déclarée. Les commandes et paquets publics ne sont pas normalisés. Les trois qualifications de développement échouées ne sont pas reclassées en succès par cette exécution finale distincte. Aucune nouvelle tentative live de WEAV ou LKEY n'est déduite de ces rejeux.

## QA navigateur et cumul TRIA

| Entrée | Résultat et portée |
| --- | --- |
| [QA finale](integrated-final/browser/browser-qa.json) | **Passed** sur le candidat 0.54 gelé, dans le navigateur géré : départ à froid au niveau 1, trois niveaux TRIA en 17 actions et 17 plans, frontières aux actions 2, 13 et 17. Pause puis une action supplémentaire réellement observées. |
| [États observés](integrated-final/browser/observed-states.json) | Transcription structurée des sorties AX réellement observées ; **aucune capture d'écran**. Pas d'injection d'état appris, saut de niveau ou action manuelle sur le plateau. Réinitialisation initiale du noyau et attente de texte expirée à la première vraie frontière conservées. Aucune mesure de latence ou garantie d'interruption immédiate. |
| [Continuation d'horloge](integrated-final/browser/browser-qa-continuation.json) | Intervalle complet de 389,595754 secondes, ajouté à la résolution initiale conservée de 374,140910 secondes : **763,736664 secondes cumulées sur 2 400**, sans reset. |
| [Liaison QA](integrated-final/browser/browser-qa-test-correction-binding.json) et [liaison de continuation](integrated-final/browser/browser-qa-continuation-test-correction-binding.json) | Même observation, mêmes dates et même cumul, liés au reçu de build recopié à l'identique dans le dossier de correction des tests. Aucun second parcours navigateur. |
| `integrated-final/browser/preview-start*`, [arrêt](integrated-final/browser/preview-stopped.json) | Prévisualisation du serveur de développement géré sur le gel ; build de production vérifié séparément. La QA n'est pas une vérification d'un Site 4B déjà publié. |

## Coût final qualifié et reçus conservés

La fenêtre **A1/B1/B2/A2**, du **10 novembre 2026 à 22:38:57.430443 à 22:47:33.071790 UTC**, est terminée avec intégrité `passed`. Elle remesure la référence Site 85 / 0.53 contre le candidat 0.54 : **32 sessions et 400 actions**, soit huit sessions par jeu/version ; seules les huit chauffes annoncées, 24 actions, sont exclues. Aucune session mesurée ni valeur extrême n'est retirée et aucune durée historique ne fournit un échantillon.

La revue indépendante passe **3 960/3 960 contrôles**, avec **2/2 jeux acceptés** sous le statut `accepted_under_predeclared_owner_cost_rule` : **STCK −1,812977 %**, **SMLP +2,735461 %**. Chaque médiane groupée de session complète reste strictement sous +10 %. Les phases ne sont pas additionnées, les ratios de cohortes ne sont pas moyennés et un jeu ne compense pas un autre. Les [médianes exactes du JSON](performance-integrated/owner-growth-review.json) sont reprises dans le [rapport de lot](../lot4b-relative-arrangements.md).

Les diagnostics agrégés restent **14/16**, avec **garde de préfixe connu SMLP +12,069030 %** et **restauration SMLP +29,830670 %**. Les deux cohortes gardent chacune **15/16 diagnostics**. Les hausses de p95 agrégés supérieures à +10 % restent conservées : **service de préfixe connu STCK +32,773109 %**, **requête de préfixe connu STCK +26,838601 %**, **garde SMLP +23,351327 %** et **acquisition/persistance SMLP +12,278213 %**. Tous les autres résultats favorables ou défavorables figurent dans le rapport complet ; ces observations ne garantissent ni stabilité sur plusieurs heures ni interruption immédiate.

| Reçu ou ensemble | Résultat et portée |
| --- | --- |
| [Protocole](performance-integrated/protocol.md), [déclaration](performance-integrated/declaration.json), [politique globale](performance-integrated/global-budget-policy.json), [contrat lisible](owner-cost-contract.md) et [contrat gelé](performance-integrated/owner-growth-contract.json) | Règles, sources et qualification fixées avant mesure. Plafond global strictement inférieur à +10 % par jeu ; règle historique des phases conservée séparément. |
| [Fixture fonctionnelle](performance-integrated/owner-structural-fixture.json), [attribution](performance-integrated/owner-structural-attribution.json), [capture A](performance-integrated/owner-graphs-baseline.receipt.json) et [capture B](performance-integrated/owner-graphs-candidate.receipt.json) | Qualification structurelle **64/64 avant mesure**. Attribution du nouveau propriétaire ; aucune preuve rétroactive des feuilles privées non capturées des 400 actions mesurées. |
| [Readiness](performance-integrated/readiness.json) et [fenêtre](performance-integrated/window.json) | Prérequis liés, quatre séries terminales passées, intégrité passée, effectifs et ordre conservés. |
| [A1](performance-integrated/cohort1/baseline.json), [B1](performance-integrated/cohort1/after.json), [B2](performance-integrated/cohort2/after.json), [A2](performance-integrated/cohort2/baseline.json) | Quatre rapports bruts complets ; toutes les sessions mesurées, observations de phases, Pause et mémoire sont conservées. |
| [Cohorte 1](performance-integrated/cohort1/comparison.json), [cohorte 2](performance-integrated/cohort2/comparison.json) | **15/16 chacune** ; restauration SMLP +42,231325 % dans la première, garde de préfixe connu SMLP +14,624866 % dans la seconde. |
| [Échec de l'agrégation stricte](performance-integrated/aggregation-failure.json) et [journal](performance-integrated/aggregation-failure.log) | Échec réel, code 1, conservé. Le contrat d'égalité intégrale des métadonnées de travail refuse le nouveau propriétaire ; aucune requalification de cet agrégateur. |
| [Consolidation complémentaire](performance-integrated/owner-growth-comparison.json) | **432 différences structurelles** sur les quatre chemins déclarés, conformes aux formes préalables. Autres métadonnées comparées exactement ; diagnostics groupés **14/16**, statut `budget_review_required`. |
| [Revue indépendante](performance-integrated/owner-growth-review.json) | **3 960/3 960 contrôles**, calcul depuis les bruts, **2/2 jeux acceptés**. Les outils déclarés, formules, seuils, populations et durées restent inchangés ; tout le coût du propriétaire est inclus. |
| [Résultats complets](performance-integrated/results.md), [reçu de rendu](performance-integrated/results-render.json), [transport des journaux](performance-integrated/log-transport.json) | Rapport immuable, médianes, p95, dispersions, inspections, Pause et mémoire ; copies compressées liées aux octets originaux. |

### Incidents de préparation et d'isolation

Le [premier préflight statique](performance-integrated/static-preflight-attempt1.json) reste en échec sur deux liens de dépendances absents dans la référence. Après création des seuls liens `node_modules` et `public/vendor/pyodide` vers les dépendances du candidat, le même outil inchangé passe **65/65 contrôles** : [préflight final](performance-integrated/static-preflight.json), [recontrôle](performance-integrated/static-preflight-recheck.json). Aucun coût, règle ou source n'est modifié par cette préparation.

La [première assertion de clôture d'isolation](performance-integrated/isolation-completion-attempt1.json) reste en échec : elle exigeait une identité des octets du statut 7B, alors que seules les notes `own_agents` et `preparation` avaient changé. L'engagement de silence et d'absence de charge lourde restait inchangé. Le [reçu de clôture distinct](performance-integrated/coordinated-isolation-completion.json) conserve ces changements précis, l'erreur initiale, la terminaison avec code 0 de la fenêtre sous verrou et sa libération. Aucun essai n'est supprimé ou répété et aucun outil ou règle de coût n'est changé.

## Publication seule encore attendue

Le [contrôle des entrées de publication](integrated-final/publication-inputs.json) passe avec le statut `integrity_verified_with_predeclared_owner_cost` : **286 fichiers natifs, 297 membres d'archive, 657 entrées source/tests, 351 entrées de build et dix entrées d'exécution des régressions**. Il relie les preuves fonctionnelles, leurs transports et le coût qualifié, en conservant `historicalStrictPassed: false` et `workMetadataExactAcrossVersions: false`. Il n'exécute ni moteur, ni jeu, ni nouvelle mesure.

**La première publication 4B est vérifiée dans Site 86**, moteur **0.54.0**, commit `082ce553ce4dfbac37071a64497bcca129b7ced0`, statut `succeeded` à **22:59:03 UTC**, accès privé du propriétaire conservé. Le [reçu Sites](integrated-final/publication-site86.json) est distinct du contrôle préalable ; il lie la version et le commit réellement publiés au déploiement terminal. Le verdict de coût reste celui du gel vérifié. Les réserves héritées de contribution, de parité de l'appelant complet, d'accumulation et de migration globale ne sont pas fermées par le coût ; LKEY reste partiel et 4C non implémenté.

Le [rapport de lot](../lot4b-relative-arrangements.md) donne l'interprétation humaine, la [filiation](../lot4b-relative-arrangements-lineage.md) les contrats, et la [feuille de route](../v6-delivery-roadmap.md) les statuts de livraison.

## Transport Git des preuves

La [déclaration des fragments binaires](planning/binary-transport-attributes.json) conserve le premier avertissement de `git diff --cached --check` sur un fragment gzip intérieur, puis le résultat réussi avec l’attribut Git `binary` des fichiers `.partNNN`. Les **1 149 identifiants d’objets de fragments présents dans l’index sont identiques** avant/après. Aucun octet de preuve, source native, entrée de build, outil ou résultat de coût n’est modifié.

## Publication et historique conservé

| Entrée | Résultat |
| --- | --- |
| [Publication Site 86](integrated-final/publication-site86.json) et [observations API](integrated-final/publication-site86-api.json) | Source et déploiement relus indépendamment : première publication native 0.54, `succeeded`, accès propriétaire inchangé. |
| [Transport source](integrated-final/publication-source-transport.json) | Cinq envois ordinaires, zéro envoi forcé et aucun Site intermédiaire. Le commit original `9bcee745…` est conservé comme parent direct du commit publié, avec le même arbre. |
| [Plan](integrated-final/transport/source-push-plan.json) et cinq reçus `step-01-execution.json` à `step-05-execution.json` | Tous les envois source et empaquetages du helper standard ont réussi ; les limites de taille sont vérifiées sur les objets réellement atteignables. |
| [Archives de déploiement](integrated-final/transport/archive-member-verification.json) | 75 contenus de fichiers identiques dans les cinq archives ; worker compilé identique au build validé. Empreintes des conteneurs conservées séparément. |

La clôture documentaire qui intègre ces reçus garde les sources natives, tests, entrées de build et résultats de mesure identiques. Elle ne constitue pas une nouvelle exécution de ces preuves.
