# SS16 — livraison et intégration

## Périmètre de ce lot

Développer **Les Ponts Engloutis**, premier trio de la série : Marchand, Guerrier, Voleur. Livrer huit cartes, un tutoriel de vingt découvertes, le moteur, une démo HTML autonome, les sources d’adaptation, les routes et les contrôles. Le raccordement natif Custom 4 et la publication du Site constituent l’étape suivante.

## Travail réalisé

- Contrat déterministe à trois héros et trois destinations.
- Capacités historiques, appuis fixes, reflets globaux, commandes à plusieurs poids, presses latérales, plateformes et combat.
- Tutoriel actif au niveau 1, commandes 1/2/3 et cycle Tab, informations déduites des pixels publics.
- Sources précises et différences de règles documentées.
- Vérifications moteur, campagne et HTML compilé ; audit de raccourcis sur les cartes structurantes.

## État de qualification

Les comptes définitifs et la portée des audits sont centralisés dans `docs/validation.md` et les rapports JSON de `validation/`. Une seule valeur de version décrit la livraison : `package.json` fait autorité. Les outils d’auteur et rapports ne sont jamais intégrés au HTML.

La revue des premières cartes a reproduit puis corrigé deux solutions qui réduisaient les investissements du tutoriel. La revue indépendante des finales a reproduit trois anciens contournements et vérifié leur blocage sur les cartes corrigées. Une solution alternative avancée à un appui est conservée dans le niveau 8. Les recherches restreintes ne sont pas présentées comme une preuve globale de nécessité ou de difficulté.

## GitHub et Site

Branche de travail : `feat/sinking-star-ss16-20261122`. Base de développement : `2e7a392ec6723353f095f906b537071ae86bddcd`. Les changements concurrents de l’intégration native SS15 jusqu’à `82f17f3981fcbb785ee5fd15c660e75ebc4d7466` ont été récupérés et conservés. Le point de sauvegarde candidat est `e022d35852031150ee3ef66fedcd8c262af5cafa` ; il précède les corrections définitives des finales.

GitHub reste la source canonique. Les points de sauvegarde sont poussés sur la branche de travail ; la livraison qualifiée est intégrée sur le `main` courant en préservant les changements parallèles. Les SHA réels sont donnés dans le compte rendu de livraison et vérifiables dans l’historique Git.

Ce lot ne publie pas de nouvelle version du Site et ne prétend pas synchroniser une version déployée. La prochaine étape consiste à suivre `docs/codex-integration-prompt.md` : adaptateur natif, galerie Custom 4, tests du dispatcher et du navigateur, commit/push/main, publication puis vérification de l’identité du code publié.
