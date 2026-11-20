# SIC Fallback · Imaginer un accès, puis le vérifier

**SS01 L2 reste invaincu après 1 200 actions. Le candidat avait pourtant imaginé une arrivée réalisable. Il l’a classée cinquième et sa prédiction sur l’action suivante était fausse.** Sur VOIS, deux dispositions choisies par SIC ont déplacé le lieu d’arrivée comme annoncé. Un test indépendant sur ce jeu montre comment composer deux commandes pour régler séparément la position de deux pièces.

## Ce que le candidat a choisi sur SS01

À la décision 325, les cinq options ci-dessous étaient présentes dans la proposition avant exécution. Le rang couvre la valeur de la destination, la continuation espérée, le coût de préparation et les échecs déjà observés. Les lignes suivent le même préfixe de 324 actions.

| Rang | Score | Préparation puis déclenchement | Arrivée prévue | Rejeu indépendant |
| --- | ---: | --- | --- | --- |
| 1 | 126 | A1 puis A5 | (30, 11) | Placement réfuté, identité du voyageur perdue |
| 2 | 108 | A3, A3 puis A5 | (26, 11) | Placement réfuté, arrivée mesurée en (29, 11) |
| 3 | 103 | A4, A4 puis A5 | (30, 20) | Placement réfuté, identité du voyageur perdue |
| 4 | 99 | A1, A1 puis A5 | (30, 8) | Placement réfuté, identité du voyageur perdue |
| **5** | **98** | **A3 puis A5** | **(29, 11)** | **Placement et arrivée vérifiés. La continuation A3 vers (29, 8) échoue.** |

A1 à A5 désignent les commandes publiques ACTION1 à ACTION5. Leurs effets sont appris dans la partie. Dans le cinquième cas, déclencher immédiatement aboutit en (32, 11). Après A3, le voyageur est en (26, 14), le repère en (30, 11) et A5 aboutit en (29, 11). Les deux pièces ont bougé pendant la préparation. Cet exemple ne suffit donc pas à isoler l’effet du seul repère. Aucun franchissement entre îlots n’est établi.

Dans la comparaison préenregistrée des douze premières décisions à plusieurs options, les douze premiers choix et les 21 alternatives ont tous manqué l’arrivée annoncée. L’audit exploratoire étendu couvre les 137 options effectivement enregistrées dans 44 décisions, y compris les décisions à option unique. Parmi elles, 33 atteignent le placement prévu et une seule atteint ensuite la destination annoncée. Les 137 incluent des propositions répétées. Une seule unité de mesure, la décision 325, est à l’origine du résultat positif.

## Pourquoi doubler le budget n’a rien débloqué

| Entrée directe SS01 L2 | Actions SIC | Images publiques distinctes | Retours à une image connue après changement | Victoire |
| --- | ---: | ---: | ---: | --- |
| Témoin de préparation | 600 | 127 | 420 | Non |
| Candidat spatial | 600 | 97 | 436 | Non |
| Même candidat, seconde session | 1 200 | 97 | 1 036 | Non |

Le moteur, l’image de départ et les paramètres de raisonnement sont identiques. Les 600 premières commandes **et** leurs empreintes avant/après coïncident entre les deux sessions du candidat. La dernière image nouvelle apparaît à l’action 428. De l’action 525 à l’action 1 200, deux commandes alternent entre les deux mêmes images pendant **676 actions**. Dès l’action 526, SIC choisit alternativement de rejoindre deux origines distinctes pour tester la même paire de commandes. Chaque choix annule le déplacement précédent. Cette boucle explique exactement où le budget supplémentaire est passé.

Sur les 600 premières actions, SIC a mené 16 déclenchements spatiaux jusqu’au bout. Dans 14 cas, la composante suivie est restée sur place. Dans les deux autres, elle s’est déplacée ailleurs que prévu. Les neuf essais de placement guidés par la position d’un repère ont échoué, dont huit avec perte de l’identité visuelle unique du voyageur dès le pas testé. Une composante peut changer d’aspect ou devenir ambiguë quand des éléments se superposent. Le journal ne permet pas d’identifier la cause physique de chaque perte.

L’audit géométrique a suivi les 36 translations de composantes identifiables sur tout le parcours. Il a comparé deux segmentations indépendantes de la géométrie publique, calculées sur les deux moitiés temporelles. Aucune translation n’a relié deux îlots distincts dans les deux projections. La segmentation varie avec l’image modale de la période, ce qui limite la portée de ce test. La mesure officielle de victoire, elle, est sans ambiguïté.

