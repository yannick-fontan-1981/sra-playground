# SS01 · Ce que la marque apprend à SIC

**Le L1 confirme mécaniquement que la marque indique où le marchand actif arrivera après l’activation.** Le candidat v22 enregistre cette relation sur les images publiques et conserve son témoin lorsque le jeu valide le L1. Au L2, la première divergence observable après cette acquisition se situe dans le choix du sujet et de la marque parmi plusieurs relations géométriques mémorisées.

## Du signe visible à l’arrivée mesurée

Les coordonnées sont celles des cases du niveau, numérotées à partir de 1. La campagne historique a fourni la suite de commandes. La décision d’alors et l’acquisition du candidat v22 sur le même événement sont deux mesures distinctes.

| Étape vérifiée | Résultat |
|---|---|
| Image avant la commande 210 du L1 | Le marchand actif est en `(6,9)`, le deuxième en `(6,13)`, la marque valide en `(9,6)`. |
| Commande et résultat physique | L’activation envoie le marchand actif en `(9,6)`. Le deuxième reste en `(6,13)`. |
| Autres commandes depuis le même écran | Nord laisse le marchand en `(6,9)`, sud l’amène en `(6,10)`, ouest en `(5,9)` et est en `(7,9)`. Seule l’activation atteint la marque parmi ces cinq commandes. |
| Acquisition par SIC | Sur les 210 transitions publiques rejouées, l’observateur du candidat rattache l’arrivée à la forme active. Le témoin contient le sujet, la marque, la commande et les références des images avant et après. L’identité du deuxième marchand et l’interprétation du rendu sont vérifiées séparément par l’audit. |
| Passage officiel du L1 au L2 | Sur un deuxième parcours, guidé et gagnant au L1, la troisième commande réalise `(6,12) → (12,6)`. La relation correcte figure parmi neuf relations emportées après la validation du niveau. |
| Première occasion sur le parcours guidé du L2 | Avant la quatrième commande, le marchand est en `(8,4)` et la marque en `(9,3)`. Parmi les neuf relations en concurrence, la famille sélectionne bien l’activation mais annonce qu’un sujet situé en `(9,3)` arrivera en `(8,3)`. Dans le moteur, c’est le marchand qui rejoint `(9,3)`. |
| Lecture séparée du témoin correct de L1 | Sur les 27 états du parcours L2, ce témoin fournit 16 prévisions. Les 16 arrivées annoncées sont confirmées sur 15 cases distinctes, dont `(9,3) → (5,7)` pour entrer dans l’îlot de gauche et `(4,13) → (9,8)` pour entrer dans l’îlot de droite. L’auditeur identifie ici le témoin par la vérification du L1 et laisse SIC lire les coordonnées sur chaque image du L2. |
| Choix libre de la famille à l’entrée officielle du L2 | Après exposition au L1, la famille émet six commandes puis s’abstient. Aucun transfert physique dans cet essai. |
| Choix libre de la famille après trois pas publics de mise en situation au L2 | Elle émet 53 commandes puis s’abstient. Sa 17e annonce correctement `(8,5) → (10,3)` et le commande. À ce stade sa justification contient déjà une observation du L2. Les 27 activations réalisant un transfert restent entre six cases visitées sur l’îlot du haut. |
| Choix des configurations débloquantes | La lecture correcte annonce l’arrivée quand le parcours a placé le miroir. Les essais de la famille seule ne découvrent et n’exécutent aucun des deux passages vers les autres îlots. |

Dans le parcours guidé, chaque essai ponctuel part d’une copie physique du même préfixe. Le résultat de la copie ne modifie pas les décisions suivantes sur la démonstration. Les deux essais où la famille choisit librement réinjectent en revanche chaque résultat dans la même mémoire. Ce sont des mesures de la famille « tester les effets préparés ». Les campagnes SIC Fallback complètes utilisent l’ordonnanceur normal.

Le script d’audit, les commandes du préfixe et les résultats détaillés permettent le rejeu. Le code du jeu sert à contrôler le sens de la marque et l’identité du marchand après coup. Seules les images publiques et les commandes entrent dans l’apprentissage. L’audit est extérieur au solveur. [Rejeu](./replay.mjs) · [Mesures](./mesures.json)

## Campagnes autonomes de SS01

| Départ et mémoire | Actions avant la limite de temps actif | Résultat du moteur | Contrôle de la marque du marchand |
|---|---:|---|---|
| L1, candidat v22 neuf, campagne visant L1 puis L2 | 422 | L1 inachevé | 253 prévisions de la famille, dont 229 géométriquement réalisées. Aucun transfert physique du marchand par activation. Cette campagne ne fournit donc aucune acquisition de la téléportation à transmettre au L2. |
| L2, candidat v22 neuf | 505 | L2 inachevé | 18 cases visitées, 35 prévisions contredites, aucun transfert physique du marchand. |
| L2, témoin neuf | 579 | L2 inachevé | Trajectoire reproduite depuis la même situation initiale. |

Le transfert de la commande 210 appartient à la campagne historique rejouée par v22. La différence entre cette exposition et la campagne autonome v22 mesure précisément le déclenchement de l’expérience. Les trajectoires autonomes sont reproduites commande par commande et chaque prévision de v22 est vérifiée contre son empreinte enregistrée avant l’action.

## Portée de la généralisation

Le code du candidat `456be4fd8713cfab058f5e7a4127546c9da4bd02` est figé avant ces essais. L’étude source porte sur 2 985 transitions publiques des 100 jeux. Des témoins géométriques sont enregistrés dans 54 jeux. Les neuf essais prospectifs entre niveaux sur les sept campagnes sources donnent deux arrivées confirmées sur GRAV L4 et L5, six contradictions et une identité indéterminée. Les deux confirmations de GRAV ont la même case d’arrivée que le témoin précédent. Elles établissent la réutilisation entre niveaux à cette position. Le rival essayé depuis le même état échoue à y parvenir dans les deux cas. [Protocole du candidat](../../architecture/sic-witnessed-preview-transfer.md) · [Mesures sur les sources](../../architecture/sic-witnessed-preview-transfer-source.json)

La validation complète des propriétés du jeu, du nombre de cases accessibles, des placements du miroir et de la poussée reste consultable dans le premier audit. Ses numéros de commandes et ses verdicts concernent la campagne v19. [Validation ligne par ligne et carte](https://github.com/yannick-fontan-1981/sra-playground/blob/7eef7c3f0bc4fcf7a52532bc9e3b06cc7eef464d/docs/diagnostics/ss01-l2-v19/README.md)
