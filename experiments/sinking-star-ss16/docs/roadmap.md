# SS16 — livraison et intégration

## Périmètre de ce lot

Développer **Les Ponts Engloutis**, premier trio de la série : Marchand, Guerrier, Voleur. Livrer huit cartes, un tutoriel de vingt découvertes, le moteur, une démo HTML autonome, les sources d’adaptation, les routes et les contrôles. Le raccordement natif Custom 4 reprend le moteur, le tutoriel et les cartes de la révision 0.2.0.

## Travail réalisé

- Contrat déterministe à trois héros et trois destinations.
- Capacités historiques, appuis fixes, reflets globaux, commandes à plusieurs poids, presses latérales, plateformes et combat.
- Tutoriel actif au niveau 1, commandes 1/2/3 et cycle Tab, informations déduites des pixels publics.
- Sources précises et différences de règles documentées.
- Vérifications moteur, campagne et HTML compilé ; audit de raccourcis sur les cartes structurantes.

## Révision 0.2.0 — niveau 5 et miroirs

- Niveau 5 : charge de relève à charger puis récupérer, réserve sous clef, extraction et changement d’axe des deux charges, réemploi de la clef et de la charge de relève, sas à deux poids avec plateformes retirées.
- Le contournement de la réserve par son flanc nord a été reproduit puis fermé ; les revues d’auteur et indépendante conservent leurs témoins et précisent la portée des contre-branches.
- Miroirs : les refus dus aux murs, portes, presses, occupants et conflits signalent les miroirs concernés en rouge/normal/rouge/normal, sans déplacement ni nouvelle annulation. La vraie salle 8 fait partie des scénarios HTML.
- Le moteur, les huit parcours, les vingt découvertes, le HTML et les audits sont requalifiés pour le fichier livré ; les résultats définitifs sont dans `docs/validation.md`.

## État de qualification

Les comptes définitifs et la portée des audits sont centralisés dans `docs/validation.md` et les rapports JSON de `validation/`. Une seule valeur de version décrit la livraison : `package.json` fait autorité. Les outils d’auteur et rapports ne sont jamais intégrés au HTML.

La revue des premières cartes a reproduit puis corrigé deux solutions qui réduisaient les investissements du tutoriel. La revue indépendante des finales a reproduit trois anciens contournements et vérifié leur blocage sur les cartes corrigées. Une solution alternative avancée à un appui est conservée dans le niveau 8. Les recherches restreintes ne sont pas présentées comme une preuve globale de nécessité ou de difficulté.

## GitHub et Site

Branche de la révision : `fix/ss16-level5-mirror-alert-20261122`, depuis la livraison intégrée `bfa3ff3246f88b7b88127858bb73c02561dc8858`. Branche du premier lot : `feat/sinking-star-ss16-20261122`. Base de développement : `2e7a392ec6723353f095f906b537071ae86bddcd`. Les changements concurrents de l’intégration native SS15 jusqu’à `82f17f3981fcbb785ee5fd15c660e75ebc4d7466` ont été récupérés et conservés. Le point de sauvegarde candidat est `e022d35852031150ee3ef66fedcd8c262af5cafa` ; il précède les corrections définitives des finales.

La mise à jour concurrente du planificateur SIC `3403bc11b0cd1f60517ea52bfc3579be2bc99f54` est conservée lors de l’intégration de cette révision ; les corrections SS16 restent dans leur laboratoire.

GitHub reste la source canonique. Les points de sauvegarde sont poussés sur la branche de travail ; la livraison qualifiée est intégrée sur le `main` courant en préservant les changements parallèles. Les SHA réels sont donnés dans le compte rendu de livraison et vérifiables dans l’historique Git.

## Intégration native de la révision 0.2.0

- Le clone dédié et la branche `codex/ss16-custom4` partent de `dd7922c3`. La révision SIC publiée précédemment fait partie de cet historique.
- SS16 suit SS15 dans Custom 4 avec huit vignettes, huit liens directs, les trois rôles, trois destinations et les vingt découvertes du niveau 1.
- Les cinq commandes du laboratoire ont réussi. Les résultats couvrent 40 tests moteur, 29 scénarios HTML et 23 contrôles du niveau 5 renforcé. Les 65 tests natifs, le typage et le build du Playground ont réussi.
- Les huit parcours concordent sur 1 243 entrées, 126 sélections et 3 655 images avec leurs durées. Les fins de salle sont annulées puis rejouées. Reset, Restart, les entrées invalides, la défaite et la victoire finale sont contrôlés.
- Chromium vérifie les rôles, commandes, vignettes et liens à 1440 et 390 px. Le niveau 5 renforcé est rejoué en 265 entrées depuis son lien direct. Le niveau 8 affiche les quatre phases rouge/normal/rouge/normal avec les durées et le comportement Undo attendus. Les régressions SS15, SS01, CASC et LS20 ont réussi.

Le coût global mesuré sur SS09 et SS12 baisse de **0,35 %**, dans la tolérance de +10 %. La médiane du temps cumulé passe de **6 538,05 ms** (`dd7922c3`) à **6 515,29 ms** (build de `ce4a1c7a`). Cinq paires après échauffement alternent les deux builds dans Microsoft Edge 158.0.4370.33. Chaque parcours charge le jeu au niveau 1 et exécute quatre actions publiques de SRA rendues à l’écran. Les actions sont identiques avant et après.

Pour reproduire, définir `CUSTOM4_BENCH_GAMES=SS09,SS12` et lancer `node scripts/compare-custom4-browser-cost.mjs http://127.0.0.1:4175 http://127.0.0.1:4174 5` avec les deux builds servis localement.

La livraison utilise le Site existant et conserve son audience. Le compte rendu de livraison contient le numéro de version, son SHA source et la vérification avec le `main` distant.

[Jouer à SS16](https://sra-playground.yannick-fontan.chatgpt.site/?game=SS16#playground)

## Suite

Évaluer la résolution autonome de SS16 par SRA depuis les observations publiques. Les victoires constatées pour cette intégration proviennent des parcours d’auteur.
