# SS20 — Le Relais des Îles : contrat du laboratoire

Version **0.1.0**. SS20 réunit le **Marchand**, le **Voleur** et le **Barde**, dans cet ordre. Le Marchand est sélectionné au départ. La campagne commence par **L’atelier des marées**, tutoriel du niveau 1 ; le niveau 2, **Le chargement à rebours**, est une salle de manutention. Les huit salles ont des cartes propres à SS20. Les crédits et écarts d’adaptation sont consignés dans [l’audit des sources](source-audit.md) et `reference/levelN-design.json`.

Le plateau logique mesure 20 × 20 cases. Chaque case occupe 3 × 3 pixels, avec une origine `(2,2)` dans une observation 64 × 64 à seize couleurs. Les règles sont déterministes. La victoire d’une salle demande les trois héros vivants sur les trois destinations simultanément. Un héros arrivé reste présent, sélectionnable et soumis aux effets physiques.

## Trois capacités complémentaires

| Rôle | Symbole / palette | Geste cardinal volontaire |
| --- | --- | --- |
| Marchand | `M` / 12, orange | Avance et pousse au plus un occupant devant lui. |
| Voleur | `T` / 14, vert | Avance vers une case libre et tire au plus un occupant situé immédiatement derrière lui. |
| Barde | `B` / 6, magenta | Avance et entraîne les pièces éligibles dans son carré de chant. |

### Marchand : une seule pièce devant

Le Marchand pousse une caisse, un miroir, un monstre ou un partenaire d’une case, si la destination de cet occupant est libre et praticable. Deux occupants contigus empêchent la poussée : le Marchand ne transmet pas son effort à toute une file. Pousser un partenaire ne déclenche pas la capacité de celui-ci. Un miroir déplacé conserve son orientation.

Une caisse peut être poussée dans l’eau nue ; elle y devient un appui. Un déplacement volontaire qui noierait un héros ou retirerait le soutien d’un miroir est refusé. Déplacer un monstre n’accorde aucune protection contre son contact.

### Voleur : un pas libre, puis une traction

La case située devant le Voleur doit être libre. S’il avance, l’occupant immédiatement derrière lui prend sa case précédente. Cette traction concerne une seule caisse, un seul miroir, un seul monstre ou un seul partenaire ; un deuxième occupant derrière le premier reste en place. Le Voleur ne pousse pas une pièce devant lui et ne tire pas à distance.

L’orientation du pas définit le côté tiré. Il faut donc préparer à la fois la case d’arrivée du Voleur et son accès de l’autre côté de la charge. Une traction imposée au Barde ne déclenche pas de chant. Comme pour la poussée, un déplacement volontaire ne peut noyer un héros ni un miroir. Tirer directement un monstre laisse normalement le Voleur à son contact : la capacité ne rend pas cette manœuvre sûre.

### Barde : portée, sélection et butées

La portée est un carré de 5 × 5 centré sur la position **avant le pas** : écarts horizontal et vertical au plus égaux à deux, diagonales comprises. Les cloisons ne coupent pas le chant. Les caisses, monstres, partenaires et appuis éligibles tentent la même translation cardinale. Les miroirs ne suivent pas le chant.

Une butée peut retenir une pièce pendant que les autres avancent. Les dépendances entre occupants sont résolues avant l’acceptation du geste. Si le Barde ne peut pas avancer, son pas entier est refusé. Un mouvement volontaire ne peut noyer aucun héros ni retirer le soutien d’un miroir.

Un appui immergé se déplace seulement d’une case d’eau vers une autre case d’eau. Il est ancré si un héros l’occupe au début du pas, même si ce héros est entraîné, ou si le Barde doit arriver sur cet appui. Une caisse ou un miroir posé dessus ne produit pas cet ancrage. Une poussée, une traction, un reflet ou une presse qui transporte le Barde ne déclenche jamais son chant.

## Eau et supports

Une caisse déposée dans une eau dépourvue de soutien devient un appui permanent. Une caisse déposée sur un appui reste une caisse. L’appui immergé est distinct des occupants : le Marchand ne le pousse pas, le Voleur ne le tire pas, les miroirs ne le reflètent pas et il ne pèse pas sur un bouton.

Les plateformes hydrauliques dépendent de la polarité de leur circuit. Leur déploiement et leur retrait sont stabilisés avec les autres effets. Une plateforme retirée sous une caisse peut créer un appui ; son retrait sous un héros peut provoquer une perte. Une réactivation ne détruit pas un appui permanent déjà présent. Les conséquences d’une arrivée forcée et celles d’un déplacement volontaire sont résolues selon leurs règles propres. Undo restaure toute la cascade.

## Boutons, portes et presses latérales

Tous les boutons d’un circuit doivent être occupés simultanément. Héros, caisses, miroirs et monstres sont des poids. Un appui immergé ne l’est pas. Une porte peut se fermer à l’appui ou au relâchement de sa commande, selon `closedWhen`.

Une porte-poussoir agit **à sa fermeture, sur un occupant de sa propre case**. Elle pousse dans la direction indiquée et peut transmettre cette poussée à la file contiguë. Ce comportement appartient à la presse, même si le Marchand ne pousse personnellement qu’une pièce. Si la file ne peut pas se déplacer, l’occupant pris dans la presse peut être écrasé. Une fermeture vide ne pousse aucun voisin ; une ouverture ne tire personne.

Les boutons et les presses des cartes occupent des cases distinctes. Les dispositifs conservent le rendu demandé :

- Bouton : fond gris opaque, plus rose, pixel de la couleur du circuit au centre.
- Presse pure : centre noir fermé, gris ouvert ; aucun fond bleu parasite.
- But sur une presse fermée : quatre coins jaunes conservés.
- Miroir posé sur un bouton : face blanche et dos noir lisibles.

