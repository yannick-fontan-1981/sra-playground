# SS09 — Le Chœur des Miroirs

Laboratoire autonome **Marchand + Barde**, neuvième jeu Sinking Star destiné à Custom 4. Version 0.1.0 / HTML v1 : huit salles, tutoriel riche au niveau 1, pixels 64 × 64 et cellules de 3 × 3.

## Jouer et reconstruire

```bash
npm install
npm test
npm run validate
```

Ouvrir `dist/SS09-demo.html`. Le fichier est autonome et fonctionne hors ligne.

- Marchand orange (12) : marche et pousse une seule pièce, un miroir ou le Barde.
- Barde magenta (6) : marche et entraîne caisses, monstres, appuis et Marchand dans son aura de 5 × 5 cases. Les membres bloqués restent en place ; les miroirs ne suivent pas.
- Espace / X : reflets géométriques des miroirs, sans chant.
- Clic, Tab, 1/2 : sélection. Z : annuler. R : recommencer. Les huit salles sont sélectionnables.

Les deux héros doivent occuper les deux destinations. Le tutoriel suit douze découvertes à partir des seuls pixels publics. L’aura est en pointillés magenta, la prévisualisation d’un héros est un + gris clair, celle d’une caisse un contour gris clair. Le Marchand peut pousser le Barde sans entraîner les poids voisins.

## Sources et portée

Les sept salles suivant le tutoriel adaptent des principes des index [North](https://sinkingstarwalkthrough.com/fr/north/) et [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/) : Heroes 3: Bard, Druid 13–15, Heroes and Mirrors 1–2, Heroes and Water 27–28 et Heroes and Light 1. La géométrie est originale, les écarts et sources figurent dans `reference/levelN-design.json`. Aucune reproduction exacte du jeu commercial n’est revendiquée.

## Validation

Le moteur possède 95 tests. Les huit parcours d’auteur totalisent 411 actions, 31 sélections et 1 218 images, jusqu’à WIN. Le HTML compilé passe dix groupes de vérification, onze cas Barde, trois cas de reflets et deux défaites réelles. Les douze découvertes du tutoriel sont atteintes.

Les parcours attestent la possibilité de terminer, pas une solution unique ou optimale. Quelques ablations sont exhaustives ; toute recherche limitée reste indiquée comme inconclusive. Le duel de L4 est une résolution proposée, sa nécessité universelle n’est pas affirmée.

Le HTML et l’agent ne contiennent ni solveur ni témoin. `DuoPuzzleSession` expose pixels, palette, animations, durées, commandes et progression. Les sources sont livrées sur une branche de travail avant revue HTML ; le raccordement natif, la fusion main et la publication Site constituent l’étape suivante.
