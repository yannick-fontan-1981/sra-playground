# SS19 — Les Gardiens Noirs · 0.2.0

## Identité et périmètre

SS19 est le laboratoire autonome du trio **Guerrier / Magicien / Barde**, dans cet ordre. Le Guerrier est sélectionné au début de chaque salle. La campagne comporte huit cartes originales et un tutoriel de 31 découvertes au niveau 1. Les sources précises et les écarts d’adaptation figurent dans `source-audit.md` et dans les huit fichiers `reference/levelN-design.json`.

Le plateau logique fait 20 × 20 cases. Chaque case est dessinée sur 3 × 3 pixels, avec une origine `(2,2)` dans une image 64 × 64 à seize couleurs. Les commandes et les règles sont déterministes. La victoire exige trois héros vivants sur les trois destinations au même instant ; les découvertes pédagogiques n’ajoutent aucune condition de victoire.

## Les trois capacités

### Guerrier — toute une file

Une flèche tente un pas cardinal. Le Guerrier pousse toute la file contiguë devant lui : caisses, monstres, miroirs et partenaires. La destination du dernier occupant doit permettre le déplacement. Un obstacle refuse la poussée entière, sans mouvement partiel. Pousser un partenaire ne déclenche pas son pouvoir. Le Guerrier est rouge, palette 8, symbole de carte `W`.

Une caisse déposée dans l’eau sans soutien devient un appui immergé. Un héros ou un miroir ne peut pas être poussé volontairement dans une eau sans soutien. Un monstre envoyé dans cette eau disparaît. L’orientation d’un miroir déplacé reste inchangée.

### Magicien — première cible et conservation des places

Le Magicien est violet, palette 15, symbole de carte `Z`.

Une flèche trace une visée cardinale. La première caisse, le premier monstre ou le premier partenaire rencontré échange sa place avec le Magicien. L’eau est transparente à la visée. Les murs, portes fermées et dos noirs des miroirs l’arrêtent. Une face blanche dévie le rayon à angle droit ; plusieurs miroirs peuvent le relayer. Les miroirs et les appuis ne sont jamais des cibles d’échange.

Sans cible, le Magicien tente de marcher. Une boucle qui ramène le rayon au lanceur produit une animation de trajet et deux pulsations du Magicien, sans déplacement ni avancée du combat. Un échange ne déclenche pas la capacité du partenaire déplacé. Il peut relever un poids sur une commande sans laisser cette commande vide, mais il ne crée pas d’occupant sur une île vide.

### Barde — groupe, butées et ancrages

Le Barde est magenta, palette 6, symbole de carte `B`.

Le chant accompagne un pas volontaire réussi. Sa portée est le carré de 5 × 5 centré sur la position **avant** le pas : distance horizontale et verticale au plus égale à deux, diagonales comprises. Les murs ne coupent pas cette portée. Les caisses, monstres, deux partenaires et appuis éligibles tentent la même translation cardinale que le Barde. Les miroirs ne suivent jamais.

Une pièce retenue par une butée peut rester en place pendant que d’autres avancent. Les dépendances entre occupants sont résolues avant d’accepter la translation. Si le Barde lui-même ne peut pas avancer, tout le pas est refusé. Un mouvement volontaire ne peut noyer aucun des trois héros ni retirer le soutien d’un miroir.

Un appui immergé ne glisse que vers une autre case d’eau. Il reste ancré s’il porte un héros au début du pas, même si ce héros se déplace, ou s’il constitue la case d’arrivée du Barde. Une caisse ou un miroir posé dessus ne constitue pas cet ancrage. La poussée, l’échange, le reflet ou la presse qui déplace le Barde ne déclenche aucun chant.

## Eau, appuis et plateformes

Une caisse déposée dans une eau sans soutien devient un appui permanent, distinct d’une caisse mobile. Une caisse déposée sur un appui reste une caisse. L’appui ne peut être poussé, échangé ou reflété ; le chant peut le déplacer selon les règles précédentes. Il ne disparaît pas lorsqu’une plateforme hydraulique est redéployée.

