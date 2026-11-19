# SS09 — dossier d’intégration native

## Portée et références

Le laboratoire **0.1.2 / HTML v3**, intitulé **Le Chœur des Miroirs**, est la source de l’intégration de SS09 dans Custom 4. Ce document décrit le travail à réaliser ; il ne prétend pas que le raccordement natif ou la publication Site sont déjà faits.

La source fonctionnelle approuvée est `ee842d20d59d51312f10d2a8249b5c978d15c545`. Les chemins d’intégration ont été vérifiés sur le dépôt `yannick-fontan-1981/sra-playground`, `main` au commit `f4d28aee9ebbb35533bb97a26968efd22887473d`, qui possédait SS01–SS08 natifs. Relire l’état courant avant modification ; ce relevé ne justifie pas d’écraser des changements plus récents.

Le prompt directement utilisable figure dans [codex-integration-prompt.md](codex-integration-prompt.md). Les règles détaillées et les choix de niveaux demeurent dans [specification.md](specification.md), [level-design.md](level-design.md) et `reference/levelN-design.json`.

## Fichiers à raccorder

| Emplacement | Travail prévu |
| --- | --- |
| `src/games/sinking-star-ss09.ts` | Nouvel adaptateur minimal vers le moteur du laboratoire ; aucun second moteur. |
| `src/runtime/native-game-dispatcher.ts` | Ajouter SS09 au chargement différé natif ; préserver le fallback des autres jeux. |
| `src/games/catalog.ts` | Entrée SS09 après SS08, groupe `custom_4`, huit niveaux, disponible. |
| `src/main.ts` | Ajouter le duo Marchand/Barde aux contrôles, à l’aide, au tutoriel, aux retours et à la présentation partagée. |
| `experiments/sinking-star-ss09/src/tutorial.ts` | Module pur à extraire de `browser.ts`, puis partagé avec l’interface native. |
| `experiments/sinking-star-ss09/scripts/build-demo.mjs` | Adapter le bundle autonome à cette extraction, sans modifier le jeu. |
| `scripts/native-game-gallery.mjs` | Ajouter la neuvième session native et générer ses huit images initiales. |
| `scripts/generate-game-gallery.mjs` | Utiliser son traitement générique existant et conserver ses contrôles de cohérence. |
| `tests/custom4-native.test.ts` | Catalogue, parité des observations, commandes, erreurs et non-régression du dispatcher. |
| `scripts/verify-ss09-browser.mjs` | Nouveau contrôle du Playground réel avec `native-browser-checks.mjs`. |

Identité catalogue proposée : `code: 'SS09'`, `id: 'ss09-c4000001'`, `name: 'Le Chœur des Miroirs'`, `group: 'custom_4'`, `family: 'sinking_star_duo'`, `levels: 8`, `availability: 'playable'`, `sourcePath: 'experiments/sinking-star-ss09/src/levels.ts'`.

L’adaptateur SS08 fournit le modèle de branchement, mais ses règles de Magicien, ses messages et son tutoriel au niveau 4 ne doivent pas être repris. SS09 démarre au niveau 1 avec son tutoriel ouvert et un Barde comme partenaire.

## Contrat du moteur

`DuoPuzzleSession(SS09_LEVELS)` expose `observe()`, `action(id, data?)`, `undo()`, `reset()`, `restart()` et `selectLevel(level)`. Les niveaux sont numérotés de 1 à 8. `nextHero()` existe pour le laboratoire, mais la sélection de l’interface native doit passer par une ACTION6 publique journalisable.

| Entrée publique | Fonction |
| --- | --- |
| ACTION1, ACTION2, ACTION3, ACTION4 | Haut, bas, gauche, droite. |
| ACTION5 | Reflet global, sans chant ; Espace ou X. |
| ACTION6 avec `{x,y}` | Sélection d’un héros avec coordonnées pixels entières de 0 à 63 ; ne fait pas avancer le monde. |
| Undo / Reset / Restart | Restaurer l’action entière / recommencer la salle / recommencer la campagne. |

Les centres des cellules déjà centrées valent `(3 + 3*x, 3 + 3*y)` dans l’image 64 × 64. Les coordonnées des cartes d’auteur sont antérieures au centrage : ne pas appliquer leur translation une seconde fois. Le clic, Tab, 1/2 et les boutons utilisent une sélection obtenue à partir de l’image publique.

L’observation publique contient exclusivement :

```ts
gameCode, frame, frames, frameDurationsMs, state,
availableActionIds, canUndo, canSelectLevel,
level, levelCount, levelsCompleted, defaultFps, palette
```

`frameDurationsMs` est optionnel dans l’interface commune du Playground, mais les durées fournies par SS09 doivent être conservées. Les indices des miroirs bloquants, positions internes, plans de déplacement, données d’auteur et témoins restent privés. La disponibilité des commandes et les états terminaux viennent du moteur.

La progression sélectionne le **premier niveau encore non terminé**, qui n’est pas nécessairement le suivant du niveau courant. Une action gagnante peut déjà se terminer par l’image initiale de cette nouvelle salle ; l’interface suit l’observation reçue.

## Animation et historique

Le lecteur de `src/main.ts` sait déjà parcourir `frames` avec `frameDurationsMs` et annuler une présentation grâce à ses générations. Étendre les ensembles de jeux duos pour que SS09 bénéficie de ce chemin, puis le vérifier sur le vrai worker.

