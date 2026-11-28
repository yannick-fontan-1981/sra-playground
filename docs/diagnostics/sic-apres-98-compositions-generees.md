# Compositions d’effets générées après les 98 démarches

Le candidat commun `096bc103fa5ec1af6b141968d39566e20051496e` contient le composeur de réserve de pression `c515ea14` et le classement P05 en mode d’observation `189b96ee`. Ce banc généré exécute le même code de composition que l’appelant de réserve de pression. Il reprend le générateur, le simulateur indépendant et la reprise SQLite du pilote `145b8c76`. [Composeur de réserve de pression](sic-pressure-composer-port.md) · [Observation P05](../architecture/sic-agenda-local-p05-shadow.md)

## Résultat sur le code commun

Graine 261128, 8 000 scénarios de développement et 2 000 de familles réservées. Chaque scénario propose de trois à cinq passages et peut imposer un relais, une fenêtre retardée, une ressource, une preuve, ou plusieurs conditions conjointes. La profondeur mesure la plus longue chaîne de prérequis entre passages. Le simulateur indépendant rejoue les plans, calcule une solution minimale dans les mêmes bornes et compare aussi une procédure gloutonne.

| Profondeur | Cas | Plans faisables et rejoués |
| ---: | ---: | ---: |
| 1 | 134 | 108 |
| 2 | 1 920 | 1 514 |
| 3 | 3 833 | 3 004 |
| 4 | 2 823 | 2 234 |
| 5 | 1 290 | 1 002 |

Le composeur retrouve les **7 862** solutions faisables, dont **1 575** sur la partition réservée. Il ramène le total de 4 796 à 7 862 résolutions par rapport à la procédure gloutonne. Les **2 138** cas restants n’ont pas de plan dans la borne. Parmi eux, 2 131 sont des contrôles négatifs déclarés et sept sont hors de portée dans les conditions tirées. Le rapport relève zéro préfixe invalide, zéro plan non minimal et zéro écart avec le calcul indépendant. Le plus long plan trouvé compte 21 gestes.

L’état de déduplication inclut la quantité de ressource, car deux positions ou ensembles de faits identiques peuvent autoriser des suites différentes. La première campagne a pris 63 secondes. La relance sur la même base a réutilisé les 10 000 verdicts.

## Reproduction

Depuis le SHA `096bc103fa5ec1af6b141968d39566e20051496e` avec Node 24.

```powershell
node scripts/sic-effect-composer-campaign.mjs --count 10000 --seed 261128 --state "$env:TEMP/sic-apres98-effets-096bc103-10000"
```

Le rapport reste dans le répertoire d’état. En cas d’écart, `firstMismatch` conserve le scénario divergent de moindre taille trouvée, son plan et le verdict du simulateur. L’empreinte de la campagne qualifiée est `7d410d95829cd087c15a1d978b684af39de09df928775c9bf37b01b8d0756524`. Les familles réservées de ce banc proviennent du générateur. La réserve de l’opérateur pour la commande inconnue et la cible cachée possède son propre protocole et ses propres reçus. [Essai indépendant sur terrain inconnu](https://github.com/yannick-fontan-1981/sra-playground/blob/eaba5ec9/experiments/symbolic-situations/apres-98-composition/BILAN.md)
