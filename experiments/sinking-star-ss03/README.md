# SS03 — La ruse verte

Laboratoire autonome du troisième jeu Sinking Star : un **Voleur vert**, huit niveaux et un tutoriel chargé dès l’ouverture. La grille compte 20 × 20 cellules de **3 × 3 pixels** dans une image de 64 × 64 pixels.

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

La traction déplace une seule caisse. Le Voleur ne pousse pas. Chaque traction s’affiche en trois images successives à 1, 2 et 3 pixels, sans clignotement ni prévisualisation de destination.

## Vérifier

```bash
npm test
npm run validate
```

`tests/witnesses.json` contient des témoins de résolution rejoués par le véritable moteur, sans garantie d’optimalité. `scripts/solver.mjs` est un outil de conception uniquement : il n’entre jamais dans le fichier jouable ni dans les observations transmises à un agent.

La vérification DOM de l’interface est facultative et utilise Happy DOM dans une installation distincte :

```bash
HAPPY_DOM_MODULE=/chemin/vers/happy-dom/lib/index.js node scripts/verify-ui-dom.mjs
```

Elle exerce les événements de l’interface et compare les pixels du canvas ; ce n’est pas un test visuel dans un vrai navigateur. Voir les rapports de `validation/` pour la portée exacte des contrôles.

## Origine des niveaux

Le niveau 1 est une création originale. Quatre grilles reprennent les salles solo du Voleur des énigmes 5 à 8 de **Heroes of Hauling**, à partir de leur transcription PuzzleScript publique. Trois salles coopératives sont adaptées pour être jouables avec un Voleur seul. Les correspondances et modifications sont détaillées dans `docs/provenance.md` et `reference/hauling-grids.json`.

- Guide demandé : https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/
- Transcriptions : https://github.com/joric/ootss/blob/main/scripts/ootss.pz

Les rendus et personnages utilisent la palette de la série SRA. Ces grilles ne prétendent pas être une extraction certifiée pixel par pixel des captures du jeu commercial.

## Intégration ultérieure dans SRA Playground

Le laboratoire expose `PullPuzzleSession` et conserve le contrat d’observation natif : pixels, palette, actions 1–4, images d’animation, durées et progression. L’ajout au catalogue Custom 4 et la publication du Site constituent une étape distincte. Voir `docs/integration.md`.
