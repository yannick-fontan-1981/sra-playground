# Correction 3B : localisation du travail de restauration

## État de ce diagnostic

**Les deux profils prévus sont disponibles. Les sept contrôles de comportement limité passent ; l'égalité stricte du résultat final complet reste fausse.** L'unique profil corrigé utilise le gel `final-v2`, digest `f0ba85e80fbe7543f2e2360c6b6e846ae76839cb6ede0e9c022d31b56f46cece`, après correction d'un cas supplémentaire d'invalidation. Les durées plus élevées du chemin instrumenté de repli sont conservées ; ce diagnostic ne valide pas le budget et ne mesure pas le gain d'un succès du cache de l'inventaire.

La fenêtre officielle ultérieure de ce même gel est désormais terminée : **`budget_review_required`, 14/16 médianes**, restauration STCK **+66,160 %** et SMLP **+21,511 %**. La [consolidation officielle](../performance/results.md) conserve cet échec et les deux cohortes échouées. Les sept contrôles de comportement de ce diagnostic, les tests et les succès de jeu ne compensent pas ce résultat. **3B reste ouvert.**

Le [protocole de diagnostic](protocol.md) déclare un rejeu STCK10 avant correction, puis un seul rejeu identique sur la correction gelée. Le [rapport initial](stck-before.json.gz), de statut `passed`, utilise le moteur publié **0.39.0**, digest natif `49648e72cf7d3d719addfe4a6bebd8c29842a0f618664a45ef3929a5d17132b1`. Le rapport établit que ses sources et entrées sont inchangées pendant l'exécution.

Ce diagnostic est une session froide instrumentée du runtime natif et de `V6AgentService` appelés directement dans Node. Le moteur recalcule chaque commande avant que le dispositif lui rende le paquet public archivé correspondant. Aucun code, règle, oracle, solution ou état appris de jeu n'est fourni au moteur.

## Observations avant et après correction

Chaque rejeu acquiert **dix actions**, termine **deux niveaux** et atteint naturellement le niveau 3. Le plafond de dix actions explique sa fin ; les trois niveaux du paramètre de cible ne sont pas revendiqués comme terminés. Chaque résultat comporte **six cycles**, **seize requêtes** et **344 nœuds** dans le graphe final. La durée instrumentée passe de **12 017,787 ms à 14 351,903 ms**. Les rapports [avant](stck-before.json.gz) et [après](stck-after.json.gz) sont tous deux `passed`, avec leurs sources respectives inchangées pendant l'exécution.

| Mesure diagnostique | Appels par version | Total 0.39 | Total 0.40 | Médiane 0.39 | Médiane 0.40 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `runtime.restoreFamilies` | 12 | 265,733325 ms | 324,076404 ms | 11,882283 ms | 13,759925 ms |
| `public_observed_inventory.restoreNative` | 12 | 75,487201 ms | 103,594494 ms | 3,882912 ms | 4,130698 ms |
| `public_occurrence_recall.restoreNative` | 22 | 61,520154 ms | 73,320915 ms | 0,1683405 ms | 0,119909 ms |
| `runtime.persistFamilies` | 13 | 2 612,428774 ms | 3 081,626491 ms | 211,673409 ms | 236,287843 ms |
| `runtime.plan` | 6 | 2 182,292585 ms | 2 588,518581 ms | 365,773396 ms | 405,885848 ms |
| `service.snapshot` | 16 | 11,620148 ms | 13,143724 ms | 0,538948 ms | 0,5842355 ms |

Ces durées sont **imbriquées**. Les lignes par famille sont des parties de phases englobantes ; leur addition ne donne pas un temps exclusif supplémentaire. Les appels de `public_occurrence_recall` comprennent les usages propres au chemin commun observé ; leur nombre ne représente pas un nombre de décisions ou d'actions distinctes.

