# SS13 — feuille de route

## Qualification du laboratoire et du Playground

| Étape | Avancement | État vérifié |
| --- | ---: | --- |
| Duo Voleur–Magicien et moteur | 100 % | 31 tests moteur réussis |
| Tutoriel de quatorze découvertes | 100 % | Niveau 1, 77 actions, 14/14 détections publiques |
| Huit salles et adaptations documentées | 100 % | Références, cartes et témoins synchronisés |
| Finales 7 et 8 durcies — version 0.2.0 | 100 % | 231 et 212 entrées ; réemploi des ressources et circuits liés, 16 contrefactuels indépendants réussis |
| Solvabilité de la campagne | 100 % | 781 entrées, 0 refus, 0 mort, 8/8 victoires |
| HTML autonome et interface DOM | 100 % | Pixels, temporisation, contrôles et annulation vérifiés |
| Contrôle Chromium du laboratoire | 100 % | Huit parcours, pixels et commandes sur ordinateur et à 390 px |
| Intégration Custom 4 dans le Playground | 100 % | Adaptateur natif, huit vignettes, tutoriel et sources. 55 tests natifs, typage et build réussis |
| Vérification dans Chromium du Playground | 100 % | Parcours, animations, interruptions et contrôle mobile |
| Coût global du runtime partagé | **+1,33 %** | Comparaison avant/après homogène, seuil +10 % |
| Publication Site et synchronisation | Livraison depuis `main` | L’URL, la version et le SHA source vérifiés figurent dans le compte rendu |

La version 0.2.0 reconstruit les deux finales. Les six premières cartes et les règles du moteur sont identiques à la version 0.1.0. La longueur des témoins ne représente pas une difficulté mesurée ni un minimum de coups.

Le rapport Chromium du laboratoire est dans `validation/browser-report.json`. Les huit victoires sont issues des parcours d’auteur. Le contrôle SRA est limité à l’exécution et à l’interruption des actions publiques.

## Vérifications de livraison

Les huit témoins concordent entre laboratoire, adaptateur et dispatcher sur 781 entrées, dont 49 sélections, et 2 411 images avec leurs durées. Chaque fin de niveau a été annulée puis rejouée. Les trois contrôles de conception et les seize contrefactuels des finales ont réussi. Les deux recherches de raccourcis sont arrivées à leur limite et restent inconclusives.

Chromium a rejoué les huit témoins dans le Playground après le contrôle du HTML autonome. Les commandes clavier, clics et boutons, le tutoriel, les interruptions, les panneaux terminaux, les liens et les vignettes ont été contrôlés à partir du jeu compilé. Le contrôle mobile couvre une largeur de 390 px. Les régressions de SS12 et SS01 ont réussi, y compris le chargement et les actions de CASC et LS20.

SS13 suit SS12 dans le groupe Custom 4. Les adaptations et leurs sources secondaires restent accessibles, y compris aux niveaux 7 et 8. Le Site existant garde son adresse et ses paramètres d’accès. La qualification de publication vérifie le SHA source Site, le SHA de `main`, puis le jeu et la galerie sur le Site déployé.

La médiane du temps cumulé pour SS11 et SS12 passe de **18 235,84 ms** (`4a60e1ac`) à **18 478,30 ms** (`aae24e0c`). La mesure alterne les deux builds dans Microsoft Edge 158.0.4370.33, avec cinq paires après échauffement, des contextes neufs et la même fenêtre. Elle couvre le chargement et quatre actions SRA par jeu avec leur rendu. Les actions publiques sont identiques dans chaque paire. Le worker agent compilé est identique entre les builds.

Pour reproduire la mesure, définir `CUSTOM4_BENCH_GAMES=SS11,SS12` puis exécuter `node scripts/compare-custom4-browser-cost.mjs http://127.0.0.1:4175 http://127.0.0.1:4174 5` avec les deux prévisualisations en cours.

## Prochaine étape

Évaluer la résolution autonome de SS13 par SRA dans une campagne dédiée, depuis les seules observations publiques.

[Jouer à SS13](https://sra-playground.yannick-fontan.chatgpt.site/?game=SS13#playground)
