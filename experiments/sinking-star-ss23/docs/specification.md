# SS23 — spécification du contrat jouable

Cette spécification décrit le moteur de **SS23 — Les Chambres de Résonance**. Elle s’appuie sur [le moteur](../src/core.ts), [le tutoriel public](../src/tutorial.ts), [les tests](../tests/) et [l’adaptateur natif](../../../src/games/sinking-star-ss23.ts). Les huit salles et leurs dossiers d’adaptation sont en cours de finalisation ; les noms de salles et les résultats de campagne ne sont pas figés dans ce document.

## 1. Composition et victoire

Le jeu exige exactement un Marchand, un Guerrier, un Magicien et un Barde, ainsi que quatre destinations. L’ordre stable est `merchant`, `warrior`, `wizard`, `bard`. Le Marchand est sélectionné à l’ouverture d’une salle.

Une salle se termine lorsque les quatre destinations sont occupées simultanément par les quatre héros vivants, après résolution des mécanismes et des contacts. Les destinations ne sont pas assignées à une couleur. Un héros déjà arrivé reste sélectionnable et peut repartir pour aider les autres. La perte d’un seul héros produit `GAME_OVER`.

Le tutoriel est le niveau 1. Ses 36 découvertes expliquent les règles ; elles ne sont pas requises par la condition de victoire. Les autres salles conservent les aides contextuelles sans attribuer de nouvelles découvertes de ce tutoriel.

## 2. Plateau, couleurs et commandes publiques

Le monde contient au plus 20 × 20 cellules. Chaque cellule occupe 3 × 3 pixels, dans une image de 64 × 64 pixels avec une origine de plateau en `(2,2)`. Une carte plus petite est centrée ; ses dispositifs utilisent les coordonnées de la carte source avant ce décalage.

| Élément | Représentation principale |
| --- | --- |
| Marchand | Croix orange, indice de palette 12 |
| Guerrier | Croix rouge, indice 8 |
| Magicien | Croix violette, indice 15 |
| Barde | Croix magenta, indice 6 ; portée pointillée quand il est sélectionné |
| Héros actif | Un bras blanc indique sa dernière direction |
| Caisse | Carré brun à centre noir |
| Appui immergé | Motif de bois et de cyan, distinct d’une caisse mobile |
| Eau / sol / mur | Bleu / gris / gris foncé |
| Destination | Contour jaune conservé sous les occupants |
| Monstre | Rouge et noir ; sa forme est distincte de la croix du Guerrier |
| Bouton | Bras roses sur fond gris, centre de la couleur du circuit |
| Presse | Repères du circuit et de direction ; centre gris ouvert, noir fermé |
| Miroir | Diagonale blanche et dos noir |

Les détecteurs pédagogiques reconnaissent les formes dans l’image publique. La couleur centrale d’un bouton violet ne suffit pas à en faire un Magicien ; le rouge d’un monstre ne suffit pas à en faire un Guerrier.

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

### Marchand : pousser un occupant

Le Marchand marche d’une case. Si la case immédiatement devant lui contient un héros, une caisse, un monstre ou un miroir, il peut pousser cet occupant d’une case supplémentaire, à condition que l’arrivée soit libre. Deux occupants contigus bloquent sa poussée. Il ne pousse pas un appui immergé.

Une poussée peut remplacer le héros qui occupait un bouton : le Marchand prend son ancienne place dans le même geste. Les héros déplacés ne déclenchent pas leur propre pouvoir. Une poussée volontaire qui noierait un héros ou détruirait un miroir faute de soutien est refusée entièrement.

### Guerrier : pousser toute une file

Le Guerrier pousse tous les occupants contigus devant lui, dans l’ordre de la file. Cette file peut mêler héros, caisses, monstres et miroirs. Chaque membre avance d’une seule case. Une butée ou une arrivée interdite fait refuser la poussée entière ; aucun préfixe de la file n’est déplacé isolément.

Le Guerrier ne possède pas d’attaque ni d’immunité. Pousser directement un monstre peut le laisser à son contact et provoquer sa mort après la cascade. Une caisse en bout de file peut devenir un appui dans l’eau ; une caisse suivante peut ensuite rester mobile dessus.

### Magicien : échanger avec la première cible

Une flèche du Magicien lance une visée dans cette direction. La première caisse, le premier monstre ou le premier autre héros rencontré devient la cible : le Magicien et cet occupant échangent leurs places simultanément. Le trajet peut franchir l’eau nue. Les appuis immergés ne sont pas des cibles et restent en place pendant un échange.

Un mur, une porte fermée, une presse fermée ou le dos noir d’un miroir arrête la visée. Une face blanche peut la dévier à angle droit ; plusieurs miroirs peuvent ainsi relayer le rayon. Un miroir n’est jamais lui-même échangé. S’il n’existe aucune cible accessible, le Magicien tente une marche ordinaire d’une case. Un miroir immédiatement devant lui peut donc relayer un rayon, mais ne peut pas être traversé par ce pas ordinaire.