Les appels répétés de restauration de l'inventaire observé et de validation de l'état de série commune fournissent des endroits concrets à examiner. Le profil ne démontre pas que Chamber est la cause du dépassement officiel antérieur de **+18,69 %**. Une session instrumentée 0.39 n'isole pas la contribution causale de l'ajout de cette couche ni celle des variations de GC et d'ordonnancement.

## Correction examinée

La correction du gel `f0ba` porte sur trois travaux communs :

- Remplacer la construction répétée d'une représentation de travail par un **témoin exact d'état mutable**, avec égalité et invalidation complètes.
- Réutiliser une restauration déjà certifiée de l'**inventaire observé** lorsque le checkpoint et l'état réellement détenu correspondent encore, en conservant le chemin intégral pour les autres cas.
- Éviter la **double validation du même témoin de série commune** dans un même chemin, sans supprimer la validation nécessaire ni autoriser la réutilisation d'un état modifié.

Ces pistes concernent l'enveloppe native commune. Elles ne changent ni les originaux V5/V6, ni la signification des connaissances apprises, ni les gardes d'action, ni les critères de résolution du jeu. Les contrôles de mutation directe, de révision, d'identité, de restauration atomique et de repli doivent être vérifiés avant toute revendication de correction validée.

## Gel préliminaire et cas adverse retenu

Le [premier gel conservé](preliminary-freeze.json), digest `55192314213367a8c35e579b8cba17a022146359e1a76efcc1ae9caf5f6ce9cc`, contient **249 fichiers natifs** et a passé **1 270/1 270 tests dans 33 fichiers**. Sa source, ses archives et ses reçus restent dans `../final/`. Il n'a servi à aucune cohorte officielle de coût.

Une relecture a identifié un `Map` dont le prototype est entièrement remplacé, avec un itérateur hérité dont le résultat dépend d'une fermeture mutable. Le cas peut échapper à `instanceof Map` et ne doit pas bénéficier d'un témoin qui certifie toutes les dépendances. La [reproduction avant correction](detached-iterator-before.json) conserve **un test échoué**, exécuté sur la source préliminaire inchangée, avec son TAP complet. La correction refuse les itérables hérités hors tableau sans invoquer leurs getters, puis conserve le chemin source de repli. Le [contrôle après correction](detached-iterator-after.json) passe **232/232 tests dans cinq fichiers**, avec réussite explicite du même test adverse. Aucun jeu ni mesure officielle n'a été exécuté par ces commandes de test.

Le [nouveau gel](../final-v2/source-manifest.json) est établi dans `../final-v2/`, avec le digest **`f0ba85e80fbe7543f2e2360c6b6e846ae76839cb6ede0e9c022d31b56f46cece`**, **249 fichiers natifs**, une [archive de 260 fichiers](../final-v2/source-archive.json) et la même version **0.40.0**. La [nouvelle validation formelle complète](../final-v2/validation/delta-tests-run.json) passe **1 272/1 272 tests dans les 33 fichiers**, sans échec, skip ou annulation. Typecheck, audits, contrôle du diff et build passent également sur ce gel. Les résultats du premier gel restent distincts. Le protocole officiel est amendé avant toute mesure uniquement pour le chemin du gel à comparer ; aucun échantillon, ordre ou seuil n'est modifié.

## Comparaison corrigée : identité limitée vérifiée

Le [comparateur historique inchangé](scoped-behavior.json) retourne **`scoped_behavior_identical`**. Ses sept contrôles sont vrais : même générateur, mêmes entrées, même cas, commandes exactes, états des propriétaires retenus exacts, champs annoncés des requêtes exacts et effectifs d'appels exacts. Les **dix commandes**, **seize requêtes** et **quatre états de propriétaires** sont concernés : `family_state:public_occurrence_recall`, `family_state:morphology`, `caller:counters` et `caller:lifecycle`.

Les effectifs `stageInvocationCountsExact` restent effectivement égaux dans les deux profils. Il n'y a donc pas de différence d'effectif à qualifier séparément sur ces exécutions. Le champ **`strictFinalEquality` reste `false`**, sans être transformé en égalité. Les rapports intégraux conservent leurs durées, provenances source et identités de graphe. Cette comparaison ne revendique ni l'identité du snapshot entier ni celle du graphe privé complet.

