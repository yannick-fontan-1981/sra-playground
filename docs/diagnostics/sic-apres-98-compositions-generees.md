# Compositions d’effets générées après les 98 démarches

## Suite P07 : création d’accès

Le [banc P07 et son bilan](sic-p07-access-bilan.md), développé sur une branche isolée depuis `20433007`, qualifie 8 000 situations de développement avec oracle indépendant, comparaison figé/candidat, ablations et contrat P09 → P07. Les résultats restent des mesures de composants simulés ; les 2 000 situations de l’opérateur et SS08–SS25 ne sont pas utilisés.

## Corpus P09 de 10 000 situations résolubles

Sur `f44982ce`, le générateur remplit le quota après validation de la faisabilité par un simulateur indépendant du composeur. Il varie les dépendances entre quatre à sept passages, la conservation des appuis, les fenêtres, le stock et les obligations de mesure. Les signatures excluent les noms et l’ordre de présentation des commandes ainsi que les paramètres temporels qui ne régissent aucun effet. Les neuf familles ont 666 à 1 334 cas chacune. Les plans minimaux vont de 5 à 21 gestes. La profondeur des dépendances entre passages va de 1 à 7.

| Partition | Situations résolubles | Procédure gloutonne | Composeur avec rejeu vérifié |
| --- | ---: | ---: | ---: |
| Six familles de développement | 8 000 | 5 334 | 8 000 |
| Trois familles séparées par construction | 2 000 | 667 | 2 000 |
| Total | 10 000 | 6 001 | 10 000 |

Les 10 000 signatures diffèrent selon la normalisation du générateur. L’audit ne relève aucun plan invalide, écart à l’oracle ni perte d’une réussite gloutonne. La campagne dure 117 secondes. Le rapport a pour SHA-256 `fff59e3fedca3776249b08e2b1c78d73662d07fd6186a7bd731c91b34086d2ac`. Le composeur reçoit les effets déclarés du simulateur. L’acquisition de ces effets à partir de retours publics et les victoires en partie native ont des épreuves séparées.

```powershell
node scripts/sic-effect-composer-campaign.mjs --count 10000 --seed 261128 --positive-corpus --state "$env:TEMP/sic-P09-positive-f44982ce-10000"
```

## Premier banc mixte avec contrôles négatifs

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
