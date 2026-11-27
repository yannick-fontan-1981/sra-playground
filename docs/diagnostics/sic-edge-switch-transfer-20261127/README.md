# Réutiliser un contrôle de libération réellement observé

La capture de GRAV part du niveau 1, conserve une seule session SIC et s'arrête après le sixième geste du niveau 5. Les **63 commandes** et les quatre préfixes gagnants sont identiques au témoin de campagne. La source de capture est `0a87f48af56a7d3ad72983b9fa15cfbeb4621cee` ; aucun comportement du jeu ni du solveur n'est modifié pendant ce diagnostic.

## Première perte et rôle déjà acquis

La commande globale **62**, cinquième geste du niveau 5, est un `ACTION5` choisi par l'exploration publique. Son retour change le panneau et les marques d'attachement conformément au déplacement observé des pièces. Le rôle `sic_settle_pieces_at_matching_edges` acquiert alors un reçu `release` contenant les deux références publiques avant/après. Les quatre directions et quatre victoires sont déjà conservées.

Avant la commande globale **63**, ce reçu est présent, mais la proposition continue d'attendre `switchVerifiedAt`, renseigné après une victoire avec les deux sens du contrôle. Le rôle refuse donc le panneau qui vient d'être observé ; l'exploration clique le bord en `(31, 7)` sans changement. Le test de régression archive les deux états natifs et les images de ce premier retour.

Le correctif admet le reçu du contrôle dans le **même scope et la même époque**, avec deux références ordonnées qui ne sont pas futures. Il exige une commande `ACTION5` réellement observée. La réutilisation entre niveaux conserve sa condition historique de victoire ; la mesure du panneau, les quatre directions, le plateau, les marques et les gardes de retour restent en place.

Sur l'état public capturé avant la commande 63, la re-proposition produit maintenant **un seul `ACTION5`, en P05**, avant une route calculée de huit gestes. L'inverse du contrôle n'a pas encore été observé : il demeure un essai unitaire, dont le retour doit être acquis avant une continuation. Ce constat n'est pas une victoire du niveau 5.

## Transfert et refus

Les deux scénarios natifs commencent avec un rôle vide au niveau 1. Une autre famille SIC opère quatre commandes directionnelles et deux victoires réelles ; une nouvelle libération est ensuite observée dans un couloir dont l'accès est bloqué par une pièce attachée. Les variantes changent la taille et le pas du plateau, les couleurs, la réflexion des pièces et l'association des commandes aux directions. Le rôle prend ensuite la suite depuis le reçu courant, et l'inverse encore inconnu reste unitaire jusqu'à son retour.

Les refus natifs couvrent l'absence du reçu, deux panneaux ambigus, une direction contradictoire et la disparition de la commande. Le test sur la capture réelle refuse aussi un reçu d'une autre session ou époque, une référence future, une paire inversée et un clic auquel l'effet d'`ACTION5` n'a pas été attribué. Les connaissances antérieures sont conservées.

Les **huit tests ciblés passent**, y compris le garde historique des marques fixes, et TypeScript termine avec le code zéro. La revue indépendante du mécanisme est favorable.

## Sources et portée du diagnostic

Le code candidat est `853094f8e6fb6300433ce8eb475b5871dab9c8cb`, sauvegardé sous `b86ea00a50dc1aa05aff2556249ce9a9d5b0c05e`, arbre `b784751df25fb4c864b80acf64dc15221b411089`. Il modifie le mécanisme générique, un fichier de tests et sa fixture publique. Aucun identifiant de jeu, numéro de niveau, couleur absolue ni parcours témoin ne choisit une action en production.

`public-evidence.json.gz` conserve les commandes, leurs plans, toutes les images avant/après et animations, les observations natives et la mémoire du rôle concerné. Les états dérivés des autres familles, les propositions détaillées de preview et le journal global dérivé sont omis et listés dans le fichier. Les deux observations complètes utiles à la régression se trouvent aussi dans la fixture des tests. Le manifeste donne l'empreinte de la capture originale, celle de la transcription conservée et les blobs Git.

Le collecteur arrête uniquement l'exécution via `canDispatch` ; les valeurs `remaining` reçues par le planificateur et les budgets historiques restent inchangés. Cet arrêt volontaire provoque le statut de banc « public board changed » après le dernier retour. Il est conservé comme **arrêt de diagnostic**, et ne constitue pas un verdict d'échec du jeu. Les durées de cette capture instrumentée ne qualifient pas les plafonds de temps.

## Rejeu strict du candidat

Le rejeu standard de `c6d37b9cbfdfd956022b6a22eaaf6397dd7b8838` (GitHub `4cd0f572a696192bbeb232eb4aa09d8396d9ec9a`) a gagné **les six niveaux en 80 commandes**, dans une seule session SIC depuis le niveau 1. La source est restée propre et inchangée. Les 80 commandes sont autorisées par SIC et les 80 retours sont acquis ; aucun reset ni undo n'a été utilisé. Les six entrées `.levels` sont exactement celles de `levelStats`.

| Niveau | Commandes | Plafond de commandes | Score observé | Plafond de temps |
| --- | ---: | ---: | ---: | ---: |
| 1 | 11 | 16 | 4,624 s | 15 s |
| 2 | 32 | 57 | 12,285 s | 53 s |
| 3 | 6 | 11 | 1,304 s | 8 s |
| 4 | 8 | 13 | 1,859 s | 9 s |
| 5 | 13 | 28 | 3,069 s | 23 s |
| 6 | 10 | 15 | 0,808 s | 8 s |

Les quatre premiers préfixes gagnants sont identiques au témoin. La première divergence est exactement la commande globale 63 : l'essai unitaire d'attachement remplace le clic sans effet. Après son retour confirmé, les sept gestes suivants sont exécutés dans une seule série au niveau 5. Le niveau 6 utilise une série de dix gestes, dont deux commandes d'attachement déjà acquises. Les plafonds n'ont pas été modifiés.

Les temps du tableau s'arrêtent au score public. Le rapport distingue le temps actif et la réconciliation finale ; celle du niveau 6 dure 915 ms après les derniers gestes. Le passage strict ne conserve pas les tickets détaillés ni un compteur de clôtures uniques : il ne se substitue donc pas à leur future collecte physique.

`strict-summary.json`, les deux JSONL compressés et leurs reçus de source documentent ce verdict. La continuité d'intégration et le viewer publié restent à exécuter avant la livraison.
