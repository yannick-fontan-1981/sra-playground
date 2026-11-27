# Transmission et reprise du rôle de réception

Le témoin `4a546a13` gagne seulement L1 de FOGW, puis atteint 19 commandes au L2. Le candidat local `47c8a10d` / GitHub `9aa3f68d`, arbre `fcc8e5336c15d50b77cfa6d7a33a23d4a8c40127`, termine les six niveaux depuis L1 en une session SIC : **173 commandes, 173 autorisations et acquisitions, aucun reset/undo**.

| Niveau | Commandes / plafond | Score public / plafond |
|---|---:|---:|
| 1 | 18 / 23 | 5,250 / 13 s |
| 2 | 7 / 19 | 0,268 / 9 s |
| 3 | 18 / 30 | 4,233 / 14 s |
| 4 | 29 / 35 | 11,148 / 19 s |
| 5 | 38 / 46 | 19,902 / 29 s |
| 6 | 63 / 76 | 34,157 / 37 s |

## Premières décisions et correction

1. À l'entrée L2, les quatre déplacements et le marquage du support réussi sont conservés, mais la réception simple repart sans commandes. La scène compatible, de même pas et avec un porteur unique, peut maintenant consommer cette mémoire.
2. Le score L2 survient sur l'arrivée mesurée au support, avant une attente. Le rôle est conservé sur cette progression officielle seulement si la commande connue et son arrivée prévue atteignent ce support précis. Un score ailleurs ne transmet rien.
3. Au L4, le retour de la commande 48 restaure la scène initiale. Le propriétaire garde l'échec daté, mais la commande 49 était prise par une preview, suivie de quatre autres commandes étrangères. La continuation est maintenant proposée avant ces essais seulement avec la preuve du rôle, un epoch compatible et, pour l'activation/séquence, la référence exacte du dernier retour. Un porteur visible doit être unique et à l'ancre conservée. Un porteur masqué ne peut continuer que depuis le retour courant, sans autre porteur visible, selon le contrat unitaire préexistant.

La recherche de trajet, les contrôles avant/après, les budgets et les échecs conservés restent actifs. Aucun identifiant de jeu, niveau, couleur absolue ou parcours de référence ne pilote la production.

## Validation et limites

Quatorze tests passent. Deux scénarios natifs varient glyphes, couleurs, positions et commandes et utilisent l'ordre réel des groupes de production. Ils vérifient les tickets et la continuité déjà justifiée. Les cas manquant, ambigu, contradictoire, score sans rapport, preuve vide et retour périmé refusent la réutilisation concernée sans effacer les autres preuves. La fixture du premier refus L4 reste dans `tests/fixtures/sic-reception-activation-public.json.gz`.

Les captures complètes archivées sont des diagnostics publics instrumentés ; elles ne servent pas à annoncer des gains de temps. Le passage strict utilise le runner de production, un worker et les plafonds inchangés. La marge temporelle L6 reste de 2,843 secondes sur ce passage ; le rejeu combiné est obligatoire avant intégration.

Le même fichier strict inclut VOIS, toujours **5/6** : L6 atteint 42 commandes puis le plafond de 27 secondes. Ce résultat n'est pas une victoire supplémentaire. Les champs absents du résultat du watchdog restent nuls dans le manifeste.

La CI complète de continuité, la publication et le rejeu par l'interface sont encore requis pour la livraison de ce candidat.