La correction de l'inventaire exige l'identité des projections source avant d'autoriser une réutilisation. Le wrapper de `state` ajouté par `scripts/profile-native-loop-costs.mjs` est une personnalisation : il provoque un **refus de ce cache et la validation complète de repli**. Le profil corrigé conserve cette instrumentation identique. Il établit le comportement de ce chemin de repli ; ses durées ne représentent pas le gain d'un succès du cache de l'inventaire. Les hausses du rejeu, de la restauration et des autres phases restent visibles dans le tableau.

Le runner officiel `scripts/measure-native-loop-costs.mjs` enveloppe `plan`, `authorize`, `seal`, `persistFamilies` et `restoreFamilies` sur le runtime. Il n'enveloppe pas les projections de famille. La fenêtre officielle a donc conservé leurs identités source intactes. Il n'y a ni assouplissement des contrôles en production pour accepter le profileur, ni profil modifié pour fabriquer des succès de cache. Les tests de personnalisation des projections vérifient séparément ce refus et son repli ; le profil instrumenté n'établit pas le nombre de succès de cache en utilisation normale.

Les [régressions CATR/RSWP](../final-v2/regressions/regression-summary.json), indépendantes de cette comparaison instrumentée, passent **34/34 contrôles**. Les 31 commandes, 33 paquets publics, 336 images et six frontières naturelles annoncés sont vérifiés. CATR conserve douze actions, trois niveaux et huit préfixes ; RSWP dix-neuf actions, trois niveaux et onze préfixes. La [campagne CATR live](../final-v2/catr-cost-session/execution-catr.json) confirme aussi douze actions, trois niveaux et huit préfixes avec le même gel. Ces résultats ne valident pas le budget officiel.

Le [contrôle navigateur](../final-v2/browser/browser-verification.json) confirme CATR **12 actions / 3 niveaux / 8 plans**, les pauses à zéro et cinq actions et la reprise d'un préfixe partiel, dans la même session. Il utilise la prévisualisation Vite des sources TypeScript gelées, avec inspecteur fermé ; il reste distinct d'un test du worker compilé dans `dist`. Le preview a été arrêté avant les mesures isolées.

## Portée et limites

Les observateurs de méthodes conservent arguments, résultats et ordre d'acquisition, mais ajoutent leur propre coût. Les appels directs excluent l'acceptation et les copies de `BrowserV6Agent`, le transport worker, Pause, le rendu navigateur et le moteur du jeu. Leurs temps ne peuvent pas être comparés directement aux métriques de requête ou de session du budget officiel.

Le [résumé CPU](cpu-summary.json) conserve les deux profils complets, chargement et export compris. Les temps échantillonnés du processus passent de **13 027,462 à 15 444,883 ms** ; ils restent distincts des temps du rejeu. Les quatre intervalles bruts négatifs observés sont conservés et listés : deux avant et deux après. Les profils bruts se reconstruisent exactement depuis leurs archives gzip. Ils ne comptent pas les allocations et ne prouvent pas la stabilité mémoire d'une longue session. Une seule session par version ne fournit ni p95, ni intervalle de confiance, ni validation du budget +10 %.

## Résultat officiel ultérieur et suite du diagnostic

La décision de coût dépend de la fenêtre **0.38 fraîche contre correction gelée `f0ba`**, décrite dans le [protocole officiel](../performance/protocol.md). Elle s'est déroulée le **10 novembre 2026, de 01:23:37 à 01:32:40 UTC**, après l'arrêt du preview et de ce profilage. Les **32 sessions mesurées et 400 actions** sont toutes retenues. Les mesures et échecs historiques 0.39 restent conservés séparément.

