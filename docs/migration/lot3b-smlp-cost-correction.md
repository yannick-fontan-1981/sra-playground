# Lot 3B : correction générique des coûts SMLP en native 0.41

## État actuel

**La correction native 0.41 est validée dans son périmètre fonctionnel, mais son budget officiel reste non conforme : `budget_review_required`, 14/16 médianes dans le seuil +10 %.** Deux réserves demeurent : **persistance STCK +14,269890051 %** et **restauration SMLP +11,220691835 %**. La [fenêtre complète et ses résultats](lot3b-smlp-cost-evidence/performance/results.md) sont conservés, avec toutes les sessions. **3B reste ouvert et 3C en attente ; aucune nouvelle publication Site n'est anticipée par ce bilan.** Le point de départ publié reste **SRA Playground 68 / native 0.40.0**, commit `512ac2cd7270b669aca0a12dbc9c4702174f1c0f`, digest natif `391a2797414c0090fa632a2fc13736c7806c1f5fceceafa34e1583dd4ef9e3a9`.

Le [gel final 0.41](lot3b-smlp-cost-evidence/final/source-manifest.json) porte le digest **`3edffde9b21f4fc8af9dda9a1dbd40707c015d9f7cba8a41460021e39acb7605`**, avec **249 fichiers natifs** et une [archive de 260 fichiers](lot3b-smlp-cost-evidence/final/source-archive.json). Cinq fichiers natifs changent par rapport à 0.40 : `canonical.ts`, `v6-native-state-graph.ts`, `v6-inventory-caller-context.ts`, `v6-observed-inventory.ts` et `v6-native-runtime.ts` pour la version. Les sources d'origine des agents V5/V6 restent conservées.

Les preuves propres à ce gel établissent **1 379/1 379 tests dans 41 fichiers**, **cinq vérifications réussies**, **34/34 contrôles de régression historiques CATR/RSWP**, ainsi qu'une campagne froide CATR et un contrôle navigateur menant chacun à **12 actions, trois niveaux terminés et huit plans**. Le diagnostic SMLP normal réussit ses **six critères bornés**, avec des temps mixtes et **`strictFinalEquality: false` conservé**. Ces résultats fonctionnels ne décident pas du budget de coût.

## Point de départ : les deux réserves 0.40 sont conservées

La version 0.40 conserve ses propres validations : **1 322/1 322 tests dans 35 fichiers**, **34/34 contrôles CATR/RSWP**, campagne froide et contrôle navigateur CATR à **12 actions, trois niveaux et huit plans**. Le [bilan 0.40](lot3b-cost-correction.md) et tous ses reçus restent inchangés ; leurs compteurs ne sont pas transférés à 0.41.

Son [budget officiel retenu](lot3b-cost-evidence/performance-v2/results.md) demeure **`budget_review_required`, 14/16** :

| Mesure | Référence 0.38 remesurée | Source publiée 0.40 | Variation |
| --- | ---: | ---: | ---: |
| Acquisition et persistance SMLP | 987,2867115 ms | 1 102,223294 ms | **+11,641662058 %** |
| Restauration SMLP | 4,871004 ms | 5,601095 ms | **+14,988511609 %** |

La restauration STCK reste dans le seuil agrégé à **+4,218399745 %**. Les cohortes historiques **14/16** et **13/16**, leurs dépassements locaux, le résultat 0.39 et le premier essai 0.40 restent conservés. La revue historique de 231 contrôles valide l'arithmétique ; elle ne ferme aucun dépassement. **3B reste ouvert, et 3C attend sa clôture.**

## Modifications génériques de la source gelée

La correction réduit le travail commun de copie, de validation et de reconstruction. Elle conserve les logiques de décision V5/V6, les observations publiques, les gardes, acquisitions, révisions, propriétaires et contre-exemples. Aucun identifiant de jeu ou de niveau ne décide du comportement de production.

### Fragments terminaux immuables du graphe d'état

