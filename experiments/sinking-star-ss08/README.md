# SS08 — La Double Transposition

Laboratoire autonome du duo **Marchand + Magicien**, destiné au lot Custom 4 de SRA Playground. Huit niveaux, atelier guidé au niveau 4, rendu ARC en 64 × 64 pixels et cellules de 3 × 3 pixels.

## Jouer et reconstruire

```bash
npm install
npm test
npm run validate
```

Ouvrir ensuite `dist/SS08-demo.html` dans un navigateur. Le HTML embarque le moteur, les cartes et l’interface ; il fonctionne hors ligne. Les sources restent dans `experiments/sinking-star-ss08/` ; l’adaptateur SRA et la publication du site constituent une étape d’intégration séparée.

- Flèches : déplacer le personnage sélectionné.
- Marchand orange (12) : pousser un seul occupant vers la case suivante.
- Magicien violet (15) : échanger automatiquement avec le premier bloc, monstre ou compagnon visé ; sans cible, marcher. La face blanche d’un miroir dévie la visée, son dos noir la bloque.
- Espace / X : activer les reflets géométriques des miroirs.
- Clic sur un personnage ou Tab : changer de personnage, sans faire avancer le monde.
- Z : annuler ; R : recommencer.

Depuis la v0.2.0, les quatre premières salles suivent l’ordre ancien 2 → 3 → 4 → 1 ; l’atelier guidé est au niveau 4. Les miroirs passent visuellement au-dessus des boutons.

Deux destinations doivent être occupées simultanément. Les caisses plongées dans l’eau deviennent des appuis permanents. Les boutons peuvent commander des portes-presses et des plateformes rétractables. Les monstres frappent leurs voisins orthogonaux simultanément.

## Références de conception

Les sources sont les zones liées depuis [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/), conformément à la demande : **Heroes and Mirrors** (30, 32, 31, 19, 25 et 34) et **Heroes and Water** (11). L’atelier guidé du niveau 4 est une création originale qui enseigne ces mécanismes. Les sept autres cartes sont des adaptations de principes, avec une géométrie et des parcours conçus pour ce duo ; aucune reproduction exacte n’est revendiquée. Chaque fichier `reference/levelN-design.json` contient l’URL, les différences, les étapes et un parcours exécutable.

## Validation et séparation des données

- `tests/duo.test.mjs` : règles et régressions du moteur, dont échanges, rebonds, boucles, pressions, combat et annulation.
- `scripts/validate-levels.mjs` : rejoue les huit parcours via le moteur et la session publique, valide chaque image et la progression jusqu’à WIN.
- `scripts/verify-ui-dom.mjs` : exécute le HTML réellement compilé avec Happy DOM, le canvas et des temporisations contrôlées. Pour ce contrôle, fournir `HAPPY_DOM_MODULE` vers le module Happy DOM disponible.
- `scripts/solver.mjs` et `tests/witnesses.json` : outils d’auteur uniquement ; ils ne sont pas inclus dans le HTML.
- `reference/*necessity*` / `*ablation*` : recherches et preuves de passages obligés. Une recherche interrompue à sa limite reste explicitement inconclusive.

Le jeu expose uniquement les pixels, les actions disponibles, les états et compteurs publics. Il n’expose ni état sémantique de la carte, ni solution, ni plan de visée. Les parcours garantissent la possibilité de terminer ; ils ne prétendent pas être optimaux ou uniques.
