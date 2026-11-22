# SS16 — qualification

Ce document sera figé avec les rapports après la dernière revue des finales. Les résultats faisant autorité sont les rapports JSON générés à partir de la version courante du moteur, des cartes et du HTML.

## Vérifications disponibles

- `tests/trio.test.mjs` : 36 tests de capacités, interactions du trio, eau, miroir, commandes, presses, combat, rendu, animation et session.
- `scripts/validate-levels.mjs` : huit témoins de solvabilité, contrat public, images et durées, progression, étapes d’auteur et couverture du tutoriel.
- `scripts/verify-ui-dom.mjs` : vrai HTML compilé exécuté dans Happy DOM, événements clavier/boutons/clic, buffers du canvas, temporisation contrôlée, interruptions et huit salles.
- `reference/author/review-level1.mjs` : reproduction de deux anciens raccourcis gagnants, blocage dans la carte corrigée et recherches directes restreintes.
- Audits des finales et contre-branches de construction : voir les scripts de `reference/author/` et les rapports de `reference/`.

Les vingt découvertes sont obtenues dans le niveau 1 par un parcours réel. Aucune donnée sémantique privée ni condition pédagogique n’est nécessaire pour gagner.

## Portée et limites

Un témoin gagnant prouve une possibilité de terminer. Les comptes d’actions sont ceux de parcours explicatifs, sélections comprises ; ils ne mesurent pas la difficulté et ne sont pas annoncés comme des minimums.

L’audit du tutoriel conserve les ressources et les deux autres héros fixes lors de ses recherches locales. Les files épuisées prouvent seulement l’absence de solution dans ce modèle restreint. La chambre finale a une entrée sèche par la porte `(18,4)` et une frontière d’eau en `(14,3)` : elle n’est pas décrite comme entièrement murée. Le parcours utilise la presse pour produire l’appui hydraulique et rapprocher les monstres ; la nécessité exclusive de cette presse pour créer cet appui n’est pas démontrée.

Les tests Happy DOM vérifient le HTML et ses interactions, pas le rendu CSS réel d’un navigateur. La prévisualisation native a été tentée puis arrêtée : lancement CLI empêché par les sockets de l’environnement, entrée native indisponible, puis protocole `file:` refusé par la politique du navigateur fourni. Aucun contournement n’a été tenté après ce refus. `validation/browser-review-status.json` conserve cette limite.

Le laboratoire ne modifie pas le runtime partagé de SRA Playground. Il ne fournit aucune mesure de résolution autonome par SRA. Le raccordement natif, le contrôle visuel ordinateur/mobile et la publication du Site seront qualifiés lors de l’étape d’intégration.
