# SS20 — qualification du laboratoire 0.1.0

Cette qualification concerne **Le Relais des Îles**, trio **Marchand / Voleur / Barde**, ses huit cartes et son HTML autonome. Le tutoriel se trouve au **niveau 1, L’atelier des marées**, avec **30 découvertes** observées depuis les pixels publics. **La campagne et son HTML compilé sont qualifiés : huit victoires depuis N1, 1 344 entrées, 3 821 images comparées avec leurs durées, zéro refus et zéro perte dans les témoins.** Ces résultats ne prouvent pas une intégration native de SS20, une réussite autonome de SRA ou une publication du Site.

## Reproduction

```sh
npm ci
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

Le projet demande Node ≥ 22 ; la qualification utilise Node 24.22.3, TypeScript 5.9.3 et Happy DOM 21.0.4. `npm run build` compile les sources puis construit `dist/SS20-demo.html`. Les données d’auteur et les témoins ne sont pas embarqués dans ce HTML.

Les rapports sont distincts afin de ne pas confondre leurs portées :

| Rapport | Ce qu’il établit |
| --- | --- |
| `validation/unit-tests.json` et `unit-tests.txt` | Résultat des tests de moteur, session, monstres et suivi pédagogique. |
| `validation/levels-report.json` | Rejeu des huit témoins, observations publiques, étapes et compteurs de la campagne. |
| `validation/ui-dom-report.json` | Commandes du vrai HTML compilé, pixels canvas, images et durées ; le champ `scope` indique si la campagne complète est incluse. |
| `validation/design-report.json` | Contraintes de départ, comparaison des terrains et exécution des revues de conception. |
| `validation/delivery-manifest.json` | Identité du HTML remis, SHA-256 et liaison avec les quatre rapports réussis. |

Le [manifeste de livraison](../validation/delivery-manifest.json) a été produit après le gel de la construction et de ces quatre rapports réussis. Il identifie le HTML autonome de **136 889 octets** par le SHA-256 :

```text
ca943358a420532703f8f6943a665e81da2dab4cf6bd9194378cf01796c1a2e8
```

Les rapports de campagne et de DOM portent cette même empreinte. Les SHA des sources et rapports sont reliés dans le manifeste. Un succès obtenu sur un HTML antérieur ne qualifie pas automatiquement une autre construction.

## Tests unitaires : 90 réussites

Le rapport [unit-tests.json](../validation/unit-tests.json) enregistre **90 tests réussis**, zéro échec et zéro test ignoré :

| Groupe | Tests réussis | Contrôles |
| --- | ---: | --- |
| Trio, moteur et session | 51 | Poussée et traction d’une seule pièce, partenaires transportés sans pouvoir passif, chant, eau, appuis, reflets, dispositifs, sélection et reprises. |
| Monstres | 19 | Immobilité, transports explicites, absence de deuxième déplacement, contacts, presses, eau et Undo. |
| Tutoriel | 20 | Déductions à partir des pixels, distinction des mouvements, trente découvertes et attribution limitée au niveau 1. |
| **Total** | **90** | |

Une sélection n’avance pas le monde. Un Marchand ne pousse pas une file ; le Voleur ne tire que le voisin arrière ; déplacer le Barde par un autre mécanisme ne fait pas chanter. Les tests distinguent les mouvements volontaires et les cascades forcées, notamment lorsqu’une presse ou un support hydraulique change une arrivée.

## Témoins des huit salles

Les JSON de référence fournissent des parcours complets et des étapes lisibles. Chaque parcours est vérifié avec zéro refus et zéro perte. Le témoin de N1 montre les **30 découvertes sur 30** dans les observations publiques et inclut des détours de démonstration facultatifs.

| Niveau | Titre | Entrées | Sélections | Hors sélection | Images |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | L’atelier des marées | 256 | 37 | 219 | 714 |
| 2 | Le chargement à rebours | 223 | 24 | 199 | 626 |
| 3 | Le poids qui reste | 85 | 5 | 80 | 255 |
| 4 | Les quais en décalage | 102 | 16 | 86 | 286 |
| 5 | Le pas qui manque | 128 | 11 | 117 | 391 |
| 6 | Les pierres voyageuses | 93 | 16 | 77 | 251 |
| 7 | La relève du passeur | 92 | 13 | 79 | 260 |
| 8 | Le chantier à démonter | 365 | 43 | 322 | 1 038 |
| **Total** | | **1 344** | **165** | **1 179** | **3 821** |

Ces comptes incluent ACTION1–6. Ils ne sont pas des minima, n’évaluent pas à eux seuls la difficulté et ne constituent pas des quotas à imposer au joueur. Le témoin n’est ni lu par le tutoriel ni communiqué à l’agent SRA. Le rapport [levels-report.json](../validation/levels-report.json) constate `WIN`, huit salles achevées et l’annulation de chaque victoire.

Les huit parcours comptent 110 poussées du Marchand, 84 tractions du Voleur, 55 chants, 28 reflets globaux, trois poussées de presse et dix déplacements d’appui. Ces valeurs décrivent les parcours effectivement rejoués, sans rendre chaque emploi obligatoire dans toutes les solutions.

## Revue de l’introduction et du milieu

[La revue N1–N2](../reference/intro-ss20-review.json) contient **11 contrôles réussis**. Elle suit les trente découvertes, la presse avant le contact des monstres, l’ancrage et l’extraction de la caisse réfléchie. Au N2, elle vérifie le changement de fonction d’une caisse, les accès du jardin et le départ du Barde par poussée puis traction. Les mauvais ordres testés restent décrits comme réversibles lorsqu’ils le sont.

[La revue N3–N5](../reference/middle-ss20-review.json) contient **15 contrôles réussis** :

- N3, six reflets avec et sans écran : le vert reste fixe uniquement dans la branche chargée, tandis que le violet alterne. Ce constat porte sur cette branche optique, pas sur une recherche universelle des déplacements.
- N4, retrait contrefactuel de la presse d’escale : les deux miroirs réclament le même acteur et le deuxième trajet est refusé. La version livrée masque effectivement le bras gauche.
- N4, caisse envoyée sans réceptionnaire : le prochain premier trajet entre en conflit avec le retour de la caisse vers l’escale.
- N4, livraison prématurée : le quai de départ disparaît. Une variante rétablit le réglage depuis la rive droite puis gagne en **116 entrées**, dont 22 sélections.
- N5, huit reflets seuls : aucune rencontre ; les monstres gardent la même parité de grille.
- N5, variante **reflet puis pas du Barde** : victoire complète en 128 entrées, avec les mêmes règles que l’ordre du témoin.
- N5, coude chargé : le passage arrière du Marchand se ferme ; le chant descend la caisse tandis que le mur retient le Marchand.
- N5, recherche sans aucun chant : **7 920 états explorés, file épuisée, résultat `unsolvable`**. Cette conclusion démontre l’impossibilité sous cette restriction précise.

Les scripts reproductibles sont `reference/author/review-intro-ss20.mjs` et `reference/author/review-middle-ss20.mjs`. Le rapport de conception rassemble ces résultats avec la revue finale et la relecture indépendante.

## Revue des finales : 18 contrôles réussis

[La revue N6–N8](../reference/final-ss20-review.json) vérifie les trois témoins et les contraintes suivantes :

- **N6 :** un seul appui effectue neuf déplacements au cours de ses réemplois ; la caisse reste sèche sur la commande finale. Une variante gagne en **97 entrées**, dont 16 sélections, en extrayant la caisse initiale par chant. Le premier tirage du témoin n’est donc pas obligatoire.
- **N7 :** un départ chanté immédiat est fatal ; une sortie haute prématurée du Voleur provoque son retour physique par la presse. Le déplacement du bouton en `(7,8)` et la presse en `(7,7)` ferment l’ancien contournement de 73 entrées, effectivement rejoué. Le seul déplacement sec du gardien vise la presse au-dessus du bouton et ne fournit pas la relève manquante.
- **N8 :** les deux coupures d’eau restent nécessaires dans un graphe optimiste avec portes ouvertes, plateforme active et transport optique disponible. Chaque trou est isolé des autres cases d’eau : un appui ne peut pas être réemployé dans les deux. Le socle empêche toute manutention du miroir.
- **N8 : après élimination du gardien**, trois caisses sont nécessaires pour les deux appuis et le poids sec. Retirer trop tôt la commande du chantier immerge la réserve haute sur `(14,13)` ; il ne reste alors que deux caisses sèches pour ces trois emplois.
- **N8 :** le retour de commande au tour 40 remonte le Marchand par chant ; le sas se ferme vide. L’unique poussée de presse du témoin transporte le gardien au tour 35.
- **N8 :** le départ volontaire du Voleur tire la caisse finale et ferme la sortie. Le chant depuis l’autre rive transporte le Voleur sans déplacer cette caisse, hors de portée.

La branche qui place un gardien sur le bouton final constate le contact fatal dans les cases du dernier passage. Elle n’est pas une preuve exhaustive contre une installation tardive après toutes les traversées. La nécessité des trois caisses est donc explicitement conditionnée à l’élimination du gardien, contrairement à celle des deux appuis distincts, qui repose sur la topologie. Les mauvaises branches testées ne sont pas ajoutées aux témoins gagnants.

## HTML compilé et navigateur

Le [rapport DOM final](../validation/ui-dom-report.json) porte le scope **`focused-ui-and-full-campaign`**. Il exécute le vrai HTML compilé dans Happy DOM, avec un tampon canvas RGBA et une file de temporisateurs contrôlée. Ses **32 cas de mécanismes** vérifient poussée simple, traction arrière simple, chant, monstres stables, appuis libres ou ancrés, presses latérales, hydraulique et contacts. Les contrôles optiques portent sur la priorité au plus proche, les échanges, les conflits atomiques et les avertissements rouges.

La vérification des commandes couvre clavier, boutons tactiles, clics, changements de héros, Undo, Reset, Restart, sélection de salle et réduction des animations. Elle contrôle les interruptions pour empêcher les anciennes images de réapparaître. Les glyphes de bouton et de presse sont vérifiés pixel par pixel, avec centre violet distinct, fond gris et centres noir/gris.

La campagne réelle a été exécutée par les commandes du HTML depuis N1 jusqu’à **`WIN`**. Toutes ses images et leurs durées ont été comparées ; les huit victoires ont été annulées puis rejouées. Le DOM affiche les **30 découvertes** du tutoriel N1 et n’en attribue aucune dans les autres salles. Les titres, objectifs, liens, aides et trois héros / trois buts de chaque salle sont contrôlés.

Sur la vraie carte **N4**, après un préfixe de **20 entrées**, un reflet bloqué produit quatre images et fait rougir trois pixels du dos du miroir concerné, sans altérer sa face. Répéter l’avertissement n’ajoute pas d’Undo ; Reset le retire. Les contrôles génériques couvrent également les avertissements multiples et la réduction des animations.

Happy DOM ne calcule pas la mise en page comme un navigateur natif. Une revue ordinateur/mobile du HTML dans un navigateur constitue une vérification distincte. Elle ne devient pas non plus une preuve de conformité du dispatcher SRA ou du Site publié.

## Relecture indépendante et total des revues

La [relecture indépendante](../reference/independent-review-ss20.json) inspecte les huit cartes et leurs témoins avec **47 contrôles réussis**. Elle confirme les causes physiques de tous les mouvements de monstres, les contraintes de départ et les contre-parcours propres aux nouvelles cartes. Deux variantes complètes sont rejouées : N5 avec le reflet avant le chant, en 128 entrées ; N6 avec extraction initiale par le Barde, en 104 entrées. Cette seconde route diffère du témoin de 97 entrées qualifié par la revue finale ; les deux sont légales.

| Revue reproductible | Contrôles réussis |
| --- | ---: |
| `review-intro-ss20.mjs` | 11 |
| `review-middle-ss20.mjs` | 15 |
| `review-final-ss20.mjs` | 18 |
| `independent-review-ss20.mjs` | 47 |
| **Total des quatre revues** | **91** |

Ces contrôles ont des périmètres qui peuvent se recouper. Ils ne constituent pas 91 preuves de nécessité universelle et ne cherchent pas une solution minimale. Le rapport de conception exécute les quatre scripts et conserve leur résultat.

## Géométrie et limites

Le [rapport de conception](../validation/design-report.json) réussit pour les huit salles. Il compare leurs terrains aux **48 cartes de SS14–SS19** après recadrage et normalisation des huit symétries, sans répétition exacte entre les nouvelles cartes ni avec les anciennes. Il confirme les trois héros, les trois destinations, l’absence de départ sur un but et la séparation des boutons et presses. Dans chacun des huit graphes de marche initiale figée, le maximum d’affectation de destinations est **zéro** ; ce contrôle inclut une version qui ignore les autres héros comme obstacles.

Les graphes de marche figent ressources et circuits ; ils ne simulent pas toutes les combinaisons d’actions. La comparaison de terrain détecte des copies exactes ; elle ne mesure pas l’originalité subjective ou la difficulté. Les revues ciblées valident leurs branches, sans transformer chaque erreur en impasse définitive. Une recherche arrêtée sur une limite de temps ou d’états reste inconclusive.

## Intégration native et publication

L’adaptateur natif doit être qualifié séparément : mêmes cartes, observations, animations, durées, interruptions et victoire depuis L1 à travers le dispatcher. L’intégration doit préserver SS19 et les autres jeux, exécuter les contrôles du dépôt et `npm run test:sic-continuity`, puis vérifier le rendu dans le navigateur de livraison.

La publication suit **tests → commit → push GitHub → intégration sur main → publication du Site existant → vérification GitHub/Site**. Le compte rendu relie le commit intégré à la version et au SHA source du Site lorsqu’il est fourni. Aucun rapport de ce laboratoire ne remplace cette preuve.
