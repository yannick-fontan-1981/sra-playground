# Contrat SS06 0.1.2

## Grille et états

Image de 64 × 64 pixels, plateau logique 20 × 20, origine (2,2), cellules 3 × 3. Une salle rectangulaire plus petite est centrée. Palette identique à SS01–SS05 : Marchand 12 orange, Guerrier 8 rouge, eau 9 bleu, sol 3 gris, mur 4 gris foncé, caisses 13 marron, appuis marron et X cyan 10, boutons/portes 7 rose, destinations 11 jaune, miroir blanc 0/dos noir 5, monstres noirs/X rouge.

Une salle contient exactement un Marchand, un Guerrier et deux cibles. Les identités sont conservées lors des poussées et reflets. Un personnage perdu suffit pour GAME_OVER ; toutes les cibles occupées par les deux héros après résolution des presses et combats terminent la salle.

Cartes : M Marchand, W Guerrier, o caisse, m monstre, s appui sur eau, b bouton, D porte, * caisse sur bouton, g cible, # mur, ~ eau, . sol. Miroirs explicites ou chiffres 1 NE, 2 SE, 3 SW, 4 NW. Les coordonnées des circuits et miroirs sont relatives à la carte avant centrage.

## Déplacement et sélection

ACTION1/2/3/4 = N/S/W/E. Le Marchand pousse une seule entité ; le Guerrier pousse une file contiguë de caisses, monstres, miroirs ou de son partenaire. Une destination bloquée refuse la transaction. La direction du héros sélectionné peut changer lors d’un refus.

ACTION6 reçoit des coordonnées entières de pixels (x,y) entre 0 et 63. Il sélectionne le héros touché ; il ne déclenche ni marche, ni combat, ni presse. Le premier personnage sélectionné au chargement est le Marchand. ACTION6 reste une action de l’historique et Undo peut l’annuler.

Une marche volontaire sur de l’eau sans appui est refusée. Une caisse qui y entre devient un appui fixe ; un monstre y disparaît. Les déplacements forcés par presse ou reflet peuvent faire tomber un héros. Une presse peut détruire un miroir en l’envoyant dans l’eau ; une poussée volontaire du miroir vers l’eau sans appui est refusée.

## Miroirs

ACTION5 active les miroirs pour les deux rôles. Chaque miroir est un coude à deux bras sur sa face blanche. Le premier héros, la première caisse ou le premier monstre rencontré sur chaque bras est proposé à distance égale sur l’autre bras. Les murs, portes fermées et autres miroirs arrêtent les rayons.

Les mouvements proposés sont simultanés et atomiques. Les échanges d’occupants sont autorisés si chacun libère sa place. Les collisions, trajets bloqués et destinations contradictoires refusent toute la réflexion. Aucun dédoublement, aucune fusion, aucun relais de rayon par un autre miroir. Un miroir peut être poussé mais n’est pas lui-même transporté par reflet.

La prévisualisation d’un héros est un + gris clair ; celle d’une caisse est un contour carré gris clair. Elle est peinte après le sol, les appuis et les cibles, puis les occupants réels restent au premier plan. Les poussées n’ont pas de prévisualisation.

## Circuits et presses

Un circuit associe une ou plusieurs dalles à des portes. Toutes ses dalles doivent être occupées (AND). Héros, caisses, monstres, miroirs et portes déjà fermées peuvent peser sur une dalle.

`closedWhen: pressed | released` détermine la polarité. Une porte qui se ferme pousse toute la file depuis sa propre case dans la direction indiquée. Si la file est bloquée, seul l’occupant sur la case de la porte est écrasé. Une fermeture ne pousse pas les voisins si sa case est vide.

Les circuits sont recalculés après chaque déplacement forcé et chaque suppression d’occupant. Les cascades se stabilisent ; une oscillation refuse l’action entière. Un état initial instable ou fatal est rejeté dès la création de la campagne.

## Monstres

Les monstres restent immobiles hors poussées/reflets/presses. Après une action réussie et le règlement des presses, tous les contacts cardinaux sont résolus simultanément. Deux monstres voisins s’éliminent ; un monstre qui meurt frappe encore pendant cette vague. Les deux héros, y compris celui non sélectionné, sont vulnérables. Les pertes peuvent libérer un bouton et déclencher une nouvelle fermeture. Les refus de mouvement et les sélections ne déclenchent pas de combat.

## Présentation

Marche, poussée et presse : 3 images, avances exactes de 1, 2 et 3 pixels, durées 60/80/40 ms. Reflet : 3 images, 70/90/40 ms. Combat : 5 images, 80/90/100/110/40 ms, préparation, avancée, impact, désagrégation et résultat. La dernière durée de la séquence vaut zéro. Les phases se composent sans couper leurs images ; une transition de niveau ajoute l’image suivante après une pause de 100 ms.

L’état logique est déjà final lors de la lecture de l’animation. L’hôte attend la dernière image pour les panneaux terminaux, interdit les commandes pendant la lecture et invalide les anciens callbacks pour Undo/Reset/Restart/changement de salle.

## Session

`DuoPuzzleSession(levels, gameCode='SS06')` : observe, action(id,data?), nextHero, undo, reset, restart, selectLevel. Le constructeur valide toutes les salles avant d’accepter la campagne ; les opérations de chargement calculent leur état avant mutation.

Les observations publiques fournissent seulement pixels, palette, commandes et progression. Elles n’exposent ni état sémantique, ni plan de reflet, ni solution. ACTION1–6 restent listées même en terminal : l’hôte doit bloquer les envois.

WIN exige les huit salles, quel que soit leur ordre. La première salle inachevée est choisie ensuite. Undo restaure aussi la progression et traverse un changement de salle ; Reset efface la complétion de la salle courante et son historique ; Restart revient à zéro au niveau 1.

