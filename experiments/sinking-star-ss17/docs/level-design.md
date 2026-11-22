# SS17 — conception des huit salles

Les cartes sont originales. Leurs contraintes adaptent des énigmes numérotées des guides demandés ; les différences de règles sont détaillées dans `source-audit.md` et `specification.md`. Les étapes ci-dessous décrivent les parcours de référence, sans imposer une solution unique.

## Progression et parcours

| Salle | Entrées, sélections comprises | Coups affichés, hors sélections | Échanges | Reflets | Déplacements de miroir |
|---|---:|---:|---:|---:|---:|
| 1 — Les trois cours de la forteresse | 120 | 100 | 2 | 5 | 1 |
| 2 — Les cellules de relève | 115 | 98 | 4 | 0 | 0 |
| 3 — Le compte des îles | 129 | 115 | 3 | 0 | 0 |
| 4 — Le miroir, puis le lest | 76 | 65 | 1 | 0 | 13 |
| 5 — La relève à angle droit | 241 | 225 | 1 | 0 | 2 |
| 6 — Les deux emplois des miroirs | 170 | 154 | 1 | 3 | 6 |
| 7 — Les trois vies de la clef | 410 | 379 | 2 | 0 | 1 |
| 8 — La forteresse aux deux visées | 205 | 178 | 4 | 3 | 16 |

La longueur des témoins n’est ni une difficulté mesurée ni un minimum. Le niveau 7 demande davantage de manutention et de changements de fonction ; le niveau 8 concentre les réglages de visée, le choix de la première cible et l’ordre de libération des accès.

## Variantes et corrections connues

- **Niveau 1 :** une solution de 130 entrées utilise les monstres comme cibles et contrepoids, sans construire le pont. Elle complète le témoin pédagogique de 120 entrées et ne donne pas accès aux sorties par simple marche.
- **Niveau 5 :** la variante de 215 entrées extrait les charges par poussée en chaîne ; celle de 257 entrées les transporte par reflets sans appui. Les deux conservent une préparation élaborée des ressources.
- **Niveau 6 :** l’ancienne variante de 170 entrées qui gardait les plateformes activées est bloquée par le verrou supérieur ajouté. Une variante de 214 entrées, avec trois échanges successifs du gardien puis des échanges de partenaire et de caisse, reste valide. Les miroirs ne sont donc pas une nécessité universelle démontrée.
- **Niveau 7 :** une solution de 366 entrées réaffecte directement la clef à un lest et conserve les trois appuis, la presse et le combat. Les trois usages successifs de la clef décrivent le témoin principal.
- **Niveau 8 :** l’ancienne route de 156 entrées qui ignorait l’alcôve de la clef est rejetée par le dernier sas cyan. Sa plaque doit être libérée : déplacer la clef puis laisser un héros à sa place ne suffit pas. Les autres méthodes de libération restent autorisées.

Ces variantes et les cartes historiques sont conservées dans `reference/`. Les revues sont exécutées par `npm run validate:design`. Aucune coche pédagogique, aucun nombre de sorts et aucun compteur caché ne conditionne la victoire.

## 1. Les trois cours de la forteresse

Organiser les trois cours, régler le miroir et relever les boutons pour réunir le trio dans la chambre des destinations.

Référence : [Adaptation pédagogique · Heroes and Water 10–11, Hauling 13 et Heroes and Mirrors 30–31](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-11).

Complément : [Heroes and Mirrors · énigmes 30–31 · visée et déplacement du miroir](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-30).

### Contraintes adaptées

- Un échange conserve le nombre d’occupants de chaque île ; la construction du pont permet un vrai transfert supplémentaire.
- La première cible alignée détermine l’échange du Magicien, y compris lorsque la face blanche dévie sa visée.
- Un échange entre deux cases occupées conserve les poids des plaques ; quitter ensuite une plaque exige une relève.
- Déplacer physiquement le miroir change les cases reliées par sa diagonale.

### Construction SS17

