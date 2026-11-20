# SS04 — L’Axe violet

Laboratoire autonome v0.1.0 pour SRA Playground / Custom 4. **Huit niveaux jouables**, avec le niveau 1 chargé et son tutoriel ouvert. Le Magicien violet échange automatiquement avec le premier bloc ou monstre visible dans la direction choisie ; sinon il marche d’une case.

## Jouer

Construire puis ouvrir `dist/SS04-demo.html`. Le fichier contient toute la démo, fonctionne hors ligne et ne charge aucune dépendance réseau. Utiliser les quatre flèches, **Z** pour annuler, **R** pour recommencer. Le menu permet de visiter les huit niveaux et de revenir au tutoriel.

Les cases logiques mesurent **3 × 3 pixels** dans une image **64 × 64**. Les miroirs fixes renvoient la visée ; les monstres immobiles menacent les cases cardinales voisines. Les blocs peuvent tenir des boutons ou devenir des appuis dans l’eau grâce aux presses latérales. Les deux dernières salles combinent ces règles.

## Niveaux et vérification

| Niveau | Titre | Actions du parcours vérifié | Échanges | Presses / appuis créés |
|---|---|---:|---:|---:|
| 1 | L’atelier des échanges | 34 | 3 | 1 / 1 |
| 2 | Le convoyeur des trois salles | 54 | 5 | 0 / 0 |
| 3 | L’échiquier des neuf blocs | 17 | 5 | 0 / 0 |
| 4 | La galerie des sentinelles | 36 | 17 | 0 / 0 |
| 5 | Le long détour des îlots | 79 | 8 | 0 / 0 |
| 6 | Les deux relais | 35 | 6 | 0 / 0 |
| 7 | Les deux digues | 79 | 6 | 2 / 2 |
| 8 | La citadelle des deux presses | 64 | 5 | 2 / 1 |

Les parcours sont des témoins de solvabilité, sans affirmation globale de minimalité. Les quatre témoins de grilles transcrites sont conservés depuis les sources. Les reprises et adaptations sont distinguées dans l’interface et `docs/provenance.md`.

## Construire et tester

Node.js 22 ou ultérieur, TypeScript 5.9.3.

```bash
npm install
npm test
npm run validate
```

- `npm test` compile, construit le HTML et exécute **42 tests** du moteur, des animations, des presses et du solveur d’auteur.
- `npm run validate` rejoue les **398 actions** des huit témoins. Résultat : 55 échanges, dont 5 réfléchis et 8 échanges avec un monstre ; 5 poussées de presse ; 4 appuis créés ; aucune action refusée, aucune mort.
- `scripts/verify-ui-dom.mjs` exécute le véritable HTML compilé dans Happy DOM et compare chaque image de chaque parcours au moteur. **11 contrôles** passent, dont les six leçons du tutoriel, les annulations pendant animation, WIN et une défaite par monstre avec Undo/Reset.

Pour reproduire le contrôle DOM dans un environnement où Happy DOM est installé :

```bash
HAPPY_DOM_MODULE=/absolute/path/to/happy-dom/lib/index.js node scripts/verify-ui-dom.mjs
```

La vérification comprend aussi une inspection du rendu exact des huit images initiales. Le test DOM n’est pas une vérification visuelle dans Chromium ; l’intégration au site devra être testée dans un navigateur réel.

## Fichiers utiles

- `src/core.ts` : moteur déterministe, `WizardPuzzleSession`, observations publiques en pixels.
- `src/levels.ts`, `src/level-info.ts` : cartes et crédits.
- `src/browser.ts`, `index.template.html` : tutoriel, commandes, présentation des animations.
- `tests/witnesses.json`, `scripts/solver.mjs` : outils d’auteur, exclus du HTML.
- `reference/` : grilles sources, adaptations, preuves et limites de recherche.
- `validation/` : rapports vérifiables de la livraison.
- `docs/specification.md`, `docs/level-design.md`, `docs/provenance.md`, `docs/integration.md` : règles, conception, attribution et raccordement futur.

## État de livraison

Le laboratoire est sauvegardé dans `experiments/sinking-star-ss04/` sur la branche `feat/ss04-wizard-lab-20261118`. Le compte rendu de livraison indique le commit final et son intégration éventuelle sur `main` après vérification distante. Ce dossier ne modifie ni le catalogue de production, ni le runtime du Playground, ni la version publiée du Site. Son raccordement comme quatrième jeu de Custom 4 est l’étape distincte décrite dans `docs/integration.md`.
