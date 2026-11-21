# Intégration native de SS12

**SS12 — La Colonne en Marche** est le douzième jeu de Custom 4. Il réunit le Guerrier rouge et le Barde magenta. Le raccordement sur la branche `codex/ss12-custom4` reprend le laboratoire 0.1.0 intégré au commit `f0a1ff43799880f6fed476187200defb5de11925`.

## Raccordement

- L’adaptateur `src/games/sinking-star-ss12.ts` est chargé à la demande par le dispatcher natif. Il valide le niveau avant de remplacer sa session et contrôle les coordonnées pixel entières de l’ACTION6.
- Le Playground utilise les huit niveaux `ss12-01` à `ss12-08` dans l’ordre du laboratoire et reprend les métadonnées, le tutoriel et la détection des treize découvertes à partir des pixels publics. Annuler conserve les découvertes. Recommencer, Repartir et changer de niveau les effacent.
- Les contrôles partagés transmettent les six actions au moteur. La présentation conserve les images et les durées, respecte la préférence de réduction des animations et protège la nouvelle observation contre les images annulées. Les panneaux terminaux attendent la dernière image.
- Les huit aperçus réels suivent SS11 dans la galerie. Le catalogue compte 112 jeux et la galerie 732 aperçus. Les crédits Steam et les deux références du niveau 8 sont accessibles.
- L’agent SRA reçoit le contrat public du jeu. Les parcours d’auteur, les scripts de conception et les solveurs restent dans le laboratoire et les tests de validation.

## Contrôles

| Contrôle | Résultat |
| --- | --- |
| Laboratoire autonome | 25 tests moteur, huit parcours, 13 découvertes et contrôles Happy DOM réussis. Chromium a confirmé les pixels après 526 entrées ainsi que le rendu et les commandes à 390 px. |
| Parité native | 53 tests Custom 4 réussis. Les 526 entrées, 38 sélections et 1 548 images de SS12 concordent entre le laboratoire, l’adaptateur et le dispatcher. Les huit parcours gagnent sans refus ni mort. |
| Chromium dans le Playground | Huit parcours et 13 découvertes rejoués par l’interface réelle. Vérification des interruptions, du moment d’affichage de la victoire et de la défaite, des huit liens et vignettes et des commandes à 390 px. |
| Régressions | SS11 et SS01 réussis dans Chromium. Les jeux historiques CASC et LS20 se chargent et répondent aux actions dans le runtime Python. |
| TypeScript et production | `npm run typecheck`, `npm run build` et `git diff --check` réussis. |

Le test du mode agent vérifie la transmission d’une action publique, le verrouillage pendant l’animation et le retour aux commandes manuelles. Les huit victoires mesurées proviennent des parcours d’auteur.

## Coût du parcours partagé

Sept paires, après une paire d’échauffement, ont comparé le build de référence `f0a1ff43` au build intégrant SS12 (`ed0da190`). Playwright a alterné l’ordre des builds dans Microsoft Edge 158.0.4370.33, avec des contextes neufs et la même fenêtre 1440 × 1000. Chaque parcours charge SS09 ou SS11 depuis le niveau 1, puis exécute quatre actions publiques de SRA avec leurs rendus. Les actions envoyées sont identiques dans chaque paire.

La médiane des temps cumulés pour les deux jeux passe de **11 664,91 ms** à **12 160,69 ms**, soit **+4,25 %** pour un seuil de +10 %. Le fichier compilé du worker agent est identique dans les deux builds.

Reproduction avec les deux prévisualisations locales : `node scripts/compare-custom4-browser-cost.mjs http://127.0.0.1:4175 http://127.0.0.1:4174 7`.

## Publication

L’adresse de production et l’audience d’origine sont conservées. La qualification de livraison compare le SHA source enregistré par Sites au SHA de `main`, puis vérifie les ressources servies et les chemins de jeu. Le compte rendu de livraison relève la version de production et le SHA observés.

[Site SRA Playground](https://sra-playground.yannick-fontan.chatgpt.site/) · [Jouer à SS12](https://sra-playground.yannick-fontan.chatgpt.site/?game=SS12#playground)