Un rayon qui revient à son origine ou tourne en boucle ne produit aucun déplacement ni tick des contacts. L’animation éclaire son circuit, puis fait pulser le Magicien. Répéter cette même animation n’ajoute pas d’annulation supplémentaire à état identique.

Un échange conserve un occupant à chacune des deux extrémités ; il peut donc assurer une relève sur un bouton sans interrompre le circuit. Il ne crée pas une première présence sur une île vide. Échanger le Barde ne fait pas chanter celui-ci. Les contacts et les effets des circuits sont néanmoins résolus après l’échange : déposer un monstre près d’un partenaire peut être fatal.

### Barde : entraîner un groupe dans son carré

Le chant accompagne le pas volontaire du Barde. Sa portée est le carré de 5 × 5 centré sur sa position avant le pas : deux cases au plus horizontalement et verticalement, diagonales comprises. Les murs ne coupent pas cette portée.

Les autres héros, les caisses, les monstres et les appuis admissibles tentent un déplacement d’une case dans la même direction. Les miroirs sont exclus. Un membre bloqué reste en place ; d’autres membres peuvent continuer. Une pièce hors de portée n’est pas poussée par propagation. Si le Barde lui-même ne peut pas avancer, l’action entière est refusée.

Le chant ne fait jamais agir le pouvoir d’un partenaire transporté : le Guerrier ne pousse pas une file extérieure à la portée, le Marchand ne prolonge pas une poussée et le Magicien ne lance pas de rayon.

## 4. Eau, caisses et appuis

Une caisse déposée dans une eau sans soutien devient un appui immergé. Elle cesse alors d’être une caisse mobile. Une caisse posée sur un appui existant reste une caisse mobile. Un monstre qui tombe dans l’eau nue disparaît et ne crée aucun appui. Un héros non soutenu meurt ; un miroir non soutenu disparaît lors d’un transport forcé.

Un appui porte les héros et les objets placés dessus. Il ne fait pas poids sur les commandes. Il ne se pousse pas, ne s’échange pas et ne se transporte pas par reflet. Le Barde peut le faire glisser d’une case d’eau vers une autre case d’eau.

Deux conditions ancrent l’appui pendant le chant : un héros l’occupe au début du pas, même si ce héros se déplace ensuite ; ou cet appui se trouve sous l’arrivée immédiate du Barde. Un miroir ou une caisse seuls ne constituent pas cet ancrage. Le chant refuse toutefois le geste entier si le déplacement des appuis priverait un héros ou un miroir de soutien. Un appui ne déplace pas un passager par une capacité de transport autonome.

Les marches, poussées et chants volontaires ne permettent pas de noyer un compagnon ni d’abandonner un miroir sur une eau déjà sans soutien. Cette protection ne neutralise pas les conséquences forcées ultérieures d’un reflet, d’une presse ou du retrait d’une plateforme.

## 5. Miroirs : deux usages distincts

ACTION5 active tous les miroirs ensemble, quel que soit le héros sélectionné. Chaque miroir met en relation les deux axes de sa face blanche en conservant la distance au miroir. Parmi les occupants visibles sur ces axes, le plus proche est prioritaire. À distance égale, les deux occupants s’échangent. L’arrivée bloquée d’un candidat plus lointain ne doit pas empêcher le transfert valide du plus proche.

Les héros, caisses et monstres peuvent être reflétés ; les miroirs et les appuis ne le peuvent pas. Un reflet ne relaie pas son trajet à travers un second miroir comme le fait la visée du Magicien. Les tracés, les destinations incompatibles et les occupants non déplacés sont contrôlés globalement : le geste s’applique entièrement ou est refusé. Les miroirs responsables peuvent clignoter en rouge sur leur dos, en gardant leur diagonale blanche.

Les arrivées possibles apparaissent sous forme de croix gris clair pour les héros et de contours carrés pour les caisses. Une arrivée dans l’eau peut rester dangereuse. Le Marchand, le Guerrier et les presses déplacent physiquement les miroirs sans changer leur orientation ; le chant ne les entraîne pas.

## 6. Boutons, portes, presses et plateformes

Un héros vivant, une caisse, un monstre ou un miroir peut maintenir un bouton. Les boutons d’un circuit nommé forment une condition ET : tous doivent être occupés. Une presse déjà fermée sur une case de bouton peut aussi maintenir ce circuit. Les portes simples `D` suivent leur règle héritée : elles ouvrent lorsque tous les boutons visibles du monde sont occupés par leurs poids ; une fermeture sur un occupant fait refuser l’action.

