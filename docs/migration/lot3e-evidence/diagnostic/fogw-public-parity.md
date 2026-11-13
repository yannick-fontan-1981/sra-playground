# FOGW : comparaison publique froide, avec adaptations natives déclarées

## Verdict

La revue indépendante passe **1 112 contrôles sur 1 112**. Elle conserve deux résultats différents : l'original intact concorde sur les quinze premiers retours, puis refuse son registre d'attente hors domaine ; l'enveloppe native déclarée autour des mêmes méthodes originales concorde sur les cinquante retours de la campagne.

| Chemin relu | Préfixes | Retours réels déjà acquis | Restaurations propres | Contrôles | Résultat |
| --- | ---: | ---: | ---: | ---: | --- |
| Original Python intact | 7 | 15 | 7 | 255 | Accord exact sur ce préfixe ; exception originale à la révision 16 |
| Méthodes originales avec enveloppe native déclarée | 27 | 50 | 27 | 849 | Aucune différence avec la couche native et les événements capturés |
| Liaison des observations, intégrité et compteurs communs | Sans nouvelle proposition | Sans nouvelle action | Sans nouvelle restauration | 8 | Vérifiés |

Ce verdict **ne constitue pas une parité complète de l'appelant Python**. Le reçu conserve `qualifiedOriginalWholeTrajectoryParity: false`. La résolution des trois niveaux vient de la campagne native effectivement exécutée ; le rejeu ne produit aucune nouvelle action ni aucun nouveau succès de niveau.

## Exception originale conservée

À la première proposition d'attente, après quinze actions, le budget courant fournit **585 actions restantes**. `ReceptionWaitBudgetD` exige un maximum inférieur ou égal à 128. L'original lève donc une `ValidationError` sur `maximum_total_wait_primitives`. Le journal propre et la mémoire demeurent inchangés lors de cet échec.

Le chemin exact s'arrête à cet endroit. Il ne reçoit pas un maximum corrigé pour prétendre terminer le trajet original. L'exception complète, son champ, sa révision et la preuve de non-mutation figurent dans `exactOriginal.stop` du [reçu source](fogw-public-source-replay.json.gz).

## Enveloppe native nommée

Le second chemin utilise les fonctions et méthodes des mêmes fichiers Python inchangés. Une enveloppe externe applique les contrats annoncés avant la campagne :

- Le plafond d'attente vaut le minimum du maximum déclaré et de 128 ; le budget général du niveau reste indépendant.
- Une attente épuisée produit un refus bloquant au lieu d'un sondage de repli.
- Une nouvelle époque est acquise avec la mémoire de proposition produite par ce même rejeu froid, au moment du retour réel ; la confirmation stationnaire est renouvelée.
- Les événements propres de Reception sont conservés séparément des événements Exposed. Sur ce trajet, les 27 préfixes sélectionnés sont Reception ; le contre-exemple du journal Exposed partagé est couvert séparément par l'oracle de composant.

Le wrapper est visible dans [replay-reception-public.py](replay-reception-public.py). Il ne modifie ni ne remplace les fichiers de référence. Les éventuelles transformations sont consignées par révision dans `adaptedOriginal.adjustments`. La mémoire d'une proposition native capturée n'amorce jamais le rejeu. Chaque nouvel état vient d'événements source produits à partir des retours publics précédents.

## Retours et registres d'attente

| Époque | Actions acquises | Commandes de réception/attente | Cumul d'attente acquis à la frontière | Retour franchissant la frontière |
| --- | ---: | ---: | ---: | ---: |
| 1 | 18 | 3 | 2 | 18 |
| 2 | 14 | 5 | 4 | 32 |
| 3 | 18 | 5 | 4 | 50 |

La différence entre les commandes d'attente et le cumul est volontairement conservée : le réducteur source ne consomme pas une unité d'attente lorsque le retour franchit une frontière d'époque. La garde ferme alors le préfixe. Les trois frontières sont présentes dans les journaux et ne sont pas transformées en essais stationnaires confirmés.

La campagne conservée se termine à **50 actions, trois niveaux résolus, 27 préfixes, arrivée au niveau 4**, avec `target_levels_completed`. Ces résultats restent ceux de la campagne native commune ; le rejeu évalue sa couche propre Reception sur les observations exécutées.

## Limites et intégrité

Les observations complètes sont retrouvées dans `inventorySourceCalls` puis liées aux 51 paquets publics par frame, état, score, commandes disponibles et époque. Les contrôles comparent les propositions propres complètes, les commandes réellement exécutées, les gardes avant/après, les scènes, les porteurs, les événements, les états acquis, le suffixe de digest sur frontière parente opaque et les restaurations propres.

Les candidats adressés ne sont pas nécessaires au sous-ensemble consommé : Reception écarte les commandes portant une donnée non vide. Le rejeu utilise le sous-ensemble non adressé exact d'`ObservedInputDomain`. Les délais physiques sont omis pour comparer de façon déterministe un travail déjà terminé ; les autres budgets et les conditions publiques demeurent.

Le layout source ne comprend pas l'identité des silhouettes homologues de la demande. Après la première action, les gardes portent sur le layout et le porteur et ne garantissent pas une interruption à chaque changement de demande conservant ces projections. Cette limite reste inchangée dans le port et explicite dans sa [filiation](../../lot3e-reception-service-lineage.md).

Les **1 786 fichiers originaux** sont vérifiés avant et après. Les deux scripts se terminent avec le code zéro ; leurs [journaux et commandes](fogw-public-replay-execution.json) sont conservés. Les empreintes des entrées, de la source native gelée et des scripts se trouvent dans [fogw-public-parity.json](fogw-public-parity.json). Aucun moteur, spécification, état privé, solution ou nouvel essai de jeu n'entre dans cette revue.
