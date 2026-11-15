# Sinking Star Lab — SS01 à SS25

Prototype autonome destiné au SRA Playground. **Hors catalogue, hors agent, hors site publié.**

## Démarrage

Depuis un checkout du dépôt disposant de ses dépendances de développement :

```sh
npm --prefix experiments/sinking-star test
```

Le compilateur TypeScript du dépôt est réutilisé ; aucun paquet ni verrou de dépendances supplémentaire n'est nécessaire. `tsc` peut aussi être fourni dans le PATH pour travailler sur ce dossier seul.

Ouvrir ensuite `experiments/sinking-star/dist/ss01-demo.html` dans un navigateur. Le HTML généré contient tout le JavaScript et n'effectue aucun appel réseau. Ne pas ouvrir directement le fichier source `index.html`, qui est un gabarit.

Flèches = déplacement ; Espace = miroir ; Z = Undo. Les mêmes commandes sont proposées sous forme de boutons. Reset réinitialise le niveau courant ; Repartir du niveau 1 réinitialise la campagne. Un saut manuel de niveau ne crédite aucun niveau non résolu.

## État réel

- SS01 : **3 niveaux pilotes sur les 8 prévus**, volontairement élémentaires.
- 23 tests Node passent ; compilation stricte TypeScript passe.
- Les quatre orientations de miroir sont testées, mais les trois premières cartes utilisent la même orientation pour isoler l'apprentissage de distance et de blocage.
- Le marchand, les miroirs fixes, le déplacement, les murs, l'eau, la destination et les contrôles de session sont implémentés.
- Les pierres, boutons, portes, autres personnages et monstres ne sont **pas** encore implémentés.
- Aucun résultat de résolution par le SRA n'est revendiqué.
- 0 jeu complet sur 25 ; 3 niveaux pilotes sur une cible de 200.

## Architecture

`src/core.ts` : logique pure, rendu indexé et session ; aucun import DOM, SRA, Python ou Playground.

`src/levels.ts` : cartes originales déclaratives ; aucune branche du moteur fondée sur un identifiant de niveau.

`src/browser.ts` : interface manuelle du laboratoire, remplaçable sans modifier les règles.

`tests/pilot.test.mjs` : validation, exploration exhaustive des petits niveaux et recherche en largeur d'une solution témoin. Ce solveur d'auteur n'est pas importé par le navigateur et ne sera pas transmis à l'agent.

`docs/specification.md` : contrat du pilote et périmètre de la suite.

`docs/roadmap.md` : lots, ordre d'intégration, critères de qualité et mesures.

## Point de départ vérifié

Dépôt : `yannick-fontan-1981/sra-playground`.

Base consultée : `main` au commit `cdab7463cca42d9457eee71f92dde9856808a099`, le 15 novembre 2026.

Le contrat `src/runtime/browser-games.ts` expose déjà les observations et les commandes nécessaires. Le worker `src/runtime/game-worker.ts` utilise encore Python/Pyodide pour les jeux existants. L'intégration future devra ajouter un chemin natif TypeScript pour SS01–SS25 **sans supprimer ni réécrire ce chemin existant**.

Seul le dossier `experiments/sinking-star/` est ajouté. Aucun import ni enregistrement dans la production, aucun changement de l'agent/SIC/Logos Engine. La compatibilité vérifiée ici est structurelle sur les observations, pas une validation de l'intégration complète.
