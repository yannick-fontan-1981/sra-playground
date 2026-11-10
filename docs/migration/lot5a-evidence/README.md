# Preuves du lot 5A

## Statut de l'index

**Index de native 0.53.0, prêt pour publication : validations fonctionnelles et intégrité passées, budget global qualifié accepté sur deux jeux.** Les pièces ci-dessous sont présentes dans le dépôt. Le manifeste natif porte sur 283 fichiers, digest `d30dedc767c588b0fdf33ea398a4ad207b07b027e8b3642b3b262c625c52387f` ; l'archive en conserve 294. Les reçus de développement, la preuve commune finale, la reprise de la suite large, les régressions et les coûts gardent leurs portées distinctes.

Le propriétaire temporel passe **51/51**, avec typecheck transitif réussi. La preuve commune finale passe **16/16** sur deux branches : douze retours, dix propres et deux passifs, dont quatre touches dans deux préfixes de deux actions. La première suite large conserve **3 834/3 835** ; son attente de compteur a été corrigée dans le seul test et la reprise officielle passe **3 835/3 835 dans 102 fichiers**. Les cinq contrôles de cette reprise passent, audit `failures: []`. Les **sept régressions sur sept** sont terminées à **119/119 contrôles**, sur **292 actions et 210 préfixes**, dont les 81 actions enregistrées de WEAV. L'attribution structurelle passe **64/64**, le préflight **65/65** et la readiness est réussie. Le budget qualifié est **accepté 2/2**, avec une revue indépendante **4 669/4 669** : **+9,62 % STCK** et **+4,66 % SMLP**. Le temps global augmente dans les deux jeux. La qualification structurelle prémesure, la correction de garde de dossier après mesure et les rejets conservés sont détaillés ci-dessous. 5A n'est pas encore publié ; le navigateur reste indisponible après deux timeouts CDP.

Le suivi live WEAV distinct s'est arrêté à **105 actions, trois niveaux résolus, niveau 4 courant et 2 401,227841 secondes cumulées** ; l'objectif de six niveaux n'est pas établi. Le rejeu enregistré de ses 81 actions historiques ne réinitialise pas cette horloge et n'est pas un nouveau live.

Le [rapport utilisateur](../lot5a-linked-temporal-preparation.md) décrit le périmètre, le travail par delta, les chemins, les limites et la suite. La [filiation](../lot5a-linked-temporal-lineage.md) identifie la fermeture source réellement consommée. Les entrées 5B et 5C ne sont pas clôturées par ces preuves.

## 1. Source et propriétaire temporel

| Pièce | Contenu | Statut et portée |
| --- | --- | --- |
| [source-oracle-export.json](diagnostic/source-oracle-export.json) | Export indépendant des originaux au commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, empreintes des modules, inventaires avant/après et comptes des cas. | Export terminé ; 1 786 fichiers inchangés. |
| [Exporteur Python](../../../scripts/export-v6-linked-preparation-reference.py) | Importe les quatre modules originaux, prépare les observations publiques synthétiques et conserve sorties, états et exceptions. | Aucune sortie TypeScript ne produit les attentes. |
| [Oracle compressé](../../../tests/fixtures/v6-linked-preparation-reference.json.gz) | 14 helpers, neuf chaînes froides / 165 opérations, treize composants directs, deux exceptions explicites. | SHA-256 `280397c931e2ba7bff5aa99931b64b938d18e5224e66e9da397407c0e3018299`, 719 074 octets selon le reçu. |
| [linked-temporal-development.json](diagnostic/linked-temporal-development.json) | API et portée, schéma natif, bornes, qualification AFTER et historique des validations. | 49/49 antérieur conservé ; 51/51 est le dernier passage ciblé réel. |
| [Validation ciblée postrevue](diagnostic/linked-temporal-20261110T203811Z-validation.json) et [TAP](diagnostic/linked-temporal-20261110T203811Z-tests.tap) | 51 tests, typecheck transitif de sortie 0 et empreintes des sept entrées directes identiques avant/après. | Résultat de développement avant la fusion ; aucun correctif de code pour obtenir le passage. |
| [Tests de conformité](../../../tests/v6-linked-temporal-reference.test.ts) | Résultats et projections complètes ; propriétaire continu et propriétaire restauré après chaque opération ; composants directs séparés. | Définition des tests, distincte d'un reçu final d'exécution. |
| [Tests natifs](../../../tests/v6-linked-temporal-preparation.test.ts) | Gardes, propriété des rasters, restauration atomique, frontières, géométrie, préservation et coupures de calcul. | Les deux cas supplémentaires sont compris dans le passage réel 51/51. |

