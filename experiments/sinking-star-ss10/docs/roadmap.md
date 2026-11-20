# Série Sinking Star — jalon SS10

SS10 **L’Entrepôt Réversible**, version **0.2.0**, réunit le Guerrier rouge et le Voleur vert. Le contenu conçu atteint **10 jeux sur 25 et 80 niveaux sur 200, soit 40 % en nombre**. Ce pourcentage compte les laboratoires conçus et ne mesure ni l’effort restant, ni la publication du Site, ni la réussite autonome du SRA.

## Livraison

Huit salles avec un tutoriel de douze découvertes. Les niveaux suivants reprennent Hauling 16, Water 3, Mirrors 4 et 5, une synthèse Water 3–4 / Mirrors 6, Light 2, puis la grille de Water 3 avec ses cinq caisses. À la dernière demande utilisateur, l’ancien niveau 8 est devenu le niveau 6 ; le nouveau niveau 8 reprend Heroes and Water, énigme 3.

Le laboratoire est sauvegardé dans `experiments/sinking-star-ss10/` sur la branche `feat/ss10-duo-lab-20261119`. L’utilisateur a validé la version avec les deux corrections : socles des miroirs bloquants rouges en conservant la diagonale blanche ; bouton et porte-presse rose-blanc au niveau 7. La révision `10367c68d48a3ffab5e40fc23bf13b6202435596` précède le réagencement final des niveaux 6 et 8. La livraison actuelle version 0.2.0 inclut également ce réagencement ; le commit final vérifié figure dans le compte rendu.

Cette livraison intègre le laboratoire sur `main` à la demande de l’utilisateur. Le compte rendu de livraison donne le commit d’intégration effectivement vérifié. Le [prompt Codex](integration-prompt.md) prépare le raccordement natif du catalogue et la publication du Site. Sur le `main` examiné pour préparer ce prompt, les jeux natifs vont jusqu’à SS08 ; SS09 reste un laboratoire. Recontrôler cet état avant le raccordement.

## Suite

1. Livraison du laboratoire validé sur `main` et du prompt Codex de raccordement natif ; le SHA vérifié est donné dans le compte rendu.
2. Raccorder SS10 au catalogue, au runtime, aux commandes Guerrier/Voleur, au tutoriel et à la galerie Custom 4.
3. Valider la parité du runtime, les commandes, les animations, le tutoriel et la non-régression ; publier le Site depuis le code durable sur GitHub et vérifier les deux identités.
4. Poursuivre avec **SS11 — La Force Transposée**, duo **Guerrier + Magicien**.

## Répartition de la série

SS01–SS05 : cinq jeux consacrés à un type de personnage. SS06–SS15 : dix duos. SS16–SS20 : cinq trios. SS21–SS25 : cinq quatuors, conformément à la dernière révision.

| Jeu | Titre de travail | Personnages |
|---|---|---|
| SS21 | Les Quatre Destinations | Marchand, Guerrier, Voleur, Magicien |
| SS22 | Le Château Submergé | Marchand, Guerrier, Voleur, Barde |
| SS23 | Le Labyrinthe des Reflets | Marchand, Guerrier, Magicien, Barde |
| SS24 | La Procession Noire | Marchand, Voleur, Magicien, Barde |
| SS25 | L’Étoile Engloutie | Guerrier, Voleur, Magicien, Barde |
