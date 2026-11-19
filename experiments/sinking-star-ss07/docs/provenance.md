# Sources et adaptations SS07

**La Distance Dérobée**, version **0.1.1 / HTML v2**, combine cinq adaptations déclarées et trois créations originales. Les sources ont servi à choisir des mécanismes de traction, de miroir et de presse, puis à construire des salles adaptées au duo Marchand/Voleur et à une grille 2D de 20 × 20 cellules.

Les règles et références sont examinées à partir du guide [Heroes and Mirrors](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/) et de [Heroes and Light](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/). Les données complémentaires utilisées pour identifier les cartes sont l’[export communautaire des dispositions](https://github.com/chenyuyang712/OSS-puzzlewiki/blob/main/data/levels_layout.json.gz), les [parcours communautaires](https://github.com/joric/ootss/blob/main/data/solutions.json) et les [captures par identifiant](https://github.com/joric/ootss_tileset/tree/main/images/levels). Les identifiants techniques ne sont pas les numéros du guide.

| Niveau SS07 | Référence | Éléments repris et changements |
|---|---|---|
| 1 | Création originale | Atelier conçu pour la complémentarité poussée / traction : deux appuis, presse distante et déplacement du miroir. |
| 2 | [Heroes and Mirrors 4](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-4), `holes` | Traction du miroir entre les trous et départs par reflet. Les 53 commandes source du Voleur sont conservées dans une reconstruction des cases parcourues. Marchand, caisse et seconde cible ajoutés ; limites non parcourues adaptées. |
| 3 | [Heroes and Mirrors 5](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-5), `double_break` | Un miroir pèse sur le bouton, le second permet de quitter la traction. Géométrie recomposée, Marchand et portes de secours réciproque ajoutés. |
| 4 | [Heroes and Mirrors 6](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-6), `drop_tool` | Déplacer le miroir pour acheminer les caisses vers les traversées. Cinq îlots et quatre appuis dans une nouvelle carte 20 × 16 ; coopération du duo et deuxième cible ajoutées. |
| 5 | [Heroes and Light 2](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-2) | Adaptation de principe de la presse qui déplace une file. Les six caisses et la cascade source deviennent deux caisses enclavées, une presse latérale, deux rives et un miroir à tirer puis à récupérer. |
| 6 | [Heroes and Mirrors 7](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-7) | Adaptation de principe : confier un bouton au monstre et changer l’alignement du miroir. Nouveau parcours en deux reflets, virage imposant traction et poussée, deuxième cible. |
| 7 | Création originale | Forteresse à deux sceaux, presse, combat mutuel et relève temporaire du Marchand pendant le départ du Voleur par reflet. |
| 8 | Création originale | Pont provisoire de trois plateformes, récupération d’une troisième caisse et conversion en appuis permanents, puis miroir de sortie. |

**Aucune reproduction certifiée case par case du jeu original n’est revendiquée.** La conservation d’une séquence source en L2 valide ce parcours dans l’adaptation ; elle ne démontre pas une identité complète des deux terrains ou de toutes leurs solutions. L5 et L6 reprennent explicitement un principe, avec une géométrie nouvelle.

Les dispositions et séquences communautaires sont des indices de conception. Les références détaillées de L2–L4 sont regroupées dans `reference/levels234-provenance.json` ; les huit fichiers `reference/levelN-design.json` du laboratoire contiennent les spécifications réellement jouables, leur provenance, les différences déclarées et les nouveaux témoins SS07. Les solutions originales et les outils d’auteur restent hors du bundle jouable.

Le laboratoire ne reprend ni textures ni modèles du jeu original : le rendu utilise des sprites géométriques de 3 × 3 pixels et la palette de la série. Les règles retenues sont explicites dans [specification.md](specification.md). Le moteur ne traite pas les empilements verticaux, les clones, les dragons ou les relais de rayon entre miroirs ; aucune salle SS07 ne dépend de ces mécanismes.