L'[agrégat officiel](../performance/combined-comparison.json) échoue à **14/16**, statut `budget_review_required`. La restauration STCK passe de **9,5947665 à 15,9426585 ms**, soit **+66,159942506 %**, et la restauration SMLP de **4,716928 à 5,731593 ms**, soit **+21,511140301 %**. Les deux dépassements demeurent `over_budget_with_noise_unresolved`. Les deux cohortes sont également non conformes, respectivement **14/16** et **13/16**, et sont conservées dans leur intégralité.

La [revue indépendante de consolidation](../performance/consolidation-review.json) passe **231 vérifications**, confirme les 32 sessions uniques et reproduit ces résultats. Son statut arithmétique `passed` est distinct de son `budgetStatus: budget_review_required` ; il n'accepte pas le coût. La [synthèse complète](../performance/results.md) détaille médianes, p95, dispersion et diagnostics de pause/inspection sans retirer d'échantillons.

Ces observations établissent l'échec du premier essai de coût, sans en isoler la cause. Le chemin de repli instrumenté et la fenêtre officielle ont des conditions de projection différentes ; leurs durées ne fournissent pas un ratio de gain du cache et ne justifient aucune attribution causale à Chamber. Les profils, leurs hausses, l'égalité stricte fausse et tous les reçus de `final-v2/` restent inchangés. Une correction concrète supplémentaire doit précéder son propre gel et une nouvelle fenêtre déclarée distinctement. Aucun résultat de cette correction ultérieure n'est anticipé ; **3B reste ouvert et 3C attend**.

## Nouvelle série normale v2, après une correction distincte

Une nouvelle correction du chemin commun est désormais gelée dans [final-v3](../final-v3/source-manifest.json), digest **`391a2797414c0090fa632a2fc13736c7806c1f5fceceafa34e1583dd4ef9e3a9`**, **249 fichiers natifs**, archive de **260 fichiers**, version 0.40.0. Quatre fichiers natifs diffèrent de `f0ba` : propriétaire natif, témoin mutable, inventaire observé et série commune. Ses preuves fonctionnelles distinctes sont maintenant acquises : **1 322/1 322 tests dans 35 fichiers**, contrôles du projet, **34/34 régressions**, CATR 12 actions / 3 niveaux / 8 plans en campagne froide et dans le navigateur sur les sources gelées. Son [budget officiel propre](../performance-v2/results.md) reste non conforme à **14/16** ; ces validations ne le compensent pas.

Deux [profils exploratoires normaux v1](normal-path-protocol.md) sur `f0ba` ont conservé `state` et `callerContextState`, mais enveloppé `restore`. La nouvelle production contrôle aussi l'identité de cette méthode ; ce générateur provoquerait donc un repli sur la nouvelle source. L'ancien script et ses deux reçus avant restent conservés avec leurs empreintes. Aucun profil après v1 n'a été exécuté ou remplacé par une sortie portant une autre instrumentation.

Le [protocole normal v2](normal-path-v2-protocol.md), déclaré avant ses quatre exécutions, conserve un générateur unique **`9e5e03e2d66cae16060a48aaec392a5874e464738c678cb6daab089580bba570`**, qui n'enveloppe pas `restore` quand la famille possède `restoreNative`. Il empreinte son propre protocole v2 ; le README 2C appartient seulement aux anciennes entrées du générateur v1. Son schéma **`logos-engine.native-restoration-profile.v2`** est explicitement aligné avec le nouveau comparateur avant tout lancement.

La série fixe **une session STCK10 et une SMLP15 par source**, sans chauffe : avant `f0ba` dans un [checkout isolé reconstitué depuis son archive](normal-path-v2-isolated-source.json), puis après `391a279` dans main, dans cet ordre. Les entrées et le générateur sont copiés exactement ; les reçus du checkout isolé doivent être copiés brut pour brut, sans modifier la provenance, les horodatages ou les résultats. Les deux anciennes sessions exploratoires ne sont pas utilisées comme les références de cette nouvelle instrumentation.

