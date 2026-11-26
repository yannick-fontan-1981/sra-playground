# SS25 — spécification du contrat jouable

Cette spécification décrit le moteur de **SS25 — Les Derniers Équilibres**. Elle s’appuie sur [le moteur](../src/core.ts), [le tutoriel public](../src/tutorial.ts), [les tests](../tests/) et [l’adaptateur natif](../../../src/games/sinking-star-ss25.ts). Les huit salles définitives sont synchronisées avec leurs références et leurs témoins ; leur correspondance et les preuves de rejeu figurent à la section 10.

## 1. Composition et victoire

Le jeu exige exactement un Guerrier, un Voleur, un Magicien et un Barde, ainsi que quatre destinations. L’ordre stable est `warrior`, `thief`, `wizard`, `bard`. Le Guerrier est sélectionné à l’ouverture d’une salle.

Une salle se termine lorsque les quatre destinations sont occupées simultanément par les quatre héros vivants, après résolution des mécanismes et des contacts. Les destinations ne sont pas assignées à une couleur. Un héros déjà arrivé reste sélectionnable et peut repartir pour aider les autres. La perte d’un seul héros produit `GAME_OVER`.

Le tutoriel est le niveau 1. Ses 39 découvertes expliquent les règles ; elles ne sont pas requises par la condition de victoire. Les autres salles conservent les aides contextuelles sans attribuer de nouvelles découvertes de ce tutoriel.

## 2. Plateau, couleurs et commandes publiques

Le monde contient au plus 20 × 20 cellules. Chaque cellule occupe 3 × 3 pixels, dans une image de 64 × 64 pixels avec une origine de plateau en `(2,2)`. Une carte plus petite est centrée ; ses dispositifs utilisent les coordonnées de la carte source avant ce décalage.

| Élément | Représentation principale |
| --- | --- |
| Guerrier | Croix rouge, indice de palette 8 |
| Voleur | Croix verte, indice 14 |
| Magicien | Croix violette, indice 15 |
| Barde | Croix magenta, indice 6 ; portée pointillée quand il est sélectionné |
| Héros actif | Un bras blanc indique sa dernière direction |
| Caisse | Carré brun à centre noir |
| Appui immergé | Motif de bois et de cyan, distinct d’une caisse mobile |
| Eau / sol / mur | Bleu / gris / gris foncé |
| Destination | Contour jaune conservé sous les occupants |
| Monstre | Rouge et noir ; sa forme est distincte de la croix des héros |
| Bouton | Bras roses sur fond gris, centre de la couleur du circuit |
| Presse | Repères du circuit et de direction ; centre gris ouvert, noir fermé |
| Miroir | Diagonale blanche et dos noir |

Les détecteurs pédagogiques reconnaissent les formes dans l’image publique. La couleur centrale d’un bouton violet ne suffit pas à en faire un Magicien ; les quatre bras noirs d’un monstre le distinguent des croix des héros.

| Commande | Contrat moteur |
| --- | --- |
| ACTION1 | Direction nord |
| ACTION2 | Direction sud |
| ACTION3 | Direction ouest |
| ACTION4 | Direction est |
| ACTION5 | Activation simultanée des miroirs |
| ACTION6 | Sélection du héros vivant sous les coordonnées pixels entières `x,y`, chacune dans 0–63 |

Les flèches déclenchent la capacité du héros actif. ACTION6 change la sélection sans tick des mécanismes, déplacement ou combat. Cliquer sur un pixel vide ou sur le héros déjà actif est sans effet. L’interface expose les mêmes sélections par 1–4, Tab, les boutons de rôle et le clic.

L’observation publique contient exclusivement `gameCode`, `frame`, `frames`, éventuellement `frameDurationsMs`, `state`, `availableActionIds`, `canUndo`, `canSelectLevel`, `level`, `levelCount`, `levelsCompleted`, `defaultFps` et `palette`. Elle ne contient ni carte sémantique privée, ni plan, ni solution. Les plans géométriques restent internes au moteur ; leurs éventuelles anticipations sont peintes dans les pixels publics.