- Carte originale de trois cours, avec un trio Guerrier/Voleur/Magicien et trois destinations simultanées.
- Le Guerrier et le Voleur déplacent le miroir SS17 ; il ne peut pas être une cible de transposition.
- La double tranchée consomme deux caisses. La traction unique, la traction d’un partenaire et le départ latéral sont montrés avant la visée coudée.
- La même paire de boutons commande une presse latérale contre les deux gardiens et la porte de la chambre finale.
- Le reflet global et la visée du Magicien restent deux actions distinctes, sans duplication de héros ni pouvoirs déclenchés par un déplacement forcé.

### Parcours explicatif

1. Le Guerrier pousse la file : deux caisses deviennent deux appuis permanents.
2. Le Guerrier traverse les appuis et libère le passage vers la deuxième cour.
3. Le Voleur extrait seulement la caisse voisine ; la réserve reste contre le mur. Un départ latéral lâche la charge.
4. La caisse remplace un héros sur la plaque occidentale : la presse rapproche les deux gardiens, qui s’éliminent.
5. Le Voleur utilise le pont déjà construit pour rejoindre le relais optique.
6. Le Voleur tire son compagnon d’une case et le laisse en position de relais, sans provoquer sa poussée.
7. Le Magicien échange avec le Guerrier ; chacun conserve son identité et son pouvoir.
8. Sans cible sur son axe, une flèche du Magicien produit un simple pas.
9. Le Guerrier descend le miroir pour aligner sa face avec la caisse de la troisième cour.
10. La visée du Magicien tourne sur la face blanche : il prend la place de la caisse sur la plaque distante. Les deux poids restent présents.
11. Le reflet global livre la caisse à la troisième cour, à distance égale sur l’autre bras du miroir.
12. À distances égales, le Guerrier et la caisse s’échangent. Le Guerrier dégage ensuite la ligne.
13. Le reflet ramène le matériel dans la cour après le passage du Guerrier.
14. Le Voleur traverse à son tour puis se place du bon côté pour reprendre la caisse.
15. Le Magicien quitte la plaque : la porte se referme. Il faut une relève permanente avant les trois sorties.
16. La caisse revient devant le Voleur. Le reflet ne confère aucun pouvoir aux pièces transportées.
17. Deux tractions ramènent la caisse sur la plaque distante ; le Voleur part de côté et laisse les deux boutons maintenus.
18. Les trois héros atteignent ensemble les destinations derrière la porte, après deux investissements dans le pont et deux relèves de plaques.

Parcours de référence : **120 entrées**, dont **20 sélections** ; **100 coups** au compteur de l’interface. Zéro refus et zéro mort. Ce parcours est un témoin de solvabilité, pas un minimum.

## 2. Les cellules de relève

Libérer deux captifs par substitution et préserver les poids qui commandent la sortie.

Référence : [Adaptation · Heroes of Hauling · énigmes 13 et 19](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-19).

Complément : [Énigme 13 · relève sur une plaque par échange](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-13).

### Contraintes adaptées

- Les héros enfermés sont remplacés par des blocs, puis réunis dans la zone commune.
- Un échange peut transférer le rôle de poids sans abandonner la cellule de commande.

### Construction SS17

- Carte originale de deux cellules séparées par de l’eau, trois héros W/T/Z et trois sorties.
- Une fermeture latérale dépose une charge dans un logement sans accès de poussée au nord.
- Un quatrième bloc doit être extrait d’un renfoncement puis conservé comme poids final.

### Parcours explicatif

1. Le Guerrier quitte sa cellule ; le Magicien libère la plaque en restant captif.
2. La charge attend sur la presse ouverte, sans accès de poussée au nord.
3. Le Magicien referme la presse puis le bloc le relève dans la cellule.
4. Le Voleur libéré doit encore être remplacé par un poids dans sa cellule.
5. Le Voleur extrait la clé du renfoncement et la conserve comme troisième poids.
6. Les trois cellules de commande restent lestées pendant la sortie du trio.

Parcours de référence : **115 entrées**, dont **17 sélections** ; **98 coups** au compteur de l’interface. Zéro refus et zéro mort. Ce parcours est un témoin de solvabilité, pas un minimum.

## 3. Le compte des îles

Distinguer l’échange d’occupants d’un véritable transfert entre îles, et préserver une ligne de récupération.

Référence : [Adaptation · Heroes and Water · énigmes 10 et 11](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-11).

