# SS14 — feuille de route

## Laboratoire autonome

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
| Contrôle visuel dans un navigateur natif | À faire dans l’environnement d’intégration autorisé. |
| Intégration au catalogue Custom 4 | À faire ; mission dans `codex-integration-prompt.md`. |
| Publication et identité du Site | À faire après l’intégration native testée et intégrée sur `main`. |

La version 0.1.0 livre le laboratoire complet. La version 0.1.1 clarifie les glyphes et sépare la commande du quai de la presse violette au niveau 6. Les huit séquences auteur restent identiques ; L6 conserve ses 107 entrées. Les deux changements hydrauliques de cette route remplacent les cinq précédents, d’où neuf images d’animation en moins sur la campagne. Le nombre d’entrées d’une route n’est pas une difficulté mesurée ni une borne minimale. Les variantes réussies restent acceptées ; aucune solution unique n’est revendiquée.

## Prochaine étape

Raccorder les sources au catalogue Custom 4 et à l’interface actuelle du Playground. Vérifier la parité de l’adaptateur, les contrôles et les formats ordinateur/mobile dans un navigateur, puis publier le Site existant depuis l’état testé et intégré sur GitHub. Préserver les paramètres d’accès du Site.

Appliquer `AGENTS.md` et `docs/migration/git-site-sync-policy.md` : **travail → tests → commit → push → intégration main → publication → vérification GitHub/Site**. Préserver les travaux concurrents. Si l’intégration touche un chemin partagé du runtime, vérifier la tolérance globale de coût de +10 % dans des conditions avant/après identiques.

L’agent SRA ne reçoit que les observations publiques. Ses résultats autonomes devront être mesurés séparément des témoins d’auteur.
