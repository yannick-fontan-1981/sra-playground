# Formes communes BranchRouting : capture native v2

Ces nouveaux outils qualifient les cinq chaînes synthétiques directement à travers **la vraie API `NativeV6Runtime`**, comme les huit tests communs acquis. Ils ne modifient ni la production, ni le corpus, ni les attendus source, ni les outils ou artefacts de la première tentative. Leur auteur n’a exécuté aucun script, import natif, contrôle de syntaxe ou test ; le propriétaire déclare et supervise les essais après gel.

## Pourquoi une nouvelle tentative

La capture01 utilisant `V6AgentService.handle` a été rejetée par la validation publique **64 × 64**, avant la factory : **0 appel de factory, 0 retour acquis, 0 capture de runtime**. La durée du processus rapportée par le superviseur est **1,033 s** ; ce n’est pas un échantillon de performance. Le reçu `docs/migration/lot8b-evidence/delivery-qualification-01/branch-capture-01/capture.receipt.json` atteste des entrées, du HEAD et des sources natives inchangés.

Le corpus contient 37 matrices : 35 de dimensions **26 × 28** et 2 de dimensions **28 × 26**. La valeur 32 était une borne prospective, pas la dimension réelle des matrices. Les faire entrer dans la façade 64 × 64 était une erreur de périmètre de l’outil v1. Un padding modifierait les empreintes et le domaine géométrique, dont `limit` et potentiellement les obligations ; aucun padding, changement de validation ou nouvel oracle n’est introduit.

Les outils v2 épinglent le reçu de cet échec, vérifient son refus avant factory et son absence de retours, et le conservent comme tentative distincte. Les trois anciens outils et le plan01 restent inchangés.

## Frontière réellement exercée

La factory de production crée une instance native froide par session. Les appels sont `initialize`, `advance`, `resume`, `inspectKnowledge` et `close`.

| Appel | Arguments réellement transmis | Retour capturé |
| --- | --- | --- |
| `initialize` | `{ sessionId, observation, budgets }`, puis l’objet `NativeExecution` décrit ci-dessous | Le `NativeRuntimeYield` réellement retourné |
| `advance` | `{ command: lastYield.command, observation, executionMs: 0 }`, puis le même objet d’exécution | Le `NativeRuntimeYield` réellement retourné |
| `resume` | Le même objet d’exécution | Le `NativeRuntimeYield` réellement retourné |
| `inspectKnowledge` | Aucun | La mémoire réelle, liée aux deltas complets par égalité et digests de tous les nœuds/deltas |
| `close` | La raison `branch_capture_session_closed` | `undefined`, avec le snapshot réel enregistré séparément |

Les champs `sessionId` et `sequence` des lignes du harnais décrivent son contexte ; ils ne sont pas présentés comme des arguments supplémentaires de `resume`, `inspectKnowledge` ou `close`. `call.arguments` conserve les arguments métier réellement passés et `call.executionArgument` décrit séparément l’objet d’exécution. Les lignes d’inspection et de fermeture n’ont pas de champ `result` fabriqué.

Les commandes restent au format natif `action_ref`. L’absence de `data` est conservée ; aucune conversion en `actionRef` ni ajout de `data: {}` n’est appliqué. Chaque paquet de retour est fourni uniquement après vérification de la commande et de l’autorisation effectivement émises. Cette autorisation contient exactement `observation_ref`, `decision_revision` et `action_index`. `authorizationIdentity()` fournit séparément `graphChain` et `nativeExecutionDigest`, liés au snapshot et revérifiés immédiatement avant `advance`. Les éventuelles clés locales de décompte du lecteur ne sont ni des tickets ni des autorisations supplémentaires.

Le runtime mesure les observations depuis les rasters mais reçoit le label `frame_hash` du paquet natif. La capture et le lecteur vérifient eux-mêmes ce label contre SHA-256 du JSON compact des lignes, tronqué à 16 hexadécimaux, et vérifient le dernier frame du paquet. Ils conservent également le SHA-256 complet de chaque paquet de retour. Ce contrôle d’outillage ne constitue pas une nouvelle validation par la façade publique.

**La validation d’entrée du service 64 × 64/palette 0..15, les tickets, leur protection contre le rejeu, les copies de réponse et le transport worker restent hors de la preuve positive.** Les artefacts portent `entryBoundary: NativeV6Runtime`, `publicServiceQualified: false`, `publicWorkerQualified: false` et `publicTicketsQualified: false`.