Complément : [Énigme 10 · garder libre l’axe du retour](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-10).

### Contraintes adaptées

- Les échanges conservent le nombre d’occupants de chaque rive ; les appuis permettent ensuite un vrai passage.
- Une charge trop proche masque la cible utile sur l’axe de retour.
- Un bloc doit rester récupérable au lieu d’être consommé pour le pont.

### Construction SS17

- Carte originale à deux rives et pont de deux cases, plutôt que cinq îles.
- Le Voleur extrait la réserve occidentale, et le Guerrier construit depuis les deux côtés.
- Le troisième bloc devient un poids distant maintenant une porte-poussoir ; aucun Clerc, dragon ou flottement.

### Parcours explicatif

1. L’échange envoie le Guerrier à l’est, sans ajouter un occupant à cette rive.
2. Le Guerrier immerge la charge orientale : seule la moitié est du pont est permanente.
3. La clé écartée de la visée permet l’échange de retour avec le Guerrier.
4. Le Voleur sort la charge occidentale de son renfoncement.
5. Le second appui réunit les rives ; un passage à pied peut enfin changer leur occupation.
6. Le dernier bloc reste mobile jusqu’à sa relève sur le bouton occidental.
7. Le pont porte le trio ; la rive ouest conserve uniquement la clé de sortie.

Parcours de référence : **129 entrées**, dont **14 sélections** ; **115 coups** au compteur de l’interface. Zéro refus et zéro mort. Ce parcours est un témoin de solvabilité, pas un minimum.

## 4. Le miroir, puis le lest

Placer physiquement le miroir pour une visée coudée, puis réutiliser cet outil comme poids.

Référence : [Adaptation · Heroes and Mirrors · énigmes 30 et 31](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-30).

Complément : [Énigme 31 · repositionner le miroir avant la sortie](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-31).

### Contraintes adaptées

- La ligne de vue du Magicien peut tourner autour d’un angle pour échanger un bloc.
- Le miroir doit atteindre une position précise avant que la visée utile existe.

### Construction SS17

- Carte originale : île de commande du Magicien, pont hydraulique, renfoncement à miroir et double verrou.
- Le Voleur extrait et transporte le miroir ; le Guerrier le pousse sur la voie, puis le même miroir devient un poids final.
- Le miroir spécial échangeable de la source 31 est remplacé par un miroir ordinaire déplacé physiquement. Aucun miroir n’est cible de magie, ni dupliqué.
- Un échange conserve la charge du bouton distant ; les sorties dépendent de deux circuits distincts.

### Parcours explicatif

1. Le Voleur extrait le miroir, l’aligne puis quitte le faisceau nord.
2. La visée coudée remplace le Magicien par le bloc sans relâcher le pont.
3. Le miroir quitte sa fonction optique et rejoint la voie du pont.
4. Le Voleur transporte le même miroir jusqu’au second verrou.
5. Le bloc reste sur l’île du Magicien, et le miroir maintient le verrou intérieur.

Parcours de référence : **76 entrées**, dont **11 sélections** ; **65 coups** au compteur de l’interface. Zéro refus et zéro mort. Ce parcours est un témoin de solvabilité, pas un minimum.

## 5. La relève à angle droit

Remplacer un gardien sur son bouton sans rompre le soutien, préparer sa cellule de réception, convertir une réserve en pont et réemployer le miroir et la clef comme lests finaux.

Référence : [Adaptation de Heroes and Water · Métamonde 4 et énigme 12](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/).

### Contraintes adaptées

- La relève par échange maintient le poids sur une commande éloignée.
- Le retrait d’un soutien hydraulique convertit les blocs restés dessus en appuis de traversée.
- Un échange seul conserve le nombre d’occupants de chaque rive ; un transfert supplémentaire est nécessaire. Le témoin utilise un pont, une variante utilise des reflets.

### Construction SS17

- Le dragon est remplacé par un monstre vulnérable à une presse latérale qui le pousse dans l’eau.
- Le rayon du Magicien est dévié par un miroir mobile, récupéré ensuite en lest.
- Une clef extraite ouvre la réserve de deux charges puis devient le lest de la rive opposée.
- La sortie exige simultanément deux poids et le retrait des plateformes ; coordonnées et topologie entièrement nouvelles.

