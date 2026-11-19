# SS08 — choix de conception des huit salles

Index demandé : <https://sinkingstarwalkthrough.com/fr/crossovers/>. Chaque carte est une création pédagogique ou une adaptation de principe, pas une transcription exacte de l’image originale.

| Niveau | Titre | Référence | Parcours vérifié |
|---|---|---|---:|
| 1 | L’atelier des deux passages | [Tutoriel original ; principe de Heroes and Mirrors 30](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-30) | 50 actions |
| 2 | Le relais derrière l’angle | [Heroes and Mirrors 30](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-30) | 30 actions |
| 3 | Le compte des cinq îles | [Heroes and Water 11](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-11) | 31 actions |
| 4 | Le miroir et son échafaudage | [Heroes and Mirrors 32](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-32) | 34 actions |
| 5 | La bonne diagonale | [Heroes and Mirrors 31](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-31) | 59 actions |
| 6 | Le poids du second reflet | [Heroes and Mirrors 19](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-19) | 32 actions |
| 7 | Le duel et le retour | [Heroes and Mirrors 25](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-25) | 50 actions |
| 8 | Le rectangle impossible | [Heroes and Mirrors 34](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-34) | 38 actions |

Les longueurs sont celles des témoins de résolution, sélections comprises. Elles ne mesurent pas la difficulté et ne sont pas annoncées comme optimales.

## 1. L’atelier des deux passages

Création pédagogique. Le rayon dévié du Magicien reprend le principe de Heroes and Mirrors 30, avec deux personnages, une presse isolée et une passerelle temporaire. La géométrie est originale.

## 2. Le relais derrière l’angle

Géométrie originale compacte à trois îlots ; duo Marchand/Magicien et deux objectifs ; miroir déplacé par le Marchand ; le Magicien dépose la caisse sur son bouton de départ.

## 3. Le compte des cinq îles

Cinq îlots réagencés et deux objectifs sur l’île centrale ; Marchand remplace le Guerrier ; une caisse supplémentaire garde une ancre de retour pour le Magicien. Aucun miroir ni porte : problème de circulation des héros et de réserve de caisses.

## 4. Le miroir et son échafaudage

Passerelle et îlots redessinés ; le Magicien échange avec son partenaire pour livrer le seul pousseur sur le chantier ; un bloc noyé construit le virage ; le miroir sert d’abord au retour puis à la traversée finale des deux héros.

## 5. La bonne diagonale

Deux miroirs ordinaires orientés différemment remplacent la distinction miroir ordinaire/spécial ; les deux héros doivent sortir ; une caisse extraite par le Magicien conserve le bouton rose et libère l’appui nécessaire pour déplacer le premier miroir. Ce dernier maintient le bouton vert de la passerelle hydraulique ; le second devient le transporteur. Deux destinations nouvelles.

## 6. Le poids du second reflet

Le retard de Heroes and Mirrors 19 devient une priorité de distance : une caisse proche tombe dans l’eau avant qu’un héros plus éloigné ne rejoigne le bouton. L’empilement original est remplacé par des appuis permanents et deux plateformes hydrauliques, avec un second îlot final accessible uniquement après la presse.

## 7. Le duel et le retour

Reprise du principe d’élimination réciproque des gobelins de Heroes and Mirrors 25, sans duplication. Géométrie originale à deux étapes : libérer le bouton construit la sortie de l’îlot du Magicien, mais le pont final exige de charger une seconde presse puis de réactiver le même bouton. La caisse finale est coincée contre trois murs : le Magicien doit l’extraire. Le seul appui de poussée latérale est un mur, donc le second pont exige la presse.

## 8. Le rectangle impossible

Le rectangle de quatre miroirs et la nécessité de briser le coin inférieur droit reprennent Heroes and Mirrors 34. Dans SS08, le Marchand construit un accès à une presse latérale, qui pousse une file caisse–miroir ; la caisse fournit ensuite le second appui. Le Magicien active une passerelle après un échange vers l’îlot supérieur. Géométrie adaptée au duo, sans échange direct avec les miroirs et sans empilement.

## Contrôle des mécanismes enseignés

Le tutoriel a été retravaillé après la découverte de deux raccourcis : une solution sans déplacer le miroir et une autre sans déployer la passerelle. Le dessin final impose les poussées du Marchand, les échanges du Magicien, la presse, la création d’appuis et le déplacement du miroir ; ces cinq points sont étayés par des recherches exhaustives. La nécessité du mécanisme hydraulique est établie séparément par une borne géométrique reproductible et un invariant de population de l’îlot. Les recherches bornées sans reflets et sans hydraulique restent marquées comme inconclusives : elles ne remplacent pas une preuve.

Le niveau 3 met en jeu une différence entre échange et transfert : l’échange conserve le nombre d’occupants de chaque île, tandis que le Marchand crée une connexion vers l’île de destination initialement vide. Le niveau 7 vérifie un combat réciproque suivi de deux presses dans son témoin. L’extraction de la seconde caisse par le Magicien et la seconde presse répondent à des contraintes de position ; aucune unicité de la manière d’éliminer les monstres n’est revendiquée.

Le niveau 8 est contrôlé dès son état initial : les rayons nord et sud du Magicien bouclent, les autres actions sont refusées. La presse déplace réellement une file caisse–miroir et détruit le coin inférieur droit ; le témoin termine après le retrait des deux plateformes hydrauliques.

## Régénération

Après compilation du moteur, les constructeurs sont dans `reference/author/`. Les niveaux 2 à 5 se régénèrent avec `node reference/author/design-source-levels.mjs 2 3 4 5`. Les quatre autres ont chacun un `build-levelN.mjs`. Exécuter ensuite `node scripts/sync-levels.mjs` puis reconstruire. Les preuves et les témoins ne font pas partie du HTML distribué.