## 3. Les quatre capacités

### Guerrier : pousser une file contiguë

Le Guerrier marche d’une case. Si sa case d’arrivée est occupée, il pousse toute la file contiguë de héros, caisses, monstres ou miroirs d’une case dans cette direction. La tête de file doit disposer d’une arrivée admissible ; un mur ou un occupant bloqué fait refuser le geste entier. Une file peut mélanger plusieurs types d’occupants. Les appuis immergés ne sont pas des pièces de cette file. Le Guerrier ne possède aucune attaque ni protection particulière contre les monstres.

Une poussée peut remplacer le héros qui occupait un bouton : le Guerrier prend son ancienne place dans le même geste. Les héros déplacés ne déclenchent pas leur propre pouvoir. Une poussée volontaire qui noierait un héros ou détruirait un miroir faute de soutien est refusée entièrement.

### Voleur : tirer un seul occupant arrière

Le Voleur doit pouvoir avancer d’une case libre. L’occupant immédiatement derrière lui prend la case qu’il quitte : caisse, miroir, monstre ou autre héros. Il ne tire pas une file ; un second occupant derrière le premier reste en place. Une caisse séparée de lui par un espace ne suit pas. Un appui immergé ne constitue jamais une prise arrière.

La traction peut remplacer le Voleur sur un bouton sans interrompre le circuit. Elle peut aussi extraire le Barde de sa portée sans entraîner le groupe de celui-ci, ou déplacer le Magicien vers une nouvelle ligne sans déclencher d’échange. Le Voleur transporté par un partenaire, une presse ou un reflet ne tire rien de lui-même. Il ne pousse aucun occupant frontal et ne bénéficie d’aucune protection contre les monstres.

### Magicien : échanger avec la première cible

Une flèche du Magicien lance une visée dans cette direction. La première caisse, le premier monstre ou le premier autre héros rencontré devient la cible : le Magicien et cet occupant échangent leurs places simultanément. Le trajet peut franchir l’eau nue. Les appuis immergés ne sont pas des cibles et restent en place pendant un échange.

Un mur, une porte fermée, une presse fermée ou le dos noir d’un miroir arrête la visée. Une face blanche peut la dévier à angle droit ; plusieurs miroirs peuvent ainsi relayer le rayon. Un miroir n’est jamais lui-même échangé. S’il n’existe aucune cible accessible, le Magicien tente une marche ordinaire d’une case. Un miroir immédiatement devant lui peut donc relayer un rayon, mais ne peut pas être traversé par ce pas ordinaire.

Un rayon qui revient à son origine ou tourne en boucle ne produit aucun déplacement ni tick des contacts. L’animation éclaire son circuit, puis fait pulser le Magicien. Répéter cette même animation n’ajoute pas d’annulation supplémentaire à état identique.

Un échange conserve un occupant à chacune des deux extrémités ; il peut donc assurer une relève sur un bouton sans interrompre le circuit. Il ne crée pas une première présence sur une île vide. Échanger le Barde ne fait pas chanter celui-ci. Les contacts et les effets des circuits sont néanmoins résolus après l’échange : déposer un monstre près d’un partenaire peut être fatal.

### Barde : entraîner un groupe dans son carré

Le chant accompagne le pas volontaire du Barde. Sa portée est le carré de 5 × 5 centré sur sa position avant le pas : deux cases au plus horizontalement et verticalement, diagonales comprises. Les murs ne coupent pas cette portée.

Les autres héros, les caisses, les monstres et les appuis admissibles tentent un déplacement d’une case dans la même direction. Les miroirs sont exclus. Un membre bloqué reste en place ; d’autres membres peuvent continuer. Une pièce hors de portée n’est pas poussée par propagation. Si le Barde lui-même ne peut pas avancer, l’action entière est refusée.

