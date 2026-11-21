# SS14 — feuille de route

## Qualification du laboratoire et du Playground

| Étape | État vérifié |
| --- | --- |
| Identité Voleur–Barde et contrat 0.1.1 | Terminé ; couleurs 14/6, Voleur initialement sélectionné. |
| Moteur déterministe | 33 tests réussis. |
| Tutoriel dense au niveau 1 | 17/17 découvertes publiques ; route de 80 entrées. |
| Huit salles et adaptations documentées | Cartes, métadonnées, références et témoins synchronisés. |
| Finales à ressources réemployées | L7 : 195 entrées ; L8 : 289. 24 contrôles indépendants réussis ; variantes locales documentées. |
| Solvabilité et observation publique | 1 028 entrées, 3 039 images, 8/8 victoires, aucun refus ni décès dans les témoins. |
| Lisibilité des commandes et presses | L8 : bouton violet sur fond gris, sans bleu parasite. L6 : bouton bleu distinct, presse violette à centre noir fermé et gris ouvert. |
| HTML autonome et interface DOM | Huit routes exécutées ; pixels, durées, contrôles, annulations et progression vérifiés. |
| Images initiales des salles | Huit matrices publiques rendues et inspectées. |
| Contrôle Chromium du Playground | Huit parcours, 17 découvertes, interruptions, victoire et défaite, commandes et rendu à 390 px vérifiés. |
| Intégration au catalogue Custom 4 | SS14 apparaît après SS13. 58 tests natifs, typage et build réussis. Huit vignettes et huit liens directs contrôlés. |
| Coût du runtime partagé | **+7,76 %** sur le parcours global mesuré, dans la tolérance de +10 %. |
| Publication et identité du Site | Livraison depuis `main` sur le Site existant. La version et le SHA source vérifiés figurent dans le compte rendu. |

La version 0.1.0 livre le laboratoire complet. La version 0.1.1 clarifie les glyphes et sépare la commande du quai de la presse violette au niveau 6. Les huit séquences auteur restent identiques ; L6 conserve ses 107 entrées. Les deux changements hydrauliques de cette route remplacent les cinq précédents, d’où neuf images d’animation en moins sur la campagne. Le nombre d’entrées d’une route n’est pas une difficulté mesurée ni une borne minimale. Les variantes réussies restent acceptées ; aucune solution unique n’est revendiquée.

## Vérifications de livraison

Les observations, les 3 039 images et leurs durées concordent entre le moteur du laboratoire, l’adaptateur et le dispatcher. Le rejeu couvre 1 028 entrées dont 63 sélections et annule puis rejoue chacune des huit fins de salle. Dans Chromium, les pixels rendus confirment le bouton bleu du quai en (8,3), la presse de L6 aux états des 47e et 49e entrées et le bouton exposé de L8 en (11,14). Les parcours intégrés et les régressions SS13, SS01, CASC et LS20 ont réussi.

La médiane du temps cumulé pour SS09 et SS12 passe de **7 584,20 ms** (`421fbe54`) à **8 172,36 ms** (`b1aa126a`). Playwright alterne les deux builds dans Microsoft Edge 158.0.4370.33 avec trois paires après échauffement, des contextes neufs et la même fenêtre. Chaque jeu est chargé au niveau 1 et exécute quatre actions SRA rendues à l’écran. Les actions publiques sont identiques par paire et le fichier du worker agent compilé est identique dans les deux builds.

Pour reproduire la mesure, définir `CUSTOM4_BENCH_GAMES=SS09,SS12`, puis exécuter `node scripts/compare-custom4-browser-cost.mjs http://127.0.0.1:4175 http://127.0.0.1:4174 3` avec les deux prévisualisations en cours.

## Prochaine étape

Évaluer les performances de résolution autonome de SS14 par SRA dans une campagne séparée, à partir des seules observations publiques. Les victoires de validation proviennent des huit témoins d’auteur.

[Jouer à SS14](https://sra-playground.yannick-fontan.chatgpt.site/?game=SS14#playground)
