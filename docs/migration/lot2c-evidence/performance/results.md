# Lot 2C : coûts observés

## Comparaison commune initiale

La [comparaison initiale](comparison.json) conserve **14 médianes sur 16 dans le budget de +10 %**. Deux métriques STCK dépassent cette limite : continuation complète du service **+12,43 %** et requête de continuation **+12,17 %**. Le comparateur les classe `over_budget_with_noise_unresolved`. Le bruit ne relève pas le seuil et ces observations ne sont pas effacées.

La référence est le résultat 0.34 déjà mesuré pour le lot 2B, réutilisé octet pour octet avec son [reçu de provenance](baseline-reuse.json). La mesure 0.35 utilise exactement le même runner, le même chemin de manifeste, les mêmes traces et déclarations, la même description d'environnement et les mêmes comptes de travail. L'exécution réservée dure de **20:28:49.832 à 20:37:50.632 UTC**, le 9 novembre 2026 ; aucun test, export, build, jeu navigateur ou campagne du projet n'est lancé en parallèle. L'hôte reste partagé et son activité externe n'est pas isolée.

| Session, médiane de trois répétitions | Référence 0.34 | Version 0.35 | Variation observée |
| --- | ---: | ---: | ---: |
| STCK, 10 actions | 11,821 s | 12,739 s | +7,77 % |
| SMLP, 15 actions | 28,098 s | 27,416 s | −2,43 % |
| LIFE, 49 actions | 128,367 s | 122,722 s | −4,40 % |

Chaque version représente **222 actions mesurées** et neuf actions d'échauffement. Les commandes sont recalculées avant la présentation de leurs retours publics enregistrés. Les durées de jeu réel et de rendu navigateur sont hors mesure. Une médiane globale plus faible ne neutralise pas la hausse d'un chemin particulier.

| Métrique STCK initialement hors budget | Référence | Version 0.35 | Variation |
| --- | ---: | ---: | ---: |
| Continuation complète du service | 21,687 ms | 24,384 ms | +12,43 % |
| Requête de continuation, transport compris | 23,652 ms | 26,530 ms | +12,17 % |

La dispersion relative entre médianes de répétitions est respectivement de **11,51 % puis 32,44 %** pour le service, et **12,58 % puis 31,41 %** pour la requête. Elle justifie un contrôle ciblé ; elle ne démontre pas à elle seule l'absence de régression.

Les hausses hors des seize médianes soumises au budget restent également au bilan. Le p95 de nouvelle décision SMLP passe de **3 360,154 à 3 747,320 ms**, soit **+11,52 %**, sur 27 échantillons. Sur LIFE, la médiane de garde passe de **28,710 à 31,937 ms** (**+11,24 %**, six échantillons) et celle de restauration de **7,896 à 9,876 ms** (**+25,08 %**, 282 échantillons). L'inspection LIFE passe de **1 202,774 à 1 275,482 ms** côté service, et de **2 225,930 à 2 339,282 ms** avec transport. Ces observations ne sont pas annulées par la diminution de sa médiane de session. La dispersion des médianes de restauration LIFE était de 91,30 % dans la référence, contre 12,92 % après ; cette variation limite l'interprétation causale du ratio sans changer les valeurs retenues.

## Suivi ciblé STCK

Un unique suivi apparié est déclaré dans [stck-followup/README.md](stck-followup/README.md), avant son exécution : nouvelle mesure de V62 puis nouvelle mesure de 0.35, cinq sessions de dix actions par version après trois actions d'échauffement. Le même runner et la même limite de 10 % sont conservés. Les huit métriques STCK sont rapportées, pas uniquement les deux excès initiaux. La mesure initiale demeure disponible et le suivi ne remplace pas les résultats SMLP/LIFE.

Le [suivi achevé](stck-followup/comparison.json) reste **`budget_review_required` : trois médianes sur huit conformes, cinq hors budget**. Les deux processus terminent normalement ; l'environnement déclaré, les entrées du harnais et les comptes de travail concordent. La [fenêtre enregistrée](stck-followup/execution-window.json) conserve les deux exécutions et leurs empreintes. Aucun nouvel essai n'est sélectionné pour obtenir un ratio plus favorable.