## La découverte sur les sources

Sur VOIS, l’agent a observé que l’arrivée du voyageur peut être décrite dans le repère d’une autre pièce. Cette relation est inversible pour le placement. À destination désirée fixée, SIC peut calculer où placer le repère, imaginer plusieurs suites de commandes et annoncer son arrivée avant d’agir.

| Décision autonome sur VOIS | Préparation | Déclenchement immédiat depuis la même origine | Arrivée prédite après préparation | Arrivée mesurée |
| --- | --- | --- | --- | --- |
| 17 | A3 puis A3 | (42, 22) | (34, 22) | (34, 22) |
| 85 | A3 puis A3 | (34, 26) | (26, 26) | (26, 26) |

Dans ces deux interventions, le voyageur est resté en place pendant que le repère bougeait. À partir des traces sources initiales, l’audit indépendant a essayé toutes les préparations admissibles d’une ou deux commandes pour les relations candidates. Il a vérifié **24 arrivées distinctes sur 24** pour VOIS, avec un déclenchement témoin depuis chaque même préfixe. Deux composantes co-mobiles décrivent les mêmes 24 interventions. Les autres relations candidates ne fournissaient pas de test admissible sous ces contraintes. [Carte des arrivées vérifiées](sic-spatial-access-vois.png)

**Un échange réversible peut servir de commande distante.** Si T échange les positions de deux pièces et U déplace l’une d’elles, la suite T–U–T peut déplacer l’autre pièce tout en remettant la première à son point de départ. Cette prédiction se teste contre U seul et contre T–T–U, avec le même nombre d’actions que la suite expérimentale. Dans VOIS, la commande « droite » déplace par exemple la pièce de gauche de quatre pixels. Encadrée par les deux échanges, la même commande déplace la pièce de droite de quatre pixels.

Une vérification complémentaire hors agent a pris les quatre déplacements locaux observés et les quatre déplacements obtenus par échange. Depuis un seul départ réel, **les 16 configurations prédites sur 16** ont été obtenues dans les deux ordres de préparation. Un dernier échange a également produit les deux arrivées prévues dans les 16 cas. L’expérience établit deux degrés de liberté indépendants dans ce mécanisme. Ce test algébrique a été effectué après le gel. Le candidat joué sur Custom 4 disposait de la recherche conjointe de placements et de l’inversion d’une relation spatiale. Le banc d’essai a exécuté la vérification des 16 produits.

Huit jeux sur les 100 présentaient dans la trace des translations opposées compatibles avec un échange de positions dans le premier filtre géométrique. Dans sept, le test supplémentaire n’a pas trouvé de paire restaurée avec des commandes admissibles pour l’intervention. Sur SS01, 16 comparaisons de transfert de commande ont été tentées à partir d’échanges apparents. Quinze ont perdu une identité visuelle et une a laissé les deux pièces sur place. Un échange apparent dans l’image est donc une raison d’expérimenter, et sa seule observation ne suffit pas à attribuer au mécanisme les propriétés observées sur VOIS. [Interventions, produits et classements détaillés](sic-spatial-access-results.json)

## Portée du résultat

- Les 100 traces de conception totalisent 2 904 actions, vérifiées par rejeu. Le banc source du candidat totalise 2 927 actions à un plafond de 60 par niveau. Le témoin et le candidat gagnent **les mêmes 66 niveaux sur 100**. Dix trajectoires ont changé.
- À 90 actions sur les trois sources examinées en détail, VOIS donne deux arrivées vérifiées en jeu. KEYD donne zéro sur six déclenchements, SWCH zéro sur cinq. La comparaison des douze premiers choix de VOIS donne une arrivée vérifiée au premier rang et onze parmi les 48 alternatives rejouées. Dans trois décisions, une alternative réussissait alors que le premier choix échouait. Le classement de l’intérêt reste le point faible, même dans la source positive.
- Les 37 tests ciblés et la vérification TypeScript passent. Le témoin et le candidat ont été publiés avant le premier essai Custom 4 de ce chantier. SS01 était déjà connu des essais antérieurs. SS09 L2 reste en réserve. [Protocole figé](sic-spatial-access-protocol.md)
- Branche expérimentale `codex/sic-spatial-access-source100`, candidat gelé `3253d5b1`, témoin `2c823c51`, moteur `f4d28aee`. Les ajouts ultérieurs portent sur les audits et les résultats. La branche est publiée sur GitHub. Aucune intégration dans `main` ni publication du Site pour cette expérience.

