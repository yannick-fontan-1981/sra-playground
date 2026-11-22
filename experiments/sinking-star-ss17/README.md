# SS17 — La Forteresse Rose

Laboratoire autonome **0.1.0**, dix-septième jeu de la série Sinking Star : **Guerrier / Voleur / Magicien**, huit salles originales et un tutoriel de **23 découvertes** au niveau 1.

Le Guerrier rouge pousse une file entière. Le Voleur vert tire seulement l’occupant adjacent derrière lui. Le Magicien violet échange sa place avec la première cible de sa visée ; un miroir peut dévier ce rayon. Les trois héros doivent occuper simultanément les trois destinations jaunes.

## Jouer et construire

```sh
npm ci
npm run build
```

Ouvrir `dist/SS17-demo.html` dans un navigateur autorisé. Le fichier contient tout le jeu et ne requiert aucun réseau. Le HTML n’embarque ni solutions, ni solveur, ni état sémantique destiné à l’agent.

| Commande | Effet |
|---|---|
| Flèches ou boutons directionnels | Capacité du héros actif ; marche lorsque sa règle le permet |
| 1 / 2 / 3 | Guerrier / Voleur / Magicien |
| Tab ou clic sur un héros | Changer le héros sélectionné sans faire avancer le monde |
| Espace / X | Activer les reflets globaux, distincts de la visée du Magicien |
| Z | Annuler l’action et sa cascade, même après la fin d’une salle |
| R | Recommencer la salle |
| Maj + Tab | Quitter le focus du plateau |

Les commandes sont également disponibles sous forme de boutons. Le suivi pédagogique observe les pixels publics et conserve les découvertes après Annuler. Recommencer remet le suivi à zéro. Les découvertes n’interviennent jamais dans la condition de victoire.

## Références et conception

Les deux index demandés sont [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/) et [Nord](https://sinkingstarwalkthrough.com/fr/north/). Chaque salle indique ses énigmes de référence et son objectif. La campagne adapte des contraintes identifiées dans Heroes of Hauling, Heroes and Water et Heroes and Mirrors : relève des poids, conservation des occupants, première cible, virages de visée, récupération des ressources et déplacement des miroirs.

Les cartes, les coordonnées et les parcours sont originaux. Les différences avec le jeu source sont déclarées : trois héros fixes, appuis permanents, presses latérales, absence de duplication ou de fusion, miroirs non échangeables. Les solutions alternatives élaborées trouvées pendant la revue restent valides et sont archivées séparément.

## Qualification

```sh
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

`docs/validation.md` donne les résultats exacts et leur portée. Les tests de l’interface rejouent le HTML compilé dans Happy DOM avec contrôle des pixels et des temporisations. Ils ne remplacent pas une revue du rendu CSS dans un navigateur natif.

## Organisation

- `src/core.ts` : règles, rendu et session.
- `src/levels.ts` : huit cartes livrées ; `src/level-info.ts` : objectifs et crédits publics.
- `src/tutorial.ts` : 23 découvertes et sélection déduites des images.
- `src/browser.ts` et `index.template.html` : interface autonome.
- `reference/author/` : construction et revues des cartes, réservées à l’auteur.
- `reference/level*-design.json` : spécifications et parcours explicatifs ; variantes dans des fichiers séparés.
- `scripts/solver.mjs` et `tests/witnesses.json` : outils de qualification, exclus du jeu.
- `validation/` : rapports générés à partir des sources livrées.
- `docs/specification.md`, `docs/level-design.md`, `docs/source-audit.md` : contrat, conception et références.
- `docs/codex-integration-prompt.md` : consigne pour le raccordement natif à Custom 4 et la publication du Site existant.

Le laboratoire est sauvegardé dans GitHub. L’intégration native, les essais autonomes de SRA et la publication du Site sont suivis séparément dans `docs/roadmap.md`.