### Parcours explicatif

1. Le rayon remonte jusqu’à la face blanche du miroir, tourne à droite et échange le Magicien avec le gardien. La commande cyan reste occupée, mais le monstre attend maintenant dans la presse.
2. Le Voleur quitte la commande orange : la presse latérale expulse le gardien dans l’eau. La case de destination du rayon avait été préparée avant la relève.
3. Le Voleur extrait la clef du mur nord et la dépose sur la commande verte. La réserve s’ouvre sans immobiliser un héros.
4. Les deux charges de pont sont sorties de leurs alcôves : elles doivent encore franchir le même sas et changer d’axe.
5. Le Guerrier réunit les charges, fait passer la première par le sas, change deux fois son axe et la pose sur la plateforme éloignée.
6. La seconde charge emprunte le sas puis rejoint la plateforme proche. Aucun héros ne doit rester sur les deux cases au retrait.
7. Le Magicien libère l’ancienne commande du gardien : les deux caisses deviennent des appuis fixes et le premier verrou final s’ouvre.
8. Le miroir est tiré sur le premier bouton violet, puis la clef verte est extraite : la réserve vide se referme. Le miroir a changé de fonction.
9. La clef de réserve devient le second lest, sur l’autre rive. Les deux commandes violettes sont occupées et l’écluse doit rester libérée.
10. Les trois héros rejoignent les destinations après avoir changé un monstre en cible, deux caisses en pont, un miroir et une clef en lests.

Parcours de référence : **241 entrées**, dont **16 sélections** ; **225 coups** au compteur de l’interface. Zéro refus et zéro mort. Ce parcours est un témoin de solvabilité, pas un minimum.

## 6. Les deux emplois des miroirs

Exploiter une visée à deux miroirs puis trois distances de réflexion, retirer les plateformes et transformer les miroirs ainsi que la clef en trois lests.

Référence : [Adaptation de Heroes and Mirrors · énigme 32](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-32).

### Contraintes adaptées

- Un miroir déplacé ou garé trop tôt condamne une visée ou un accès encore utile.
- Le dernier rôle du miroir dépend de l’achèvement des transports précédents.

### Construction SS17

- Deux miroirs relaient une magie d’échange puis trois réflexions géométriques établissent un pont à trois cases.
- La clef hydraulique déclenche aussi une expulsion latérale du gardien.
- Les deux miroirs et la clef deviennent les trois poids d’une même commande ET.
- Un verrou de retenue devant la destination haute exige de libérer la commande hydraulique : garder les plateformes actives et remplacer les miroirs par des caisses ne suffit plus à terminer.
- Les miroirs ne sont ni échangeables par le Magicien ni duplicables : le Guerrier et le Voleur assurent leur repositionnement.
- Carte et coordonnées originales, sans reproduction du plan commercial.

### Parcours explicatif

1. Un seul rayon traverse les deux miroirs : le Magicien rejoint la cour inférieure et la charge lointaine arrive sur le bras du premier miroir. Un échange transporte une ressource sans créer un passage collectif.
2. La première réflexion place la charge sur le soutien le plus éloigné. Le Magicien a quitté le second bras pour éviter une projection simultanée.
3. La deuxième charge est extraite puis réglée à quatre cases du miroir : la réflexion l’envoie sur la plateforme centrale.
4. Le Voleur règle la troisième charge à trois cases du miroir. Les trois plateformes portent désormais des pierres mobiles, pas encore un pont permanent.
5. Le Voleur retire la clef hydraulique : trois appuis deviennent fixes et la même libération expulse le gardien latéralement dans l’eau.
6. Le Guerrier traverse le pont et déplace le miroir de relais de quatre cases. Il devient le premier lest éloigné ; la visée à deux coudes n’existe plus.
7. La clef retirée change plusieurs fois d’axe, traverse les trois appuis et devient le deuxième lest éloigné. Le témoin réserve cette charge au troisième lest, après les transports optiques.
8. Le premier miroir est tiré sur son bouton violet. Les deux miroirs qui ont transporté les charges deviennent des poids immobiles, avec l’ancienne clef comme troisième poids.
9. Le Magicien et le Guerrier franchissent le sas sous trois poids. Dernier à sortir, le Voleur tire la clef derrière lui : la presse libérée le projette sur la destination centrale, sans traction supplémentaire.

