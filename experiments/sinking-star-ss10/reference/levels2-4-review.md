# SS10 — revue de conception des niveaux 2 à 4

Ces niveaux sont des adaptations de principes, avec des géométries originales.
Les trois témoins sont légaux, gagnants, sans action refusée ni décès.

| Niveau | Référence | Témoin | Interaction centrale |
|---|---|---:|---|
| 2 — Les deux réserves | Heroes of Hauling 16 | 76 actions | Extraire les poids du bord nord puis finir leur placement contre le bord sud |
| 3 — L’appui du prochain pont | Heroes and Water 3 | 62 actions | Réemployer chaque appui construit pour aborder le bloc suivant |
| 4 — Le miroir désenclavé | Heroes and Mirrors 4 | 39 actions | Tirer le miroir, libérer la traversée par reflet, puis caler le poids avec le Guerrier |

## Nécessité et limites des contrôles

Le rapport `levels2-4-necessity.json` distingue les recherches exhaustives des arrêts sur budget.

- L2 : impossible sans traction après 7 080 états exhaustifs. Sans poussée, limite à 250 000 états ; cette limite n’est pas une preuve. La raison de conception est que les deux boutons sont sur le dernier rang de sol, et que tirer une caisse vers ce rang exigerait de marcher dans le mur au-delà. Les deux héros doivent ensuite quitter les boutons pour occuper les deux destinations.
- L3 : impossible sans poussée après 13 248 états exhaustifs. Sans traction, limite à 250 000 états ; cette limite n’est pas une preuve. Le chemin exige trois cases d’eau comblées avec les trois seules caisses. Dépenser une caisse pour atteindre le côté nord des réserves initiales empêche de terminer ce chemin. Le témoin construit d’abord le passage est, puis les deux cases du pont sud.
- L4 : impossible sans poussée (18 156 états), sans traction (264 états), ou sans reflet (17 504 états), chaque fois par épuisement de la file. Le témoin élimine les deux monstres en les rapprochant par reflet. La recherche d’une victoire gardant un monstre atteint sa limite : la nécessité globale de leur élimination n’est pas revendiquée. Les monstres restent des obstacles actifs à la traversée, même si une stratégie alternative les déplaçait au lieu de les éliminer.

Les comptes d’actions ne sont pas des optimums. Les objectifs publics restent brefs ; ces témoins et raisonnements d’auteur ne sont pas importés dans le jeu.

## Reproduction

Après compilation du moteur : exécuter les trois scripts `author/build-level2.mjs`, `author/build-level3.mjs` et `author/build-level4.mjs`, puis `author/verify-levels2-4.mjs`. Le contrôle supplémentaire sur les monstres de L4 est `author/verify-level4-monsters.mjs`.

## Sources

- https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-16
- https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-3
- https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-4