Les attentes couvrent le modèle et l'effet distant acquis, un nouvel endpoint soutenu et deux frontières scorées avec connaissance portable. Les propositions autonomes de `PhaseRelations` et `PhaseTransfer` restent hors du chemin consommé. L'exception Python qui laisse une mutation partielle sur AFTER sans `entities` est conservée ; le natif rejette cette entrée hors contrat avant mutation. Cette qualification n'est pas normalisée en réussite.

## 2. Travail incrémental, persistance et continuité

| Pièce | Dernier résultat présent | Portée |
| --- | --- | --- |
| [performance-targeted-tests.tap](diagnostic/performance-targeted-tests.tap) | 125/125 | Transactions Kernel, checkpoints natifs, CrossedPrefix, conclusion de coût nul et bornes. Résultat fonctionnel, sans conclusion de gain de temps. |
| [frontier-snapshot-targeted-tests-initial.tap](diagnostic/frontier-snapshot-targeted-tests-initial.tap) | 43/43 | Frontier natif immuable, séquences source, snapshots, deltas et refus de données altérées. |
| [frontier-delta-review.json](diagnostic/frontier-delta-review.json) | Revue textuelle avec empreintes et limites déclarées. | Mode natif explicite, partage de branches, vérification de restauration, données retenues, compteurs du runtime ; ni exécution supplémentaire ni certification indépendante exhaustive. |
| [runtime-store-targeted-tests.tap](diagnostic/runtime-store-targeted-tests.tap) | 21/21 | Magasin, runtime, service et rejeux déjà exécutés sur l'état antérieur concerné. |
| [mixed-path-targeted-tests.tap](diagnostic/mixed-path-targeted-tests.tap) | 6/6 | Touche/clic/touche par le contrôleur, service et runtime réels avec famille synthétique déclarée ; Pause, ticket, point courant, gardes et frontière. |
| [mixed-path-test-development.json](diagnostic/mixed-path-test-development.json) | Échec initial 5/6, correction de l'attente du test, puis 6/6 dans le reçu précédent. | La forme des commandes clavier attendues a été corrigée dans le test ; aucune règle de production n'a été modifiée pour cet échec. |
| [blocking-and-registration-tests.json](diagnostic/blocking-and-registration-tests.json) et [TAP](diagnostic/blocking-and-registration-tests.tap) | 9/9 | Refus courant bloquant, drapeaux non bloquants, rejets des témoins périmés ou autoritaires, priorité des entrées et enregistrement. Adaptateur ciblé, avant fusion. |

Ces ensembles se recouvrent et ne sont pas additionnés. Ils précèdent le gel final intégré. Le partage immuable de Frontier conserve les faits historiques ; les copies de maps, recherches et rejeux peuvent encore croître avec l'historique. Le test mixte ne crée pas de politique WEAV à plusieurs actions et ne remplace pas la preuve du caller complet. La décision rapide de CrossedPrefix porte sur l'optimum d'une affectation d'apparences de coût nul, sans certifier un prochain coup physique obligatoire.

## 3. Gel et preuve commune finale

