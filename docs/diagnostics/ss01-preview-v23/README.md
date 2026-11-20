# SS01 · La marque désigne l’arrivée du marchand

**Le candidat figé réutilise une observation du L1 pour choisir le bon sujet, lire la marque du L2, annoncer sa destination et y envoyer le marchand.** L’essai vérifie cette capacité après une démonstration du L1 et trois pas publics au L2. En campagne entièrement autonome, le premier échec mesurable arrive avant cette lecture.

## Validation du raisonnement

| Question | Vérification |
|---|---|
| Que voit-on au L1 avant l’action 210 de la campagne historique ? | Le marchand actif est en `(6,9)`, la croix grise en `(9,6)` et le second marchand en `(6,13)`. Les cinq pixels de la forme enregistrée comme indicateur disparaissent lorsqu’on retire uniquement l’aperçu du rendu de contrôle. |
| Que fait l’activation depuis cet état ? | Elle envoie le marchand actif en `(9,6)`. Le second marchand reste en `(6,13)`. Depuis le même état, nord, sud, ouest et est aboutissent respectivement en `(6,9)`, `(6,10)`, `(5,9)` et `(7,9)`. |
| Quelle connaissance SIC acquiert-il ? | À partir des images publiques, le candidat enregistre quelle forme annonce l’arrivée de quel sujet sous quelle commande, avec l’image d’origine et le résultat observé. Le diagnostic vérifie séparément l’identité du marchand dans le moteur. |
| Le savoir survit-il au changement de niveau ? | Oui. Une démonstration indépendante du L1 donne `(6,12) → (12,6)` à sa troisième commande et termine officiellement le niveau. La relation correcte figure parmi neuf relations conservées. |
| Qui choisit à la première occasion du L2 ? | Après les trois pas de mise en situation, la famille de raisonnement choisit elle-même l’activation. Elle annonce `(8,4) → (9,3)` avant la commande et le marchand arrive en `(9,3)`. La référence enregistrée vient du L1. Le candidat v22 se trompait de sujet à cette même occasion. |
| La relation permet-elle de lire une *nouvelle* destination ? | Interrogée séparément sur le parcours guidé du L2, la relation établie au L1 annonce correctement 16 arrivées sur 15 cases distinctes. Elle lit notamment le passage haut → gauche puis gauche → droite après placement des miroirs. |
| La famille sait-elle déjà organiser ces placements ? | À l’entrée officielle du L2, elle agit deux fois puis s’abstient. Si on lui fournit les trois pas initiaux, elle agit 69 fois. Elle réalise alors 31 transferts et visite huit cases de l’îlot du haut. Elle n’atteint pas les îlots suivants. |
| À quel moment la campagne *autonome* du L1 diverge-t-elle ? | À la commande **363**, le marchand est en `(6,9)` et la marque valide en `(9,6)`. SIC choisit un clic. Sur 17 occasions avec une marque valide, il choisit 14 clics et trois commandes sud. Ses six activations ont lieu dans d’autres états. Zéro transfert physique en 441 commandes, et le L2 n’est pas atteint. |
| À quel moment le départ *autonome à froid* du L2 diverge-t-il ? | Aux commandes **49 et 50**, SIC pousse le premier miroir vers la droite, de `(8,3)` à `(10,3)`. Sur 533 commandes, il visite 18 cases et ne rencontre aucune configuration présentant une arrivée valide pour le marchand actif. Il émet 27 activations. |
| Les deux traversées et la victoire sont-elles possibles mécaniquement ? | Oui. Le parcours de référence les réalise. Le premier audit énumère 4 placements débloquants du miroir du haut et 11 couples départ–arrivée. Les mesures ci-dessus distinguent leur lecture une fois préparés et leur découverte autonome. |

Le L1 testé comporte deux marchands et deux destinations à occuper simultanément. La règle « case vide uniquement » admet aussi, dans ce niveau, un échange entre marchands. Le rapport initial vérifie ligne par ligne les deux sens de réflexion, les propriétés de l’eau, les régions accessibles et les poussées nécessaires. [Validation ligne par ligne et carte](https://github.com/yannick-fontan-1981/sra-playground/blob/7eef7c3f0bc4fcf7a52532bc9e3b06cc7eef464d/docs/diagnostics/ss01-l2-v19/README.md)

## Anticiper une disposition avant de la créer

Un essai distinct sur les sources permet de tester l’idée « si j’amène ce changement ailleurs, que puis-je faire ensuite ? ». Dans VOIS L1, le calcul annonce trois futures positions de marque à partir de trois préparations possibles, depuis le même écran. Après chaque préparation, la même commande envoie effectivement le sujet à la nouvelle position annoncée. Les trois destinations diffèrent de l’arrivée de la commande seule. Les deux essais admissibles sur GABA échouent. Ce résultat expérimental distingue l’anticipation de la marque et sa simple lecture sur l’écran courant. [Expérience sur les dispositions futures](../../architecture/sic-preview-writes-source.md)

## Comparaison des campagnes autonomes

Nombre de commandes émises par le solveur avant l’arrêt de chaque départ direct au L2. Le contrôle commun et les deux candidats commencent sur la même empreinte d’image pour chaque jeu. **Aucun ne valide l’un de ces quatre niveaux.** Le budget de temps actif entraîne des nombres de commandes différents.

| Jeu | Témoin | Candidat v22 | Candidat v23 |
|---|---:|---:|---:|
| SS01 L2 | 579 | 505 | 533 |
| SS06 L2 | 751 | 451 | 470 |
| SS07 L2 | 5 | 28 | 41 |
| SS08 L2 | 791 | 927 | 664 |

Les versions v22 et v23 ont été figées avant leurs essais respectifs. SS01 était déjà connu de l’expérimentateur. Les entrées du calcul qui a sélectionné la correction v23 proviennent des 100 jeux sources. Sur les 314 situations où plusieurs lectures prédisent des effets pour une même commande, le nombre de bonnes attributions passe de 15 à 67. Sur les niveaux supérieurs, il passe de cinq à sept sur 29. SS09 L2 reste en réserve. [Étude source](../../architecture/sic-preview-competition.md) · [Comparaison, empreintes et versions figées](./campagnes.json)

Le rejeu reconstruit les commandes des campagnes autonomes, les fourches depuis le même état et les deux expériences de la famille isolée avec retour réel à chaque action. Les règles internes du jeu servent au contrôle a posteriori. L’apprentissage et les choix du candidat utilisent les observations publiques. [Mesures détaillées](./mesures.json) · [Code de rejeu](../ss01-preview-v22/replay.mjs)
