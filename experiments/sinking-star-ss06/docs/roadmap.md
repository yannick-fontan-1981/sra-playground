# Série SS01–SS25 — jalon SS06

SS06 **Les Ponts Réfléchis**, version **0.2.0 / HTML v4**, est le premier duo de la série : Marchand + Guerrier. Huit niveaux sont livrés en HTML autonome avec moteur TypeScript, témoins et rapports.

Le contenu préparé atteint **6 jeux sur 25 et 48 niveaux sur 200, soit 24 % en nombre**. Ce pourcentage ne mesure pas l’effort restant et ne signifie pas que les six jeux sont déjà publiés.

## Révision v4

- Ancien niveau 8 déplacé en position 5, avec sa carte et son parcours conservés.
- Nouveau niveau 8 adapté de Heroes and Mirrors 20 : deux horloges, verrou vert et alternance violette différée.
- Quinze portes-plateformes dans l’eau, polarités, marqueurs de circuit et animation de trois images.
- Deux héros à synchroniser avant et pendant la traversée ; îlot final séparé par au moins trois cases d’eau.
- Tutoriel L1 : les huit acquis et la nécessité du Guerrier et des quatre caisses restent validés.

## Validation

51 tests du moteur, 14 contrôles HTML, 483 actions et 1 480 images sur les huit niveaux. Trois routes de défaite couvrent le combat, le reflet dans l’eau et le retrait d’une plateforme ; Undo et les panneaux terminaux sont vérifiés. La parité des parcours historiques a été contrôlée avant la réorganisation. La validation HTML utilise Happy DOM, pas un navigateur natif.

## Sauvegarde et état

Branche du laboratoire : `feat/ss06-duo-lab-20261118`. Le compte rendu indique le commit effectivement poussé après vérification des empreintes distantes. Le laboratoire se trouve sous `experiments/sinking-star-ss06/`.

Cette étape livre l’HTML à essayer. L’intégration sur main et la publication Site restent à réaliser ; aucun numéro de version Site ni SHA publié n’est revendiqué. L’agent du Playground n’a pas été modifié et aucune mesure de coût global ni réussite autonome du SRA n’est annoncée.

## Suite

1. Essai de l’HTML v4 et derniers ajustements ludiques.
2. Sauvegarde de la version retenue sur main et prompt d’intégration.
3. Raccordement natif, validation de parité, publication et vérification GitHub/Site.
4. SS07 **La Distance Dérobée**, duo Marchand + Voleur, selon la feuille de route de la série.
