# SS11 — Vérifications de la livraison 0.1.2

- Compilation TypeScript stricte et construction du HTML autonome : réussies.
- Réorganisation des cartes selon les anciens indices `[2,3,4,5,6,7,1,8]`. Les cartes, parcours, sources et autres données de référence sont identiques au commit précédent `a9f06f6`, après mise à jour des identifiants de position.
- `npm run validate` : huit cartes initiales valides, conformes à leurs références ; image 64 × 64 et palette de seize couleurs ; deux héros et deux destinations par carte.
- Le tutoriel accompagne La cour aux deux sorties au niveau 7. Les douze leçons restent détectées dans les pixels publics au cours de son parcours d’auteur.
- `scripts/verify-ui-dom.mjs` : 12 contrôles réussis, aucune exception JavaScript. Le jeu démarre sur La relève du gardien au niveau 1, le tutoriel est visible au niveau 7, les sélections, animations et interruptions fonctionnent, et Restart revient au nouveau niveau 1.
- Le HTML n’importe aucun script externe et n’embarque ni solveur ni parcours d’auteur.

Les rapports sont `validation/content-report.json` et `validation/ui-report.json`. Le contrôle de l’interface utilise Happy DOM avec capture des écritures de pixels ; il ne constitue pas une inspection visuelle dans un navigateur.

Le moteur est celui de la version 0.1.1, dont les quinze tests ciblés avaient réussi. La présente révision vérifie le réordonnancement et le déplacement du tutoriel, sans nouvelle recherche de solution ni contrôle d’unicité.