Le chant ne fait jamais agir le pouvoir d’un partenaire transporté : le Voleur ne tire pas une pièce extérieure à la portée, le Guerrier ne prolonge pas une poussée et le Magicien ne lance pas de rayon.

## 4. Eau, caisses et appuis

Une caisse déposée dans une eau sans soutien devient un appui immergé. Elle cesse alors d’être une caisse mobile. Une caisse posée sur un appui existant reste une caisse mobile. Un monstre qui tombe dans l’eau nue disparaît et ne crée aucun appui. Un héros non soutenu meurt ; un miroir non soutenu disparaît lors d’un transport forcé.

Un appui porte les héros et les objets placés dessus. Il ne fait pas poids sur les commandes. Il ne se pousse pas, ne s’échange pas et ne se transporte pas par reflet. Le Barde peut le faire glisser d’une case d’eau vers une autre case d’eau.

Deux conditions ancrent l’appui pendant le chant : un héros l’occupe au début du pas, même si ce héros se déplace ensuite ; ou cet appui se trouve sous l’arrivée immédiate du Barde. Un miroir ou une caisse seuls ne constituent pas cet ancrage. Le chant refuse toutefois le geste entier si le déplacement des appuis priverait un héros ou un miroir de soutien. Un appui ne déplace pas un passager par une capacité de transport autonome.

Les marches, poussées et chants volontaires ne permettent pas de noyer un compagnon ni d’abandonner un miroir sur une eau déjà sans soutien. Cette protection ne neutralise pas les conséquences forcées ultérieures d’un reflet, d’une presse ou du retrait d’une plateforme.

## 5. Miroirs : deux usages distincts

ACTION5 active tous les miroirs ensemble, quel que soit le héros sélectionné. Chaque miroir met en relation les deux axes de sa face blanche en conservant la distance au miroir. Parmi les occupants visibles sur ces axes, le plus proche est prioritaire. À distance égale, les deux occupants s’échangent. L’arrivée bloquée d’un candidat plus lointain ne doit pas empêcher le transfert valide du plus proche.

Les héros, caisses et monstres peuvent être reflétés ; les miroirs et les appuis ne le peuvent pas. Un reflet ne relaie pas son trajet à travers un second miroir comme le fait la visée du Magicien. Les tracés, les destinations incompatibles et les occupants non déplacés sont contrôlés globalement : le geste s’applique entièrement ou est refusé. Les miroirs responsables peuvent clignoter en rouge sur leur dos, en gardant leur diagonale blanche.

Les arrivées possibles apparaissent sous forme de croix gris clair pour les héros et de contours carrés pour les caisses. Une arrivée dans l’eau peut rester dangereuse. Le Guerrier, le Voleur et les presses déplacent physiquement les miroirs sans changer leur orientation ; le chant ne les entraîne pas.

## 6. Boutons, portes, presses et plateformes

Un héros vivant, une caisse, un monstre ou un miroir peut maintenir un bouton. Les boutons d’un circuit nommé forment une condition ET : tous doivent être occupés. Une presse déjà fermée sur une case de bouton peut aussi maintenir ce circuit. Les portes simples `D` suivent leur règle héritée : elles ouvrent lorsque tous les boutons visibles du monde sont occupés par leurs poids ; une fermeture sur un occupant fait refuser l’action.

Chaque presse latérale nomme son circuit, son sens de poussée et sa condition de fermeture, à l’appui ou au relâchement. Lorsqu’elle passe d’ouverte à fermée, elle pousse l’occupant de sa propre case ainsi que la file contiguë devant lui. Une fermeture sur une case vide ne pousse pas une pièce voisine. Si une butée empêche le transport, l’occupant pris sur la case de presse est écrasé ; un héros écrasé entraîne la défaite.

Une plateforme hydraulique se déploie ou se retire selon son circuit. Déployée, elle porte les héros et les objets. Les arrivées forcées sur une case hydraulique attendent la résolution de son état de soutien dans la cascade. Retirer une plateforme peut noyer un héros distant, éliminer un monstre ou un miroir, ou transformer sa caisse en appui. Cet appui persiste lors d’un redéploiement et reste soumis au chant.

