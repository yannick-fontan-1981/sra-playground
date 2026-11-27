# HOLE et reprise immédiate du coloriage

La référence `4a546a13` a obtenu 6/6 en 83 commandes, réparties en 5, 8, 10, 10, 23 et 27. L’audit de `0fe417b2` a obtenu 4/6. Les niveaux 2 et 4 ont gagné respectivement deux commandes et une. Au niveau 5, l’audit s’est arrêté à la limite de 24 commandes.

Les quatre premières commandes du niveau 5 ont produit les mêmes retours dans les deux traces. Au cinquième choix, à la révision 35 (observation `b65e9214c3db135f`), le test préparé `witnessedPreview` a remplacé le pigment actif par un autre. Le recoloriage a dû resélectionner le pigment juste après. Quand la limite a été atteinte, le cadre `8c56496f128a91d6` correspondait exactement à celui qui précède la commande gagnante de la référence. La restitution vérifie ces préfixes en rejouant les commandes archivées sur le moteur officiel et recalcule la proposition du propriétaire à partir des retours publics.

Un changement de pigment effectivement observé peut donner la priorité à l’application du pigment dans le cadre retourné. Ce choix exige la préservation du champ, de la légende et des pigments de la palette. La famille vérifie de nouveau le pigment actif et la cible avant de proposer l’application. Les tests natifs couvrent le retour observé, sa variante avec permutation des couleurs, un pigment différent, une modification du champ ou de la légende et un état obtenu sans sélection acquise par l’agent.

Pour reproduire la comparaison depuis le dépôt avec Node 24 et Pyodide préparé, exécuter `node docs/diagnostics/sic-hole-20261127/probe-archived-selection.mjs`. Le fichier `selection-window-public.json.gz` contient les observations physiques utilisées par les tests.

## Qualification

Le commit producteur `333b5048d8bac6ab34a387eeb1221413cd0a1673` a réussi les six niveaux en 78 commandes, toutes autorisées, avec zéro réinitialisation et zéro annulation. Le parcours part du niveau 1 en mode SIC avec un seul worker, sur Ubuntu 24.04 avec Node 24. Les quatre premiers préfixes correspondent à ceux de l’audit `0fe417b2`. [Exécution GitHub](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46050735634)

| Niveau | Commandes | Plafond | Temps actif compté | Plafond |
| --- | ---: | ---: | ---: | ---: |
| 1 | 5 | 10 | 1,983 s | 11 s |
| 2 | 6 | 11 | 1,457 s | 10 s |
| 3 | 10 | 15 | 3,126 s | 15 s |
| 4 | 9 | 14 | 3,100 s | 14 s |
| 5 | 21 | 24 | 9,525 s | 29 s |
| 6 | 27 | 33 | 14,059 s | 33 s |

Le [manifeste](github-46050735634/manifest.json), le [résultat](github-46050735634/result.json) et les [empreintes des reçus](github-46050735634/receipt-sha256.json) consignent la source et les seuils. SHA256 du reçu strict décompressé `b073696deec210427d377b51a3809a01b48490977e740df4900e428db9b28e35`.
