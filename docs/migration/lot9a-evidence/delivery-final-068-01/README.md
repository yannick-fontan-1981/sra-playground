# Lot 9A : livraison fonctionnelle qualifiée sous l’identité finale 0.68

La qualification des formes de travail et des graphes est terminée dans le périmètre déclaré. Le candidat **0.68.0** conserve **334 fichiers natifs**, digest `e7a94fbc7cdcb19d8704b5d4120f27a858cbcd07e455084711510ee147f4e653`. Il raccorde **70/76 entrées, dont 27/33 matérielles**. Le prédécesseur comparé est exactement **Site 108 / native 0.67.0**, source `8462204043aa368faa7df280d796bb706eb53b38`, à 69/76.

Le [bilan vérifiable](validation-summary.json), la [réconciliation finale](final-reconciliation.json) et la [revue indépendante de conclusion](independent-delivery-review.json) distinguent cette qualification fonctionnelle du coût et de la publication. Le site en production reste 108 / 0.67, avec son accès privé au propriétaire. **Aucune mesure officielle ni publication 0.68 n’est revendiquée.**

## Résultats établis

| Volet | Résultat | Preuve |
| --- | --- | --- |
| Identité finale | Seul le littéral 0.67 → 0.68 change depuis les algorithmes qualifiés. Trois fichiers Chart ajoutés et seul le runtime modifié parmi les fichiers du publié. | [Réconciliation d’identité](identity-reconciliation.json) |
| Inventaire réel des fabriques | 62 → 63 propriétaires ; 28 → 29 programmes familiaux. Seuls `public_chart_navigation` et `v6.chart_navigation.choose` sont ajoutés. Les éléments antérieurs gardent leur ordre. | [Inventaire](work-inventory-01/owner-source-inventory.json) |
| Quatre formes STCK/SMLP par rôle | 8 sessions froides, 62 retours. Les commandes calculées concordent avec les traces avant chaque retour. | [Capture A](work-baseline-01/baseline.receipt.json), [capture B](work-candidate-01/candidate.receipt.json) |
| Lecture appariée finale | **64 contrôles sur 58 points ; 28 279 différences attribuées, zéro inexpliquée.** Les snapshots, propositions, décisions, états, tickets et graphes complets sont conservés. | [Lecture v2](work-qualify-02/graph-review.json), [formes](work-qualify-02/work-forms.json) |
| Chaînes Chart communes | **5 sessions, 9 retours, 52 points, 21 graphes uniques complets**. Six acquisitions actives, deux passives et une ablation. | [Qualification common](common-qualify-01/review/qualification.json) |
| Restauration | 9 restaurations de faits source, 19 appels `restoreNative`, deux resets froids contrôlés comptés séparément. Les cinq instances sont fermées. | [Revue de cohérence des résultats](common-results-review.json) |
| Build et registre | Build final avec TypeScript passé ; 74 fichiers, 30 149 887 octets, empreintes toutes réconciliées. Audit d’entrées frais : identité 0.68 et 70/76. | [Build](build-01/receipt.json), [manifeste](build-manifest.json), [audit](final-entry-audit-01/receipt.json) |

Les **175 tests historiques dans huit modules** restent attachés à leur gel original. Leur réutilisation repose sur la réconciliation des algorithmes, sans présenter ces 175 résultats comme de nouvelles exécutions 0.68. Le rapport de migration antérieur conserve 219 composants vérifiés, 149 transferts partiels, 1 001 modules en attente et zéro erreur ; ses six portes globales restent fausses.

Le worker final est `dist/assets/v6-agent-worker-BQvVnNgs.js`, SHA-256 `fe31e2caff224557a8bd97bcdb541be7c0f61049317b8dee1e5b4ef3be2c0478`. Ce build ne constitue pas à lui seul une qualification du trajet public positif de Chart.

## Premier refus conservé et correction du lecteur