Une plateforme est active quand son circuit atteint la polarité définie par la carte. Les appuis et charges hydrauliques sont stabilisés pendant les cascades, avant de conclure le résultat d’une arrivée forcée. La disparition d’une plateforme sous un héros peut le tuer ; sous une caisse, elle peut créer un appui. Les pertes dues aux effets forcés restent distinctes des déplacements volontaires interdits. Annuler restaure l’ensemble de la cascade.

## Boutons, portes et presses

Tous les boutons d’un même circuit doivent être occupés simultanément. Héros, caisse, monstre et miroir sont des poids ; un appui immergé ne l’est pas. Une porte-poussoir peut se fermer à l’appui ou au relâchement, selon `closedWhen`. Une fermeture sur un occupant pousse celui-ci et la file éventuelle dans la direction indiquée ; la presse suit sa propre direction, indépendamment du personnage actif. Une fermeture sur une case vide ne pousse pas un voisin.

Quand l’extrémité de la file est bloquée, l’occupant pris dans la presse peut être écrasé. Les changements de circuit sont stabilisés jusqu’au résultat cohérent. Les portes et les boutons des huit cartes occupent des cases distinctes.

Le bouton libre possède un **fond gris opaque, un plus rose et le pixel de couleur du circuit au centre**. Une presse pure montre un **centre noir lorsqu’elle est fermée, gris lorsqu’elle est ouverte**. Son fond n’est pas un bouton bleu. Les marques d’un bouton occupé n’effacent pas la diagonale blanche et le dos noir d’un miroir.

## Reflet global et avertissement rouge

ACTION5 active simultanément les miroirs. Chaque miroir relie les deux axes de sa face blanche en conservant la distance. Le candidat le plus proche est prioritaire ; à distance égale, les deux occupants échangent leurs places. Les héros, caisses et monstres peuvent être reflétés. Les appuis et les miroirs ne le peuvent pas.

Les conflits sont atomiques : une destination incompatible ou un trajet bloqué annule tous les transports de l’action. Les dos des miroirs concernés clignotent deux fois en rouge, en quatre images de **110 / 70 / 110 / 0 ms**. Les diagonales blanches et les miroirs non concernés restent intacts. Ce refus signalé en rouge ne crée pas d’entrée Undo. Le mode de réduction des animations montre directement l’état final.

Les prévisions d’arrivée utilisent un plus gris clair pour un héros et un contour carré gris clair pour une caisse. La capacité d’un héros n’est pas exécutée lorsqu’il est transporté par reflet.

## Monstres : des déplacements provoqués

Tous les monstres de SS19 suivent la même règle : **ils restent sur leur case jusqu’à ce qu’un pouvoir, un reflet ou une presse les déplace**. Marcher dans une autre région, changer de héros, ouvrir une porte ou simplement attendre ne provoque aucun déplacement autonome. Il n’existe ni cible secrète, ni rayon de chasse, ni calcul d’axe dominant, ni catégorie cachée de garde mobile.

Le motif noir et rouge reste distinct de la croix rouge du Guerrier. Les monstres peuvent être entraînés par le chant, échangés par le Magicien, reflétés ou poussés par une file et une presse. Chaque mouvement imposé suit les mêmes règles d’arrivée que les autres pièces : murs, portes fermées et occupants peuvent le bloquer. Une ouverture de porte ne transporte pas un monstre voisin ; une fermeture de presse agit sur un occupant de sa propre case et pousse dans la direction indiquée.

L’ordre d’une action est :

1. Exécuter le geste du héros ou le reflet global.
2. Stabiliser les circuits, presses, plateformes, arrivées dans l’eau et contacts orthogonaux.
3. Évaluer les destinations après ces effets. Aucun pas de monstre supplémentaire n’est ajouté.

Un monstre déposé sur un bouton reste donc un poids stable tant qu’aucun mécanisme ne le déplace. Les héros, caisses et miroirs restent eux aussi des poids possibles ; un appui immergé ne compte pas comme poids. Les conditions matérielles finales de certaines cartes rendent leurs gardiens nécessaires, sans condition de victoire cachée.

