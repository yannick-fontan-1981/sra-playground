# Lot 3B : correction des coûts communs d'état en native 0.42

## État de la livraison

**Native 0.42.0 est fonctionnellement validée avec une réserve de coût : 14/16 critères conformes. Le lot 3B reste ouvert.** Les deux points visés dans la livraison précédente rentrent dans le seuil de cette nouvelle fenêtre : persistance STCK **−8,261037 %** et restauration SMLP **+6,223866 %** face à la référence 0.38 fraîche. Deux dépassements subsistent sur STCK : service d'un préfixe connu **+27,720363 %** et requête correspondante **+26,350748 %**. La source gelée passe les **1 396 tests du périmètre affecté**, les contrôles de projet, les régressions CATR/RSWP et les trois niveaux CATR en campagne froide et dans le navigateur.

Le point de départ est **SRA Playground 69 / native 0.41.0**, commit `c1d5e044dce6291b3eee7320f29663ec5b80ea85`, digest natif `3edffde9b21f4fc8af9dda9a1dbd40707c015d9f7cba8a41460021e39acb7605`. Son [résultat officiel conservé](lot3b-smlp-cost-evidence/performance/results.md) est **14/16** : la persistance STCK dépasse la référence 0.38 fraîche de **14,269890051 %**, et la restauration SMLP de **11,220691835 %**. Les autres résultats et toutes les sessions historiques restent conservés.