Dans [v6-native-state-graph.ts](../../src/logos-engine/v6-native-state-graph.ts), un cache borné réutilise les fragments terminaux déjà validés et profondément immuables. Le prédicat exposé par [canonical.ts](../../src/logos-engine/canonical.ts) reconnaît la propriété immuable établie par le mécanisme source ; un objet simplement gelé ailleurs ne reçoit pas cette certification. Le cache est limité à **256 entrées et 8 Mio de poids structurel conservateur**.

La lecture du magasin courant reste requise avant toute réutilisation. L'identité du fragment et son identifiant doivent correspondre. Les fragments contenant des références continuent à traverser le magasin courant ; les contrôles de profondeur restent effectifs, y compris pour les références répétées. Les contrats affectés vérifient notamment les fragments remplacés, manquants ou altérés, les magasins distincts et les limites du cache. Cette réduction de travail interne ne supprime aucun échantillon des phases officielles.

Le [contrôle synthétique de profondeur](lot3b-smlp-cost-evidence/diagnostic/repeated-reference-depth-comparison.json) établit aussi un changement de validation explicite : une référence répétée à la profondeur **513**, acceptée par 0.40, est désormais refusée ; la frontière **512** reste acceptée avant et après. Une première occurrence à 513 était déjà refusée dans les deux sources. Le correctif ferme donc un contournement pour un cas hors du contrat structurel ; cette différence de validation ne constitue pas une égalité globale des états.

### Copies du contexte et validation du tracker

