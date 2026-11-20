# Un effet local annoncé, éprouvé puis réutilisé

Le candidat expérimental v32 a été figé au commit `9600279bccd29994fbbec9dd238e2f7146b3c6c3`. Les 2 548 fichiers d’exécution ont été comparés aux objets Git. Leur empreinte de fichier en fichier est `6f3fb2b97981d44a028e8c84704405b02d4d8627418f35a1c96c7742eac8fade`. L’ancienne et la nouvelle politique utilisent le même moteur `f4d28aee`. [Protocole enregistré avant POLA](protocole-capacites.md)

## POLA, famille réservée pour cette expérience

| Départ | v31 à 90 coups | v32 à 90 coups |
| --- | --- | --- |
| L2 à froid | Victoire en 79 | Victoire en 79 |
| L2 après les 6 actions gagnantes du L1 | Victoire en 67 | Victoire en 67 |
| L3 à froid | Échec à 90 | **Victoire en 61** |
| L3 après la même leçon du L1 puis sélection publique du L3 | Échec à 90 | **Victoire en 61** |

Avec un plafond porté à 180 sur un nouveau départ à froid du L3, v31 échoue à 180 et v32 reproduit les 61 actions gagnantes. La première divergence est au coup 41. V31 choisit ACTION7. V32 choisit ACTION4 pour mesurer une réponse, puis à nouveau ACTION4 comme préparation. La préparation visuelle annoncée échoue. Dans une intervention croisée sur le moteur, la suite des commandes 42 à 61 de v32 gagne après l’un ou l’autre choix du coup 41. La suite de v31 jusqu’au coup 90 échoue dans les deux conditions. Le premier choix change la trajectoire de la politique. Sa substitution isolée ne suffit pas à expliquer le gain.

Sur les 19 images distinctes de la trajectoire froide du L3, le module interrogé séparément formule 11 prédictions. Deux sont vérifiées contre B seul et contre les commandes alternatives, aux préfixes de 9 et 48 actions. C’est la même relation géométrique transportée de (44,31) à (19,16), dans deux états distincts. Aucune continuation C n’est confirmée sur POLA. Les résultats de ce banc sont identiques avec la leçon du L1. Sur les 17 images distinctes du L2, le module ne formule aucune prédiction dans ce banc. POLA avait déjà figuré dans le corpus historique des 100 jeux.

## Une révision correcte sur deux dispositions de SWCH

Le banc présente au module les 25 transitions publiques du L1, puis utilise les états du L2 issus de la trajectoire froide. Pour isoler la capacité de révision, il fournit les résultats d’actions témoins jouées depuis le même préfixe. SIC choisit lui-même son explication révisée, qui est enregistrée avant la mesure. Ces interventions de laboratoire ne font pas partie de la partie autonome.

| Préfixe du L2 | Préparation confirmée | Réponse réfutée | Révision choisie | Premier usage suivant |
| --- | --- | --- | --- | --- |
| 2 actions | ACTION4, motif en (15,13) | Une deuxième ACTION4 manque l’effet prévu en (23,13) | ACTION2 produit l’effet prévu en (20,16) | Une autre ACTION2 atteint le motif annoncé en (20,21) |
| 3 actions | ACTION4, motif en (15,18) | Une deuxième ACTION4 manque l’effet prévu en (23,18) | ACTION2 produit l’effet prévu en (20,21) | Une autre ACTION2 atteint le motif annoncé en (20,26) |

Les deux révisions conservent la préparation sur place. Le banc compare A-B à B seul et compare A-B-C à A-C et B-C. Les effets sont également absents avec les autres commandes admissibles testées à la place de B ou de C. Au total sur SWCH L2 avec leçon, 6 prédictions sur 89 sont confirmées, dont 2 des 9 révisions tentées. Sur SWCH L3 après la même leçon et sélection du L3, 4 sur 47 sont confirmées, dont 2 révisions sur 2. Les essais autonomes sur SWCH L2 restent en échec à 90.

## Quand SIC décide et joue lui-même

Sur KEYD L2 précédé des 35 actions gagnantes du L1, v32 gagne en 62 actions. Sur ses quatre hypothèses distinctes, trois passent les contrôles. Deux sont menées jusqu’à l’exécution réelle de C, avec les trois effets visuels annoncés et les contrôles de même longueur. Sur KEYD L2 à froid, v32 gagne en 57 contre 60 pour v31. Aucune des quatre hypothèses locales de la partie froide ne passe le contrôle causal.

En conservant toute la suite de la partie de KEYD, le coup prédit 57, ACTION4 en direction de l’effet situé en (36,33), est indispensable parmi les choix essayés. ACTION4 donne la victoire. Omettre ce coup ou lui substituer ACTION1, ACTION2, ACTION3 ou ACTION5 échoue. Le coup prédit 30 peut au contraire être omis ou remplacé par chacun des quatre autres contrôles testés et la même suite gagne encore. Sous la même leçon, v31 et v33 échouent à 90. Le [rejeu des substitutions](../../../scripts/check-use-against-score.mjs) conserve le préfixe et les commandes suivantes pour mesurer le rôle de chaque intervention dans ce parcours précis.

Sur VOIS L1, v32 joue effectivement six réponses B et cinq continuations C dont la relation est vérifiée au rejeu. Malgré ces réussites locales, le candidat perd au plafond de 60. V31 gagnait en 57. Avec un plafond de 120, v32 finit par gagner en 103. Sur l’ensemble des 100 L1, v32 conserve 99 victoires et 96 trajectoires identiques à v31. Les quatre parcours demandés sont conservés, ainsi que SS01 L2 en 44 actions à froid et 32 après le L1. Les 752 tests ciblés passent sur les sources et fixtures du candidat.

Sur GARE L2 et L3, aucun des effets annoncés par le module dans le banc de révision avec leçon n’est confirmé. Sur CATR L2, il ne produit aucune prédiction. Sur CATR L3, les trois prédictions sont réfutées. La méthode mesure une transition précise de neuf pixels et sa conséquence. L’ouverture d’une destination du jeu demande une vérification de jeu supplémentaire.

Les [témoins compacts](temoins-capacites-v32.json) contiennent cinq parties et neuf prédictions vérifiables, dont deux continuations jouées en partie autonome. Le [vérificateur](../../../scripts/replay-capacity-witnesses.mjs) rejoue les scénarios sur un checkout moteur. Les contrôles autonomes, les interventions depuis une trace et les scores officiels y sont mesurés séparément.

```powershell
node scripts/replay-capacity-witnesses.mjs ../sic-contact-acquisition docs/diagnostics/sic-plan-arbitration/temoins-capacites-v32.json
```
