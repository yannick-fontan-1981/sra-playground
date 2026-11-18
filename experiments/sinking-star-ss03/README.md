# SS03 — La ruse verte · v0.3.0

Laboratoire autonome du troisième jeu Sinking Star : un **Voleur vert**, huit niveaux et un tutoriel chargé dès l’ouverture. La grille compte 20 × 20 cellules de **3 × 3 pixels** dans une image de 64 × 64 pixels.

## Changements de cette version

Le niveau 2, **La presse latérale**, remplace Le triple verrou par un défi de difficulté moyenne : deux caisses à préparer autour d’un pilier, une presse orientée vers l’est et deux boutons à remplir. Le parcours validé emploie deux poussées ; la seconde avance une file de deux caisses. La presse est indispensable à la résolution. L’aide aux pistons s’affiche dès ce niveau.

Les sept autres salles, les commandes et les animations sont conservées. Leurs observations sont comparées à la version précédente.

## Jouer

```bash
npm install
npm run build
```

Ouvrir `dist/SS03-demo.html` dans un navigateur. Le fichier est autonome et ne requiert aucune connexion réseau pour jouer.

- Flèches : marcher et tirer automatiquement une caisse immédiatement derrière soi.
- Un pas de côté : laisser la caisse sur place et se repositionner.
- Z ou Ctrl+Z : annuler, y compris pendant une animation.
- R : réinitialiser le niveau ; Recommencer : revenir au tutoriel et effacer la progression.
- Le sélecteur permet d’essayer directement les huit niveaux.

Le Voleur tire une seule caisse. Aux niveaux 2, 7 et 8, une porte qui apparaît pousse l’occupant de sa case et toute la file devant lui dans le sens du chevron. Si la poussée est bloquée, l’occupant initial est écrasé. Les petits repères de couleur relient les boutons à leurs portes ; le corps des dispositifs reste rose. Il n’y a ni touche Espace ni prévisualisation de destination.

## Vérifier

```bash
npm test
npm run validate
```

Les **47 tests** du moteur et du solveur couvrent les tractions, les portes, les cascades, les collisions, les plateformes, l’annulation et les animations. Les huit témoins rejoués comptent **472 directions, 147 tractions et 10 poussées de piston**, sans action bloquée, décès ni caisse perdue. Ce sont des parcours validés, sans garantie d’optimalité.

Les sept autres niveaux conservent exactement les observations de v0.2.0, y compris leurs images d’animation et leurs durées.

La vérification DOM de l’interface utilise Happy DOM dans une installation distincte :

```bash
HAPPY_DOM_MODULE=/chemin/vers/happy-dom/lib/index.js node scripts/verify-ui-dom.mjs
```

Ses **15 contrôles** exercent les événements, comparent les pixels du canvas et annulent une action pendant la phase de poussée. Ce n’est pas un test visuel dans un vrai navigateur. Le panneau de défaite est couvert par les tests moteur pour son état public, mais pas par un parcours humain fatal dans les huit niveaux. Voir `validation/` pour la portée exacte des contrôles.

## Origine des niveaux

Les niveaux 1, 2 et 7 sont des créations originales. Les niveaux 3 à 6 viennent de **Heroes of Hauling** : deux transcriptions conservées et deux adaptations pour un Voleur seul. Le niveau 8 reprend la géométrie de **Heroes and Light, énigme 2** : 9 × 10 cases, 67 cases de sol, six caisses, deux boutons et trois portes.

Les correspondances, circuits et preuves de transcription figurent dans `docs/provenance.md`, `reference/hauling-grids.json` et `reference/light-piston-grid.json`. La palette et les sprites suivent le contrat ARC de la série ; la reproduction porte sur la grille et ses mécanismes.

- Heroes of Hauling : https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/
- Heroes and Light : https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-2

## Intégration ultérieure dans SRA Playground

Le laboratoire expose `PullPuzzleSession` et conserve le contrat d’observation natif : pixels, palette, actions 1–4, images d’animation, durées et progression. Les solveurs, états sémantiques et témoins ne sont jamais inclus dans les observations publiques.

L’ajout au catalogue Custom 4 et la publication du Site constituent une étape distincte. Voir `docs/integration.md`.
