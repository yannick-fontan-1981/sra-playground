# Continuité physique SNAR après la qualification stricte

Le candidat individuel `9756ab4e79612c8be8615f6629edc5c14b4687cf` a gagné **6/6 en 163 commandes** au rejeu strict GitHub **46027386793**. Le niveau 6 a pris 29 commandes et 13 744 ms, avec les plafonds inchangés de 35 commandes et 17 000 ms. Le reçu strict durable est archivé au commit `a95459fc` sur `fix/sic-snar-resume`.

La collecte GitHub **46028362277** a rejoué depuis L1 avec une seule session SIC et un seul worker sur `339f31bf84a557fe551bcda93b084230d750127a`, code de production identique à la source combinée `3cecddb1b3eb137e03ab1baee30b767e48844d6c`. Ce rejeu passif établit les effets physiques et le maintien des plafonds par niveau. La qualification chronométrée est portée par le rejeu strict.

| Niveau | Commandes | Tickets de continuation | Marches connues confirmées | Attentes continues | Sortie gardée gagnée | Terrains préservés sous un mobile mesuré |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 16 | 6 | 6 | 0 | 0 | 0 |
| 2 | 24 | 6 | 6 | 0 | 0 | 0 |
| 3 | 23 | 7 | 7 | 0 | 0 | 0 |
| 4 | 36 | 8 | 8 | 0 | 0 | 2 |
| 5 | 35 | 4 | 3 | 0 | 0 | 1 |
| 6 | 29 | 11 | 8 | 2 | 1 | 7 |

Le geste 162 est expérimental et le retour confirme sa position avant le départ du geste 163. La sortie conserve sa signature publique. Les deux commandes appartiennent à une décision et à une seule réconciliation de longueur deux. Les marches et les attentes se mesurent séparément sur des retours exécutés. Les réconciliations qui observent un mobile maintiennent le terrain acquis indépendamment avant son passage.

Le dossier `ci-339f31bf-46028362277/` préserve la commande, sa source et le reçu natif. Le SHA-256 du JSONL avant compression est `1121d3b8d8d04414224e28092773adcc5827c82c4433d341d764f08e2a80bf60`.

`npm run test:sic-continuity` accepte les 168 niveaux des reçus conservés dans les 25 cohortes, avec les 162 niveaux précédents du lot PR142 et les six niveaux SNAR. Cette vérification déterministe des reçus conserve les contrôles et seuils existants. Les workflows de la branche d'intégration rejouent les cohortes sur leur nouvelle source combinée.