Le contact orthogonal reste dangereux : un monstre tue un héros voisin par un côté, y compris un héros inactif. Deux monstres voisins s’éliminent simultanément et frappent encore leurs voisins pendant cette vague ; leur disparition ne protège pas un héros adjacent. Une diagonale seule ne provoque pas ce contact. Une poussée directe du Guerrier peut le laisser au contact : il faut préparer un transport sûr, par exemple avec une caisse interposée, un pouvoir à distance ou une presse.

L’eau sans soutien et l’écrasement par une presse peuvent également éliminer un monstre. Les caisses ordinaires ne deviennent pas des armes d’écrasement. Un monstre peut occuper un appui ou une plateforme active, puis tomber si cette plateforme est retirée. Les conséquences forcées sont résolues avant la victoire.

Les déplacements imposés conservent leurs animations. Une presse qui agit après un geste possède sa propre séquence visible ; les contacts utilisent cinq images. Un seul Undo restaure le geste entier, ses effets et une éventuelle transition de salle.

## Issue de la salle

La défaite et la victoire apparaissent après la dernière image de leur animation. Une salle réussie ouvre la première salle encore inachevée ; la campagne affiche `WIN` lorsque les huit salles sont terminées. Undo peut annuler la transition de salle ou la victoire finale. Aucun nombre minimal de coups, pouvoir obligatoire ou script de solution n’est ajouté au moteur.

Les contraintes matérielles propres à chaque carte, dont les gardiens vivants et la caisse nécessaire du niveau 8, sont documentées dans `level-design.md` et les rapports d’auteur.

## Contrat public

| Action | Effet |
| --- | --- |
| ACTION1 | Haut |
| ACTION2 | Bas |
| ACTION3 | Gauche |
| ACTION4 | Droite |
| ACTION5 | Reflet global |
| ACTION6 | Sélection par coordonnées pixel entières `{x, y}`, de 0 à 63 |

ACTION6 ne fait pas avancer le monde. Une sélection réellement différente participe à Undo. Une sélection vide est sans effet. Les actions et coordonnées malformées sont rejetées sans mutation de la session.

`TrioPuzzleSession` expose `observe`, `action`, `undo`, `reset`, `restart`, `selectLevel` et `nextHero`. Les observations contiennent uniquement `gameCode`, `frame`, `frames`, l’éventuel `frameDurationsMs`, `state`, `availableActionIds`, `canUndo`, `canSelectLevel`, `level`, `levelCount`, `levelsCompleted`, `defaultFps` et `palette`. Le code de jeu est `SS19`, la fréquence par défaut 10 et les actions disponibles `[1,2,3,4,5,6]`.

L’état auteur, les coordonnées sémantiques, les plans de reflet, les témoins et le solveur ne sont pas transmis au joueur ou à SRA. Les modules de `reference/`, le solveur et les témoins ne sont pas embarqués dans le HTML.

## Interface et pédagogie

Clavier : flèches ; Espace ou X pour les reflets ; 1 / 2 / 3 ou Tab pour Guerrier / Magicien / Barde ; Z pour Annuler ; R pour Recommencer. Clic sur le héros et boutons tactiles disponibles. Maj+Tab conserve la navigation hors de la grille. Les contrôles ordinaires sont bloqués pendant une animation ; Undo, Reset, Restart et le changement de niveau invalident les animations en cours.

Le tutoriel observe uniquement les images publiques et compte 31 découvertes. Elles restent acquises après Undo ; Reset, Restart ou changement de salle réinitialisent le suivi. Le niveau 1 peut être terminé sans avoir coché toutes les découvertes. Son parcours de qualification démontre les 31, avec de vraies interactions visibles. Les aides expliquent aussi les refus, les effets forcés, les ancrages et les différences entre échange et reflet.

La qualification DOM et pixel est documentée dans `validation.md`. La revue CSS dans un navigateur natif et la vérification du dispatcher SRA appartiennent à l’intégration native, encore distincte de cette livraison autonome.