La [première lecture](work-qualify-01/graph-review.json) reste en échec : ses 58 écarts inexpliqués concernent exactement `/whyAct/decision/total_ms`. La correction a été déclarée [avant sa deuxième exécution](work-reader-amendment-v2.json), sous le même budget `work-qualify`. Les deux lectures totalisent **101,757378051 secondes**, sous le plafond cumulé de 600 secondes, avec deux essais au maximum et 300 secondes actives au maximum par essai.

Le v2 relie chaque rapport au producteur réel et à une unique trace `src_decision` complète, persistée avant l’ajout de la durée. Par rôle, **21 créations** sont bornées par l’intervalle monotone de leur appel et la croissance du compteur actif ; **37 rétentions** conservent exactement le rapport entier, durée comprise. La seule attribution ajoutée porte sur ce scalaire. Les deux timestamps internes du bridge n’ont pas été capturés séparément : la durée est bornée, sans prétendre la recalculer.

Les deux captures et les outils initiaux restent inchangés. Tous les écarts bruts et le premier refus sont conservés. Les trois avis de préparation sont distincts de la revue de conclusion : [work initial](../work-delivery-preparation-review.json), [common](../delivery-preparation-review.json), [correctif v2](../work-reader-v2-review.json).

## Comptes et limites

Cette étape ajoute **13 sessions et 71 retours**. Les dix sessions et quatorze retours communs antérieurs restent dans le registre, soit **23 sessions et 85 retours** dans le périmètre suivi. Trois fabriques supplémentaires sans initialisation sont comptées séparément : deux pour l’inventaire et une pour l’audit du registre. Les deux fabriques antérieures restent conservées. Ce registre ne prétend pas sommer toutes les campagnes historiques du projet.

L’ancien libellé `maximumSessions:8` reste une réserve, car il ne précisait pas le cumul. Aucun compteur n’est remis à zéro. Les deux échecs de clôture de l’oracle et la récupération indépendante du corpus restent conservés, sans troisième oracle.

Une [qualification documentaire](work-case-metadata-qualification.json) corrige la portée du libellé `historicalCaseRowsExact` : les six champs d’exécution sont strictement identiques, mais les descriptions `purpose` ont changé. Aucun travail de capture n’en dépend.

La première génération du bilan s’est arrêtée sur l’ordre canonique des chemins. Les 334 empreintes de fichiers concordaient déjà ; seul le tri des clés du générateur documentaire a été corrigé. Le [reçu de cette correction](documentation-reconciliation-correction.json) et les octets du générateur initial sont conservés. La réconciliation corrigée passe sans nouveau moteur, lecteur fonctionnel, session ou retour.

L’ablation passe de l’offre `homologous_marker` à `annotation_dependency`, tout en conservant **ACTION4**. Elle démontre une différence d’offre, sans revendiquer une différence de commande. Les preuves Chart utilisent le caller natif et les rasters originaux 64 × 64, sans adaptation ; le trajet public positif via service, worker et tickets reste une qualification distincte. Aucun nouveau niveau officiel résolu n’est revendiqué. La validation des checkpoints demeure structurelle, sans garantie d’authenticité ni de borne supérieure face à une future trame artificiellement incompatible.

## Suite et règle de coût

La prochaine étape est la comparaison officielle STCK/SMLP contre le prédécesseur réellement publié, relu avant la fenêtre. **Chaque médiane globale de session complète doit rester strictement sous +10 % d’augmentation, pour chaque jeu séparément. Une phase au-dessus de +10 % est acceptable si les deux globaux passent.** Aucun échantillon mesuré ne sera retiré et aucune compensation entre jeux n’est admise.

La publication privée de 0.68 suit cette qualification de coût. Les mesures officielles et la publication gardent une exclusivité courte, libérée par son détenteur. Le développement, les contrôles fonctionnels, les commits et les sauvegardes continuent sans verrou global ni attente de disponibilité. Aucun verrou n’a été acquis pour ce jalon. LKEY reste définitivement fermé.

Après cette livraison, poursuivre 9B `region_intervention`, puis 9C `joint_channels`. La [feuille de route générale](../../v6-delivery-roadmap.md) conserve aussi l’état des lots 7, 6, 10 et de la consolidation 11.
