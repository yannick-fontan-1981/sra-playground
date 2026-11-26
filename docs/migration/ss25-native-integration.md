# SS25 — intégration native dans SRA Playground

**SS25 — Les Derniers Équilibres** est raccordé après SS24 dans **Custom 4**. Le quatuor est **Guerrier / Voleur / Magicien / Barde**. L’adaptateur utilise directement le moteur TypeScript du laboratoire, sans iframe ni moteur Python pour SS25.

Les huit cartes et leurs témoins sont synchronisés. Les contrôles acquis comprennent **137 tests du laboratoire**, **102 tests natifs**, **45 configurations DOM**, les huit parcours HTML et quatre revues de conception. Les témoins totalisent **1 209 entrées**, **201 sélections** et **3 296 images publiques** ; N1 enseigne **39 découvertes**. Le rejeu **Chrome Manual N1→N8** est terminé, avec le panneau officiel de victoire et Undo final vérifiés. La continuité SIC est également qualifiée ; les références de publication sont consignées dans le reçu de la [PR 130](https://github.com/yannick-fontan-1981/sra-playground/pull/130).

## Raccordements réalisés

| Fichier | Rôle |
| --- | --- |
| [src/games/sinking-star-ss25.ts](../../src/games/sinking-star-ss25.ts) | Adapte ACTION1–ACTION6, Undo, Reset, Restart et choix de niveau à `QuartetPuzzleSession` et `SS25_LEVELS` ; valide les requêtes avant de remplacer une session |
| [src/runtime/native-game-dispatcher.ts](../../src/runtime/native-game-dispatcher.ts) | Charge le backend SS25 par la branche native du dispatcher |
| [src/games/catalog.ts](../../src/games/catalog.ts) | Ajoute `ss25-c4000001`, famille `sinking_star_quartet`, huit niveaux et source SS25 après SS24 |
| [src/main.ts](../../src/main.ts) | Raccorde les quatre rôles, le suivi pédagogique, les feedbacks, les objectifs, les sources, les commandes et les animations interrompues |
| [src/games/sinking-star-ss25-help.ts](../../src/games/sinking-star-ss25-help.ts) | Réemploie les 39 prompts publics de `lessonIds` et `lessonPrompt`, ainsi que l’aide du quatuor |
| [src/styles.css](../../src/styles.css) | Présente les boutons de rôle sur deux colonnes et applique les couleurs du quatuor |
| [scripts/native-game-gallery.mjs](../../scripts/native-game-gallery.mjs) | Génère les aperçus SS25 depuis la session et les huit cartes finales |
| [tests/custom4-native.test.ts](../../tests/custom4-native.test.ts), [scripts/verify-ss01-browser.mjs](../../scripts/verify-ss01-browser.mjs) | Attendent SS01 à SS25 dans Custom 4, en conservant les collections précédentes |
| [tests/ss25-native.test.ts](../../tests/ss25-native.test.ts) | Compare les parcours laboratoire/adaptateur/dispatcher, les transitions, Undo, la sélection et l’aide native |

Le build exécuté génère **125 jeux et 836 aperçus de niveaux**. Le jeu expose des images de **64 × 64 pixels**, une palette de 16 couleurs et les actions publiques 1 à 6. L’ordre des héros est stable : `warrior`, `thief`, `wizard`, `bard`, associé aux touches 1, 2, 3, 4. Les boutons, les touches et Tab utilisent la détection des héros dans les pixels publics ; le clic transmet ACTION6 avec des coordonnées entières dans 0–63. X déclenche les reflets.

| Rôle | Couleur | Capacité volontaire |
| --- | --- | --- |
| Guerrier | Rouge, palette 8 | Pousser d’une case toute la file contiguë devant lui |
| Voleur | Vert, palette 14 | Tirer uniquement l’occupant immédiatement derrière lui après un pas libre |
| Magicien | Violet, palette 15 | Échanger avec la première cible de la visée, ou marcher sans cible |
| Barde | Magenta, palette 6 | Entraîner les occupants admissibles de son carré avant le pas |

Le Guerrier n’a aucune immunité ni attaque spéciale. Les monstres ne poursuivent pas les héros et leurs contacts orthogonaux se résolvent simultanément après les déplacements et les mécanismes. Les quatre héros vivants doivent occuper simultanément les quatre destinations. Les 39 découvertes de N1 ne sont pas une condition cachée de victoire.

## Contrat public et transports passifs

Le changement principal par rapport à SS24 est le remplacement du Marchand par le Guerrier : la poussée volontaire déplace maintenant une file complète, alors que le Voleur conserve une prise arrière unique. Les files peuvent mélanger héros, caisses, monstres et miroirs. Les appuis immergés ne sont pas des pièces de la file, des prises du Voleur ou des cibles du Magicien.

Un partenaire transporté n’active pas son pouvoir. Le Barde tiré ou poussé ne chante pas ; le Magicien déplacé ne vise pas ; le Voleur chanté ou reflété ne tire rien ; le Guerrier transporté ne prolonge pas la poussée. Le chant peut déplacer les appuis libres d’eau en eau, avec les règles d’ancrage par un héros ou par l’arrivée immédiate du Barde. Les pressions, reflets et retraits de plateformes restent capables de produire des effets forcés dangereux.

L’observation native transmet uniquement les pixels, les images d’animation, leurs durées et les métadonnées publiques de session. Les cartes privées, les états sémantiques, les plans et les solutions n’y figurent pas. Les scripts d’auteur et les témoins ne sont pas importés par le bundle jouable. Le [contrat du laboratoire](../../experiments/sinking-star-ss25/docs/specification.md) décrit les règles détaillées.

## Qualification exécutée

| Contrôle | Résultat | Preuve |
| --- | --- | --- |
| Laboratoire, moteur et pédagogie | **137/137 tests**, zéro échec ni test ignoré | [unit-tests.json](../../experiments/sinking-star-ss25/validation/unit-tests.json) |
| Parcours publics | Huit victoires, **1 209 entrées / 201 sélections / 3 296 images**, aucun refus ni décès | [levels-report.json](../../experiments/sinking-star-ss25/validation/levels-report.json) |
| HTML autonome | **45 configurations de rôles**, huit parcours ; pixels, durées, contrôles et Undo exacts | [ui-dom-report.json](../../experiments/sinking-star-ss25/validation/ui-dom-report.json) |
| Conception et correspondance | **4 revues / 97 contrôles**, 25 contrebranches dans la revue indépendante | [design-report.json](../../experiments/sinking-star-ss25/validation/design-report.json) |
| Adaptateur et dispatcher natifs | **102/102 tests**, exit 0 | [native-tests-report.json](ss25-evidence/native-tests-report.json), [log](ss25-evidence/native-tests.txt) |
| Chrome natif en Manual | Une session N1→N8, **39/39 découvertes**, **VICTORY**, Undo final puis reprise vérifiés | [chrome-manual-report.json](ss25-evidence/chrome-manual-report.json) |
| TypeScript racine | Réussi | [typecheck.txt](ss25-evidence/typecheck.txt) |
| Build racine | Réussi, **125 jeux / 836 aperçus** | [build.txt](ss25-evidence/build.txt) |

La commande native effectivement exécutée est :

```sh
node --test --test-reporter=tap tests/ss25-native.test.ts tests/custom4-native.test.ts tests/ss21-native.test.ts tests/ss22-native.test.ts tests/ss23-native.test.ts tests/ss24-native.test.ts
```

Cette exécution couvre SS25, Custom 4 et les régressions des campagnes antérieures chargées par cette suite. Le test SS25 compare chaque observation des huit témoins, les 3 296 images et leurs durées, les sélections, les passages de niveau et Undo après les victoires. Il vérifie aussi les chargements invalides, les coordonnées ACTION6, Reset, Restart, le choix de salle, l’ordre des rôles et les 39 prompts de l’aide native.

Le tutoriel est contrôlé à partir des observations publiques. Les fixtures distinguent le Guerrier rouge des monstres rouges, les héros des boutons et les gestes volontaires des transports passifs. Une file homogène enseigne la poussée de file ; la découverte de file mixte exige au moins deux types d’occupants visibles. Une seconde caisse distante ou un appui immergé ne suffisent pas à démontrer la prise unique du Voleur. Les découvertes ne s’ajoutent qu’au niveau 1.

Le contrôle du HTML utilise Happy DOM et une file d’animation contrôlée. Il compare le tampon du canvas et les durées, puis teste Undo, les interruptions et la réduction des animations. Il est distinct du rejeu visuel natif Chrome et ne doit pas être présenté comme son résultat.

## Campagne et portée des revues

| Niveau | Salle | Entrées | Sélections incluses |
| --- | --- | ---: | ---: |
| N1 | Le chantier des quatre gestes | 216 | 38 |
| N2 | Le quai à deux réceptions | 123 | 21 |
| N3 | Les deux formes du pont | 212 | 26 |
| N4 | La cale que l’on reprend | 159 | 24 |
| N5 | La cale qui change de côté | 124 | 19 |
| N6 | Le dernier usage de la butée | 151 | 39 |
| N7 | Le retour de la troisième charge | 134 | 19 |
| N8 | Les deux accès avant le retour | 90 | 15 |
| **Total** | **Huit victoires** | **1 209** | **201** |

Les revues d’introduction, centrales, finales et indépendante comptent respectivement **12, 34, 35 et 16 contrôles**. La dernière rejoue les actions numériques directement avec `stepDetailed`, sans importer les outils d’auteur ni le solveur. Elle vérifie les états jalonnés, les circuits, les ressources, les contacts et les destinations. Ses **25 contrebranches** décrivent des effets locaux, sans affirmer qu’une réparation ultérieure serait impossible.

Les variantes gagnantes sont conservées : N1 en 214 entrées sans la première démonstration de traction ; N5 en 131 avec une relève manuelle sans chant ; N6 en 130 en plaçant le Magicien avant le poids final ; N7 en 139 avec un premier pas de retour anticipé ; N8 en 74 en extrayant le Magicien après l’ouverture des plateformes. Ces résultats empêchent de transformer le seul ordre du témoin en nécessité générale. Les actions et limites se trouvent dans les [rapports de conception](../../experiments/sinking-star-ss25/reference/).

Le contrôle géométrique compare SS25 aux **88 terrains SS14–SS24**, avec recadrage, normalisation, rotations et symétries. Aucun doublon exact n’est trouvé. Les graphes de marche individuelle sont bornés et figent les autres ressources ; le modèle généreux ignore les autres héros comme obstacles tout en conservant leurs poids. Ils ne simulent pas toutes les coopérations ni les cascades de transport des presses. La variété et les dépendances entre ressources sont décrites dans le [dossier des sources](../../experiments/sinking-star-ss25/docs/source-audit.md), sans prétendre mesurer la difficulté pour chaque joueur.

Le HTML autonome qualifié mesure **159 970 octets**, SHA-256 `358f1e976aca5754f07a3e9a851d25716b8c8dbf814474a2c88b0c2d24efd895`. Le [manifeste](../../experiments/sinking-star-ss25/validation/delivery-manifest.json) lie cet artefact aux sources et rapports du laboratoire. Son champ `nativeBrowserSession: false` délimite cette qualification autonome ; il ne remplace pas le rapport de l’interface native. La [validation du laboratoire](../../experiments/sinking-star-ss25/docs/validation.md) détaille les parcours et les preuves.

## Rejeu Chrome natif terminé

Le [rapport Chrome](ss25-evidence/chrome-manual-report.json) décrit **une seule session Manual, démarrée en N1 et terminée en N8**. Les flèches, Tab et X sont envoyées au canvas public, avec attente de la fin des animations. Aucune action n’est injectée dans l’état privé du moteur. Le rejeu couvre les **1 209 entrées et 201 sélections** des témoins ; les transitions de salle sont observées et le compteur de N1 atteint **39/39 découvertes**.

À la fin de N8, l’interface affiche **VICTORY · Les quatre destinations sont occupées**. Le clic sur Undo masque ce panneau, puis **ArrowDown** reproduit le dernier geste et le rétablit. Ces deux commandes supplémentaires sont comptées séparément du témoin.

Le rapport archive les empreintes des sources d’intégration et du moteur, ainsi que celles des huit cartes et listes d’actions. Le journal consulté ne contient aucune erreur d’origine applicative ; les huit erreurs recensées concernent les métadonnées d’une extension Chrome. La vérification porte sur l’aperçu natif géré. Les captures sont inspectées pendant la session, sans fichiers exportés revendiqués ; la publication et son SHA source sont contrôlés séparément.

## Continuité et publication

Le contrôle `npm run test:sic-continuity` a réussi : **78 niveaux protégés, 13 jeux et 11 cohortes**, avec vérification des séries réellement exécutées, de leur clôture et des effets physiques. Le [rapport](ss25-evidence/sic-continuity-report.json) et le [log](ss25-evidence/sic-continuity.txt) conservent le résultat ; les 11 traces comprimées et leurs empreintes permettent sa relecture. Aucun apprentissage, planificateur ou arbitrage SIC n’est modifié par SS25.

La livraison suit la [PR 130](https://github.com/yannick-fontan-1981/sra-playground/pull/130). Consulter son reçu pour les valeurs observées après les contrôles : commit poussé, SHA intégré sur `main`, version Site, SHA source et concordance. Un rapport de laboratoire ne qualifie pas la continuité SIC, une exécution native ne prouve pas la publication, et aucune de ces vérifications n’établit une résolution autonome de SS25 par SRA.

## Traçabilité GitHub et Site

Branche : `feat/sinking-star-ss25-20261126`. Base historique : `4a546a139f9064422c078ef5f40b8c22133c39a8`.

Deux checkpoints ont été poussés :

- `a5b023acbcf7fbfa63b1d7e64aed8b66da80cee2` — moteur SS25, intégration native et atelier de 39 découvertes.
- `fce2d03ebe994370e79034f589c2ec411a781bc9` — cartes, relèves de ressources et parcours intermédiaires.

Ces checkpoints précèdent la qualification finale. Le reçu de la [PR 130](https://github.com/yannick-fontan-1981/sra-playground/pull/130) conserve les valeurs effectivement constatées après intégration et publication. La chaîne de livraison est travail → tests → commit → push GitHub → intégration canonique → publication → contrôle de concordance. Les accès du Site sont conservés.