| Pièce | Résultat ou identité | Portée |
| --- | --- | --- |
| [source-manifest.json](final/source-manifest.json) | 283 fichiers natifs, digest `d30dedc767c588b0fdf33ea398a4ad207b07b027e8b3642b3b262c625c52387f`. | Identité de la source native 0.53 du candidat. |
| [source-archive.json](final/source-archive.json) et [parties de l'archive](final/source-archive-parts.json) | 294 fichiers ; SHA-256 de l'archive `e0467979b2189935dbc649428810daf8c198a4ff95f52acfa45344812fa3bda2`. | Sources et entrées de reproduction figées ; aucune connaissance apprise injectée. |
| [transfer-map-application.json](diagnostic/transfer-map-application.json) | Quatre sources ajoutées : deux `component_verified`, deux `partial_transfer`. | Application initiale après intégration du commit de préparation 7A ; sa filiation publiée est réconciliée dans le reçu ci-dessous. |
| [published-predecessor-reconciliation.json](final/published-predecessor-reconciliation.json) | Site 82 `0ca36b0a6a358e1e89420753bbcec4a33f028e0a`, puis Site 83 `bed48116585da864dd5c412ed11dd6990a950e8e`, tous deux fusionnés. | Site 83 clôt la documentation du même code 0.52 ; aucun fichier d'entrée d'exécution contrôlé ne change de 82 à 83. Référence officielle de coût : Site 82 / native 0.52.0 ; candidat 0.53 inchangé. |
| [Revue des essais de preuve préintégration](diagnostic/common-loop-before-integration/attempt-review.json) | Deux échecs d'attentes du harnais, puis diagnostic passé. | Sources, scripts et échecs historiques conservés ; ne remplace pas le résultat final ci-dessous. |
| [linked-temporal-common-loop.json.gz](final/linked-temporal-common-loop.json.gz) et [reçu d'exécution](final/linked-temporal-common-loop-execution.json) | **16/16**, source et entrées du script inchangées. Deux branches / douze retours / dix acquisitions propres / deux passives / deux préfixes finaux de deux touches. | Caller froid avec priorités réelles, WHY/ACT, garde intermédiaire, acquisition unique et restauration du Kernel. Retours publics synthétiques ; pas de navigateur ni de campagne. |

Après le contact, la branche avec effet conserve une proposition propre `ACTION2`, sélectionnée par le caller ; la branche sans effet n'a plus de proposition propre et le caller choisit `observed_frontier` / `ACTION1`. Ces décisions suivantes sont proposées ; elles ne sont pas ajoutées aux douze retours exécutés. L'ordre déclaré des familles n'a pas été modifié pour produire cette contribution.

## 4. Validation large, régressions et navigateur

| Pièce | État présent | Qualification |
| --- | --- | --- |
| [Premier passage large](final/validation/delta-tests-run.json) et [sortie](final/validation/delta-tests-output.log.gz) | **Échec conservé : 3 834/3 835**, 102 fichiers de tests. | L'unique échec attendait 56 entrées et huit entrées `surface` au lieu de 57 et neuf. |
| [validation-correction.json](diagnostic/validation-correction.json) | Correction du seul test de compteurs ; code natif inchangé. | Conserve aussi l'audit initial avec fixture Feedback absent ; le gzip a été reconstruit depuis ses deux parties sous son empreinte originale. |
| [Archive de la reprise](final/test-expectation-correction/source-archive.json) | Même digest natif et même archive de 294 fichiers. | La correction d'attente ne modifie pas l'implémentation native gelée. |
| [Suite officielle reprise](final/test-expectation-correction/validation/delta-tests-run.json) et [sortie](final/test-expectation-correction/validation/delta-tests-output.log.gz) | **3 835/3 835 dans 102 fichiers**, aucun échec ni test ignoré. | Suite explicite du périmètre affecté ; source et entrées de tests inchangées pendant l'exécution, historique initial conservé. |
| [Contrôles de reprise](final/test-expectation-correction/validation/checks-run.json) | Cinq contrôles réussis : typage, audit des entrées, audit de migration, diff, build. | Digest natif inchangé ; ces contrôles restent distincts du résultat de la suite de tests. |
| [Audit des entrées](final/test-expectation-correction/validation/entry-audit-output.log.gz) | 57/76 raccordées, groupe `surface` 9/10, `fullV6Parity: false`. | Registre : aucune entrée partielle, dix-neuf en attente ; ce n'est pas le comptage des modules Python. |
| [Audit de migration](final/test-expectation-correction/validation/migration-audit-output.log.gz) | 174 composants vérifiés, 145 transferts partiels, 1 050 modules en attente, aucun module `verified`, `failures: []`. | Les six critères de clôture globale restent faux. |
| [Préflight des rejeux](final/preflight.json) et [cas déclarés](recorded-regression-cases-integrated.json) | Sept cas prévalidés. | Le préflight n'exécute aucun rejeu et ne vaut pas verdict de réussite. |
| [CATR](final/regressions/catr-052-comparison.json), [RSWP](final/regressions/rswp-052-comparison.json), [FOGW](final/regressions/fogw-052-comparison.json), [VOIS](final/regressions/vois-052-comparison.json), [CONN](final/regressions/conn-052-comparison.json), [MIND](final/regressions/mind-052-comparison.json), [WEAV](final/regressions/weav-052-comparison.json) | Sept comparaisons réussies, dix-sept contrôles chacune : **119/119**. | Commandes calculées avant fourniture des retours archivés ; champs comparés explicitement bornés, aucune nouvelle victoire live. |
| [regression-summary.json](final/regressions/regression-summary.json) et [functional-block-review.json](final/functional-block-review.json) | **7/7**, 292 actions, 299 paquets publics complets, 1 405 frames, 210 préfixes, 502 requêtes et 21 frontières naturelles. | Source et entrées d'exécution inchangées ; preuve commune et régressions enregistrées, aucune comparaison de vitesse ni parité globale de V6. |
| [regression-evidence-parts.json](final/regression-evidence-parts.json) | Sept rapports complets conservés en **61 parties vérifiées**. | Transport exact des octets, aucun résultat régénéré ou réinterprété. |
| [delivery-integrity.json](final/delivery-integrity.json) | Réussie : **283 fichiers natifs, 294 archivés, 647 entrées source/tests, 348 entrées build et 1 786 originaux inchangés**. | Identité des fichiers, reçus et reconstruction sans perte ; aucune nouvelle campagne. |
| [evidence-byte-transport.json](final/evidence-byte-transport.json) | **Neuf grands gzip en 75 parties** : les sept régressions et les deux captures structurelles. | Transport exact ; le reçu initial des sept régressions reste conservé. |
| [publication-inputs.json](final/publication-inputs.json) | Entrées de publication vérifiées, worker compilé et inventaires inchangés. | Aucune réexécution de test, build, jeu ou mesure ; la publication Sites elle-même reste à effectuer. |
| [Exécution du rejeu WEAV](final/regressions/weav-052-execution.json) | Réussie, **81 actions / 81 préfixes**, trois niveaux historiques. | Rejeu enregistré terminé ; aucune extrapolation à six niveaux ni reprise du suivi live. |
| [browser-qa.json](final/browser/browser-qa.json) | `unavailable_browser_control`, deux timeouts CDP avant navigation. | Preview démarrée ; aucun jeu UI lancé, aucune observation rendue de native 0.53 ni réussite Pause/reprise annoncée. |

Le résultat final de la suite large reprise se trouve dans `final/test-expectation-correction/validation/`. L'échec initial reste archivé à sa place et n'est pas renommé en réussite. Les deux timeouts de rattachement à l'onglet ne sont pas remplacés par les tests synthétiques du contrôleur. La [réconciliation publiée](final/published-predecessor-reconciliation.json) fixe la référence de coût à Site 82 / native 0.52.0, digest `f5f4a67d68f867d3a37ef66fd7c07b9e75b9d201daceb732038f8fa71caa59eb`. Les pièces de qualification et de lancement de cette mesure figurent ci-dessous ; elles ne valent pas résultat de budget.

## 5. Suivi live WEAV et horloge conservée

| Pièce | Rôle |
| --- | --- |
| [followup-clock.json](weav/followup-clock.json) | Prolonge les 1 277,782615 secondes historiques ; budget total de 2 400 secondes, cible de six niveaux et interdiction de nouveau live après la limite. |
| [declaration.json](weav/native050-delta-diagnostic/declaration.json) | Base native 0.50 / Site 79, quatre fichiers du patch diagnostique, plafond par niveau inchangé, digest et réserves de concurrence. |
| [source-manifest.json](weav/native050-delta-diagnostic/source-manifest.json) | Identité des fichiers du diagnostic isolé. Distinct du gel intégré native 0.53. |
| [driver-started.json](weav/native050-delta-diagnostic/driver-started.json) | Commande déclarée, démarrage et limite horaire. |
| [driver-execution.json](weav/native050-delta-diagnostic/driver-execution.json) | Arrêt du processus sur la limite du cas et qualification de travail fonctionnel concurrent. |
| [heartbeat.json](weav/native050-delta-diagnostic/heartbeat.json) | Dernier état de suivi conservé pendant l'exécution. |
| [Journal public partiel](weav/native050-delta-diagnostic/partial-public-journal.jsonl.gz) | Retours publics disponibles avant l'interruption. |
| [Sortie partielle](weav/native050-delta-diagnostic/partial-live-output.log.gz) | Journal de sortie de l'invocation interrompue. |
| [result.json](weav/native050-delta-diagnostic/result.json) | Verdict `case_budget_exhausted`, 105 actions / trois niveaux / niveau 4, horloge cumulée 2 401,227841 secondes et budget restant nul. |

Le résultat ne prouve pas un nouvel échec au niveau 6 : ce niveau n'est pas atteint dans le dernier retour conservé. Le budget externe cumulé a terminé le suivi. Le diagnostic porte sur un patch antérieur isolé, avec concurrence fonctionnelle déclarée ; il ne mesure pas le coût officiel du candidat final. Aucun nouveau live WEAV n'est annoncé par cet index.

## 6. Qualification et résultats de coût

| Pièce | Résultat ou état | Limite conservée |
| --- | --- | --- |
| [Attribution initiale](performance/owner-structural-attribution.json) | Échec d'une comparaison d'origine à `STCK / measured / 7`. | La création anticipée d'un fragment partagé demandait une qualification ; le résultat initial n'est pas remplacé. |
| [Revue indépendante des fragments partagés](performance/diagnostic/shared-fragment-independent-review.json) | Attribution v2 **64/64**, **14 créations appariées**, **70 deltas du candidat**, **58 points capturés** ; revue indépendante passée avant mesure. | Qualification fermée aux quatorze fragments et à leurs consommateurs observés. Aucune normalisation générale des origines ni conclusion de vitesse. |
| [owner-growth-contract.json](performance/owner-growth-contract.json) | Contrat final liant les captures, l'attribution v2 et son supplément préalable. | Les quatre chemins de compteurs autorisés et les analyseurs déclarés restent inchangés. |
| [Préflight initial](performance/diagnostic/static-preflight-initial-failure.json) et [réparation de dépendance](performance/dependency-preparation-repair.json) | Dépendance Pyodide absente dans la référence, puis lien vers les assets identiques déjà présents côté candidat. | Sources natives inchangées ; aucune interprétation ou exécution des assets lors de la réparation. |
| [static-preflight.json](performance/static-preflight.json) | **65/65**, aucune condition insatisfaite. | Contrôle préparatoire réussi, distinct du budget mesuré. |
| [readiness-initial-failure.json](diagnostic/readiness-initial-failure.json) et [lecteur initial](diagnostic/finalize-cost-readiness-initial.py) | Échec du lecteur avant toute écriture ; résumé de source comparé à un manifeste complet. | Traceback conservé, heure de fin inconnue laissée à `null`. Correction de lecture de métadonnées seulement ; aucun défaut du moteur ni modification de preuve. |
| [readiness-execution.json](performance/readiness-execution.json) et [readiness.json](performance/readiness.json) | Exécution réussie, preuves et calme coopératif liés avant mesure. | Réserves navigateur indisponible et suivi live WEAV épuisé conservées séparément ; aucune réussite UI inventée. |
| [exclusive-window-execution.json](performance/exclusive-window-execution.json) | Fenêtre officielle réussie le 10 novembre 2026 de **21:29:50 à 21:38:25 UTC**, ordre **A1/B1/B2/A2**. | A : Site 82 / native 0.52.0 ; B : native 0.53.0. 32 sessions mesurées / 400 actions ; huit chauffes / 24 actions séparées. |
| [aggregation-failure.json](performance/aggregation-failure.json) | Rejet réel et conservé du comparateur historique strict. | L'identité structurelle stricte ne devient pas passée ; l'analyse complémentaire emploie le contrat structurel préalablement déclaré. |
| [owner-growth-analysis-initial-failure.json](performance/owner-growth-analysis-initial-failure.json) | L'analyseur qualifié initial refuse le nom du dossier déjà lié dans son contrat. | Outil gelé, rejet et journal conservés ; aucun résultat de coût réécrit. |
| [owner-cost-directory-correction-v1.json](performance/diagnostic/owner-cost-directory-correction-v1.json) | Réparation de garde de dossier **après mesure**, dans des variantes séparées et identifiées. | Seul le dossier exact déjà déclaré est admis ; règles, calculs, données et contrôles restent inchangés. |
| [owner-growth-comparison.json](performance/owner-growth-comparison.json) et [owner-growth-review.json](performance/owner-growth-review.json) | Budget global qualifié **accepté 2/2**, revue **4 669/4 669**. | Qualification structurelle prémesure et variante de dossier postmesure explicites ; diagnostic historique 10/16 conservé. |
| [final-cost-independent-review.json](performance/diagnostic/final-cost-independent-review.json) | Revue indépendante finale passée, reconstruite depuis les quatre rapports bruts. | Accepte la règle globale finie avec la correction de dossier postmesure ; marge STCK étroite et toutes les variations défavorables conservées. |
| [results.md](performance/results.md) | Tableau complet des résultats globaux, phases, cohortes et distributions. | Les six dépassements de phase et la seconde cohorte STCK défavorable restent publiés. |
| [log-transport.json](performance/log-transport.json) | Quatre journaux ABBA conservés et transportés sans perte. | Aucune sélection ou suppression de session, durée, variation ou diagnostic. |

Les 14 créations appariées décrivent les mêmes valeurs immuables : elles surviennent plus tôt dans B pour `linked_temporal_preparation`, puis A les crée pour les consommateurs communs. Les causes et les digests source sont conservés. Le bilan structurel tient compte des 70 deltas réellement attribués à B et des créations observées ensuite dans A à chacun des 58 points. Il ne modifie pas les durées, les échantillons, la politique de coût ou les résultats fonctionnels. Les échecs de préparation, leur correction et leurs qualifications restent des pièces distinctes.

| Jeu | Médiane globale A | Médiane globale B | Augmentation | Décision qualifiée |
| --- | ---: | ---: | ---: | --- |
| STCK | 9 872,156 ms | 10 821,705 ms | **+9,6185 %** | Accepté. |
| SMLP | 16 573,027 ms | 17 346,155 ms | **+4,6650 %** | Accepté. |

Les médianes regroupent huit sessions mesurées par version et jeu, sans exclusion d'une session défavorable. La seconde cohorte STCK à **+11,6734 %** reste incluse ; la marge globale STCK est de **0,3815 point de pourcentage**, environ **37,666 ms**. Le diagnostic reste **10/16** : nouvelles décisions, persistance et restauration dépassent +10 % dans chacun des deux jeux. Les p95 de restauration augmentent de **192,94 % sur STCK** et de **134,56 % sur SMLP**. L'acceptation ne prouve aucun gain de vitesse global, comportement stable en session longue ou succès WEAV au niveau 6.

## 7. Éléments encore attendus

La suite officielle, les sept régressions, la réconciliation des publications 82 puis 83, l'attribution, le coût qualifié et l'intégrité sont acquis. Restent :

1. Publication de 5A et liaison de l'identité Sites finale au commit, aux preuves et aux réserves réelles.
2. Poursuite de 5B, puis 5C, avec leurs contrats et contributions propres ; maintien des réserves de sessions longues, latence et WEAV au niveau 6.

La règle autorisée est une **médiane de session complète strictement inférieure à +10 % pour chaque jeu testé** ; les dépassements par phase restent acceptables sous cette condition et publiés avec leurs distributions. Un jeu ne compense pas un autre et les phases imbriquées ne sont pas additionnées. La [feuille de route globale](../v6-delivery-roadmap.md) conserve cette règle et les verdicts historiques. Aucun de ces éléments en attente n'est remplacé par les tests ciblés, la présence d'un fichier source ou le diagnostic WEAV. Les conversations responsables de 4B et 7B poursuivent leurs lots séparément ; cet index ne leur attribue aucun résultat de 5A.
