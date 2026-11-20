# SS11 — Vérifications de la livraison 0.1.1

- Compilation TypeScript stricte et construction du HTML autonome : réussies.
- `npm test` : 15 tests ciblés du moteur réussis. Ils couvrent les poussées en chaîne, les échanges, les presses, la sélection, les reflets proches, le dos rouge des miroirs bloquants, les boucles de rayon, les monstres et l’annulation.
- `npm run validate` : huit cartes initiales valides, chacune identique à sa référence d’auteur ; image 64 × 64 et palette de seize couleurs ; deux héros et deux destinations par carte.
- Le parcours pédagogique de L1 déclenche les douze leçons par observation des pixels publics.
- Le HTML n’importe aucun script externe et n’embarque ni solveur ni parcours d’auteur.
- `scripts/verify-ui-dom.mjs` : 12 contrôles réussis, aucune exception JavaScript. Sélection des héros, clavier, huit cartes, suivi du tutoriel, interruption des animations par Undo/Reset et retour à L1.
- Inspection dans Chrome : nouvelle carte de L1, affichage v0.1.1, déplacement au clavier, première leçon cochée puis réinitialisation du tutoriel. Les autres cartes restent identiques à la livraison précédente.

Les parcours présents dans `reference/` ont été écrits et rejoués pendant la conception. Ils constituent des exemples de réussite, pas une recherche exhaustive ni une preuve que toute autre solution utilise chaque élément. Les contrôles de livraison ne lancent aucun solveur.

Le rapport automatique des cartes et du tutoriel est `validation/content-report.json`. Le contrôle du DOM utilise un canvas simulé et ne remplace pas l’inspection visuelle dans un navigateur.

La relecture ciblée a aussi corrigé un raccourci de la première ébauche : les distances du rayon sont désormais asymétriques (6 et 7). Espace ne permet plus l’échange direct du héros et de la caisse identifié pendant cette relecture ; sa réception prématurée est en eau. Ce contrôle ciblé ne constitue pas une preuve exhaustive d’unicité.