Les circuits, les presses et les plateformes sont résolus jusqu’à stabilisation. Si une cascade de mécanismes est instable, le geste physique est refusé. Les contacts peuvent supprimer un monstre qui servait de poids et entraîner une nouvelle résolution des mécanismes.

## 7. Monstres et déplacements imposés

Les monstres restent sur leur case sans transport explicite. Ils ne poursuivent pas les héros. Une poussée, une traction, un échange, un chant, un reflet ou une presse explique chaque déplacement.

Après un geste effectif et ses effets mécaniques, les monstres attaquent leurs voisins orthogonaux. Une diagonale n’est pas un contact. Deux monstres adjacents s’éliminent simultanément, mais frappent encore les héros adjacents pendant cette même vague. Les quatre héros sont concernés, y compris ceux qui ne sont pas sélectionnés.

La sélection, un déplacement refusé et un rayon revenant ne déclenchent pas ces contacts. Les transports imposés n’activent aucun pouvoir secondaire : un Barde poussé, échangé, reflété ou pressé ne chante pas ; un Magicien transporté ne vise pas ; un Voleur chanté ne tire pas ; un Guerrier transporté ne pousse pas non plus.

## 8. Animations, historique et campagne

Le rendu montre les étapes jusqu’au résultat stable. Les marches, poussées, tractions et chants ordinaires utilisent trois images ; les échanges et reflets trois images de transport ; le combat cinq images. Les durées sont fournies explicitement, la dernière image sans attente. Le circuit de quatre miroirs de la fixture de retour du Magicien utilise neuf images, avec les durées `90,90,90,90,100,100,80,100,0` ms.

Undo restaure l’action entière : sélection, positions, mécanismes, morts et progression de niveau. Une transition vers la salle suivante peut être annulée. Les avertissements répétés des miroirs ne créent pas de nouvelles entrées d’historique. L’interface permet d’interrompre une animation par Undo, Reset, Restart ou changement de niveau ; une temporisation annulée ne doit pas repeindre un ancien état.

Reset réinitialise la salle courante et son historique. Restart retourne au niveau 1 et efface la progression de campagne. Le choix d’une salle efface son historique local et remet cette salle à son état initial. Après la victoire dans cette salle, la session passe à la première salle non terminée, s’il en reste une. Le suivi pédagogique est un état d’interface : Undo conserve les découvertes, tandis que les opérations de redémarrage ou de choix de salle réinitialisent ce suivi.

## 9. Les 39 découvertes publiques

La liste suivante suit exactement l’ordre de `lessonIds`. Les textes détaillés et la détection restent dans `src/tutorial.ts` ; l’aide native réemploie les mêmes prompts.