## NativeExecution, horloges et supervision

Chaque session réutilise un objet `NativeExecution` contenant seulement `yieldControl: () => new Promise(resolve => setTimeout(resolve, 0))`. Aucun `signal`, `now`, `deadlineMs` ni `remainingLevelActions` n’est fourni dans cet objet par l’outil. Les arguments d’exécution effectivement dérivés par le runtime et reçus par le propriétaire sont observés, dont les délais d’acquisition.

Pour les quatre chaînes ordinaires, la factory conserve son horloge native par défaut, `performance.now()`. Le runtime continue de produire les bornes de niveau et d’acquisition à partir de son budget de 360 000 ms. L’absence de délai externe dans l’objet d’exécution ne retire pas ces bornes.

Seul `incomplete-prefix` utilise la configuration native déclarée `now: () => clockMs`. Cette horloge vaut 0 jusqu’au résultat inchangé du garde réel de la seconde action de mouvement, puis 360 001. Le premier `record` réel refuse alors sur sa borne native ; le second n’est pas appelé à travers cette acquisition manquante. La méthode originale `record` n’est pas remplacée pour cette intervention. Le `resume` arrêté est exercé avant `close` et doit conserver exactement le résultat arrêté, sans nouvelle acquisition.

`Date.now` reste inchangé. Les intervalles réels autour des appels permettent uniquement de vérifier la provenance des scalaires `created` des traces ; ils ne deviennent pas des mesures de coût. La supervision racine impose **300 secondes par commande** et `NODE_OPTIONS=--max-old-space-size=1536`. Ce plafond V8 n’est pas un plafond de toute la RSS. Le timeout externe est une limite de la tentative, pas un délai du service public ou une promesse de coût. Les outils n’ouvrent aucun verrou et ne relancent pas une tentative échouée.

## Corpus et formes conservées