Le comparateur générique v2 conserve **six critères exacts** de comportement et rapporte séparément toutes les différences d'effectifs, de résultats des témoins et de durées. Il ne transforme pas `strictFinalEquality` et ne revendique pas l'identité complète du graphe. Les onze contrôles initiaux sur fixtures sont attachés à leur ancien hash ; les [deux contrôles d'alignement du schéma](normal-path-comparator-v2-schema-validation.json) concernent le comparateur final **`da2468b0ff39dd30a67b46357aaf4c25ea3c94b21d569604e8b95542d2b36f0b`**. Ces vérifications légères n'ont exécuté aucun profil ni moteur de jeu.

### Résultats normaux v2 effectivement obtenus

Les quatre sessions ont terminé dans l'ordre annoncé, le **10 novembre 2026 entre 02:06:40 et 02:08:08 UTC**. Les inventaires natifs sont restés inchangés. Les quatre reçus confirment `sourceProjectionsUnwrapped: true` et **huit méthodes source de restauration laissées intactes**. Le [reçu de copie](normal-path-v2-before-copy.json) conserve les deux rapports avant du checkout isolé, copiés byte pour byte dans main.

Les comparaisons [STCK](normal-path-v2-comparison-stck.json) et [SMLP](normal-path-v2-comparison-smlp.json) passent toutes deux **six contrôles exacts**, statut **`scoped_behavior_identical`**. Chacune conserve **`strictFinalEquality: false`**, **`aggregateInvocationCountsExact: false`**, **`methodInvocationCountsExact: false`** et **`witnessResultsExact: false`**. Ces différences n'ont pas été effacées ni converties en identité.

| Cas | Actions et niveaux par source | Requêtes par source | Observations de méthodes avant → après | Contrôles exacts |
| --- | --- | ---: | ---: | ---: |
| STCK | 10 actions, 2 niveaux | 16 | 2 067 → 2 059 | 6/6 |
| SMLP | 15 actions, 3 niveaux | 24 | 3 142 → 3 128 | 6/6 |

### Toutes les différences d'effectifs retenues

Chaque cas comporte **quatre entrées de différence agrégée** : les deux méthodes ci-dessous apparaissent chacune dans la table des étapes et dans celle des familles. Elles ne représentent donc pas quatre travaux indépendants. Tous les autres effectifs agrégés des étapes, familles et lectures de connaissances restent égaux.

| Méthode | STCK avant → après | SMLP avant → après |
| --- | ---: | ---: |
| `inventory.captureCheckpointWitness` | 14 → 13 | 21 → 19 |
| `shared.unchanged` | 66 → 59 | 54 → 42 |

Le découpage par opération conserve également les déplacements de travail ; voici **toutes les dix différences** des deux comparaisons, quatre sur STCK et six sur SMLP :

| Cas | Méthode | Opération | Appels avant | Appels après |
| --- | --- | --- | ---: | ---: |
| STCK | `captureCheckpointWitness` | `advance` | 12 | 6 |
| STCK | `captureCheckpointWitness` | `resume` | 0 | 5 |
| STCK | `shared.unchanged` | `advance` | 52 | 46 |
| STCK | `shared.unchanged` | `init` | 4 | 3 |
| SMLP | `captureCheckpointWitness` | `advance` | 18 | 9 |
| SMLP | `captureCheckpointWitness` | `init` | 3 | 2 |
| SMLP | `captureCheckpointWitness` | `resume` | 0 | 8 |
| SMLP | `shared.unchanged` | `advance` | 26 | 23 |
| SMLP | `shared.unchanged` | `init` | 5 | 3 |
| SMLP | `shared.unchanged` | `resume` | 23 | 16 |

Les résultats booléens des témoins sont eux aussi différents et conservés :

| Cas et témoin | Appels avant → après | Succès avant → après | Refus avant → après |
| --- | ---: | ---: | ---: |
| STCK Inventory | 18 → 18 | 12 → 6 | 6 → 12 |
| STCK Shared | 66 → 59 | 56 → 49 | 10 → 10 |
| SMLP Inventory | 27 → 27 | 17 → 9 | 10 → 18 |
| SMLP Shared | 54 → 42 | 21 → 17 | 33 → 25 |

Ces nombres concernent les appels observés des méthodes, pas des actions ou décisions supplémentaires. `shared.restoreOwned` conserve **7 appels sur STCK et 12 sur SMLP** dans chaque source. Les commandes, acquisitions et champs de requête annoncés sont identiques malgré les changements de validation/capture ; cela ne constitue pas l'identité de tout état privé.

### Durées normales v2 : résultats mixtes conservés

| Cas et phase | Appels avant → après | Total avant (ms) | Total après (ms) | Médiane avant (ms) | Médiane après (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| STCK `runtime.restoreFamilies` | 12 → 12 | 254,392176 | 277,581759 | 12,3023335 | 15,3987935 |
| STCK Inventory `restoreNative` | 12 → 12 | 87,900139 | 91,839207 | 4,2579325 | 4,845209 |
| STCK Inventory capture | 14 → 13 | 22,063626 | 12,213612 | 1,5799655 | 0,983885 |
| STCK Inventory vérification | 18 → 18 | 17,777392 | 5,870243 | 1,3882535 | 0,032629 |
| STCK Shared `restoreNative` | 22 → 22 | 64,072943 | 57,590646 | 0,085572 | 0,062923 |
| STCK Shared vérification | 66 → 59 | 5,438678 | 3,348666 | 0,075892 | 0,040950 |
| SMLP `runtime.restoreFamilies` | 18 → 18 | 189,122097 | 161,949337 | 8,059371 | 6,465182 |
| SMLP Inventory `restoreNative` | 18 → 18 | 79,040498 | 62,610604 | 3,4693785 | 2,906002 |
| SMLP Inventory capture | 21 → 19 | 31,377691 | 20,295814 | 1,487402 | 1,027141 |
| SMLP Inventory vérification | 27 → 27 | 23,357420 | 8,232765 | 0,988323 | 0,029403 |
| SMLP Shared `restoreNative` | 21 → 21 | 23,339482 | 20,199884 | 0,533100 | 0,636252 |
| SMLP Shared vérification | 54 → 42 | 2,299590 | 1,532000 | 0,005358 | 0,007832 |

Les distributions complètes, minima, maxima et durées de chaque requête restent dans les rapports. Le rejeu STCK passe de **12 000,927434 à 12 149,079581 ms** ; SMLP de **18 364,188281 à 18 034,194947 ms**. La baisse des durées de capture et vérification de l'inventaire ne se traduit donc pas par une baisse de restauration ou de rejeu STCK dans cette session. La médiane de restauration Shared SMLP augmente également malgré un total inférieur. Ces hausses restent visibles ; aucune sélection de phase favorable ne remplace le résultat complet.

Les phases se recouvrent, les méthodes restent instrumentées et une seule session par source est disponible. Aucun total des lignes n'est présenté comme un temps exclusif, aucune p95 ou confiance statistique n'est déduite, et la comparaison ne prouve pas une causalité complète. Les quatre profils ne forment pas des cohortes officielles et ne compensent pas l'échec `f0ba` 14/16.

La [nouvelle fenêtre officielle distincte](../performance-v2/results.md), avec référence 0.38 fraîche et seize critères +10 %, a depuis terminé : **`budget_review_required`, 14/16**, acquisition/persistance SMLP **+11,641662058 %** et restauration SMLP **+14,988511609 %**, toutes deux non résolues avec bruit. STCK restauration reste dans le seuil agrégé à **+4,218399745 %**. La revue indépendante passe **231 contrôles** sur **32 sessions et 400 actions** et confirme cet échec du budget. Les deux cohortes, 14/16 et 13/16, restent conservées. Ces résultats officiels ne changent ni les profils ni leurs qualifications ; **3B reste ouvert et 3C attend**.