Le violet d’un circuit utilise la palette **15** ; la palette **7** correspond au rose des bras du bouton.

## Reflet global

ACTION5 active tous les miroirs dans la même action. Chaque miroir relie les deux axes de sa face blanche en conservant la distance. Il choisit les occupants les plus proches ; deux occupants à égale distance peuvent échanger leurs positions. Héros, caisses et monstres sont reflétables. Miroirs et appuis immergés ne le sont pas.

Un trajet obstrué, une destination incompatible ou un acteur revendiqué vers deux destinations différentes refuse l’action complète. Il n’y a ni copie d’acteur ni transfert partiel. Les dos concernés clignotent deux fois en rouge en quatre images de **110 / 70 / 110 / 0 ms**, sans effacer la diagonale blanche. Cet avertissement ne crée pas d’entrée Undo supplémentaire. Les prévisions grises distinguent notamment le héros et la caisse par leur forme.

Le transport par reflet n’exécute pas le pouvoir du personnage déplacé. La salle des quais exploite explicitement la règle atomique : l’escale ferme un bras du montage avant le second trajet.

## Monstres stables et contacts

Les monstres restent en place tant qu’une poussée, une traction, un chant, un reflet ou une presse ne les transporte pas. Marcher ailleurs, sélectionner un héros ou ouvrir une porte ne leur ajoute aucun pas. Tous suivent cette règle ; il n’existe aucune catégorie cachée de poursuivant.

Le contact orthogonal est dangereux pour les trois héros, actifs ou inactifs. Deux monstres voisins s’éliminent simultanément et attaquent encore pendant cette vague : leur rencontre ne protège pas un héros adjacent. Le contact diagonal seul ne suffit pas. Un monstre envoyé dans l’eau nue disparaît sans créer d’appui. Une presse bloquée peut aussi l’écraser.

L’action volontaire ou le reflet est exécuté, puis les circuits, presses, plateformes, arrivées dans l’eau et contacts sont stabilisés ; les buts sont évalués après ces conséquences. Aucun déplacement autonome ne s’intercale. Les animations rendent les transports imposés et le combat visibles ; Undo restaure l’action entière.

## Session et frontière publique

| Action | Effet |
| --- | --- |
| ACTION1 | Haut |
| ACTION2 | Bas |
| ACTION3 | Gauche |
| ACTION4 | Droite |
| ACTION5 | Reflet global |
| ACTION6 | Sélection par coordonnées pixel entières `{x, y}`, entre 0 et 63 |

ACTION6 ne fait pas avancer le monde. Une sélection réellement différente peut être annulée. Une sélection vide est sans effet. Les actions et coordonnées malformées sont rejetées sans mutation de la session.

`TrioPuzzleSession` expose `observe`, `action`, `undo`, `reset`, `restart`, `selectLevel` et `nextHero`. Ses observations contiennent uniquement `gameCode`, `frame`, `frames`, l’éventuel `frameDurationsMs`, `state`, `availableActionIds`, `canUndo`, `canSelectLevel`, `level`, `levelCount`, `levelsCompleted`, `defaultFps` et `palette`. SS20 utilise le code `SS20`, la fréquence par défaut 10 et les actions `[1,2,3,4,5,6]`.

Une salle terminée ouvre la première salle encore inachevée. La campagne atteint `WIN` lorsque les huit salles sont terminées ; une visite par le sélecteur ne remplace pas leurs victoires. Undo peut revenir avant une transition ou la victoire finale. Reset reprend la salle ; Restart revient au niveau 1 avec le Marchand.

Les coordonnées sémantiques, l’état d’auteur, les plans de reflet, les témoins et le solveur restent privés au laboratoire. Ils ne sont ni embarqués dans le HTML de jeu ni transmis à SRA.

## Interface et tutoriel du niveau 1

Les commandes sont les flèches, 1 / 2 / 3 ou Tab pour les personnages, Espace / X pour les reflets, Z pour Annuler et R pour Recommencer. Le clic sur un héros et les boutons tactiles sont disponibles. Maj+Tab permet de quitter la grille. Pendant une animation, les commandes ordinaires sont bloquées ; Undo, Reset, Restart et le changement de salle invalident les anciens callbacks. Les panneaux de victoire et de défaite attendent la dernière image. La réduction des animations conserve le résultat physique.

Le tutoriel de **L’atelier des marées** suit **30 découvertes**, toutes déduites des observations publiques :

| Domaine | Découvertes |
| --- | ---: |
| Sélection, déplacement, destinations | 3 |
| Poussée, traction, pièce unique, partenaires, miroir déplacé, relève, départ sans chant | 8 |
| Chant, partenaires, sélection par butée, diagonale, cloison, monstre entraîné | 6 |
| Création, glissement, ancrage et traversée d’un appui | 4 |
| Reflet global, héros reflété, caisse reflétée | 3 |
| Bouton, porte, presse | 3 |
| Immobilité des monstres, transport par presse, rencontre | 3 |
| **Total** | **30** |

Les coches restent acquises après Undo ; Reset, Restart ou changement de salle réinitialisent leur suivi. Elles ne sont attribuées qu’au niveau 1. Elles enseignent et ne verrouillent jamais une victoire. Le témoin pédagogique contient volontairement des démonstrations facultatives ; sa longueur ne mesure pas la difficulté minimale du niveau.

La [validation](validation.md) distingue le moteur, les replays, le DOM compilé, la revue navigateur et l’intégration native. Une preuve de laboratoire ne vaut pas preuve de publication du Site.