Les phases usuelles sont : déplacement/poussée/chant/presse/plateforme `[60,80,40]`, reflet `[70,90,40]`, combat `[80,90,100,110,40]`. Les cascades concatènent les phases ; le dernier délai de l’ensemble est ramené à zéro. Ces exemples décrivent le moteur : le lecteur doit consommer les tableaux retournés, sans recalculer ni uniformiser les durées.

L’interférence d’un miroir produit quatre images `[110,70,110,0]`, rouge/blanc/rouge/blanc, puis le même état final. Aucun mouvement, circuit, attaque ou nouvelle étape Undo n’en résulte. Une déduplication fondée sur l’image finale masquerait ce signal. Un nouveau déclenchement doit le rejouer. Les témoins de l’interférence la plus proche, de source masquée, de destination conflictuelle et du miroir éloigné sans responsabilité doivent conserver leur sens.

Les commandes de jeu restent bloquées pendant l’animation ; les contrôles de récupération et de navigation annulent les callbacks périmés. Un changement de mode ou une réponse d’agent ne doit pas ressusciter une ancienne animation. Les panneaux terminaux ne recouvrent pas la préparation, l’impact ou la disparition d’un combat. Le replay conserve les coordonnées de sélection ainsi que les observations et durées publiques.

## Enseignement et présentation

Le tutoriel du navigateur contient déjà les détecteurs fondés sur les pixels : héros visibles, pièces, déplacement, chant, reflet, interférence et circuits. Leur extraction doit produire un module sans DOM, sans session privée et sans import de témoin. Les deux interfaces appellent ensuite la même logique. Conserver les douze identifiants et les consignes actuelles ; `selective-song` exige une pièce déplacée et une pièce retenue, pas seulement le déplacement du Barde.

Conserver l’aura pointillée magenta sous les glyphes, les prévisualisations `+` pour les héros et contour carré pour les caisses, et les miroirs au-dessus des boutons. La source et l’objectif de chaque salle viennent de `LEVEL_INFO`. Les crédits communs `SINKING_STAR_CREDIT_HTML` restent visibles dans la galerie ; les adaptations ne doivent pas devenir des revendications de reproduction exacte.

## Géométrie à préserver

**L1 v3** déplace une unique case de sol de `(9,8)` à `(9,11)` dans la carte brute 20 × 16, dont le décalage vertical de centrage est de deux cases. Toute la rive du premier îlot et tous les occupants/dispositifs initiaux sont identiques à v1. La correction ne conserve pas les ajouts et découpes de terrain de v2. Le témoin compte 52 actions et valide les douze découvertes.

**L4** conserve le Barde isolé, la libération par le Marchand, la caisse préchargée protégée contre un contournement manuel, les deux monstres dans le passage obligatoire, la presse créant le pont et le réglage final du miroir. Les preuves établissent la nécessité des capacités et dispositifs concernés ; elles ne prétendent pas que le duel soit l’unique traitement des monstres.

**L8** conserve la caisse à charger, le bouton et la porte sur le rayon. La poussée du Barde par le Marchand permet de partir sans entraîner le poids ; un chant mal choisi déplace la caisse et ferme la porte. Les recherches exhaustives de nécessité sont documentées et reproductibles dans `reference/author/verify-level8-necessity.mjs` ; ce script ne fait pas partie du jeu distribué.

## Validation et livraison

La référence de laboratoire validée possède **108 tests réussis**, **huit parcours gagnants**, **443 actions dont 33 sélections**, **1 312 images**, **douze découvertes pédagogiques**, quatre cas d’interférence et deux défaites réellement atteignables. Le compteur de déplacements affiché par le HTML exclut ACTION6 ; il ne faut pas le confondre avec le nombre total de commandes des témoins. Les onze groupes Happy DOM vérifient le HTML compilé ; ils n’attestent pas encore du fonctionnement natif dans le navigateur du Playground.

La validation d’intégration compare chaque observation du moteur et de l’adaptateur : métadonnées, pixels finaux, images intermédiaires et durées. Elle couvre les chargements invalides, les niveaux invalides, ACTION6 hors grille ou non entière, le passage entre jeux natifs et anciens, l’absence de chargement Python pour SS09 et l’absence d’état privé dans les messages publics.

Le contrôle navigateur reprend l’infrastructure `scripts/native-browser-checks.mjs` et les méthodes de `verify-ss08-browser.mjs`, avec un paramètre d’URL propre à SS09. Vérifier les témoins via les vrais contrôles, les douze découvertes, les interruptions d’animation, Undo après défaite et changement de salle, les deux héros, les retours de miroir, le chemin d’action SRA, le mobile et la galerie. Les galeries proviennent des huit `selectLevel(N)` du moteur : aucun aperçu dessiné séparément. Le lien de chaque salle est `/?game=SS09&level=N#playground`.

Exécuter les scripts `test` et `validate` du laboratoire ainsi que `npm test`, `npm run typecheck` et `npm run build` à la racine. Après commit/push et intégration sur `main`, publier le Site existant depuis le commit intégré, vérifier sa provenance et comparer les assets applicatifs, le worker et l’atlas avec le build. Les helpers navigateur supportent déjà cette vérification de publication. Le compte rendu distingue clairement source poussée, fusion sur `main`, tests locaux et Site réellement vérifié, avec les SHA et l’URL jouable.