Le [gel 0.42](lot3b-state-cost-evidence/final/source-manifest.json) contient **249 fichiers natifs**, digest **`2de70025ae08845efd491929416e091e9dc9e8e4b473440b9c6a86838e0b3d19`**. Son [archive des sources d'exécution](lot3b-state-cost-evidence/final/source-archive.json) contient 260 fichiers, restituables depuis ses [parties vérifiables](lot3b-state-cost-evidence/final/source-archive-parts.json). Les 553 fichiers de sources et tests liés à la validation sont empreintés séparément dans le [reçu formel](lot3b-state-cost-evidence/final/validation/delta-tests-run.json) ; l'archive d'exécution ne prétend pas contenir tous les tests. Le moteur conserve ses mécanismes de décision ; la correction porte sur la représentation, la validation et la copie des états communs.

## Réduire les allocations de validation sans perdre le snapshot du parent

[canonical.ts](../../src/logos-engine/canonical.ts), [v6-native-state-graph.ts](../../src/logos-engine/v6-native-state-graph.ts) et [v6-native-owned.ts](../../src/logos-engine/v6-native-owned.ts) évitent de construire un objet intermédiaire contenant tous les descripteurs des propriétés, puis plusieurs collections dérivées de cet objet. Chaque descripteur reste lu individuellement ; **tous les descripteurs du parent sont recueillis avant de parcourir ses enfants**. Un enfant ne peut donc pas modifier rétroactivement la valeur d'un frère déjà capturée.

Aux frontières de canonicalisation, d'encodage et de rétention, les accesseurs étrangers restent refusés sans être invoqués par cette validation. Cette propriété ne fait pas de l'hydratation brute une API de rejet universel des accesseurs. Les propriétés symboliques, cachées, les tableaux creux ou décorés et les limites structurelles conservent leurs contrôles. Les noms d'indices sont normalisés après acquisition des descripteurs pour reproduire l'ordre de l'ancien objet intermédiaire, même lorsqu'un Proxy valide fournit ses clés dans un autre ordre. Les tableaux denses ordinaires gardent un contrôle direct de leurs indices contigus.

L'encodage peut relire directement les propriétés d'un objet portant déjà la provenance privée d'`immutableJson`. Cette reconnaissance ne s'étend pas à un objet simplement gelé par l'appelant. Les nombres, la profondeur, les références et les identités de fragments restent soumis à leurs contrôles. Les tableaux d'entrées locaux sont triés sur place lorsque leur propriétaire est l'appel courant, ce qui évite une copie supplémentaire sans modifier les octets canoniques attendus.

## Copier les états hydratés avec une provenance fermée

Le décodeur du graphe conserve dans un `WeakSet` privé l'identité des tableaux et objets **qu'il construit lui-même**, après décodage de leurs membres. Seul un prédicat de lecture, `isHydratedNativeJson`, est exposé. Une enveloppe reçue, un objet étranger gelé ou une validation par `retainNativeJson` ne peuvent attribuer cette provenance.

La fonction commune `copyNativeValue` utilise cette provenance, ou celle d'`immutableJson`, pour produire directement une copie mutable. Elle préserve les références partagées à l'intérieur d'une copie, les nombres exacts dont `-0`, les chaînes, l'ordre des membres et les propriétés littérales telles que `__proto__`. Deux appels produisent des propriétaires distincts ; aucun résultat mutable n'est mis en cache. Les autres objets passent toujours par `structuredClone`, y compris les collections personnalisées, les accesseurs, les cycles et les proxies étrangers. Les fonctions et symboles conservent leur rejet ; les valeurs scalaires clonables gardent leur représentation.

Cette copie commune est consommée par la restauration du tracker dans [v6-inventory-project.ts](../../src/logos-engine/v6-inventory-project.ts), les champs préparés dans [v6-observed-inventory.ts](../../src/logos-engine/v6-observed-inventory.ts), et les copies du [contexte d'inventaire](../../src/logos-engine/v6-inventory-caller-context.ts). Elle ne donne aucune nouvelle autorité de réutilisation à un checkpoint. Les témoins de l'état mutable, les révisions, la normalisation, la préparation atomique des propriétaires et l'ordre d'acquisition restent présents. Les restaurateurs personnalisés conservent leur dispatch et leurs copies détachées.

## Durcissement explicite des graphes malformés

L'hydratation construit ses propres tableaux denses par parcours explicite. Une méthode `map` fournie sur le tableau d'entrée ou un constructeur `Symbol.species` ne peuvent choisir le conteneur qui recevra la provenance privée. Les regroupements `concat` et `merge` suivent la même règle de construction fermée.

Ce changement corrige également une acceptation indue : l'ancien parcours par `map` pouvait ignorer un trou dans les membres d'un graphe. Le nouveau parcours visite chaque position et refuse sa valeur manquante. **Il s'agit d'un durcissement de validation des graphes malformés**, et non d'une affirmation d'équivalence sur toutes les entrées JavaScript. L'encodeur refusait déjà les tableaux creux ; les contrôles de fragments manquants ou modifiés, de hash, de cycles et de profondeur ne sont pas supprimés.

## Périmètre et premières preuves

Les modifications de production ne comportent aucune décision liée à un identifiant de jeu, à un niveau ou à une solution préparée. La comparaison Git en lecture seule de `reference/` avec la publication 69 ne montre aucune modification : les sources de référence V5/V6 restent conservées. Cette correction n'ajoute aucune entrée fonctionnelle au registre.

Le [reçu des tests ciblés de restauration](lot3b-state-cost-evidence/diagnostic/restoration-tests.json) conserve **216 tests réussis sur 216**, ainsi que l'exécution de développement précédente à 215 tests, avant le dernier correctif d'ordre des clés. Il s'agit de tests de développement ; leur empreinte source a été enregistrée après l'exécution. Ils ne remplacent pas le passage formel sur le gel final. Le [nouveau fichier de contrats](../../tests/v6-native-copy.test.ts) confronte notamment les copies à `structuredClone`, vérifie les alias, l'indépendance des copies, les entrées étrangères et les descripteurs réordonnés.

Le [périmètre formel](lot3b-state-cost-evidence/final/release-scope.json) rassemble **42 fichiers de tests**, soit les 41 contrats affectés conservés et les nouveaux contrats de copie. L'[exécution sur le gel final](lot3b-state-cost-evidence/final/validation/delta-tests-run.json) passe **1 396/1 396 tests**, sans échec, annulation, test ignoré ni TODO ; les sources et tests restent inchangés. Ce périmètre n'est pas la totalité de la suite historique. Les [cinq contrôles du projet](lot3b-state-cost-evidence/final/validation/checks-run.json) passent : typage, audits des entrées et de migration, vérification du diff et build.

Les [régressions déclarées contre 0.41](lot3b-state-cost-evidence/recorded-regression-cases.json) passent **34/34 critères historiques, deux cas sur deux**, dans le [résumé](lot3b-state-cost-evidence/final/regressions/regression-summary.json). CATR conserve **12 actions, trois niveaux, huit préfixes** ; RSWP **19 actions, trois niveaux, onze préfixes**. Chaque commande est recalculée avant son retour public enregistré. Les retours RSWP restent la trace publique historique 0.38, tandis que ses décisions de référence ont été recomputées par 0.41. Les critères couvrent les champs déclarés du comparateur ; ils ne prouvent pas l'égalité du graphe complet ou de tous les payloads propriétaires. La liste des exigences de propriétaires passifs est vide et n'ajoute aucune couverture.

### CATR confirmé en session neuve et dans l'interface

La [campagne froide](lot3b-state-cost-evidence/final/catr-state-cost-session/execution-catr.json) atteint naturellement le niveau 4 : **trois niveaux terminés, 12 actions, huit plans et une session**. Aucun état appris, trajet, solution ni saut de niveau n'initialise le moteur. Le jeu complet reste `NOT_FINISHED` ; cette campagne confirme la capacité existante de CATR et n'est pas une nouvelle capacité attribuée aux optimisations.

| Niveau terminé | Actions du niveau | Actions cumulées | Plans cumulés |
| --- | ---: | ---: | ---: |
| 1 | 3 | 3 | 2 |
| 2 | 4 | 7 | 5 |
| 3 | 5 | 12 | 8 |

Le [contrôle navigateur](lot3b-state-cost-evidence/final/browser/browser-qa.json) confirme séparément les mêmes compteurs. Les contrôles visibles produisent une pause initiale, les actions unitaires 1 et 2, une reprise jusqu'à la première frontière, l'action 4, puis une pause à l'action 5 après acquisition de son résultat. Les reprises atteignent les frontières **7/2/5** puis **12/3/8**. L'inspecteur reste fermé. La [capture](lot3b-state-cost-evidence/final/browser/catr-three-levels.png) montre le résultat du preview de développement utilisant les sources gelées ; le build de production est vérifié séparément.

## Diagnostics de comportement et réserve sur les temps locaux

Les [comparaisons STCK et SMLP](lot3b-state-cost-evidence/diagnostic/results.md) passent chacune leurs **six critères bornés** : mêmes générateur, entrées, cas, commandes, quatre états propriétaires retenus et champs de requête sélectionnés. Les effectifs par méthode et les résultats des témoins sont inchangés. **`strictFinalEquality: false` reste conservé dans les deux cas** ; aucun résultat ne devient une égalité globale de tous les états.

Les médianes diagnostiques de persistance diminuent, tandis que celles de restauration augmentent de **4,459 % sur STCK** et **26,307 % sur SMLP**. Tous les groupes et toutes les variations restent dans le rapport. Ces temps ne constituent pas une attribution causale : la [réserve d'isolation](lot3b-state-cost-evidence/diagnostic/isolation-deviation.json) consigne que de courts tests avaient été autorisés pendant la programmation des profils de référence ; leurs heures exactes ne permettent pas d'établir ou d'exclure un chevauchement. Les profils et résultats sont conservés à l'identique, sans remplacement par une répétition favorable.

## Budget officiel : 14/16, deux critères de continuation STCK non résolus

La [fenêtre officielle](lot3b-state-cost-evidence/performance/window.json) est terminée sur une référence **0.38 fraîchement remesurée**, dans l'ordre déclaré **A1/B1/B2/A2**. Elle conserve les deux cohortes, **huit sessions par jeu/version, 32 sessions et 400 actions mesurées**, avec le seuil inchangé de **+10 % pour chacune des seize médianes**. Les huit chauffes de trois actions sont les seules exclusions prévues. Les prérequis fonctionnels étaient terminés et le preview arrêté avant le premier passage ; le [reçu préalable](lot3b-state-cost-evidence/performance/readiness.json) et le [protocole](lot3b-state-cost-evidence/performance/protocol.md) sont conservés.

L'[agrégat](lot3b-state-cost-evidence/performance/combined-comparison.json) conserve **`budget_review_required`, 14/16**, sans session écartée, retrait d'extrême ni tolérance de bruit ajoutée. Les durées sont regroupées depuis les observations originales avant tout calcul ; il ne s'agit pas d'une moyenne des deux résultats de cohorte.

| Phase | Médiane 0.38 fraîche | Médiane 0.42 | Variation | Décision agrégée |
| --- | ---: | ---: | ---: | --- |
| Persistance STCK, 104 observations/version | 179,444488 ms | 164,620512 ms | **−8,261037 %** | Conforme au seuil |
| Restauration SMLP, 144 observations/version | 5,1182095 ms | 5,436760 ms | **+6,223866 %** | Conforme au seuil |
| Service de préfixe connu STCK, 32 observations/version | 8,844152 ms | 11,295783 ms | **+27,720363 %** | **Non résolu** |
| Requête de préfixe connu STCK, 32 observations/version | 10,5221265 ms | 13,2947855 ms | **+26,350748 %** | **Non résolu** |
| Session STCK, huit sessions/version | 11 507,6884395 ms | 9 459,8053905 ms | **−17,795781 %** | Conforme au seuil |
| Session SMLP, huit sessions/version | 18 844,4015975 ms | 16 311,280257 ms | **−13,442302 %** | Conforme au seuil |

Les deux dépassements STCK sont présents dans **chacune des deux cohortes**. La première passe **14/16**, avec service **+26,748000 %** et requête **+27,364775 %** ; la seconde passe **13/16**, avec service **+13,141428 %**, requête **+11,737054 %** et garde **+13,578554 %**. La médiane agrégée du garde STCK reste conforme à **+6,896310 %** ; ce résultat ne supprime pas son dépassement de cohorte 2. Les deux anciennes cibles sont dans le seuil des deux cohortes et de leur agrégat.

Le [bilan complet](lot3b-state-cost-evidence/performance/results.md) conserve les seize médianes, les effectifs, les distributions et les p95. Les pointes défavorables restent visibles : p95 du garde SMLP **0,756828 → 7,512366 ms**, malgré une médiane conforme ; p95 de nouvelle décision SMLP **800,527360 → 892,998337 ms** ; service STCK **11,184791 → 15,736011 ms** et requête STCK **13,319492 → 20,205342 ms**. Le budget déclaré porte sur les médianes, ce qui n'annule pas ces limites de latence. Aucun p95 de session n'est calculé avec seulement huit observations par version.

La [revue indépendante](lot3b-state-cost-evidence/performance/consolidation-review.json) passe **231/231 contrôles**, confirme les 32 sessions uniques, 400 actions et les calculs, puis conserve le même verdict **14/16**. Les phases sont imbriquées et leurs durées ne s'additionnent pas. Les observations internes d'une session sont corrélées. Les variations mesurent 0.42 contre 0.38 dans cette fenêtre ; elles ne comparent pas directement les durées des anciennes fenêtres 0.41. Le qualificatif `over_budget_with_noise_unresolved` n'est pas une exemption. Ces mesures sur retours publics enregistrés ne démontrent ni la cause exacte des hausses, ni une vitesse de jeu live, ni une stabilité sur plusieurs heures.

## Diagnostic suivant préparé depuis les mesures conservées

L'[analyse a posteriori de la continuation](lot3b-state-cost-evidence/diagnostic/known-prefix-followup.md) localise le périmètre du prochain travail sans exécuter une nouvelle fenêtre. Les 32 avances STCK par version correspondent aux mêmes quatre positions d'un préfixe dans huit sessions. Elles ne contiennent aucun appel instrumenté de nouvelle décision, acquisition, persistance ou restauration. La médiane du service après soustraction de sa garde **requête par requête** passe de **8,600408 à 11,0457345 ms** ; le résidu requête moins service passe de **1,7717115 à 1,893720 ms**. Les médianes de ces composantes ne s'additionnent pas.

Cette décomposition situe l'augmentation principalement dans le service hors garde mesurée. Elle ne désigne pas sa cause. Les postes à instrumenter sont la validation et les copies du paquet public, le hash de l'image, la copie de l'observation par le runtime, la mesure de ses composantes, puis la construction et le détachement du snapshot. Les modules de service concernés sont inchangés entre les versions ; un effet indirect des données, des allocations ou de l'environnement reste possible. La réutilisation éventuelle d'une observation validée doit conserver une provenance privée et le chemin complet pour les objets étrangers. Aucun de ces candidats n'est annoncé comme correctif livré.

## Décision de livraison et suite

La livraison fonctionnelle de **0.42.0** conserve explicitement la réserve de coût. **3B reste ouvert ; `exposed_reception_plan` (3C) attend sa clôture.** La prochaine étape est de diagnostiquer le travail du service et de la requête de préfixe connu, puis d'appliquer une correction générique vérifiable. Elle devra conserver les gardes, témoins de connaissance, identités de requête, copies détachées et acquisitions. Un nouveau code matériellement modifié, un nouveau gel et une fenêtre préalablement déclarée seront nécessaires ; aucune répétition officielle du gel inchangé ne remplace le résultat présent.

La [feuille de route actualisée](v6-delivery-roadmap.md) garde **50/76 entrées raccordées, 26 restantes, 37 workflows compilés et 2/6 branches d'`observed_composition_services`**. Cette correction de coût n'ajoute aucune capacité de jeu. Les preuves historiques 0.39, 0.40 et 0.41, leurs échecs et leurs limites restent conservés. L'[index de cette livraison](lot3b-state-cost-evidence/README.md) relie la source gelée, les validations, les campagnes, les diagnostics et les coûts ; l'[intégrité finale](lot3b-state-cost-evidence/final/delivery-integrity.json) vérifie leurs entrées et la reconstruction exacte des rapports segmentés.
