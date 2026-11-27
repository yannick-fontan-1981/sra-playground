# Coût de l’hydratation des fragments natifs de WA30

Le profil du rejeu diagnostique de `8fd38588` attribue 3,138 secondes inclusives à l’hydratation sur l’extrait du niveau 9. Les temps inclusifs se recouvrent avec les autres postes du [profil CPU](https://github.com/yannick-fontan-1981/sra-playground/tree/20147f92fcb2d99ff9bde232718648f332ae8b08/docs/diagnostics/sic-27-wa30-20261127/native-profile-8fd38588).

Lorsqu’un fragment construit par l’encodeur natif conserve exactement son identité immuable, son adresse est déjà liée au hash calculé sur ses octets. L’hydratation réutilise cette preuve d’identité et demande toujours au résolveur le fragment et chacun de ses descendants. Les fragments issus d’une autre source passent par la vérification ordinaire du contenu. Un test retire puis remplace un descendant de la collection déjà hydratée et vérifie les deux refus.

Mesure locale sous Node 24.22.3, sur l’état de préparation obtenu en réconciliant les 74 retours publics archivés dans `wa30-last-part-public.jsonl.gz`. Le même graphe de 19 nœuds est hydraté 200 fois par lot, en alternant l’ordre des deux implémentations sur cinq lots.

| Source | Temps par lot, ms | Médiane, ms | Appels du résolveur |
| --- | --- | ---: | ---: |
| Production `8fd38588` | 780, 681, 647, 805, 635 | 681 | 18 018 |
| Réutilisation du digest calculé | 469, 425, 370, 455, 442 | 442 | 18 018 |

Le SHA-256 chaîne le JSON canonique du graphe et celui de son état hydraté. Il est identique dans les deux cas, `6fa60e0b8cab808f0f087529d1f47672abccd276901747ff50d9c851d814ba27`. Les 76 tests ciblés et TypeScript passent. Ce test mesure l’hydratation seule.
