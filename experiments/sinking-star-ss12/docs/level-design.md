# SS12 — conception des huit salles

Les cartes sont redessinées pour le duo Guerrier–Barde. Le tutoriel est original ; les sept salles suivantes adaptent des contraintes de North et Crossovers. Les coordonnées et les parcours de construction sont réservés aux fichiers de référence, hors du jeu jouable.

## Campagne validée

| Niveau | Salle | Source | Actions du témoin |
| --- | --- | --- | ---: |
| 1 | La répétition des deux rives | [Tutoriel original · Guerrier et Barde · règles du Nord et des zones mixtes](https://sinkingstarwalkthrough.com/fr/north/) | 61 |
| 2 | Les deux rails et le convoi | [Adaptation de Heroes 3: Bard, Druid · énigme 14](https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-14) | 31 |
| 3 | Le quai ramené d’en bas | [Adaptation de Heroes 3: Bard, Druid · énigme 19](https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-19) | 51 |
| 4 | Les trois poids sous garde | [Adaptation de Heroes 2: Monsters · énigme 22](https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/#%C3%A9nigme-22) | 51 |
| 5 | Le poids reste, le chant s’en va | [Adaptation de Heroes and Mirrors · énigme 1](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-1) | 63 |
| 6 | Les deux écluses de pierre | [Adaptation de Heroes and Light · énigme 1](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-1) | 77 |
| 7 | Le canal aux quatre coudes | [Adaptation de Heroes and Water · énigme 27](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-27) | 133 |
| 8 | La coda des deux reflets | [Synthèse adaptée de Heroes and Mirrors 2 et Heroes and Water 28](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-2) | 59 |

Les nombres incluent les sélections de héros ; ils décrivent les parcours de vérification, pas des minima à atteindre.

## Enchaînements proposés

1. **La répétition des deux rives.** Les deux ateliers sont séparés. La file du Guerrier et la caisse chantée par le Barde construisent un passage. Un poids conservé commande la presse distante ; le miroir doit être replacé avant la traversée vers les deux destinations. Treize découvertes publiques sont acquises sur le témoin.
2. **Les deux rails et le convoi.** Deux rails inaccessibles à la poussée directe amènent les poids sur une commande conjointe. Les rails continuent après les boutons : poursuivre volontairement avec le Barde déplacerait les poids. Le Guerrier le pousse sans chant, puis transforme les trois caisses du convoi en pont.
3. **Le quai ramené d’en bas.** Le chant extrait une caisse de sa niche. La poussée d’une file contenant la caisse et le miroir aligne l’atelier. Le Barde doit ensuite ramener l’appui du fond du canal pour donner accès aux départs des reflets.
4. **Les trois poids sous garde.** Les deux monstres doivent rester vivants : ils deviennent deux poids, rejoints par une caisse livrée dans une poche par une presse. Le Barde guide à distance, le Guerrier dégage la file de l’entrée.
5. **Le poids reste, le chant s’en va.** Le Barde quitte une caisse-bouton par miroir. Sur la seconde rive, il extrait un autre bloc d’un puits ; le Guerrier transforme ce bloc en appui du détroit.
6. **Les deux écluses de pierre.** Deux presses orientées créent deux traversées. Les deux héros doivent tenir une commande conjointe, puis le chant rapproche les gardiens à distance sûre.
7. **Le canal aux quatre coudes.** La même caisse devient un appui puis traverse tout le canal. Les rives servent de butées pendant que le Barde corrige leur écart. Le Guerrier ancre l’appui pour la traversée, puis un miroir devient le poids durable des trois plateformes.
8. **La coda des deux reflets.** La caisse traverse avant le Barde, change de position relative et commande deux portes. Le Guerrier règle le second miroir et déplace le Barde sans chant. Le dernier reflet mène au duel puis aux deux destinations. La référence complémentaire est [Heroes and Water 28](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-28).

## Contrôles de causalité

L2 a été retouché après découverte d’un parcours qui évitait tout déplacement forcé du Barde. Prolonger les deux rails après les commandes corrige ce raccourci : un pas chanté retire les poids, la poussée les maintient. La recherche bornée n’établit pas une nécessité globale.

Pour L8, cinq remplacements locaux ont été vérifiés aux étapes de replacement du Barde : la marche volontaire retire la caisse du bouton ; la poussée du Guerrier laisse le circuit actif. Cela démontre l’effet recherché à ces positions, pas l’unicité du parcours complet.

Les fonctions des blocs, appuis, miroirs, portes et monstres sont consignées dans les références d’auteur. Un miroir peut également servir de poids ou d’obstacle ; son activation n’est donc pas obligatoire dans chaque salle où il apparaît.

## Adaptation des règles

La série utilise le chant carré 5 × 5, les appuis occupés ancrés et une translation d’une case. Les piles et pouvoirs des autres personnages du jeu commercial ne sont pas importés. Voir `specification.md` et `source-audit.md` pour la portée exacte des adaptations.

## Témoins

Chaque salle possède un fichier `reference/levelN-design.json` avec carte, source, déclaration d’adaptation, étapes et parcours. `scripts/sync-levels.mjs` génère les huit cartes, les métadonnées publiques et les témoins de tests depuis ces références. Les vérifications comparent ces représentations et leurs signatures avant livraison.
