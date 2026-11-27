# Divergence attendue avant correction A

Le parent retenu est le gel historique `f296ac1c2e18f9d02b8e3045c3a225c61553c0e6`. Les réductions publiques A, B et C proviennent de `35fd9299dd4fafcce933c26751f2cbe8da82fb74`.

| Réduction | Premier geste et effet attendu du candidat A isolé | Issue attendue |
| --- | --- | --- |
| A | L’indexation est permise lorsque P n’est pas indexé. Demander `indexer P` dès le tour 1 dans les deux situations. L’accusé historique `poste indexé` confirme l’effet certain `indexed(P)=true`. Le cadran peut désormais valoir R ou S selon le guide. Sa lecture précède tout marquage. | 2 succès en 4 gestes, avec des choix de marque différents après la lecture. |
| B | `indexer P` puis arrêt sur le libellé `indexé`, comme le parent. | 0/1 pour A seul. Le correctif B relève d’un autre SHA. |
| C | Lire avant de marquer. | 2 succès en 3 gestes. Un engagement prématuré condamnerait une possibilité. |

La première divergence A est **le tour 1**, auparavant sans commande. Il faudra conserver un seul état de connaissance après l’accusé commun et toutes les valeurs possibles du cadran jusqu’au retour de lecture. Ni le guide inconnu ni le résultat de l’indexation ne deviennent des observations à la suite d’une simulation. Une précondition d’exécution inconnue, une conséquence potentiellement terminale ou des conséquences incompatibles doivent empêcher l’engagement. La recherche reste bornée. Le candidat de coût `bd61ff40` conserve sa mesure séparée.
