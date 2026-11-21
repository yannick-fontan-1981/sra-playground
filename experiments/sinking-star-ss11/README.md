# SS11 — La Forge des Reflets

Laboratoire autonome du onzième jeu de Custom 4 : **Guerrier rouge (8) + Magicien violet (15)**. Version **0.1.2**, huit niveaux et un tutoriel de douze découvertes au niveau 7. Image de **64 × 64 pixels**, grille logique 20 × 20, cellules de **3 × 3 pixels**, seize couleurs.

Le tutoriel **La cour aux deux sorties**, désormais en septième position, est une carte à trois branches : chantier à l’est, destination au nord et atelier optique au sud-ouest. Une caisse remplit plusieurs rôles successifs. Cette carte remplace le premier atelier, trop proche de SS08 L4.

## Jouer

Ouvrir `dist/SS11-demo.html`. Le fichier fonctionne hors ligne et commence au niveau 1, **La relève du gardien**. Le tutoriel est accessible au niveau 7 dans le sélecteur.

- **Flèches** : le Guerrier marche ou pousse une file complète. Le Magicien échange sa place avec la première caisse, créature ou personnage visé ; sans cible, il marche.
- **Face blanche d’un miroir** : dévie le rayon du Magicien à angle droit. Le dos noir le bloque.
- **Espace / X** : active les reflets géométriques.
- **Tab, 1, 2 ou clic sur un héros** : sélection sans faire avancer le monde.
- **Z / Ctrl+Z** : annuler toute l’action. **R** : recommencer le niveau.
- Les **deux contours jaunes** doivent être occupés simultanément.

Le Guerrier prépare les positions et les appuis ; le Magicien extrait les pièces et relaie les occupants des boutons. Les caisses immergées deviennent des appuis fixes marron avec X cyan. Les monstres frappent leurs voisins orthogonaux après une action effective. Une presse qui se ferme pousse dans le sens de son repère.

## Sources et campagne

Les sources viennent de [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/) et du [Nord](https://sinkingstarwalkthrough.com/fr/north/). L1–L6 adaptent respectivement Heroes of Hauling 13 et 11, Heroes 2: Monsters 15, Heroes and Mirrors 21, Heroes and Light 4 et Heroes and Mirrors 30. L7 est le tutoriel original **La cour aux deux sorties**. L8 adapte Heroes and Water 11.

Chaque `reference/levelN-design.json` documente les éléments conservés, les modifications et une route de construction. Les captures ont été consultées comme références ; aucune reproduction exacte n’est revendiquée. Voir `docs/level-design.md`.

## Reconstruire

```sh
npm install
npm run build
npm test
npm run validate
```

Après une modification de carte, exécuter son `reference/author/build-levelN.mjs`, puis `node scripts/sync-levels.mjs` et reconstruire. Le build ne lance pas de solveur.

`src/core.ts` définit les règles et observations. `src/tutorial.ts` déduit ses leçons des pixels publics. `src/browser.ts` et `index.template.html` produisent le HTML. Les références, parcours et scripts d’auteur sont exclus du bundle.

L’intégration au catalogue natif est une étape séparée : `docs/codex-integration-prompt.md` prépare cette suite. Cette livraison est le laboratoire HTML.
