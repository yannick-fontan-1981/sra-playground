# SS19 — conception des huit salles

Version du laboratoire : **0.1.0**. SS19, **La Chasse Noire**, associe le Guerrier, le Magicien et le Barde. Les cartes sont des géométries originales inspirées de problèmes repérés dans les guides du [Nord](https://sinkingstarwalkthrough.com/fr/north/) et des [zones mixtes](https://sinkingstarwalkthrough.com/fr/crossovers/). Elles adaptent des contraintes de placement et de calendrier ; elles ne reproduisent pas les grilles ni toutes les règles du jeu source. Le détail des emprunts et des différences figure dans [l’audit des sources](source-audit.md).

## Une campagne qui change de problème

Le Guerrier pousse une file entière, le Magicien échange deux occupants et le Barde déplace son voisinage. La poursuite ajoute une question commune : **quel héros doit être actif au prochain geste pour que les monstres prennent la bonne direction ?** La sélection seule ne fait pas avancer le monde. Les salles alternent ensuite ce raisonnement avec des problèmes sans monstre, afin que la chasse ne remplace pas toute la logistique.

| Niveau | Structure et contrainte dominante | Entrées du témoin | Dont sélections |
| --- | --- | ---: | ---: |
| 1 · Les galeries de la première chasse | Trois galeries décalées ; découverte des pouvoirs et trois accès verrouillés différemment | 201 | 17 |
| 2 · Le gardien du seuil | Rail séparé, commande intérieure et îlot de relève ; conserver la bonne cible | 56 | 8 |
| 3 · L’interrupteur hors d’atteinte | Machine optique isolée et deux sas opposés ; extraire les réserves dans les bons états | 150 | 18 |
| 4 · Le gardien de la vanne | Deux rives et une réserve temporaire ; chasser, retirer un soutien puis construire le passage | 143 | 9 |
| 5 · Le troisième doit rester vivant | Prison étroite et moulin de presses ; éliminer une paire tout en conservant un gardien | 143 | 15 |
| 6 · La seconde image | Régions séparées et deux reflets couplés ; retarder une commande grâce à la première cible | 74 | 10 |
| 7 · Le relais condamné | Îlots et relais optique consommable ; préparer un miroir, en supprimer un autre et rouvrir son axe | 52 | 9 |
| 8 · Les deux gardiens vivants | Deux enclos en L, sas optique et île vide ; conserver deux chasseurs et affecter l’unique caisse au pont | 115 | 12 |
| **Total** | **Huit parcours gagnants sans refus ni perte de héros** | **934** | **98** |

Une entrée désigne ici une commande envoyée au moteur, sélection comprise. Ces nombres documentent les parcours qualifiés ; **ils ne mesurent ni la difficulté ni un minimum de coups**. Le témoin du niveau 1 montre volontairement de nombreuses interactions. Un niveau plus court peut exiger une décision plus difficile sur l’ordre des opérations. La campagne ne demande pas non plus d’utiliser chaque pouvoir dans chaque salle.

Les cartes, étapes, commandes complètes et métriques sont conservées dans les huit fichiers `reference/levelN-design.json`. Le fichier [des témoins de campagne](../tests/witnesses.json) rassemble les commandes à rejouer. Ces données appartiennent aux outils d’auteur ; elles ne sont pas fournies au joueur ni à l’agent SRA.

## 1 — Les galeries de la première chasse

**Références principales :** Heroes 2: Monsters, énigmes 1 et 14 ; Heroes and Water, 27–28 ; Heroes and Mirrors, 1 et 30. [Carte, étapes et témoin](../reference/level1-design.json).

Trois galeries décalées exposent les capacités par petits ensembles. Le chasseur circule dans un rail séparé : ses deux premiers déplacements permettent de voir le rythme de la poursuite, puis sa butée rend les manipulations suivantes plus faciles à observer. La salle enseigne la poussée en file, le déplacement imposé d’un partenaire, le réglage d’un miroir, la première cible d’une visée, les échanges et les reflets. Le chantier du Barde montre ensuite la portée diagonale, le chant à travers une cloison, les butées qui retiennent certaines pièces, l’immersion d’une caisse, le déplacement d’un appui et son ancrage.

Les trois destinations ont des accès distincts. La commande cyan exige deux charges ; l’issue optique demande de libérer un bouton initialement occupé ; l’accès inférieur dépend des poids disposés par le chant. Dans l’état initial, même un parcours qui ignore les autres occupants n’atteint aucune destination par la marche seule. Une suite de marches et de sélections qui ne déplace aucune pièce ne peut pas libérer l’issue optique.

Le tutoriel comporte **31 découvertes lues dans les images publiques**. Son parcours est pédagogique : les déplacements de partenaires, les allers-retours optiques, les relèves de commandes et la noyade du chasseur par presse donnent des exemples concrets des règles. **Ces interactions ne sont pas toutes imposées pour gagner.** Les coches n’interviennent jamais dans la victoire ; une solution peut montrer moins de choses que le témoin. La noyade enseignée ne devient pas un objectif caché d’élimination.

La [revue indépendante](../reference/independent-review-ss19.json) vérifie les sorties initialement inaccessibles, un refus concret devant la presse occidentale et le confinement du chasseur pendant le parcours pédagogique.

## 2 — Le gardien du seuil

**Références principales :** Heroes 2: Monsters, énigmes 15 et 22. [Carte, étapes et témoin](../reference/level2-design.json).

Le bouton du gardien est situé **à l’intérieur de son rail**, et non à son extrémité. Quatre gestes l’amènent à la bonne colonne ; un geste supplémentaire depuis une mauvaise cible peut le faire repartir. Changer de héros déplace la cible au sud : le mur bloque alors l’axe choisi par la poursuite et le gardien reste sur sa commande. Le rail est suffisamment séparé pour que le chant, les poussées et les visées des héros ne remplacent pas ce raisonnement.

Pendant que le gardien est immobilisé, le Barde retire la caisse d’un coude aveugle. Le Guerrier l’aligne avec le Magicien sur son îlot. L’échange laisse la caisse sur la commande et libère le Magicien, sans interrompre son occupation. Les trois destinations sont elles-mêmes des presses commandées par l’accord des deux poids : pénétrer derrière une porte puis laisser l’accord se défaire ne suffit donc pas.

La nécessité des ressources vient du nombre d’occupants. À la victoire, les trois héros sont sur les trois buts, distincts des commandes. La caisse unique et le gardien unique sont les deux seuls poids restants pour les deux boutons. La [revue du niveau 2](../reference/level2-review.json) rejoue notamment une immersion qui perd la caisse : aucun héros ne meurt immédiatement, mais l’accord final devient impossible sans annuler ou recommencer.

## 3 — L’interrupteur hors d’atteinte

**Références principales :** Heroes and Mirrors, énigme 16 ; Heroes 3: Bard, Druid, énigme 19. [Carte, étapes et témoin](../reference/level3-design.json).

Cette salle sans monstre est un problème de configuration à distance. Une caisse isolée change de bras par reflet et bascule une commande inaccessible. Celle-ci ouvre le sas supérieur en fermant le sas inférieur, puis inverse ces passages. Le joueur doit sortir les deux réserves de leurs chambres, les conserver au sec et choisir les moments où les partenaires franchissent les sas.

Une réserve est coincée dans un cul-de-sac sans position de poussée arrière. Le Barde la dégage, puis le Magicien l’extrait de son poste pour éviter qu’un départ chanté reprenne la caisse. Les deux charges rejoignent leurs commandes séparées ; le poids optique conserve sa fonction de contrôleur. Le dernier changement de configuration ouvre la destination occidentale sans déplacer ces lests.

La machine optique reste isolée des lignes de visée des héros. La revue indépendante vérifie aussi le cas où le Barde atteint sa caisse par la portée du chant : le mur bloque le pas qui la déplacerait, et les autres directions ne la dégagent pas. Le témoin utilise trois reflets ; ce nombre n’est pas annoncé comme un minimum. La contrainte porte sur les configurations accessibles et sur les trois caisses conservées pour les trois commandes finales, pas sur un compteur de reflets.

## 4 — Le gardien de la vanne

**Références principales :** Heroes and Water, énigmes 12 et 28 ; Heroes 2: Monsters, énigme 14. [Carte, étapes et témoin](../reference/level4-design.json).

Le gardien remplit d’abord une fonction utile : sa position maintient ouverte la réserve contenant deux caisses. Le témoin commence donc par faire sortir les deux charges en file. Le Guerrier attire ensuite le chasseur sur le soutien temporaire maintenu par le Magicien. Quand celui-ci quitte sa commande, la plateforme disparaît et le monstre tombe à l’eau.

Dans le témoin de référence, la seconde moitié de la salle transforme les ressources extraites en passage. Le Barde recale un appui déjà immergé ; les deux caisses construisent les deux cellules manquantes. Il faut préparer leur ordre de livraison, car une caisse immergée devient un appui et cesse d’être une charge mobile. Le témoin fait ensuite pousser le Barde par le Guerrier pour démontrer une traversée sans chant. Deux échanges assurent la relève des partenaires.

La salle oppose ainsi trois calendriers : sortir les réserves tant que le gardien les autorise, retirer le soutien au bon moment et conserver les appuis pendant les passages. Les destinations réparties sur les deux rives demandent un transfert net d’occupants. Le calendrier de noyade et les deux immersions appartiennent à ce parcours de référence, sans constituer des obligations universelles.

Deux variantes gagnantes sont conservées dans la [revue indépendante](../reference/independent-review-ss19.json). La première, de **141 entrées dont 9 sélections**, construit le passage pendant que le gardien vit encore, puis le noie au départ du Magicien. La seconde, de **138 entrées dont 16 sélections**, ne transforme qu’une des deux caisses en appui : l’autre caisse et un appui se déplacent ensemble, puis un échange du Magicien assure la relève. Son état final conserve les appuis en `(11,11)` et `(13,11)` et une caisse sèche en `(9,11)`. Les deux réserves sont toujours utilisées ; cela ne prouve pas que chacune doive être immergée. Les deux variantes terminent sans refus ni perte de héros.

Le Barde peut aussi traverser le pont achevé par cinq pas chantés : les appuis sont retenus par les autres appuis et la rive. La poussée du Guerrier enseigne donc un départ imposé, sans être une nécessité universelle de cette carte.

Une variante indépendante retarde la sortie du Magicien de sa commande jusqu’après la construction et le transfert du Barde. Elle termine en **141 entrées, dont 9 sélections**, et conserve les deux caisses ainsi que l’appui déplacé. La noyade avant le chantier n’est donc pas un ordre obligatoire ; le témoin principal de 143 entrées reste un parcours pédagogique valide.

## 5 — Le troisième doit rester vivant

**Références principales :** Heroes 3: Bard, Druid, énigmes 13–14 ; Heroes and Light, énigme 1. [Carte, étapes et témoin](../reference/level5-design.json).

Cette carte sèche n’utilise aucun miroir. Le Magicien attire d’abord les deux chasseurs extérieurs dans une rangée commune, puis vers la droite : une butée retient le premier et leur rapprochement déclenche le combat. Ce travail précède le verrouillage du moulin. Le Barde fait ensuite monter le captif dans sa colonne jusqu’au bouton et amène la caisse derrière lui. Cette commande ouvre le passage de chargement du Guerrier, placé au-dessus de la réserve, mais ferme les côtés de manœuvre.

Le Barde agit depuis un pupitre étroit. En sortir volontairement risquerait de reprendre les pièces qui constituent la prison ; le Magicien l’en extrait par échange. La caisse de la chambre haute traverse alors le moulin : la première presse la dépose vers l’ouest, la seconde transforme ce transfert en livraison vers le sud. Le Guerrier récupère la charge et la conduit à la commande de la chambre haute. Les côtés condamnés et les murs inférieurs empêchent la séquence de quatre chants qui, dans une version de travail, remplaçait directement ces deux livraisons.

La nécessité du captif a une raison géométrique. Sa colonne fermée, de `(5,8)` à `(5,12)`, contient un monstre initialement au-dessus d’une caisse. Les deux pièces ne peuvent ni se croiser ni quitter cette colonne ; aucune ligne de visée, aucun miroir et aucun accès latéral ne permettent d’inverser leur ordre. Seul le monstre peut donc occuper le bouton du haut, qui maintient une destination ouverte. La caisse sert à le retenir à cet endroit pendant les départs.

Le problème porte sur la différence entre une paire à rapprocher et un gardien à maintenir sur place, puis sur les côtés de poussée qui restent accessibles après le changement de circuit. Aucun compteur « tuer deux monstres » n’est ajouté à la victoire : les effets utiles sont la libération de l’arène, le chargement du moulin et les boutons occupés.

Une **variante gagnante de 181 entrées, dont 22 sélections**, utilise la première presse puis remplace la seconde par un déverrouillage temporaire du captif, une extraction par échange du Magicien et un nouveau verrouillage. Elle conserve le gardien utile et demande davantage de coordination que le témoin de 143 entrées. La fermeture des côtés a supprimé le contournement direct en quatre chants ; elle ne prouve pas que les deux presses soient obligatoires dans toute solution. Cette variante légale est conservée dans la [revue indépendante](../reference/independent-review-ss19.json).

## 6 — La seconde image

**Références principales :** Heroes and Mirrors, énigme 19 ; Heroes and Water, énigme 11. [Carte, étapes et témoin](../reference/level6-design.json).

Deux systèmes optiques partagent la même commande de reflet. Dans le plan de référence, le Barde prépare une charge éloignée derrière une caisse plus proche du miroir. Le Magicien le relève sans reprendre cette charge. Le premier reflet transporte le Guerrier vers le débarcadère nord et envoie seulement le bloqueur proche dans l’eau : il devient l’appui du passage sud-est. Le second atteint la charge lointaine et l’envoie sur le bouton.

Cette commande ferme le débarcadère emprunté par le Guerrier et ouvre d’autres accès. Le joueur doit donc déplacer le Guerrier hors de son axe avant de poursuivre. Répéter immédiatement le reflet le ramène au départ ; une troisième activation est ensuite refusée par le débarcadère fermé. Le rapport décrit ce résultat comme une erreur réparable, sans prétendre qu’elle rend toute la salle définitivement insoluble.

Une **variante gagnante de 95 entrées, dont 10 sélections**, laisse la charge en haut avant les deux premiers reflets. Elle la récupère plus loin sur le quai, la replace au chant et utilise deux échanges pour extraire le Barde. La préparation avant les reflets n’est donc pas une nécessité universelle. Le parcours de référence, de 74 entrées, conserve un appui et un poids sec ; cela ne constitue pas une preuve exhaustive contre toute autre utilisation de deux appuis ou déplacement ultérieur d’un miroir. Les deux parcours figurent dans la [revue finale](../reference/final-ss19-review.json).

## 7 — Le relais condamné

**Références principales :** Heroes and Mirrors, énigme 18 ; Heroes 2: Monsters, énigmes 10 et 14. [Carte, étapes et témoin](../reference/level7-design.json).

Le Guerrier prépare d’abord le petit miroir pour les arrivées nord-ouest, avant de quitter l’atelier. Un autre miroir sert de relais vers le quai droit, mais occupe l’axe du dernier reflet. Il faudra le supprimer après son utilisation. Le chasseur du quai se trouve derrière une caisse écran ; le témoin pousse la file deux fois, ce qui envoie le monstre à l’eau et laisse la caisse sur une commande.

Dans l’atelier, le Barde descend une charge dans sa glissière jusqu’au bouton de destruction. La presse écrase le relais contre une butée. **Le miroir disparu laisse cependant une presse fermée dans le même axe** : il faut remonter la charge d’une case pour rouvrir le rayon. Les deux contre-essais — relais intact, puis relais détruit mais presse encore fermée — produisent bien un refus de reflet.

Le Magicien extrait ensuite le Barde de la glissière. Le premier départ par le petit miroir place le Barde hors de l’axe ; le dernier reflet transporte ensemble les deux autres héros vers les destinations restantes.

Une **variante gagnante de 50 entrées, dont 9 sélections**, utilise une seule poussée de la file. Elle garde le monstre vivant en `(16,12)` et sa caisse écran en `(15,12)`. Les changements de cible suivants restent bloqués par l’écran. Le réglage du petit miroir, la destruction du relais, la réouverture de sa presse et les départs sont conservés. **Tuer ce chasseur n’est donc pas obligatoire.** Le témoin principal compte 52 entrées ; les deux solutions sont rejouées dans la [revue finale](../reference/final-ss19-review.json).

## 8 — Les deux gardiens vivants

**Références principales :** Heroes 2: Monsters, énigmes 15, 22 et 29 ; Heroes and Water, énigme 11. [Carte, étapes et témoin](../reference/level8-design.json).

Les chasseurs occupent deux enclos en L. Les premières actions les amènent vers leurs angles, mais des retenues empêchent encore leur descente. Une caisse unique se trouve sur la commande d’une réserve éloignée. Le témoin l’extrait par une visée coudée : le Magicien remplace la caisse et conserve le sas ouvert. Le Barde dégage la caisse du rayon, puis un reflet ramène le Magicien. La réserve maintenant vide ferme la presse du sas, le dépose au sud et crée une butée qui servira à garder le chasseur oriental en place.

La caisse descend ensuite dans l’atelier, change d’axe sur le quai et devient l’appui d’entrée de l’île finale. Le Guerrier tient la commande de libération des enclos. Depuis cette position éloignée, sa cible ne suffit pas à conduire le chasseur oriental jusqu’au bouton : le Barde devient actif et descend dans une autre colonne. La priorité d’axe fait alors progresser les deux monstres jusqu’à leurs commandes. Les positions des trois arrivées et les butées maintiennent les gardiens en place pendant la fin du parcours.

### Pourquoi la caisse et les deux chasseurs sont nécessaires

L’île finale, en `x14..16, y16..18`, est bordée de murs sauf à son entrée d’eau **`(13,17)`**. Elle ne contient initialement aucun occupant. Aucun axe du miroir n’y arrive. Un échange ne peut pas y envoyer le premier occupant sans cible ; le chant ne fait pas traverser un héros sur de l’eau nue. **La caisse unique doit donc fournir l’appui de cette entrée.**

Le miroir en `(17,11)` ne peut pas être déplacé : chaque direction de poussée rencontre un mur du côté de l’arrivée ou du pousseur, notamment en `(18,11)` et `(17,12)`. Il ne peut pas devenir un poids de remplacement.

Deux autres destinations sont des presses liées aux boutons **`(6,6)`** et **`(12,11)`**, distincts des buts. Dans l’état final, les trois héros occupent leurs destinations, la seule caisse est immergée et le miroir reste sur son socle. Les deux monstres vivants sont alors les seuls poids disponibles pour les deux commandes. Perdre l’un d’eux empêche l’accord final sans annuler ou recommencer. Cet argument repose sur la géométrie et les occupants visibles ; il ne repose pas sur l’échec d’une recherche bornée.

Deux contrebranches illustrent ces contraintes. Relâcher la commande dès que les gardiens entrent dans les retenues les renvoie vers le haut. Couler la caisse dans le bras optique en `(13,11)` crée un appui séparé de `(13,17)` par du sol et des murs : un appui ne se déplaçant qu’entre cases d’eau, aucun chant ne peut réparer cette immersion.

### Une extraction alternative acceptée

Une **variante gagnante de 98 entrées, dont 9 sélections**, commence par un reflet qui extrait directement la caisse. Elle n’utilise pas la visée coudée du témoin de 115 entrées. Elle construit néanmoins l’appui en `(13,17)` et maintient les deux gardiens vivants sur leurs boutons. L’échange coudé et l’ordre exact de récupération sont donc des possibilités enseignées, sans être annoncés comme des obligations universelles. Le parcours complet, ses métriques et les contrebranches figurent dans la [revue finale](../reference/final-ss19-review.json) et la [revue indépendante](../reference/independent-review-ss19.json).

## Ce qui décide réellement de la victoire

Chaque salle exige toujours les trois héros vivants sur les trois destinations, après la stabilisation des presses, de l’eau et des contacts. Les dispositifs qui rendent certains objets nécessaires sont sur la carte : boutons occupés, portes ouvertes, appuis présents et passages accessibles. Il n’existe aucun contrôle caché de l’ordre des actions, du nombre de reflets, des découvertes du tutoriel ou du recours à un pouvoir.

Les témoins prouvent des victoires légales. Les variantes constructives établissent d’autres victoires précises. Les contrebranches décrivent leur effet à partir d’une position donnée ; seules les preuves de géométrie ou de conservation explicitement exposées étendent une conclusion à toutes les routes. La qualification technique et ses limites sont consignées séparément dans [validation.md](validation.md).