| ID | Enseignement |
| --- | --- |
| `select` | Choisir un héros sans faire avancer le monde |
| `move` | Lire la direction et le héros actif |
| `warrior-push` | Pousser un occupant frontal |
| `file-push` | Déplacer plusieurs occupants contigus dans une même poussée |
| `mixed-file` | Déplacer une file contenant au moins deux types d’occupants |
| `thief-pull` | Tirer l’occupant immédiatement derrière le Voleur |
| `single-pull` | Constater qu’une seconde charge alignée reste en place |
| `partner-pull` | Tirer un partenaire sans activer son pouvoir |
| `release-by-pull` | Extraire le Barde en laissant les membres de son groupe |
| `partner-push` | Transporter un partenaire sans son pouvoir |
| `mirror-motion` | Déplacer un miroir sans le tourner |
| `relay-weight` | Remplacer un poids sans interrompre sa commande |
| `monster-still` | Reconnaître un monstre resté en place |
| `wizard-swap` | Effectuer un échange réciproque |
| `wizard-first` | Observer la priorité de la première cible |
| `wizard-partner` | Échanger un partenaire sans activer son pouvoir |
| `wizard-bend` | Dévier le rayon par une face blanche |
| `wizard-water` | Viser au travers de l’eau nue |
| `wizard-walk` | Marcher quand le rayon ne trouve aucune cible |
| `bard-song` | Entraîner des occupants dans le carré de chant |
| `partner-song` | Faire suivre un partenaire sans sa capacité |
| `selective-song` | Retenir certains membres par des butées |
| `diagonal-song` | Atteindre les coins de la portée |
| `wall-song` | Agir au-delà d’une cloison |
| `monster-song` | Déplacer un monstre par le chant |
| `release-by-swap` | Extraire le Barde par échange en laissant son groupe |
| `water-support` | Transformer une caisse en appui immergé |
| `support-slide` | Faire glisser un appui par le chant |
| `support-anchor` | Protéger un appui par son occupant ou l’arrivée du Barde |
| `cross-support` | Traverser un appui |
| `mirror` | Activer les reflets globaux |
| `hero-reflection` | Refléter un héros sans sa capacité |
| `crate-reflection` | Transporter une caisse par reflet |
| `button` | Maintenir un bouton par un poids |
| `gate` | Lire un changement d’état de porte ou de presse |
| `press` | Déplacer un occupant par fermeture de presse |
| `monster-press` | Attribuer le transport d’un monstre à une presse |
| `monster` | Observer la disparition d’un monstre et ses risques |
| `goals` | Réunir les quatre héros sur les destinations |

## 10. Références, adaptations et preuves

Les huit références d’auteur décrivent le principe retenu, les transformations de géométrie, les rôles ajoutés et les limites de la comparaison. Les liens affichés dans chaque salle proviennent de ce dossier. La première salle est un atelier original ; les salles suivantes adaptent les problèmes référencés. Les clones synchronisés, la lumière orange, la traversée des murs et le feu de dragon des références ne deviennent pas des pouvoirs implicites de SS25.

Le [dossier des sources](source-audit.md), le [README](../README.md) et les revues `reference/author/review-*-ss25.mjs` détaillent les emprunts. Les références numérotées retenues sont Stones East 2 et 4, Light 29 et 30, Artifacts 9, Doubled 10 et Water 22. Les variantes gagnantes sont conservées ; l’usage d’un pouvoir dans le témoin n’en démontre pas la nécessité générale.

Les JSON d’auteur doivent correspondre exactement à `src/levels.ts`, `src/level-info.ts` et `tests/witnesses.json`. La qualification rejoue les entrées publiques, compare les images et leurs durées, vérifie la victoire officielle, les 39 découvertes et Undo à chaque fin de salle. Les tests pédagogiques transmettent uniquement les champs publics nécessaires, y compris à partir de copies JSON détachées de toute session privée.

Les rapports de cette campagne sont produits dans `validation/` ; ceux de l’intégration native et du navigateur sont dans `docs/migration/ss25-evidence/` à la racine du dépôt. La [note de validation](validation.md) consigne leurs mesures réelles. Le contrôle de diversité compare les terrains des huit salles aux 88 niveaux SS14–SS24 après normalisation, translation, rotation et symétrie. Cela détecte les reprises exactes ; cela ne mesure ni l’originalité subjective ni la difficulté.

Les graphes de marche individuelle gèlent les autres pièces, recalculent les circuits quand le héros quitte une commande et excluent le contact orthogonal avec les monstres. Le modèle généreux ignore les autres héros comme obstacles tout en conservant leurs poids sur les commandes : il s’agit d’une approximation favorable, pas d’un parcours réellement exécuté. Ces graphes ne simulent pas la coopération complète ni les cascades de déplacement des presses. Les contre-branches locales établissent leurs conséquences observées, sans conclure à une impossibilité globale de réparation. Une solution d’auteur prouve la jouabilité, pas l’optimalité, l’unicité ou la réussite autonome de SRA.
