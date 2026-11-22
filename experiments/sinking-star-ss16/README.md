# SS16 — Les Ponts Engloutis

Laboratoire autonome de la série Sinking Star pour **SRA Playground / ARC-3-AGENT**. SS16 ouvre les jeux à trois personnages : **Marchand orange (12), Guerrier rouge (8), Voleur vert (14)**. Huit salles, trois destinations simultanées, image de 64 × 64 pixels et palette de seize couleurs.

Le problème central est de choisir quand une caisse doit rester mobile et quand elle peut devenir un appui définitif. Les trois rôles préparent des positions différentes : le Marchand pousse une pièce, le Guerrier une file, le Voleur tire la pièce située derrière lui. Les miroirs, les commandes à plusieurs poids, les presses et les plateformes changent ensuite l’ordre des opérations.

## Jouer et reconstruire

```sh
npm ci
npm run build
```

Ouvrir `dist/SS16-demo.html` dans un navigateur. Le HTML contient le moteur, les cartes, le tutoriel et l’interface ; aucune connexion n’est nécessaire pour jouer. Les liens de référence sont des lectures facultatives.

| Commande | Effet |
| --- | --- |
| Flèches ou boutons directionnels | Déplacement et capacité du héros sélectionné |
| 1 / 2 / 3 | Marchand / Guerrier / Voleur |
| Tab dans la grille | Cycle des trois héros |
| Clic sur un héros ou bouton de rôle | Sélection sans action du monde |
| Espace / X | Réflexion globale des miroirs |
| Z / Annuler | Annulation de toute la cascade, même après une fin de salle |
| R / Recommencer | Position initiale de la salle courante |
| Repartir du niveau 1 | Nouvelle campagne et remise à zéro des découvertes |

Le sélecteur permet de visiter les huit salles. La victoire de campagne exige leur complétion, quel que soit l’ordre choisi.

## Un tutoriel qui est aussi une énigme

Le niveau 1, **L’atelier des trois passeurs**, contient vingt découvertes. Le suivi décrit uniquement les images publiques observées : changements de personnage, trois capacités, file et extraction simple, lâcher latéral, déplacement du miroir, caisses immergées, traversée des appuis, plateforme retirée, reflets de héros et de caisse, bouton, porte, presse, monstres et destinations.

Les coches ne déverrouillent aucune porte. Les passages demandent de vrais appuis, des poids et des positions compatibles. Elles restent acquises après Annuler et sont effacées par Recommencer. Les aides détaillées restent disponibles dans les autres salles.

## Sources et adaptations

Les deux index demandés sont [les zones mixtes](https://sinkingstarwalkthrough.com/fr/crossovers/) et [le monde Nord](https://sinkingstarwalkthrough.com/fr/north/). Chaque salle attribue ses références précises et explique les contraintes conservées. Les cartes sont propres à SS16 ; elles ne revendiquent pas une reproduction case par case du jeu commercial.

Lire [l’audit des sources](docs/source-audit.md), [la conception des niveaux](docs/level-design.md) et [la spécification](docs/specification.md). Les règles de la série SS font autorité : appuis fixes et conservés lors d’une réactivation hydraulique, reflets sans duplication, combat orthogonal simultané.

## Vérifier

```sh
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

Les tests de mécanique sont séparés des huit témoins de solvabilité. `validate:ui` exécute le vrai HTML compilé dans Happy DOM, contrôle les commandes, les pixels, les durées et les transitions. Les recherches et contre-branches de conception sont des outils d’auteur dont la portée est explicitée. Un parcours gagnant n’est pas une preuve d’optimalité, d’unicité ou de résolution autonome par SRA.

Les résultats et limites de la livraison sont consignés dans [validation](docs/validation.md). La revue native du fichier local a été bloquée dans l’environnement de travail ; elle n’est pas annoncée comme réussie.

## Structure et intégration

- `src/core.ts` : moteur déterministe et `TrioPuzzleSession`.
- `src/levels.ts` / `src/level-info.ts` : huit cartes et crédits publics.
- `src/tutorial.ts` : sélection et découvertes à partir des pixels publics.
- `src/browser.ts` / `index.template.html` : interface autonome.
- `tests/`, `scripts/solver.mjs`, `reference/` : témoins, audits et outils d’auteur, exclus du HTML.
- `docs/codex-integration-prompt.md` : consigne de raccordement natif et publication ultérieure.

Les changements de ce laboratoire ne modifient pas le dispatcher, le catalogue ou le runtime partagé de SRA Playground. L’étape native devra reprendre le contrat à trois héros, les animations, les crédits et les commandes. La chaîne de publication reste **tests → commit → push → main → publication → vérification du SHA**.
