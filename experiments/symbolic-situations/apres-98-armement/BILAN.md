# Accusé d’armement · deuxième réserve indépendante

Candidat `06d9ab07ab36f7a658c3370706a5cf5d86b3e94b`. La deuxième réserve comprend quatre paires physiques sous quotas identiques, avec et sans le bit public `armed`. Elle a été scellée séparément avant lecture du candidat. SHA-256 `83c8414d559580c3887fe38edd813b635d54b6b4e3ca6a62cb0da470d72bf589`. Reçu brut opérateur `cdc894646541bc1299942a2e143b543b7565c427e5fe8f8de02e442ad3b595a8`.

| Sur quatre terrains, une fois par condition | Figé, bit masqué → visible | Composé, bit masqué → visible |
| --- | --- | --- |
| Victoires | 1 → 1 | 2 → 4 |
| Gestes totaux | 34 → 34 | 19 → 24 |
| États de recherche développés | 0 → 0 | 2 505 → 384 |
| Arrêts par quota de gestes | 3 → 3 | 0 → 0 |
| Arrêts par quota de recherche | 0 → 0 | 1 → 0 |
| Arrêts faute de plan justifié | 0 → 0 | 1 → 0 |

Deux bascules vers la victoire et aucune bascule inverse. Les deux victoires communes de la composition prennent chacune six gestes dans les deux conditions. Sur l’ensemble des huit cas, le figé gagne 2 fois en 68 gestes et la composition 6 fois en 43 gestes. Aucun geste illégal et aucune perte terminale ne sont observés.

- **Première bascule.** Au T1, l’armement produit en position 0 `armed:true` avec porte fermée. Au T2, le composé avance et le vrai retour est position 1, porte ouverte, cible inconnue. Avec bit masqué, au même T2 il teste un autre code et le vrai retour est position 0, porte ouverte, cible inconnue. La version visible gagne au T5. La version masquée s’arrête au T5 après la révélation de la cible et la fermeture.
- **Deuxième bascule, quota de recherche de 1 000.** Après deux gestes, la version masquée s’arrête à la décision T3, quota atteint. La version visible lit deux accusés négatifs, reste à la position 0, puis reçoit `armed:true` au T3 avec porte encore fermée. Elle avance au T4 et gagne au T7, avec 164 états développés. Le premier écart est donc à T3 et le premier geste justifié par l’accusé positif est à T4.
- **Ordre inversé et témoin tolérant.** Avec ordre inversé, les deux conditions gagnent au T6 par la même suite. L’accusé positif au T2 précède l’approche au T3 dans la condition visible. La recherche passe de 709 à 74 états. Sur le témoin tolérant, les deux conditions gagnent aussi au T6. La politique choisit encore une commande inerte pendant l’attente après consommation, avec une seule ouverture et 101 → 75 états. Le figé garde la même suite de gestes dans les quatre paires.

**Terrain et régression.** Le contrôle indépendant rejoue les mêmes gestes dans les deux variantes sur 627 états appariés et 2 190 transitions, dont 170 terminales. Les observations physiques concordent après retrait du seul bit. Le bit confirme 35 armements avant l’ouverture et reste vrai sur 389 transitions de fermeture. Trois faux retours sont rejetés : signal avant consommation, ouverture prématurée et bit divulgué dans le mode masqué. Les 16 départs du reçu concordent avec le rejeu dans des processus de politique restreints, à partir d’un modèle physique indépendant. Deux tentatives de lecture privée échouent. Les quatre variantes masquées rejouées sur `909e584a` donnent les mêmes décisions, compteurs et reçus complets dans les deux politiques. Ce contrôle de régression utilise la seconde réserve, et le premier lot reste scellé à part.

Les 15 tests de développement du candidat passent après montage des ressources de référence V6, dont les tickets natifs des neuf scènes de développement. Le résultat comparatif réservé concerne les politiques du simulateur. Les paires et traces intégrales demeurent chez l’opérateur.
