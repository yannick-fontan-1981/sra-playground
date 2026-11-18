# SS05 — Le Chant Magenta

Version 0.1.1. Laboratoire HTML autonome du cinquième jeu Sinking Star pour SRA Playground, avec un Barde magenta et huit niveaux. Le premier niveau est chargé immédiatement et son tutoriel est ouvert.

## Jouer

Ouvrir `dist/SS05-demo.html` après compilation. Le fichier est autonome : pas de bibliothèque distante, de compte, de serveur ni de connexion réseau nécessaire pour jouer.

- Flèches / ACTION1–4 : marcher et entraîner les objets proches dans le même sens.
- Espace (ou X) / ACTION5 : activer les miroirs sans déclencher le chant.
- Z : annuler une action complète, y compris ses conséquences et un changement de niveau.
- R : recommencer le niveau courant.
- Le sélecteur permet d’essayer chaque salle. La victoire demande de terminer les huit.

Le chant sélectionne les caisses, monstres et appuis à deux cases du Barde, dans un carré de 5 × 5 cases. Un objet bloqué reste en place. Si le Barde ne peut pas avancer, tout le mouvement est refusé. Une caisse dans l’eau devient un appui ; ces appuis peuvent glisser sur l’eau avec le chant. Les déplacements sont animés en trois images, avec un déplacement de 1, 2 puis 3 pixels. Les reflets ont leur propre animation : la destination du Barde est un + gris clair et celle des caisses reste un contour carré gris clair. L’aura du chant est délimitée par des pointillés magenta qui accompagnent les déplacements.

## Campagne

| Niveau | Salle | Origine | Parcours vérifié |
| --- | --- | --- | ---: |
| 1 | L’atelier du chant | Création : chant, ancrage, presse, pont et miroir | 32 actions |
| 2 | Les trois blocs du crochet | Heroes 3, énigme 12 | 59 actions |
| 3 | La ronde des sentinelles | Heroes 3, énigme 10 | 51 actions |
| 4 | La cage en U | Heroes 3, énigme 11 | 87 actions |
| 5 | Rompre le chant | Adaptation de Heroes and Mirrors, énigme 1 | 31 actions |
| 6 | Le contretemps des trois îlots | Adaptation de Heroes and Mirrors, énigme 2 | 26 actions |
| 7 | Les écluses en cadence | Création : plateformes mobiles et trois presses | 63 actions |
| 8 | La forteresse des trois voix | Création : monstres, miroirs et cascade de presses | 46 actions |

Ces parcours constituent des preuves de résolution, pas des minima annoncés ni des résultats d’un agent SRA. Les solutions alternatives sont conservées. Le dernier niveau admet notamment une solution plus courte de 37 actions, documentée dans sa revue indépendante.

## Construire et vérifier

Depuis ce répertoire, avec Node 22 ou supérieur :

```bash
npm install
npm test
npm run validate
```

Le vérificateur facultatif de l’interface utilise Happy DOM. Il exécute l’HTML réel, les commandes clavier et les boutons, et compare chaque image du canvas aux observations du moteur :

```bash
HAPPY_DOM_MODULE=/chemin/absolu/vers/happy-dom/lib/index.js node scripts/verify-ui-dom.mjs
```

Le rapport décrit honnêtement cet environnement : ce n’est pas un test dans un navigateur natif. Les pixels des huit cartes sont également rendus et inspectés. Les scripts de recherche, parcours témoins et états d’auteur ne sont jamais embarqués dans l’HTML.

## Organisation

- `src/core.ts` : moteur déterministe, pixels, animations et `BardPuzzleSession`.
- `src/levels.ts` et `src/level-info.ts` : huit cartes et références affichées.
- `src/browser.ts` et `index.template.html` : interface française et tutoriel fondé sur les pixels publics.
- `tests/` : cas de règles et parcours reproductibles.
- `scripts/solver.mjs` : recherche d’auteur, séparée du produit et de l’agent.
- `reference/` : grilles sources, choix d’adaptation, dessins des niveaux et revue indépendante.
- `validation/` : résultats de vérification de cette version.

La branche du laboratoire conserve ce travail avant une éventuelle intégration à Custom 4. Ce répertoire ne modifie pas le catalogue, le routeur natif ou le site publié. Voir `docs/integration.md` pour le contrat à respecter lors du raccordement.
