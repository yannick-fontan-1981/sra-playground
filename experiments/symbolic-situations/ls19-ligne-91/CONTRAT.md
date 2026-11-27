# Ligne 91 LS19 · une seule répétition de confirmation

Le contrat antérieur de SIC 2 est `68efddd2d009ace4f4b898cc82c4bb7941e815ae`. Sa [description publique](https://github.com/yannick-fontan-1981/sra-playground/blob/68efddd2d009ace4f4b898cc82c4bb7941e815ae/docs/architecture/sic-ls19-ligne-91.md) situe la ligne 91 au geste de confirmation et à la décision qui suit son retour. La calibration utilise uniquement le parent de cette extraction. Le verdict de la ligne 90 demeure dans son propre registre.

**Entrée.** Le même service natif et le même transport que pour la ligne 90 reçoivent le budget et les observations publiques, une par ticket effectivement demandé. Une session démarre à neuf par histoire. Les deux membres d'une paire ont les mêmes commandes disponibles, le même budget, les mêmes indices et le même préfixe jusqu'à l'image qui les départage. La branche ou le résultat attendu n'entrent jamais dans le processus du décideur. L'opérateur lit ensuite la libération, son garde et la petite projection de la transition acquise.

| Situation publique | Observation utile et règle de jugement |
| --- | --- |
| D1 · la preuve reste-t-elle actuelle au moment de répéter ? | Sur une vue LS19 réfléchie, le geste 12 arrête le mobile à l'entrée. Dans une histoire le support reste visible, dans l'autre le carré d'entrée se libère tandis que le mobile reste immobile. Le témoignage d'un ancien arrêt peut encore figurer dans la transition. Seule une obstruction toujours appariée à la pose et au support autorise `confirm_access_obstruction` au tour 13. Le prochain retour doit laisser une question close si le support a disparu. |
| D2 · que faire après la répétition autorisée ? | Le premier arrêt justifie le même `ACTION2` au tour 13 dans les deux histoires. Dans l'une le mobile s'immobilise une seconde fois. Dans l'autre il franchit l'entrée. La seconde immobilité porte le compteur à deux sur la même clé. Le franchissement efface la question. Les deux retours peuvent donner zéro pixel de vue supplémentaire. Les deux observations fixes additionnelles, lorsque le service demande un ticket, ne justifient aucune troisième confirmation. Toute commande d'une autre famille est jugée avec son propre plan. |

**Besoin, plan et durée de la preuve.** Le besoin de vue `observe_view_access` conserve son identifiant sous `G_official_completion`. Le plan d'approche libéré et le plan de confirmation ont deux sous-objectifs différents. Une confirmation admissible cite un passage antérieur attesté, une première immobilité, les observations avant et après, une cause exclusive encore inconnue et un garde admis. Son reçu doit citer le nouveau sous-objectif et la révision effective. Une image identique à la précédente peut avoir une autre référence temporelle. Dès le prochain choix, une confirmation consommée ne peut être relibérée sur le seul dossier stationnaire. Les témoins altérés examineront la remise en circulation de l'ancien ticket et la substitution d'un reçu périmé.

**Portée.** La fixture fournit un préfixe de transitions partielles de LS19. Les contrefactuels changent uniquement l'observation utile dans chaque paire. Au-delà du préfixe capturé, une petite fenêtre construite laisse l'image constante pour toute commande directionnelle proposée. Le verdict examine un mécanisme de décision du service et ses retours sur ces situations. La complétion du jeu, le Banc de non-régression et l'intégration canonique ont leurs propres mesures.

Depuis ce répertoire, dans un clone contenant la fixture du contrat de la ligne 90 et le SHA de la ligne 91 :

```powershell
node qualifier.mjs --sha 68efddd2d009ace4f4b898cc82c4bb7941e815ae --depot . --rapport dev-91.json
```

Node 24 et `tar` sont requis. [Situations publiques](situations.mjs) · [Règles exécutables](criteres.mjs)
