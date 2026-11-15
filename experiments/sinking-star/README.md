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

## État réel — version 0.1.0

- SS01 : **8 niveaux sur 8 jouables**, dont trois tutoriels élargis (25/25/24 cases accessibles avant le miroir, contre 2/4/3).
- **66 tests Node passent**, dont les 23 tests du pilote initial conservés ; compilation TypeScript stricte validée.
- Marchand, miroirs fixes, pierres échangeables, boutons, portes, eau bloquante et contrôles de session fonctionnent. Les cartes sont déclaratives et originales.
- Huit solutions vérifiées ; aucun raccourci par la marche seule ; aucun état accessible sans issue dans ces huit cartes. Validation reproductible par `npm --prefix experiments/sinking-star run validate`.
- Les quatre autres personnages, les pierres immergées, les monstres et les destinations multiples restent à développer.
- **1/25 jeux développé en autonomie ; 8/200 niveaux ; 0/25 intégré au Playground.** Aucun résultat de résolution par le SRA revendiqué.

## Architecture

`src/core.ts` : logique pure, rendu indexé et session ; aucun import DOM, SRA, Python ou Playground.

`src/levels.ts` : cartes originales déclaratives ; aucune branche du moteur fondée sur un identifiant de niveau.

`src/browser.ts` : interface manuelle du laboratoire, remplaçable sans modifier les règles.

`tests/pilot.test.mjs` : les 23 tests d'origine, avec les petites cartes historiques conservées en fixtures. `tests/campaign.test.mjs` : campagne de huit niveaux et nouvelles interactions. `tests/helpers/search.mjs` : recherche en largeur d'auteur, avec statut distinct pour budget épuisé. Ce solveur d'auteur n'est pas importé par le navigateur et ne sera pas transmis à l'agent.

`docs/specification.md` : contrat de SS01 et périmètre de la suite. `docs/validation.json` : témoins et mesures reproductibles, hors paquet navigateur.

`docs/roadmap.md` : lots, ordre d'intégration, critères de qualité et mesures.

## Point de départ vérifié

Dépôt : `yannick-fontan-1981/sra-playground`.

Base consultée : `main` au commit `cdab7463cca42d9457eee71f92dde9856808a099`, le 15 novembre 2026.

Le contrat `src/runtime/browser-games.ts` expose déjà les observations et les commandes nécessaires. Le worker `src/runtime/game-worker.ts` utilise encore Python/Pyodide pour les jeux existants. L'intégration future devra ajouter un chemin natif TypeScript pour SS01–SS25 **sans supprimer ni réécrire ce chemin existant**.

Seul le dossier `experiments/sinking-star/` est ajouté. Aucun import ni enregistrement dans la production, aucun changement de l'agent/SIC/Logos Engine. La compatibilité vérifiée ici est structurelle sur les observations, pas une validation de l'intégration complète.

## Qualification navigateur

Le HTML autonome a été exécuté dans Chromium via `set_content` (les URL `file://` sont bloquées dans cet environnement). Huit niveaux terminés au clavier, contrôles par boutons, Undo, Reset, Restart et affichage mobile vérifiés ; aucune requête HTTP ni erreur JavaScript. Cela ne constitue pas encore une qualification de l'adaptateur Playground.