Parcours de référence : **170 entrées**, dont **16 sélections** ; **154 coups** au compteur de l’interface. Zéro refus et zéro mort. Ce parcours est un témoin de solvabilité, pas un minimum.

## 7. Les trois vies de la clef

Libérer le bon rôle sans quitter le bouton, livrer trois charges, préparer une presse de combat, échanger la clef contre le gardien du soutien puis récupérer cette clef en lest.

Référence : [Adaptation de Heroes of Hauling · énigme 20 ; Heroes and Water · Métamonde 4](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-20).

Complément : [Heroes and Water · Métamonde 4 et énigme 11](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/).

### Contraintes adaptées

- Un prisonnier est remplacé sur sa commande avant de pouvoir travailler ailleurs.
- Les charges libérées dans les alcôves deviennent des ressources pour une autre zone.
- La substitution sur un bouton maintient les dispositifs pendant le changement de rôle.

### Construction SS17

- Le prisonnier initial est le Voleur ; deux échanges coudés utilisent le même miroir avant son rangement.
- Une seule clef remplit successivement trois fonctions : retenue d’une presse, relève du bouton cyan, puis lest violet distant.
- Trois charges superposées sont extraites une par une, transportées par un sas et converties en appuis permanents.
- La charge de combat est récupérée après élimination simultanée de deux monstres et rapatriée comme lest.
- Les règles d’appuis fixes persistants et de presses latérales appartiennent à SS17 ; carte entièrement nouvelle.

### Parcours explicatif

1. Le Magicien échange sa place avec le Voleur captif par un rayon coudé. La commande cyan reste occupée : la réserve et les soutiens restent disponibles pendant que les rôles changent de rive.
2. Charge 1/3 : extraction individuelle dans la colonne, transport par le sas, changement d’axe au sud et dépôt sur la plateforme 3. La clef orange doit encore rester en place.
3. Charge 2/3 : extraction individuelle dans la colonne, transport par le sas, changement d’axe au sud et dépôt sur la plateforme 2. La clef orange doit encore rester en place.
4. Charge 3/3 : extraction individuelle dans la colonne, transport par le sas, changement d’axe au sud et dépôt sur la plateforme 1. La clef orange doit encore rester en place.
5. Pour changer de rive alors que les trois charges bouchent les plateformes, le Guerrier pousse la file entière jusque dans la cour, en fait le tour, puis la repousse exactement sur les trois soutiens.
6. Le Guerrier charge la presse depuis le sud. Le gardien voisin empêche un chargement depuis sa propre ligne ; les deux monstres sont encore séparés.
7. La clef orange est retirée : la presse décale la charge et le premier gardien. Les deux monstres devenus voisins s’éliminent dans la même vague. Le Voleur extrait ensuite la clef par le sas.
8. Le Voleur tire la clef vers l’est, contourne sa charge et change l’axe de traction pour l’installer sous le miroir. Il quitte le rayon pour ne pas masquer la première cible.
9. Deuxième usage du même miroir : le Magicien revient dans l’atelier en échangeant sa place avec la clef. La clef prend le relais sur le bouton cyan et garde le pont provisoire actif.
10. Le Voleur parque le miroir sur le bouton violet puis sort de la réserve. La liaison magique a fini ses deux missions ; la clef distante retient toujours le sas et les plateformes.
11. Le Guerrier libère la commande cyan et descend la clef sur le troisième bouton violet. Les trois charges deviennent des appuis fixes et la réserve vide se ferme.
12. La charge qui a servi à déplacer les gardiens est récupérée, changée d’axe et ramenée sur le pont permanent. Elle devient le lest violet de la rive de départ.
13. Les trois destinations exigent de libérer la prison après avoir substitué les ressources : miroir-lest, charge de combat-lest et clef de relais-lest.

Parcours de référence : **410 entrées**, dont **31 sélections** ; **379 coups** au compteur de l’interface. Zéro refus et zéro mort. Ce parcours est un témoin de solvabilité, pas un minimum.

## 8. La forteresse aux deux visées

