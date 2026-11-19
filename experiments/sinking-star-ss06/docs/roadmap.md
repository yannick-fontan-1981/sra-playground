# Série SS01–SS25 — jalon SS06

SS06 **Les Ponts Réfléchis**, version **0.2.1 / HTML v5**, est le premier duo de la série : Marchand + Guerrier aux niveaux 1 à 7. Le niveau 8 se joue avec le Guerrier seul et une cible. Huit niveaux sont livrés en HTML autonome avec moteur TypeScript, témoins et rapports.

Le contenu préparé atteint **6 jeux sur 25 et 48 niveaux sur 200, soit 24 % en nombre**. Ce pourcentage ne mesure pas l’effort restant et ne signifie pas que les six jeux sont déjà publiés.

## Révision v5

- Niveaux 1 à 7 inchangés ; le tutoriel L1 conserve ses huit acquis et la nécessité du Guerrier et des quatre caisses.
- Niveau 8 « Le verrou vert », adapté de Heroes and Mirrors 20 : un Guerrier rouge, une cible et un témoin de 61 actions.
- Trois miroirs au total, dont deux dans la salle de droite. Le second coupe le rayon de retour de la caisse verte après le premier reflet.
- Sept portes-plateformes : quatre vertes, trois violettes ; aucune porte-presse et aucun premier reflet différé.
- Trois reflets produisent le vert `111` et le violet `101`. Le Guerrier utilise les appuis verts avant chaque bascule du violet.
- Contrat `solo-warrior` explicite ; sélection sans effet et sans entrée Undo dans cette salle. Le duo reste le mode par défaut.

La réorganisation v4 reste acquise : l’ancien niveau 8 occupe la position 5, tandis que l’ancien niveau 5 est archivé dans `reference/history/`.

## Validation

**55 tests du moteur, 15 contrôles HTML, 433 actions, 17 sélections et 1 338 images** sur les huit niveaux. L8 compte 61 actions, 192 images et trois reflets. Les routes de défaite couvrent le combat, le reflet dans l’eau et le retrait d’une plateforme ; Undo et les panneaux terminaux sont vérifiés. Les anciennes observations duo ont été rejouées avec des empreintes identiques. Les fichiers de conception et témoins des niveaux 1 à 7 sont conservés.

Le témoin de L8 prouve sa solvabilité. Un contrefactuel retire le miroir bloqueur juste avant le deuxième reflet du témoin : le vert se désactive et le Guerrier tombe. Ce constat porte sur cet état et ce parcours ; il n’établit pas une unicité globale ou l’impossibilité de toute autre stratégie. La validation HTML utilise Happy DOM, pas un navigateur natif.

## Sauvegarde et état

Branche du laboratoire : `feat/ss06-duo-lab-20261118`. Le compte rendu indique le commit effectivement poussé après vérification des empreintes distantes. Le laboratoire se trouve sous `experiments/sinking-star-ss06/`.

Cette étape livre l’HTML à essayer. L’intégration sur main et la publication Site restent à réaliser ; aucun numéro de version Site ni SHA publié n’est revendiqué. L’agent du Playground n’a pas été modifié et aucune mesure de coût global ni réussite autonome du SRA n’est annoncée.

## Suite

1. Essai de l’HTML v5 et derniers ajustements ludiques.
2. Sauvegarde de la version retenue sur main et prompt d’intégration.
3. Raccordement natif, validation de parité, publication et vérification GitHub/Site.
4. SS07 **La Distance Dérobée**, duo Marchand + Voleur, selon la feuille de route de la série.
