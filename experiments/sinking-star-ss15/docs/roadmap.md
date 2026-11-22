# SS15 — Feuille de route

## Laboratoire 0.2.0

- [x] Magicien violet + Barde magenta, échange dirigé et chant carré.
- [x] Rayon dévié, relais de miroirs et retour en boucle animé.
- [x] Reflets globaux, commandes, presses, plateformes et combat simultané.
- [x] Appuis immergés mobiles et ancrage sous les héros.
- [x] Ancien niveau 4 déplacé en première position.
- [x] Atelier de vingt découvertes déplacé en quatrième position, avec passages conditionnés.
- [x] Huit salles originales ou adaptées, avec sources et changements déclarés.
- [x] Finales avec ressources réemployées et contre-exemples locaux exécutés.
- [x] HTML autonome, contrôles complets et interruptions d’animation.
- [x] 38 tests moteur, huit routes gagnantes et rejeu du HTML compilé.
- [x] Revue indépendante des deux finales et des textes publics.
- [x] Atelier L4 : 142 entrées, vingt découvertes, six contre-branches et accès directs contrôlés.
- [x] Campagne réordonnée : 732 entrées, 2 153 images, aucun refus ni décès.
- [x] Documentation de règles, conception, sources, validation et intégration.

Les métriques et l’empreinte exacte de la construction qualifiée se trouvent dans `docs/validation.md` et `validation/`. Le code de ce lot est isolé sous `experiments/sinking-star-ss15/`.

## Intégration native et livraison

- [x] Adaptateur et dispatcher natifs. SS15 suit SS14 dans Custom 4 et dispose de huit liens directs et vignettes.
- [x] Campagne 0.2.0 dans l’ordre corrigé. L1 est « L’appui des deux traversées » et l’atelier renforcé est en L4.
- [x] Parité des huit témoins entre laboratoire, adaptateur et dispatcher. 732 entrées, 56 sélections et 2 153 images avec leurs durées. Annulation et reprise de chaque fin de salle.
- [x] `npm ci`, tests et quatre validations du laboratoire. 38 tests moteur et les contrôles de l’atelier et des finales ont réussi.
- [x] 61 tests Custom 4, 55 contrôles SIC/attention, typage et build réussis. Chromium a vérifié SS14, SS01, CASC et LS20.
- [x] Chromium sur ordinateur et à 390 px. Vingt découvertes en L4, Repartir vers L1, commandes, interruptions, victoire, défaite et pixels du bouton et de la presse de l’atelier vérifiés.

Le coût global mesuré sur SS09 et SS12 augmente de **1,74 %**, pour une tolérance de +10 %. La médiane des temps cumulés passe de **7 775,68 ms** (`2e7a392e`) à **7 911,14 ms** (`e4d42920`). Playwright alterne les deux builds dans Microsoft Edge 158.0.4370.33, avec cinq paires après échauffement, des contextes neufs et la même fenêtre. La mesure couvre le chargement et quatre actions SRA rendues à l’écran par jeu. Les actions publiques et le fichier compilé du worker agent sont identiques.

Reproduction avec les deux prévisualisations en cours et `CUSTOM4_BENCH_GAMES=SS09,SS12` : `node scripts/compare-custom4-browser-cost.mjs http://127.0.0.1:4175 http://127.0.0.1:4174 5`.

La publication utilise le Site existant et son audience. Le compte rendu de livraison donne la version publiée, le SHA source et sa correspondance avec `main` après vérification du jeu déployé.

[Jouer à SS15](https://sra-playground.yannick-fontan.chatgpt.site/?game=SS15#playground) · [Ouvrir l’atelier de L4](https://sra-playground.yannick-fontan.chatgpt.site/?game=SS15&level=4#playground)

## Suite

Évaluer séparément la résolution autonome de SS15 par SRA depuis les observations publiques. Les victoires de validation proviennent des parcours d’auteur.

## Identité du laboratoire

| Élément | Référence |
| --- | --- |
| Dépôt canonique | `yannick-fontan-1981/sra-playground` |
| Branche de travail | `fix/ss15-workshop-order-20261122` |
| Base main vérifiée au démarrage | `a14bd33e34c187c0c4fee2039676bfca43760465` |
| Révision locale / distante du laboratoire | Commit contenant ce dossier, relevé dans le compte rendu de livraison et par `git log -1 -- experiments/sinking-star-ss15` |
| Branche canonique visée pour le laboratoire | `main`, avec contrôle du parent et du même arbre avant mise à jour |
| Version du laboratoire | `0.2.0` |

Conformément à `AGENTS.md`, le laboratoire doit être poussé sur GitHub avant la livraison. Le compte rendu fournit les SHA effectivement vérifiés ; la version du Site ne doit jamais servir d’archive unique du code.