| Médiane STCK du suivi | Référence 0.34 fraîche | Version 0.35 fraîche | Variation | Échantillons par version | Budget +10 % |
| --- | ---: | ---: | ---: | ---: | --- |
| Session complète | 11 710,381 ms | 12 674,846 ms | +8,24 % | 5 | Respecté |
| Nouvelle décision | 300,954 ms | 326,486 ms | +8,48 % | 30 | Respecté |
| Continuation complète du service | 20,357 ms | 25,596 ms | +25,74 % | 20 | Dépassé |
| Requête de continuation | 22,098 ms | 27,682 ms | +25,27 % | 20 | Dépassé |
| Garde de continuation | 0,212 ms | 0,241 ms | +13,61 % | 20 | Dépassé |
| Acquisition et persistance | 1 051,835 ms | 1 031,810 ms | −1,90 % | 30 | Respecté |
| Persistance | 182,006 ms | 219,621 ms | +20,67 % | 65 | Dépassé |
| Restauration | 10,351 ms | 12,053 ms | +16,45 % | 60 | Dépassé |

Les cinq dépassements restent classés `over_budget_with_noise_unresolved`. La dispersion ne permet pas d'attribuer toute la hausse au code ou à l'hôte, et ne permet pas non plus de l'écarter comme simple bruit. La médiane de session reste dans le budget ; cela n'annule pas les cinq résultats par chemin. Les p95, extrêmes, inspections et points Pause restent disponibles dans la comparaison complète.

**Décision de livraison : le fonctionnel 2C est disponible, avec réserve de coût. Le sous-lot reste ouvert.** La prochaine priorité est d'isoler les contributions de la continuation, de la persistance et de la restauration sur ce même travail, puis de corriger une cause établie et de vérifier le budget inchangé. Aucun gain, cause unique ou correction de performance n'est revendiqué par cette livraison.

## Douze coûts absolus du nouveau domaine

Le [diagnostic distinct](managed-component-results.md) passe **douze cas positifs**, avec 36 appels d'échauffement et **240 appels mesurés**. Les sorties, l'enrichissement des faits et les prémisses inchangées sont vérifiés contre leurs attentes originales après chaque intervalle chronométré. Le natif, les fixtures, le runner et son [protocole](managed-component-protocol.md) gardent leurs empreintes. Exécution unique : **20:38:57.672 à 20:39:00.519 UTC**, après la fenêtre commune et avant le suivi STCK.

| Composant | Médiane observée selon le cas |
| --- | ---: |
| Projection publique, deux cas | 0,441 à 0,699 ms |
| Recherche finie, trois cas | 0,869 à 2,270 ms |
| Mesures géométriques complètes, quatre cas | 10,211 à 26,836 ms |
| Approche avec sonde différée | 6,621 ms |
| Approche sans sonde différée | 6,558 ms |
| Reprise d'entrée | 0,237 ms |

Ces composants chauds reçoivent des prémisses de méthode, de jauge ou de retour explicitement déclarées. Ce diagnostic ne mesure pas l'acquisition par un Kernel initialement vide, la sélection complète, WHY/ACT, la persistance, le transport ou le rendu. Les intervalles imbriqués ne s'additionnent pas. Le p95 empirique sur vingt appels, conservé dans le rapport détaillé, n'est pas un intervalle de confiance. Aucun ratio de gain avec une branche absente de V62 n'est fabriqué.

## Limites communes

Les inspections mesurent le service et le transport, sans rendu de l'inspecteur. Pause couvre les deux points fixes du protocole, début de planification et première action engagée, sans borne revendiquée pour toute recherche longue. Les répétitions partagent un processus chaud mais recommencent avec une connaissance froide. Le p95 est omis sous vingt échantillons. Les mesures imbriquées ne s'additionnent pas ; les ratios restent propres à ce travail et à cet environnement. Une session LIFE finie ne prouve ni une stabilité de mémoire sur plusieurs heures ni une absence générale de fuite.