Le corpus indépendant `tests/fixtures/v6-branch-routing-reference.json` reste épinglé au SHA-256 `e6ae197b7b982bd41f561b9df8e458436d7ce0797f39bbf86d972e55472b6769`, issu de la référence source `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Ses sources, exportateur et manifest sont fingerprintés sans exécution de l’exportateur. Aucun payload de jeu ou LKEY n’est interprété.

Toutes les chaînes partent du constructeur froid réel. La chaîne contraire rejoue les quatre acquisitions avant son retour contraire, sans injecter le snapshot retenu de la fixture. L’ablation remplace explicitement le seul wrapper sélectionné `record` par `{ events: [] }` ; elle reste distincte d’une acquisition source réussie.

La sélection commune conserve le centroïde mesuré **(6,13)** dans `[6,12,7,15]`, explicitement distinct du point **(7,13)** fourni en premier dans la liste manuelle du corpus composant. Les attendus des états et événements restent entiers ; les références source sont transportées vers les véritables observations communes. Les deux listes d’entrées ne sont pas déclarées identiques.

| Session | Retours | Acquisitions source réussies | Formes exécutées | Question finale sans retour |
| --- | ---: | ---: | --- | --- |
| `single-positive` | 6 | 6 | 4 calibrations, mouvement, propagation sans score | Aucune |
| `triple-prefix` | 7 | 7 | 4 calibrations, sélection, 2 mouvements acquis au scellement | Propagation `ACTION5` |
| `contrary-return` | 5 | 5 | 4 calibrations, même commande de mouvement, retour contraire | Calibration `ACTION5` |
| `selected-acquisition-ablation` | 1 | 0 | Première calibration avec effet sélectionné omis | Calibration `ACTION1` |
| `incomplete-prefix` | 7 | 5 | 4 calibrations, sélection, 2 mouvements publics conservés mais non acquis | Aucune |

Les totaux restent **26 retours**, **23 acquisitions réussies**, **1 ablation**, **2 retours incomplets**, **25 appels wrapper `record`** et **24 invocations de l’adaptateur original**. Ce dernier total inclut un refus typé. Les modes exécutés sont 17 calibrations, 2 sélections, 6 mouvements et 1 propagation ; les 3 questions finales non exécutées sont séparées.

`caller.acquiredTransitions` compte les retours réconciliés, pas seulement les effets acquis par BranchRouting. `finished: true` après une propagation sans score n’est pas une victoire. Aucun niveau officiellement résolu n’est revendiqué.

## Graphe, propriétaire et lecteur indépendant

Tous les deltas Kernel sont conservés. Le lecteur vérifie leur chaîne et leurs hashes, schémas, portées, révisions, origines, profil de store et fragments identifiés par contenu. Il reconstruit les nœuds, hydrate les racines modifiées et recalcule l’identité des programmes. L’inspection finale doit correspondre aux digests des nœuds et deltas complets.

Les opérations, checkpoints et restaurations du propriétaire enregistré restent réels. Les événements et états complets sont rapprochés du corpus indépendant. Les gardes sont reliés aux paquets/observations courants ; les deux rasters et le paquet d’animation de `record` sont rapprochés des retours conservés. Le lecteur relie le programme commun de choix, WHY/ACT, la proposition, l’autorisation native, les faits source et les véritables relations des nœuds de préfixe. Un libellé diagnostique du rapport ne devient pas une nouvelle relation Kernel.

L’ablation exige un fait `branches:<revision>` nul et l’absence d’apprentissage. Les deux acquisitions incomplètes exigent l’absence de faits `branches:<revision>`, les transitions publiques complètes conservées, `acquired: false`, `release_authority: false`, `frontier.complete: false` et le lien vers la proposition dans `prefix_evidence`. Le second refus doit identifier le premier retour non acquis et indiquer que `record` n’a pas été appelé.

Le lecteur ne crée pas de runtime et n’exécute aucune famille. Ses seules dépendances natives utilisées sont les validateurs, codecs et fonctions de digest du graphe épinglé. Il conserve les deltas historiques complets et limite son cache de valeurs hydratées à une révision par nœud, avec réhydratation possible d’une racine ancienne.

## Identité et CLI

Le candidat annoncé comporte 331 fichiers natifs, digest canonique `3ff1d9ad56e22aedc0fee3a0da6a3af50a1da0bc14a0ba01cb38272ba85234be`. Le manifest contient exactement `fileCount`, `digest` et `files`, triés par chemins relatifs complets. La capture exige des fichiers, entrées et HEAD inchangés pendant ses cinq sessions ; le lecteur vérifie à nouveau les empreintes. Aucun ancien digest ou reçu n’est réécrit.

Depuis `/workspace/sites/sra-lot8b-branch-routing-20261112/.sites-checkout`, le propriétaire doit déclarer deux commandes séparées sous son superviseur **300 s / old-space 1536 MiB**. Les chemins ci-dessous sont proposés pour la nouvelle tentative et doivent être absents avant écriture :

```bash
node docs/migration/lot8b-evidence/tools/delivery/branch-common-capture-v2.mjs \
  /workspace/sites/sra-lot8b-branch-routing-20261112/.sites-checkout \
  docs/migration/lot8b-evidence/delivery-qualification-01/candidate-native.json \
  docs/migration/lot8b-evidence/delivery-qualification-01/branch-capture-02/capture.jsonl.gz

node docs/migration/lot8b-evidence/tools/delivery/branch-common-qualify-v2.mjs \
  docs/migration/lot8b-evidence/delivery-qualification-01/branch-capture-02/capture.jsonl.gz \
  docs/migration/lot8b-evidence/delivery-qualification-01/branch-capture-02/capture.receipt.json \
  docs/migration/lot8b-evidence/delivery-qualification-01/branch-qualify-02/graph-review.json \
  docs/migration/lot8b-evidence/delivery-qualification-01/branch-qualify-02/work-forms.json
```

Les artefacts utilisent des schémas `branch-common-runtime-*.v2`, distincts de v1. Les statuts de succès restent `captured_synthetic_common_structure` et `qualified_synthetic_common_work_forms_and_graphs`, à lire avec `entryBoundary` et les trois drapeaux de portée publique. Un échec, un timeout ou un artefact manquant ne qualifie aucun sous-ensemble par défaut. Les sorties sont exclusives et les tentatives échouées restent conservées avec le journal et le reçu du superviseur.

La qualification demeure synthétique : `officialPerformanceEligible: false`, `wholeCallerParity: false`, aucune preuve de résultat de jeu, d’égalité des graphes entre versions, d’acceptation de performance ou de publication.