Dans le [contexte d'inventaire](../../src/logos-engine/v6-inventory-caller-context.ts), les valeurs scalaires évitent `structuredClone`, car elles n'ont pas d'état mutable à détacher. Les objets conservent une copie détachée ; fonctions et symboles conservent leur rejet par le chemin historique. Les valeurs particulières telles que `undefined`, les nombres non finis, le zéro négatif et les grands entiers gardent leur sémantique.

Dans [v6-observed-inventory.ts](../../src/logos-engine/v6-observed-inventory.ts), une copie extérieure du tracker est supprimée lorsque le restaurateur source fournit déjà sa propre copie détachée. Un restaurateur personnalisé conserve la copie historique. Les contrats vérifient la normalisation du checkpoint, les getters, le contexte et l'atomicité de la publication. La fenêtre officielle distincte constate encore deux dépassements ; la validation de ces contrats ne les efface pas.

## Diagnostic SMLP avant/après : comportement borné identique, temps mixtes

Le [protocole diagnostic](lot3b-smlp-cost-evidence/diagnostic/protocol.md) et sa [déclaration préalable](lot3b-smlp-cost-evidence/diagnostic/declaration.json) fixent une session SMLP15 sur 0.40, puis une session sur 0.41 gelée, avec **zéro chauffe** et échantillonnage CPU à **1 000 µs**. Le générateur conserve le schéma normal v2 et reçoit le protocole comme argument. Les méthodes source de projection et les restaurateurs des huit familles natives ne sont pas remplacés.

Les [rapports avant](lot3b-smlp-cost-evidence/diagnostic/before-smlp.json.gz) et [après](lot3b-smlp-cost-evidence/diagnostic/after-smlp.json.gz) sont conservés. Le [comparatif normal inchangé](lot3b-smlp-cost-evidence/diagnostic/comparison.json) conclut **`scoped_behavior_identical`, 6/6** : générateur, entrées, cas, commandes, quatre états propriétaires retenus et onze champs de requête sélectionnés sont identiques dans le périmètre déclaré. Chaque côté contient **15 actions, 24 requêtes et 3 128 échantillons**. Le scénario termine les trois premiers niveaux et atteint naturellement le niveau 4.

Les comptes d'invocation agrégés et par méthode sont identiques, sans différence effacée. Les témoins restent également exacts : Inventory **27 contrôles, neuf succès de réutilisation et 18 échecs** ; Shared **42 contrôles, 17 succès et 25 échecs**. L'environnement déclaré est identique. Les quatre états retenus sont `public_occurrence_recall`, `morphology`, les compteurs de l'appelant et son cycle de vie. **L'égalité stricte des objets finaux complets est fausse : `strictFinalEquality: false`.** Le succès des six critères ne devient donc ni égalité de tous les propriétaires ni égalité du graphe complet.

Le tableau reprend **les quatorze groupes de phases** du diagnostic. Les temps sont en millisecondes ; chaque effectif est identique avant et après.

| Phase diagnostique | Appels par côté | Total 0.40 → 0.41 | Médiane 0.40 → 0.41 | Variation de médiane |
| --- | ---: | ---: | ---: | ---: |
| `caller.checkpointWrites` | 19 | 53,263044 → 55,327520 | 2,594162 → 2,588272 | -0,227 % |
| `family.nativeState` | 163 | 112,912108 → 96,050483 | 0,026649 → 0,025558 | -4,094 % |
| `family.restore` | 702 | 16,154503 → 17,897344 | 0,008157 → 0,008312 | +1,900 % |
| `family.restoreNative` | 147 | 103,053651 → 94,209851 | 0,040480 → 0,041471 | +2,448 % |
| `inventory.captureCheckpointWitness` | 19 | 17,567551 → 17,119767 | 0,895894 → 0,949313 | +5,963 % |
| `inventory.unchangedCheckpointWorkingState` | 27 | 7,115820 → 7,463404 | 0,039268 → 0,028482 | -27,468 % |
| `knowledge.commit` | 142 | 5 901,996118 → 6 527,723075 | 4,697308 → 5,537719 | +17,891 % |
| `knowledge.stateValue` | 1785 | 1 278,691271 → 840,734869 | 0,003855 → 0,003966 | +2,879 % |
| `runtime.creation` | 1 | 93,757329 → 144,795450 | 93,757329 → 144,795450 | +54,436 % |
| `runtime.persistFamilies` | 19 | 3 016,563508 → 3 195,143503 | 153,208591 → 156,382353 | +2,072 % |
| `runtime.restoreFamilies` | 18 | 160,114790 → 150,582740 | 6,869792 → 7,272021 | +5,855 % |
| `shared.restoreOwned` | 12 | 18,342914 → 21,033786 | 0,808939 → 0,858724 | +6,154 % |
| `shared.unchanged` | 42 | 1,448174 → 1,485326 | 0,007065 → 0,007812 | +10,566 % |
| `shared.workingStamp` | 32 | 2,756662 → 3,776196 | 0,050810 → 0,067640 | +33,124 % |

Le rejeu instrumenté complet passe de **17 519,444418 à 18 572,071020 ms**, soit **+6,008 %**. La lecture/reconstruction `knowledge.stateValue` baisse en temps total, tout en présentant une médiane légèrement supérieure. La restauration d'Inventory baisse également dans son sous-groupe : sa médiane `restoreNative` passe de **3,130449 à 2,707604 ms**. À l'inverse, la médiane de `knowledge.commit` augmente de **17,891 %**, celle de la persistance commune de **2,072 %**, et celle de la restauration commune de **5,855 %**. Les totaux et médianes ne décrivent pas la même partie de la distribution ; les deux restent visibles.

Les profils CPU [avant](lot3b-smlp-cost-evidence/diagnostic/before-smlp.cpuprofile.gz) et [après](lot3b-smlp-cost-evidence/diagnostic/after-smlp.cpuprofile.gz), leurs résumés et leurs reçus de [copie avant](lot3b-smlp-cost-evidence/diagnostic/before-output-copy.json) et de [compression après](lot3b-smlp-cost-evidence/diagnostic/after-output-receipt.json) restent conservés. La compression représente les profils bruts sans perte. Les durées de méthodes imbriquées ne s'additionnent pas en temps exclusif. Une seule session instrumentée par source ne fournit ni p95, ni intervalle de confiance, ni preuve causale du budget, ni validation de stabilité mémoire. Ces résultats mixtes ont été consignés avant la fin de la fenêtre officielle ; aucune mesure favorable ne les remplace.

## Contrats et build sur le gel final

Le [périmètre formel déclaré](lot3b-smlp-cost-evidence/final/release-scope.json) rassemble 41 fichiers : les 35 contrats affectés précédents et six fichiers couvrant les copies d'Inventory, l'hydratation, le magasin de connaissances, les caches et le Kernel. Son [exécution complète](lot3b-smlp-cost-evidence/final/validation/delta-tests-run.json) réussit **1 379/1 379 tests**, avec **zéro échec, annulation, test ignoré ou tâche différée**. Il s'agit du périmètre affecté déclaré, pas d'une exécution de toute la suite historique. Le digest source final est inchangé pendant l'exécution.

Les [cinq vérifications](lot3b-smlp-cost-evidence/final/validation/checks-run.json) réussissent : typage, audit des entrées, audit de migration, vérification du diff et build. Elles portent le même gel `3edffde9…` et conservent les sorties brutes ainsi que l'empreinte du worker compilé. Les résultats ciblés antérieurs restent séparés ; ils ne remplacent pas ce passage formel du gel final.

## Régressions depuis 0.40 et incident de prérequis conservé

Les [manifestes copiés](lot3b-smlp-cost-evidence/input-copies.json) séparent la référence de coût 0.38 de la référence fonctionnelle 0.40. Le [manifeste des régressions](lot3b-smlp-cost-evidence/recorded-regression-cases.json) fixe :

| Cas | Décisions de référence | Retours publics | Résultat actuel |
| --- | --- | --- | --- |
| CATR | Campagne froide 0.40 : 12 actions, trois niveaux, huit préfixes | Trace publique correspondante 0.40 | **17/17** |
| RSWP | Rapport recomputé par 0.40 : 19 actions, trois niveaux, onze préfixes | Trace publique historique 0.38 inchangée | **17/17** |

La [prévalidation en lecture seule](lot3b-smlp-cost-evidence/recorded-regression-preflight.json) avait vérifié 31 commandes, 33 paquets complets, 336 images, 19 préfixes, 50 requêtes et six frontières naturelles, sans exécuter de rejeu.

Une première tentative de rejeu a échoué au chargement du module Pyodide **avant toute commande**, car le build qui préparait ce prérequis n'était pas encore terminé. Les deux exécutions en échec et leurs sorties restent intactes dans `prebuild-failed/regressions/` ; le [reçu de déplacement](lot3b-smlp-cost-evidence/prebuild-failed/relocation.json) donne leurs chemins initiaux, chemins conservés et empreintes. Après achèvement du build, les mêmes sources gelées et les mêmes entrées publiques ont été réutilisées. Cet incident de prérequis n'est ni un échec effacé ni une répétition de mesure de coût.

Le [résultat des rejeux après build](lot3b-smlp-cost-evidence/final/regressions/regression-summary.json) est **2/2, 34/34 contrôles historiques**, avec sources et entrées inchangées. Chaque commande est recomputée avant que l'hôte fournisse son retour public enregistré. Les critères portent sur les commandes, paquets publics complets et champs sélectionnés du comportement commun. Ils n'affirment pas l'égalité de tous les payloads propriétaires, identités dérivées, chaînes de graphe ou états nouvellement ajoutés. L'ancien résultat strict RSWP 0.38 → 0.39 à **16/17** et sa qualification restent conservés.

**Aucun contrôle supplémentaire de propriétaires passifs n'est revendiqué** : `passiveOwnerRequirements: []`, avec **zéro préfixe propriétaire passif contrôlé**. Le booléen de présence réussi pour cette liste vide n'ajoute pas de couverture aux 34 contrôles historiques. Ces deux rejeux restent des régressions sur retours enregistrés, distinctes d'une campagne live et d'une comparaison de vitesse.

## CATR : trois premiers niveaux conservés en campagne froide et dans l'interface

La [campagne froide sur le gel 0.41](lot3b-smlp-cost-evidence/final/catr-smlp-cost-session/execution-catr.json) réussit avec **12 actions, trois niveaux et huit plans**, sans solution attendue, état appris ni saut de niveau fourni à l'agent. Le journal passif conserve les commandes réelles et tous les retours publics ; le moteur de jeu reste une boîte noire. Son [rapport complet](lot3b-smlp-cost-evidence/final/catr-smlp-cost-session/catr-campaign.json.gz) et sa [trace publique](lot3b-smlp-cost-evidence/final/catr-smlp-cost-session/catr-public-trace.json.gz) identifient cette exécution propre à 0.41.

Le [contrôle navigateur](lot3b-smlp-cost-evidence/final/browser/browser-qa.json) confirme séparément les commandes visibles **Run**, **Pause**, **One action** et le passage naturel jusqu'au niveau 4. Il observe une pause pendant l'initialisation puis à une frontière d'action engagée, et termine avec les mêmes compteurs **12 / 3 / 8**. Les captures finales et l'arbre d'accessibilité sont conservés. Une première capture pleine page a expiré après observation du résultat ; deux captures du viewport ont ensuite réussi, sans relancer le jeu.

Cette observation porte sur le preview de développement géré, utilisant le code source gelé 0.41. Elle ne prouve pas une exécution du bundle publié en production, une victoire complète du jeu ou une performance de production. Les trois premiers niveaux de CATR constituent une réussite confirmée sur la correction ; cette correction de coût n'invente pas une nouvelle capacité de jeu.

## Résultat officiel 0.41 : 14/16, budget non conforme

Le [protocole définitif](lot3b-smlp-cost-evidence/performance/protocol.md) a été déclaré le **10 novembre 2026 à 03:27:40.663165 UTC**, avant toute mesure officielle. Son SHA-256 reste **`45a242dd01181244b73982ee74e198f58ebe0682bab116d4f66fa4dd607041f4`**. La [déclaration](lot3b-smlp-cost-evidence/performance/declaration.json) lie références, outils et source. Les [cas](lot3b-smlp-cost-evidence/performance/cases.json) et la [politique](lot3b-smlp-cost-evidence/performance/comparison-policy.json) sont des copies exactes des entrées 0.40 ; leur prose historique est explicitement qualifiée : A est **0.38 fraîchement remesurée**, B est **0.41**, et la référence fonctionnelle demeure **68/0.40**.

La [fenêtre](lot3b-smlp-cost-evidence/performance/window.json) s'est déroulée de **03:29:17.604801 à 03:38:41.399588 UTC**, dans l'ordre **A1/B1/B2/A2**. Elle a conservé **deux cohortes de quatre sessions par jeu et par version**, STCK10/SMLP15, soit **32 sessions et 400 actions mesurées**. Seules les **huit chauffes de trois actions**, soit 24 actions, sont exclues. Aucun échantillon mesuré, résultat de cohorte ou extrême n'est retiré. Les diagnostics, tests, builds, campagnes et contrôles navigateur étaient terminés et le preview arrêté. Les quatre commandes réussissent, avec intégrité de fenêtre `passed` ; ce statut ne vaut pas conformité du budget.

L'[agrégat des deux cohortes](lot3b-smlp-cost-evidence/performance/combined-comparison.json) retient **14/16 critères dans le seuil**, avec **deux `over_budget_with_noise_unresolved`** :

| Mesure | Médiane 0.38 fraîche | Médiane 0.41 | Variation | Décision |
| --- | ---: | ---: | ---: | --- |
| Persistance STCK | 169,327983 ms | 193,490900 ms | **+14,269890051 %** | **Non résolu** |
| Restauration SMLP | 4,907037 ms | 5,4576405 ms | **+11,220691835 %** | **Non résolu** |
| Acquisition et persistance SMLP | 1 046,0816115 ms | 934,704901 ms | −10,647038364 % | Conforme |
| Restauration STCK | 9,9928605 ms | 8,4364265 ms | −15,575460100 % | Conforme |
| Session STCK | 11 421,563532 ms | 11 440,935006 ms | +0,169604397 % | Conforme |
| Session SMLP | 18 372,584632 ms | 18 433,246848 ms | +0,330177910 % | Conforme |

L'acquisition/persistance SMLP respecte le seuil dans cette fenêtre, mais la restauration SMLP reste hors budget et la persistance STCK dépasse également la borne. Les anciennes réserves 0.40 ne sont pas réécrites. Les références ayant été remesurées à des moments différents, la comparaison de ratios entre fenêtres ne prouve pas un gain causal isolé 0.40 → 0.41. Les baisses locales et les faibles variations du temps de session ne compensent aucun dépassement.

| Cohorte | Résultat | Réserves conservées |
| --- | --- | --- |
| [C1](lot3b-smlp-cost-evidence/performance/cohort1/comparison.json) | **14/16**, `budget_review_required` | Persistance STCK **+20,788832583 %** ; restauration SMLP **+21,227161869 %** |
| [C2](lot3b-smlp-cost-evidence/performance/cohort2/comparison.json) | **14/16**, `budget_review_required` | Gardes de continuation STCK **+11,226585617 %** et SMLP **+25,651440529 %** |

Les deux cohortes restent intégrales ; aucune n'est choisie pour obtenir un verdict favorable. Le [bilan complet](lot3b-smlp-cost-evidence/performance/results.md) donne les seize médianes, les quatorze p95 disponibles, les dispersions, pauses et inspections. Un pic défavorable de garde STCK reste visible : **p95 de 0,302587 à 6,544347 ms**, maximum après **7,056963 ms**, alors que sa médiane agrégée reste conforme. Aucun extrême n'est écarté et aucun critère supplémentaire n'est inventé après mesure.

La [revue indépendante](lot3b-smlp-cost-evidence/performance/consolidation-review.json) passe **231 vérifications** et reproduit l'arithmétique des cohortes, de l'agrégat et des effectifs. Son **`status: passed`** confirme cette cohérence ; son **`budgetStatus: budget_review_required`** maintient l'échec de coût. Le seuil reste **+10 % pour chacune des seize médianes**, sans tolérance ajoutée pour le bruit. Les comparateurs et les quatre rapports mesurés restent inchangés ; aucune mesure supplémentaire n'a été lancée pour cette consolidation.

## État des obligations restantes

| Obligation | État actuel |
| --- | --- |
| Source corrigée et archive | **Gel final identifié : 249 fichiers natifs, archive 260** |
| Contrats affectés | **1 379/1 379 tests dans 41 fichiers** |
| Typage, audits, diff et build | **5/5** |
| Diagnostic SMLP normal avant/après | **6/6 dans le périmètre déclaré ; temps mixtes ; égalité finale stricte fausse** |
| Rejeux CATR/RSWP depuis les rapports 0.40 | **2/2, 34/34 historiques ; aucun contrôle propriétaire passif supplémentaire** |
| Campagne froide et interface CATR | **Trois premiers niveaux, 12 actions, huit plans dans chaque observation** |
| Fenêtre officielle | **Terminée : 32 sessions, 400 actions ; budget non conforme 14/16, deux réserves** |
| Comparaisons, agrégat et revue indépendante | **C1 14/16, C2 14/16, agrégat 14/16 ; revue 231 vérifications réussies, sans validation du budget** |
| Intégrité finale, index et publication privée | **En attente** |

## Prochaine étape ciblée

La prochaine revue examinera l'évitement d'`Object.entries` pour les tableaux denses certifiés `immutableJson` dans `canonical.encode` ; le travail `jsonEntries` et le GC observés dans le profil CPU SMLP ne prouvent pas la cause du dépassement STCK. Elle examinera aussi la normalisation, la validation du contexte et les copies d'Inventory pour la restauration SMLP, en conservant toutes les garanties et en exigeant une nouvelle source gelée avant toute nouvelle comparaison complète.

Les **50/76 entrées raccordées**, **2/6 branches de composition observée** et **37 workflows compilés** restent les compteurs publiés. Cette correction ne revendique aucune nouvelle entrée fonctionnelle. La [feuille de route complète](v6-delivery-roadmap.md) reste ouverte sur 3B jusqu'à satisfaction de toutes les obligations fonctionnelles et du budget annoncé ; `exposed_reception_plan` vient ensuite. Les sessions finies ne prouvent ni la stabilité de plusieurs heures ni la latence réseau et navigateur de production.