Préparer une réception de monstre, régler les distances de trois projections, échanger les rôles, reconstruire une visée à deux miroirs et libérer la clef isolée avant de ranger les miroirs sur leurs poids finaux.

Référence : [Adaptation de Heroes and Mirrors · énigmes 31–32 ; Heroes of Hauling · énigme 19](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-31).

Complément : [Heroes of Hauling · énigme 19 · libérer un captif par substitution](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-19).

### Contraintes adaptées

- Le déplacement du miroir modifie les accès et les diagonales disponibles.
- Il faut terminer la dernière opération optique avant de garer les miroirs.
- Un prisonnier échangé exige un accès de secours ou une ressource de remplacement.
- Les échanges seuls ne constituent pas un passage collectif.

### Construction SS17

- Deux stations successives coordonnent deux miroirs mobiles ; le deuxième rayon suit une autre colonne d’eau.
- Une réflexion globale transporte simultanément un héros et la troisième charge, sans réactiver la capacité du héros déplacé.
- Le gardien est échangé vers une presse latérale puis noyé.
- La clef est isolée sur une petite île : le quatrième bloc est réservé à son appui de secours.
- Les deux miroirs et la clef deviennent les trois poids de deux sas. Un troisième sas reste fermé tant que la prison cyan est occupée : il faut aussi faire ressortir le héros qui remplace la clef.
- Cette commande de prison empêche de terminer en ignorant la clef isolée ; elle n’impose pas une solution unique. Coordonnées et disposition originales.

### Parcours explicatif

1. Le Voleur descend le miroir enfermé contre le mur et le place à la première station. La visée à deux miroirs du témoin n’est pas encore alignée.
2. Le Magicien échange sa place avec le gardien à travers les deux miroirs. Le monstre arrive dans la cellule de réception ; le Magicien quitte le bras inférieur avant la prochaine réflexion globale.
3. Le Guerrier libère la commande orange. La presse expulse le gardien vers l’ouest, dans la seule case d’eau de l’atelier.
4. La première charge, extraite au nord, est réfléchie à quatre cases : elle devient l’appui du milieu. Les deux miroirs sont concernés par la même action globale.
5. La seconde charge est réglée à trois cases du premier miroir : elle devient l’appui proche. Les appuis immergés ne sont plus des cibles optiques.
6. Le Magicien reprend la visée inverse pour échanger les rôles : le Guerrier rejoint la salle inférieure et le Magicien prend sa place sur le bras du premier miroir.
7. Le Guerrier règle la charge du sud à trois cases du second miroir. Une seule réflexion globale achève le pont au sud et transporte simultanément le Magicien sur le premier appui.
8. Le Voleur décale le miroir supérieur de deux cases. La première liaison est rompue : le nouveau rayon doit emprunter l’autre colonne d’eau.
9. Le Guerrier déplace le miroir inférieur vers l’est puis vers le sud, et sort de son bras nord. Les deux miroirs sont maintenant accordés sur une seconde visée.
10. La dernière charge libre est changée d’axe puis sacrifiée dans l’eau au nord de l’alcôve. Cet appui de secours doit exister avant de téléporter un héros dans la prison de la clef.
11. Le Magicien suit la nouvelle visée à deux coudes et échange sa place avec la clef isolée. Il ressort par l’appui préparé, sans renvoyer la clef dans sa prison.
12. Le Voleur extrait la clef de la ligne de visée et la pose sur sa commande verte. La clef ouvre le second sas sans retenir un héros.
13. Le miroir inférieur est poussé une seconde fois : après deux stations de visée et une projection de charge, il devient le lest violet de la cour.
14. Le miroir supérieur est récupéré vers l’ouest et garé sur le second bouton violet. La commande ET n’ouvre le premier sas qu’une fois les deux instruments devenus des poids.
15. Le trio franchit les trois sas : les deux miroirs sont lestés, la clef verte est posée et son ancienne prison est vide. Les trois charges de pont, l’appui de la prison, les deux miroirs et la clef ont chacun trouvé leur dernier usage.

Parcours de référence : **205 entrées**, dont **27 sélections** ; **178 coups** au compteur de l’interface. Zéro refus et zéro mort. Ce parcours est un témoin de solvabilité, pas un minimum.