Chaque presse latérale nomme son circuit, son sens de poussée et sa condition de fermeture, à l’appui ou au relâchement. Lorsqu’elle passe d’ouverte à fermée, elle pousse l’occupant de sa propre case ainsi que la file contiguë devant lui. Une fermeture sur une case vide ne pousse pas une pièce voisine. Si une butée empêche le transport, l’occupant pris sur la case de presse est écrasé ; un héros écrasé entraîne la défaite.

Une plateforme hydraulique se déploie ou se retire selon son circuit. Déployée, elle porte les héros et les objets. Les arrivées forcées sur une case hydraulique attendent la résolution de son état de soutien dans la cascade. Retirer une plateforme peut noyer un héros distant, éliminer un monstre ou un miroir, ou transformer sa caisse en appui. Cet appui persiste lors d’un redéploiement et reste soumis au chant.

Les circuits, les presses et les plateformes sont résolus jusqu’à stabilisation. Si une cascade de mécanismes est instable, le geste physique est refusé. Les contacts peuvent supprimer un monstre qui servait de poids et entraîner une nouvelle résolution des mécanismes.

## 7. Monstres et déplacements imposés

Les monstres restent sur leur case sans transport explicite. Ils ne poursuivent pas les héros. Une poussée, un échange, un chant, un reflet ou une presse explique chaque déplacement.

Après un geste effectif et ses effets mécaniques, les monstres attaquent leurs voisins orthogonaux. Une diagonale n’est pas un contact. Deux monstres adjacents s’éliminent simultanément, mais frappent encore les héros adjacents pendant cette même vague. Les quatre héros sont concernés, y compris ceux qui ne sont pas sélectionnés.

La sélection, un déplacement refusé et un rayon revenant ne déclenchent pas ces contacts. Les transports imposés n’activent aucun pouvoir secondaire : un Barde poussé, échangé, reflété ou pressé ne chante pas ; un Magicien transporté ne vise pas ; un Guerrier chanté ne pousse pas ; un Marchand transporté ne pousse pas non plus.

## 8. Animations, historique et campagne

Le rendu montre les étapes jusqu’au résultat stable. Les marches, poussées et chants ordinaires utilisent trois images ; les échanges et reflets trois images de transport ; le combat cinq images. Les durées sont fournies explicitement, la dernière image sans attente. Le circuit de quatre miroirs de la fixture de retour du Magicien utilise neuf images, avec les durées `90,90,90,90,100,100,80,100,0` ms.

Undo restaure l’action entière : sélection, positions, mécanismes, morts et progression de niveau. Une transition vers la salle suivante peut être annulée. Les avertissements répétés des miroirs ne créent pas de nouvelles entrées d’historique. L’interface permet d’interrompre une animation par Undo, Reset, Restart ou changement de niveau ; une temporisation annulée ne doit pas repeindre un ancien état.

Reset réinitialise la salle courante et son historique. Restart retourne au niveau 1 et efface la progression de campagne. Le choix d’une salle efface son historique local et remet cette salle à son état initial. La session passe ensuite à la première salle non terminée. Le suivi pédagogique est un état d’interface : Undo conserve les découvertes, tandis que les opérations de redémarrage ou de choix de salle réinitialisent ce suivi.

## 9. Les 36 découvertes publiques

La liste suivante suit exactement l’ordre de `lessonIds`. Les textes détaillés et la détection restent dans `src/tutorial.ts` ; l’aide native réemploie les mêmes prompts.

| ID | Enseignement |
| --- | --- |
| `select` | Choisir un héros sans faire avancer le monde |
| `move` | Lire la direction et le héros actif |
| `merchant-push` | Pousser un occupant |
| `warrior-push` | Employer la poussée du Guerrier |
| `file-push` | Déplacer toute une file contiguë |
| `mixed-file` | Mêler partenaires et charges dans une file |
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

Les références d’auteur doivent décrire le principe retenu, les transformations du plan, les rôles ajoutés ou remplacés et les limites de la comparaison. Les liens publics exposés dans chaque salle doivent correspondre à ce dossier. Une salle adaptée est présentée comme une adaptation, sauf preuve explicite d’une reprise exacte.

Les témoignages de walkthrough servent à étudier les mécanismes et la structure d’une énigme. Ils ne certifient pas automatiquement la difficulté, la fidélité géométrique ou la nécessité d’un pouvoir dans SS23. Les titres et correspondances détaillés des huit salles seront consignés après validation des dossiers sources.

Les références JSON et les témoins doivent correspondre aux cartes expédiées. Les validations rejouent les commandes publiques, comparent les images et durées, vérifient la victoire officielle, les découvertes et Undo. Les essais d’ablation ou de recherche restent des outils d’auteur ; un budget épuisé est inconclusif. Le simple usage d’un mécanisme dans un témoin n’en prouve pas la nécessité.

La qualification complète et la publication de SS23 restent en attente. Les preuves courantes sont décrites dans la note d’intégration native ; aucune résolution autonome SRA n’est déduite du rejeu d’auteur.
