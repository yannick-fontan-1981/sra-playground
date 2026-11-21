# Généralisation de l’arbitrage et des préparations

**Main contient v31, au commit `cf6069a1`. À froid sur SS06, SS07 et SS08 L2, v31 gagne 0 niveau sur 3.** Les deux candidats suivants ont été figés et testés sur une branche expérimentale distincte. Aucun des trois ne place même un personnage sur une des deux destinations sur ces niveaux. SS09 L2 reste en réserve. [Rejeu des six parties de la fusion](custom4-a-froid.md)

| Custom 4 L2 à froid | Ancien main | v31 fusionné | v32 expérimental | v33 expérimental |
| --- | ---: | ---: | ---: | ---: |
| SS06 | 46 coups, arrêt | 151, mort | 242, mort | 173, mort |
| SS07 | 5, mort | 5, mort | 5, mort | 5, mort |
| SS08 | 124, arrêt | 544, temps | 519, temps | 396, temps |

Sur SS06, les quatre versions couvrent exactement 26 cases avec le marchand et une avec le guerrier. Sur SS07, les cinq commandes sont identiques. La réflexion du coup 5 tue le voleur. Sur SS08, l’ancien main couvre 10 cases avec le marchand et 9 avec le sorcier. Les trois candidats en couvrent 8 et 2 et contrôlent uniquement le marchand. Les nombres de coups sur cette dernière ligne dépendent du temps actif. La comparaison à 124 coups donne déjà les mêmes couvertures pour v31 et le témoin que leurs fins de parties respectives. [Mesures de chaque paire](mesures-capacites-v32-v33.json)

## Ce que SIC a effectivement appris à faire

- **Employer une conséquence annoncée pour gagner.** Sur KEYD L2 après le L1, v32 gagne en 62 coups. V31 et v33 échouent à 90 dans la même condition. Au coup 57, v32 exécute la troisième action d’une composition qu’il avait prévue à un nouvel emplacement. Les témoins confirment l’effet de cette action. Remplacer cette seule commande par chacun des quatre autres contrôles essayés, ou l’omettre, fait échouer la suite gagnante. Au coup 30, un autre effet également prédit peut être omis sans perdre. Cette différence mesure la contribution au score des deux usages.
- **Garder une préparation et changer d’explication.** Dans le banc de SWCH, le module garde le changement obtenu par ACTION4 après la réfutation de la deuxième ACTION4. À deux emplacements du L2, il propose ensuite ACTION2 et prédit correctement l’effet d’une autre ACTION2 en un troisième lieu. Le moteur confirme les deux révisions et les deux continuations face aux commandes alternatives. Le L3 fournit également deux révisions confirmées. Le banc mesure cette capacité après des interventions contrôlées. En partie autonome, SWCH L2 reste en échec au plafond de 90.
- **Gagner sur une famille réservée.** V32 gagne POLA L3 en 61 coups à froid et en 61 après une leçon de six coups du L1. V31 échoue au plafond de 90 dans les deux conditions, puis encore à 180 à froid. V32 répète sa victoire à 61 avec ce budget élargi. Au coup 41, la nouvelle expérience détourne SIC de la politique v31, puis sa prédiction est réfutée. La suite de v32 gagne aussi lorsqu’on lui substitue le coup 41 de v31. La victoire établit un transfert de comportement. La preuve d’une composition annoncée qui contribue au score vient de KEYD. [Prédictions, cas négatifs et interventions rejouables](capacites-v32.md)

## Coût sur les acquis

| Mesure vérifiée | v31 | v32 | v33 |
| --- | ---: | ---: | ---: |
| Victoires sur les 100 L1, plafond de 60 coups | 100 | 99 | 100 |
| Trajectoires identiques à v31 | 100 | 96 | 100 |
| Coups cumulés sur les 100 L1 | 1 571 | 1 620 | 1 571 |
| SS01 L2 à froid | 44 | 44 | 44 |
| SS01 L2 après le L1 | 32 | 32 | 32 |
| POLA L3 à froid, plafond de 90 | Échec | Victoire en 61 | Échec |

V32 a perdu VOIS au plafond de 60 tout en y exécutant cinq continuations prédites et vérifiées. Il gagne en 103 avec un budget de 120. Le réglage v33 attend une limite observée avant d’interrompre l’exploration. VOIS retrouve ses 57 coups et toute la cohorte retrouve les commandes et images de v31. Sur POLA L3, v33 reproduit également la trajectoire perdante de v31. La branche expérimentale conserve les deux versions. Les 752 tests ciblés de v32 et les 753 de v33 passent. [Protocole du réglage v33](protocole-limite-v33.md)

Le tag `sic-source100-local-capacity-v32` pointe sur `9600279b`, et `sic-source100-witnessed-limit-v33` sur `b043be87`. Les deux archives d’exécution ont été vérifiées fichier par fichier contre Git avant leurs campagnes. La première comparaison Custom 4 demandée a été faite avec v31 intact. Les essais suivants sur ces mêmes cibles mesurent la réplication sur des cibles déjà vues. [Gel, compteurs officiels, historiques des 100 jeux et empreintes des parties](mesures-capacites-v32-v33.json)
