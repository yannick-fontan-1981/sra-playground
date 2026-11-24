# SS19 — Les Gardiens Noirs : conception des huit salles

Version du laboratoire : **0.2.1**. La campagne associe le **Guerrier rouge (`W`)**, le **Magicien violet (`Z`)** et le **Barde magenta (`B`)**. Ses huit géométries sont originales ; elles adaptent des problèmes de placement et de transport repérés dans les guides du [Nord](https://sinkingstarwalkthrough.com/fr/north/) et des [zones mixtes](https://sinkingstarwalkthrough.com/fr/crossovers/). Les emprunts et leurs limites sont détaillés dans [l’audit des sources](source-audit.md).

## Progression et diversité des problèmes

La révision 0.2.1 échange les deux premières salles de la version 0.2.0. Le jeu démarre au **Gardien du seuil** ; le tutoriel de **31 découvertes** suit au niveau 2, dans **Les galeries des gardiens**. Les cartes, mécanismes et parcours sont conservés avec leur salle. Les niveaux 3 à 8 restent dans le même ordre.

La difficulté vient de la préparation des emplacements, du partage des ressources et des départs qui doivent préserver les poids déjà posés. **Tous les monstres restent immobiles tant qu’un pouvoir, un reflet ou une presse ne les transporte pas.** Aucun pas supplémentaire ne dépend du héros sélectionné, de sa distance ou d’un calcul de direction invisible.

| Niveau | Structure et raisonnement dominant | Entrées du témoin | Dont sélections |
| --- | --- | ---: | ---: |
| 1 · Le gardien du seuil | Rail de trois presses et îlot de relève ; livrer deux poids permanents | 62 | 8 |
| 2 · Les galeries des gardiens | Trois galeries décalées ; 31 découvertes et trois accès verrouillés différemment | 208 | 20 |
| 3 · L’interrupteur hors d’atteinte | Machine optique isolée et deux sas opposés ; extraire les réserves dans les bons états | 150 | 18 |
| 4 · Le gardien de la vanne | Réserve temporaire, trappe et bassin ; coordonner le retrait du gardien et le chantier | 135 | 12 |
| 5 · Le troisième doit rester vivant | Chambre scellée, rencontre provoquée et moulin de presses ; conserver trois poids distincts | 134 | 13 |
| 6 · La seconde image | Régions séparées et reflets couplés ; différer une livraison grâce au premier obstacle | 74 | 10 |
| 7 · Le relais condamné | Îlots et relais optique consommable ; préparer, détruire puis rouvrir | 52 | 9 |
| 8 · Les deux gardiens vivants | Deux transports de monstres, réserve optique et île vide ; répartir exactement les ressources finales | 97 | 15 |
| **Total des huit témoins** | **Victoire sans refus ni perte dans chaque salle** | **912** | **105** |

Ces comptes décrivent des parcours complets vérifiés. Ils ne mesurent pas la difficulté et ne constituent pas des minimums. Le témoin du niveau 2 comprend volontairement des démonstrations facultatives. Les variantes qualifiées sont indiquées plus bas ; le jeu accepte toute solution conforme aux mêmes règles physiques.

Les niveaux 3 et 6 ne contiennent pas de monstre : leurs cartes et leurs témoins sont conservés. Le niveau 7 conserve également sa carte et son témoin, dont les déplacements du monstre étaient déjà provoqués par des poussées. Les niveaux 1, 2, 4, 5 et 8 organisent désormais leurs gardiens autour de commandes explicites. La règle d’immobilité s’applique à tous les monstres de la campagne, sans catégorie particulière.

## Ce que le plateau permet de comprendre

Le Guerrier pousse une file contiguë entière. Le Magicien échange sa place avec la première cible de sa visée, éventuellement déviée par un miroir. Le Barde entraîne les occupants de son carré de 5 × 5, calculé avant son pas ; les murs ne coupent pas cette portée. Un déplacement imposé à un partenaire ne déclenche pas sa capacité. Le [contrat des règles](specification.md) précise les ancrages, les cascades et les cas de refus.

Chaque transport de monstre possède une cause observable. Le chant suit un pas accepté du Barde ; une presse agit à sa fermeture sur l’occupant de sa propre case ; un reflet part des axes visibles ; une poussée conserve la file. Ouvrir une porte vide ou sélectionner un héros ne fait venir aucun gardien. Le contact par un côté reste dangereux pour tous les héros, même inactifs ; deux monstres voisins s’éliminent simultanément.

Les boutons et les presses occupent des cases distinctes. Un bouton montre un plus rose sur fond gris et la couleur de son circuit au centre. Une presse montre son orientation et un centre noir lorsqu’elle est fermée, gris lorsqu’elle est ouverte. Les couleurs relient les commandes aux dispositifs ; leur polarité se vérifie par le changement d’état. Un trajet de reflet incompatible est refusé en entier et les miroirs concernés signalent le blocage en rouge.

Les sorties restent soumises aux circuits après l’arrivée d’un premier héros. **La victoire exige seulement trois héros vivants sur les trois destinations simultanément.** Aucun quota de combat, nombre de reflets, usage obligatoire d’un pouvoir ou découverte pédagogique n’est ajouté à cette condition. Les nécessités mentionnées dans ce guide proviennent de la géométrie et des occupants disponibles.

## 1 · Le gardien du seuil

Le rail du gardien est séparé du sol des héros par deux rangées murées. Les trois commandes **jaune, verte et orange**, alignées en **(10,6), (11,6), (12,6)**, actionnent trois presses orientées vers l’ouest. Leurs fermetures livrent successivement le monstre de **(14,3)** à **(13,3)**, puis **(12,3)**, puis au bouton violet distinct en **(11,3)**. Le joueur peut suivre chaque impulsion et son résultat sur le rail.

Revenir sur une commande déjà employée ne remplace pas l’impulsion suivante : sa presse est alors vide. La portée du chant, les visées et l’absence de miroir rendent les presses nécessaires à cette livraison. Une fois arrivé, le gardien conserve sa place jusqu’à un nouveau transport imposé.

Le second poids demande une autre logistique. Le Barde extrait la caisse de son coude aveugle ; le Guerrier l’aligne devant l’eau ; le Magicien échange sa place avec elle pour la laisser sur la commande de son îlot. L’accord des deux boutons violets ouvre les trois destinations.

La nécessité des deux ressources est un comptage final : les trois héros occupent les trois destinations, distinctes des commandes. La caisse et le monstre sont les seuls poids restants pour les deux boutons. Leurs rôles ne sont pas imposés par un compteur invisible.

**Références adaptées :** [Heroes 2, 15 et 22](https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/) pour les poids et leur relève ; [Light, 1](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/) pour les poussées depuis un côté inaccessible. Le rail à trois couleurs et l’îlot sont originaux. [Témoin et étapes du niveau 1](../reference/level1-design.json).

## 2 · Les galeries des gardiens

Les trois alcôves sont fermées au départ. La commande cyan demande deux poids, la commande optique doit être libérée et la galerie basse dépend de l’accord du chœur. Une simple marche ne résout donc pas la salle : la caisse déjà posée sur le bouton optique maintient notamment l’alcôve est fermée tant qu’elle n’est pas déplacée.

Le parcours pédagogique fait découvrir la poussée en file, le déplacement d’un partenaire sans son pouvoir, le recalage d’un miroir, la visée coudée, la priorité de la première cible et la relève d’un poids par échange. Le Barde travaille ensuite derrière une cloison : les butées retiennent une partie du groupe, une caisse devient appui et un héros protège cet appui pendant le déplacement du suivant. Le Magicien permet de quitter ces postes sans reprendre les charges par le chant.

La livraison du gardien est une démonstration en deux temps. Il reste en **(16,9)** pendant les préparatifs. Un pas du Barde vers la gauche le dépose sur la presse verte ouverte en **(15,9)**. Après l’extraction du Barde, la commande verte ferme cette presse et pousse le monstre vers l’eau en **(15,10)**. Un pas bloqué du Barde ne chante pas ; une fermeture de presse vide ne transporte rien à distance.

Les **31 découvertes** couvrent sept familles :

| Famille | Nombre | Enseignements observés |
| --- | ---: | --- |
| Lecture et issue | 5 | Sélection, déplacement, immobilité des monstres, danger du contact et destinations communes |
| Guerrier | 4 | Poussée, file, partenaire déplacé sans pouvoir et miroir mobile |
| Magicien | 4 | Première cible, échange de partenaire, visée coudée et relève d’un poids |
| Barde | 7 | Groupe, partenaires, butées, diagonales, portée à travers les murs, monstre chanté et départ par échange |
| Eau | 4 | Création d’appui, glissement, ancrage et traversée |
| Reflets | 3 | Activation globale, transport d’un héros et transport d’une caisse |
| Circuits | 4 | Bouton, porte, presse et monstre poussé par presse |

Le témoin de 208 entrées démontre ces interactions ; il n’est pas nécessaire de cocher les 31 découvertes pour gagner. En particulier, la noyade enseignée n’est pas déclarée indispensable à toutes les solutions. Les extractions sans chant et les trois verrouillages donnent au tutoriel une résolution matérielle propre, au-delà de ses démonstrations.

**Références adaptées :** [Heroes 2, 14–15](https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/) pour la préparation et les poids ; [Water, 27–28](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) pour les appuis et les départs imposés ; [Mirrors, 1 et 30](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/) pour le transport et la visée. La baie de livraison, les galeries et les trois verrous sont propres à SS19. [Témoin et étapes du niveau 2](../reference/level2-design.json).

## 3 · L’interrupteur hors d’atteinte

Cette salle conserve son problème sans monstre. Un poids commandé par reflet change de bras dans une machine isolée. Il ouvre un sas pendant qu’il ferme l’autre. Les deux réserves doivent franchir leurs passages dans des configurations différentes avant d’occuper les deux boutons du circuit de charges.

Le Barde extrait une réserve d’un cul-de-sac où le Guerrier manque de place derrière la caisse. Le Magicien le relève sans reprendre cette charge. Le dernier état de l’interrupteur autorise les arrivées tout en laissant les deux lests en place. Les trois reflets du témoin décrivent ce calendrier ; leur nombre n’est pas annoncé comme minimal.

Le contrôle depuis le bord ne donne pas un déplacement gratuit de la machine : même lorsque la caisse entre dans la portée du Barde, le pas susceptible de l’extraire est bloqué par un mur. Les autres directions la retiennent contre ses butées. Un retrait du lest bas après une première arrivée referme réellement une presse de destination et en expulse son occupant.

À l’état final, le poids de l’interrupteur et les deux réserves assurent trois commandes distinctes, tandis que les héros occupent les buts. Cette conservation explique le rôle des trois caisses. La salle apporte une alternance optique à la campagne sans modifier sa géométrie pour y ajouter des monstres.

**Références adaptées :** [Mirrors, 16](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/) pour l’interrupteur distant ; [Heroes 3, 19](https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/) pour l’extraction par chant. Les chambres, les deux sas et les destinations sont originaux. [Témoin et étapes du niveau 3](../reference/level3-design.json).

## 4 · Le gardien de la vanne

Le gardien tient initialement la commande orange de la réserve. Il faut en sortir les deux caisses avant de le déplacer : son départ referme le chargement et ouvre la destination orange. Le Barde le dépose par **un chant vers le bas**, de **(12,5)** sur la trappe en **(12,6)**. Le Magicien maintient le bouton violet qui soutient cette case, puis le quitte ; le monstre tombe sur place lorsque la plateforme disparaît.

La difficulté suivante est un chantier. Le Barde recale l’appui initial dans la rangée du passage. Les caisses empruntent la même colonne de descente et, dans le témoin, complètent successivement le pont en **(11,11), (12,11), (13,11)**. Les héros doivent ensuite traverser sans que le chant retire un appui utile : la poussée d’un partenaire et deux échanges fournissent les relèves du parcours.

Les contrôles distinguent les contraintes. Chanter trop tôt ferme effectivement la réserve, mais cette erreur locale n’est pas annoncée irréversible. La plateforme levée de la trappe ne relie pas à elle seule les deux rives. Après la première immersion, une traversée droite rencontre encore une case d’eau nue. Enfin, un transfert net de héros entre les rives reste nécessaire : les échanges seuls en conservent les effectifs.

Le témoin de **135 entrées / 12 sélections** utilise les deux réserves et les transforme en deux appuis. Cette observation ne prouve pas que toute solution doive faire deux immersions ou utiliser exactement les mêmes relèves. Deux variantes de cette version ont également été rejouées sans refus ni perte :

- **135 entrées / 12 sélections : retirer la trappe avant le chant.** Le Magicien relâche d’abord sa commande. Le chant envoie ensuite le gardien dans l’eau nue et le chantier peut se poursuivre. Le séjour sur la plateforme illustre donc un mécanisme, sans constituer une étape obligatoire.
- **138 entrées / 15 sélections : traverser par chant.** Cinq pas du Barde font passer le duo sur le pont préparé, dont les appuis sont retenus par la rive et les héros. La poussée du Barde du témoin est une relève utile, pas l’unique traversée légale.

**Références adaptées :** [Water, 12 et 28](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) pour le retrait d’un soutien et le passage imposé du Barde ; [Heroes 3, 14](https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/) pour le transport des gardiens par chant. Le bassin, la réserve et leur coordination sont propres à SS19. [Témoin et étapes du niveau 4](../reference/level4-design.json).

## 5 · Le troisième doit rester vivant

Trois postes donnent des fonctions différentes aux monstres et aux caisses. Dans une chambre scellée, trois chants placent le captif sur le bouton orange **(5,8)** et sa caisse sur le bouton vert **(5,9)**. La butée supérieure retient le gardien pendant que la caisse termine son approche. Le Magicien extrait ensuite le Barde : un départ à pied risquerait de reprendre les deux poids.

Dans le couloir central, un autre chant rapproche la paire de monstres jusqu’au contact. Leur disparition vient de cette translation visible et de la règle de combat. Le captif reste séparé. Aucun quota d’élimination ne participe à la victoire.

Le Guerrier charge alors la caisse supérieure sur la presse violette en **(10,4)**. Une première impulsion l’envoie à l’ouest en **(9,4)** ; la presse rose la dépose au sud en **(9,5)**. Le même circuit rose ouvre le volet en **(9,6)** : le Magicien doit maintenir sa commande pendant la sortie de la charge. Sept pas chantés l’amènent au bouton cyan **(9,12)**, puis un second échange libère le Barde sans retirer le poids.

Les trois poids finaux ont des fonctions lisibles. Le gardien orange commande une destination, la caisse verte en commande une autre et la caisse cyan ouvre le but supérieur. La chambre scellée conserve son gardien et sa caisse sans accès de remplacement pour les héros. Dans la région ouverte, un monstre ne peut remplacer la caisse cyan : il tuerait le héros nécessaire sur la destination orange voisine **(9,13)**. La dernière livraison ne peut donc être supprimée en laissant simplement un monstre sur ce bouton.

L’ordre des presses produit aussi une conséquence matérielle : fermer d’abord la presse rose en **(9,4)**, puis envoyer la caisse contre elle avec la presse violette, écrase cette dernière réserve. Relâcher trop tôt la commande rose après une livraison correcte referme simplement le volet ; la caisse reste retenue et le transport peut reprendre après réouverture.

Le témoin réalise deux impulsions de presse et deux échanges. Cela démontre une combinaison de moyens de transport, sans transformer chaque emploi de pouvoir en obligation universelle. Les anciennes variantes de la carte précédente ne sont pas des solutions qualifiées de cette géométrie.

**Références adaptées :** [Heroes 3, 13–14](https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/) pour le contraste entre rencontre provoquée et gardien conservé ; [Light, 1](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/) pour les presses qui changent l’axe de livraison. La chambre à deux poids, le volet et les trois postes sont originaux. [Témoin et étapes du niveau 5](../reference/level5-design.json).

## 6 · La seconde image

Deux reflets couplent le départ du Guerrier et la livraison de deux caisses. La première cible, plus proche du miroir, part à l’eau et devient l’appui **(11,14)** ; elle cesse alors d’être une cible de reflet. La charge plus éloignée peut rejoindre au second passage le bouton **(8,14)**. Cette commande ferme le débarcadère derrière le Guerrier tout en ouvrant sa destination et le passage sud-est.

La préparation enseignée place la charge dans sa glissière avec le Barde, puis l’extrait par échange sans reprendre la caisse. Entre les deux reflets, le Guerrier quitte sa case d’arrivée. Répéter immédiatement le reflet le renvoie au départ ; la commande se ferme ensuite et un nouveau transfert se heurte au débarcadère fermé. Le refus n’est pas décrit comme une impasse définitive.

**Variante vérifiée : 95 entrées / 10 sélections.** La charge peut rester plus haute lors des deux premiers reflets, arriver en **(5,14)** puis être amenée au bouton par chant et deux échanges. La préparation préalable est donc un calendrier commode, pas une nécessité universelle. Les deux variantes emploient une caisse comme appui et l’autre comme poids sec.

Aucune preuve exhaustive n’exclut tous les réaménagements de miroirs obtenus en fabriquant d’autres appuis. Le guide ne déduit ni unicité ni optimalité de la réussite du témoin de 74 entrées. La carte et ses commandes sont conservées.

**Références adaptées :** [Mirrors, 19](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/) pour la livraison retardée par un premier obstacle ; [Water, 11](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) pour la conservation des occupants lors des échanges. SS19 utilise un appui permanent et n’importe aucun empilement. [Témoin et étapes du niveau 6](../reference/level6-design.json).

## 7 · Le relais condamné

Le Guerrier recale d’abord le petit miroir de **(3,14)** vers **(2,14)**. Le relais central lui permet ensuite de rejoindre le quai droit. Une caisse interposée sert d’écran pendant la poussée du monstre ; le témoin effectue deux poussées de file, noie le monstre et laisse la caisse sur le bouton du quai en **(16,12)**.

Le Barde descend l’autre charge dans sa glissière jusqu’en **(9,18)**. La commande ferme la presse sur le relais **(11,8)** et l’écrase contre sa butée. Il faut ensuite remonter la charge d’une case pour rouvrir cette presse vide. Le retrait de l’obstacle et l’ouverture du passage sont deux opérations distinctes, que le plateau montre séparément.

Le Magicien extrait le Barde. Un premier départ place celui-ci hors de l’axe, puis le dernier reflet envoie ensemble les deux autres héros vers leurs destinations. La contre-branche qui détruit le relais tout en laissant la presse fermée refuse ce dernier reflet en entier et déclenche le signal rouge attendu.

**Variante vérifiée : 50 entrées / 9 sélections.** Une seule poussée conserve le monstre sur **(16,12)** et la caisse écran sur **(15,12)**. Le monstre reste naturellement sur sa commande. Le recalage, la destruction du relais et la réouverture restent présents ; l’élimination n’est pas nécessaire. Le témoin de 52 entrées et la géométrie sont conservés.

**Références adaptées :** [Mirrors, 18](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/) pour le miroir utile devenu obstacle ; [Heroes 2, 10 et 14](https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/) pour la préparation d’une ligne face au monstre. La caisse SS19 sert d’écran et de poids, sans devenir un cristal offensif. [Témoin et étapes du niveau 7](../reference/level7-design.json).

## 8 · Les deux gardiens vivants

La finale combine deux dispositifs de livraison avec une réserve unique. Elle n’ajoute aucune règle de poursuite : chaque étape change un objet ou un circuit visible.

| Ressource | Transport du témoin | Fonction conservée à la fin |
| --- | --- | --- |
| Gardien occidental | Sept pas chantés le font suivre un rail, puis descendre derrière une cloison | Bouton violet **(6,6)** ; une porte distincte en **(6,7)** se ferme derrière lui et permet au Barde de se dégager |
| Gardien oriental | Un reflet le dépose sur la presse **(13,11)** ; la commande verte **(3,16)** le pousse au sud | Bouton orange **(13,12)**, hors du rayon optique |
| Caisse du nord-est | Visée coudée du Magicien, écart par chant puis transport par le Guerrier | Appui **(13,17)** donnant accès à l’île initialement vide |

Le gardien oriental est la première cible du miroir ; la caisse plus éloignée reste sur sa commande de réserve. Répéter le reflet sans dégager ce gardien le renvoie, au lieu de récupérer la caisse. Fermer la presse verte avant la livraison bloque également le reflet : une presse vide ne fait pas venir son futur occupant. Après la livraison, il faut relâcher la commande pour rouvrir le trajet optique.

Dans le témoin, le Magicien échange sa place avec la caisse par le miroir et maintient ainsi la commande de réserve. Le Barde écarte la caisse du rayon de retour. Le reflet ramène le Magicien ; la commande désormais vide referme le sas et sa presse le dépose au sud. Le Guerrier peut alors descendre la caisse dans l’atelier, changer son axe sur le quai et construire l’entrée de l’île. Les gardiens restent sur leurs boutons pendant les trois arrivées.

### Pourquoi les trois ressources sont nécessaires

L’île finale, composée des neuf cases **x = 14 à 16, y = 16 à 18**, est vide au départ. Toute sa frontière est murée, sauf l’eau en **(13,17)**. Elle est hors des deux axes du miroir en **(17,11)**. Un échange ne crée pas un premier occupant sur une île vide ; un transport dans l’eau nue ne livre pas un héros vivant. Il faut donc fabriquer l’appui d’entrée avec la caisse unique.

Le miroir ne fournit pas un poids de remplacement. Pour chacune de ses quatre directions de poussée, la case nécessaire au pousseur ou celle d’arrivée du miroir est murée. Le chant, l’échange et le reflet ne déplacent pas les miroirs. Fabriquer un autre appui ne retire aucun de ces murs.

À la victoire, les trois héros occupent les trois destinations, toutes distinctes des boutons des gardiens. La caisse est devenue un appui, qui ne pèse pas ; le miroir demeure immobilisé. **Les deux monstres vivants sont donc les deux seuls poids disponibles pour maintenir les deux presses de destination ouvertes.** Cette nécessité repose sur la frontière de l’île et le décompte des pièces, pas sur l’échec d’une recherche limitée.

La contre-branche qui immerge la caisse trop tôt en **(12,11)** crée bien un appui, mais dans une composante d’eau isolée par les deux sols voisins et deux murs. Le Barde ne peut pas le faire glisser jusqu’en **(13,17)**. Sans annulation ou recommencement, cette dépense retire la ressource du dernier passage.

### Deux variantes légitimes

**75 entrées / 9 sélections : réserve par reflet.** Après la livraison des gardiens, un second reflet transporte directement la caisse. La presse du sas la dépose au sud et le Barde l’écarte avant le chantier. Aucun échange du Magicien n’est nécessaire dans cette solution ; les deux gardiens, les presses utilisées pour cette route et l’appui final restent effectifs.

**93 entrées / 15 sélections : livraison orientale par chant.** Après le reflet initial, le Barde atteint **(11,9)**, chante vers le bas pour déposer le gardien en **(13,12)**, puis vers la gauche pour se dégager. Cette route remplace la presse verte de livraison tout en conservant les deux gardiens et la caisse. Le témoin de 97 entrées montre la coopération de la visée coudée et des presses ; leur emploi complet n’est pas une condition universelle.

**Références adaptées :** [Heroes 2, 15, 22 et 29](https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/) pour les monstres conservés comme poids ; [Water, 11](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) pour le transfert vers une île vide. La galerie de chant, le sas réutilisé et la preuve des ressources appartiennent à cette géométrie SS19. [Témoin et étapes du niveau 8](../reference/level8-design.json).

## Portée des vérifications et parcours complets

Les fichiers de conception liés dans chaque section contiennent la carte, les commandes complètes, les métriques et les états intermédiaires. Les longues chaînes de commandes ne sont pas recopiées ici afin de conserver une seule référence rejouable.

La [revue indépendante 0.2.1](../reference/independent-review-ss19.json) inspecte les huit témoins, les causes de transport et les contraintes géométriques : **37 contrôles réussis**. La [revue des niveaux 6 à 8](../reference/final-ss19-review.json), **21 contrôles réussis**, conserve notamment les variantes **95/10**, **50/9**, **75/9** et **93/15**, ainsi que les refus locaux qui expliquent les obstacles. La [revue du niveau 1](../reference/level1-review.json) contient **10 contrôles** et la [revue des niveaux 3 à 5](../reference/ss19-middle-review.json), **20 contrôles réussis**, contient les deux variantes actuelles du niveau 4. Ces rapports portent sur les cartes de la version 0.2.1. La [validation du laboratoire](validation.md) consigne l’état de la qualification générale.

Un témoin gagnant établit la résolubilité. Une contre-branche établit l’effet exact de cette tentative. Une nécessité générale demande en plus un invariant de ressources, une frontière géométrique ou un examen exhaustif du cas annoncé. La campagne conserve les solutions alternatives qui satisfont ses règles visibles ; elle ne les remplace pas par des conditions cachées destinées à imposer le parcours d’auteur.
