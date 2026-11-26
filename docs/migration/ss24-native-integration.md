# SS24 — intégration native dans SRA Playground

**SS24 — Les Voies de Traverse** est raccordé après SS23 dans Custom 4. Le quatuor est **Marchand / Voleur / Magicien / Barde**, sans Guerrier. L’adaptateur utilise directement le moteur TypeScript du laboratoire, sans iframe ni Python.

Les cartes présentes dans le scaffold sont encore provisoires. Les contrôles décrits ici portent sur les règles et l’interface indépendamment de ces cartes ; ils ne qualifient pas encore une campagne de huit salles.

## Raccordements réalisés

| Fichier | Rôle |
| --- | --- |
| `src/games/sinking-star-ss24.ts` | Adapte ACTION1–ACTION6, Undo, Reset, Restart et choix de niveau à `QuartetPuzzleSession` et `SS24_LEVELS` ; contrôle les coordonnées pixels 0–63 et les chargements invalides avant d’accepter une nouvelle session |
| `src/runtime/native-game-dispatcher.ts` | Charge SS24 nativement et conserve le contrat public de `browser-games.ts` |
| `src/games/catalog.ts` | Ajoute `ss24-c4000001`, famille `sinking_star_quartet`, huit niveaux et source du laboratoire SS24, après SS23 |
| `src/main.ts` | Raccorde les quatre rôles, les observations pédagogiques, les feedbacks, les aides, les sources, les commandes, les animations interrompues et la réduction des animations |
| `src/games/sinking-star-ss24-help.ts` | Expose les quatre capacités et les 37 prompts publics, issus de `lessonIds` et `lessonPrompt` ; nomme N1 « L’atelier des départs » |
| `src/styles.css` | Conserve les boutons sur deux colonnes, les quatre couleurs et la typographie lisible des quatuors |
| `scripts/native-game-gallery.mjs` | Raccorde la session SS24 ; la génération finale attend les huit cartes définitives |
| `tests/custom4-native.test.ts`, `scripts/verify-ss01-browser.mjs` | Attendent SS01 à SS24 dans Custom 4 sans retirer de jeu existant |
| `tests/ss24-native.test.ts` | Prépare les comparaisons complètes laboratoire/adaptateur/dispatcher, les transitions, Undo, les sélections et l’aide native |

Le catalogue attendu contient désormais 124 jeux si aucun autre ajout n’intervient. Le moteur livre des images 64 × 64 et une palette de 16 couleurs. L’ordre stable est `merchant`, `thief`, `wizard`, `bard`, avec les indices 0, 1, 2, 3 et les touches 1, 2, 3, 4. Les touches, les boutons et Tab utilisent la détection publique des héros ; le clic conserve ACTION6 en coordonnées pixels.

| Rôle | Couleur | Capacité volontaire |
| --- | --- | --- |
| Marchand | Orange, palette 12 | Pousser un occupant devant lui |
| Voleur | Vert, palette 14 | Tirer uniquement l’occupant immédiatement derrière lui après un pas libre |
| Magicien | Violet, palette 15 | Échanger avec la première cible de la visée, ou marcher sans cible |
| Barde | Magenta, palette 6 | Entraîner les occupants admissibles de son carré avant le pas |

Les quatre héros vivants doivent occuper simultanément les quatre destinations. Les 37 découvertes de N1 expliquent les règles et ne constituent pas une condition cachée de victoire.

## Traction et transports passifs

La traction reprend le contrat historique : le Voleur doit pouvoir avancer vers une case libre et soutenue ; seul son voisin arrière occupe son ancienne case. Une deuxième pièce alignée ne suit pas. Un pas refusé ne déplace aucune prise. Le Voleur tire une caisse mobile, un miroir, un monstre ou un partenaire, mais jamais un appui immergé ; une caisse posée sur un appui reste distincte de celui-ci.

Tirer le Barde n’entraîne ni ses caisses ni ses appuis. Tirer le Magicien ne lance pas de rayon. Un Voleur déplacé par le chant, l’échange, la poussée, la presse ou le reflet n’effectue aucune traction. Le Magicien sans cible conserve une marche ordinaire, même si une caisse se trouve immédiatement derrière lui. Tirer un monstre peut rester fatal après la cascade des mécanismes.

L’absence du Guerrier retire la poussée héroïque de file ; les presses gardent leur capacité héritée à déplacer l’occupant de leur propre case et la file contiguë. Le chant, les appuis, les circuits, les reflets et les contacts simultanés conservent leurs règles.

## Vérifications indépendantes des cartes

| Contrôle exécuté | Résultat | Preuve |
| --- | --- | --- |
| Compilation isolée du moteur SS24 | Réussie | Source compilée utilisée par les tests ci-dessous |
| `node --test --test-reporter=tap tests/quartet.test.mjs tests/monsters.test.mjs` dans le laboratoire | **85/85**, zéro échec ni test ignoré | [engine-fixtures.txt](ss24-evidence/engine-fixtures.txt) |
| Fixtures de `tests/tutorial.test.mjs`, sans les deux parcours d’auteur | **42/42**, zéro échec | [tutorial-fixtures.txt](ss24-evidence/tutorial-fixtures.txt), [tutorial-fixtures-report.json](ss24-evidence/tutorial-fixtures-report.json) |
| `node scripts/verify-ui-dom.mjs --fixtures-only` | Réussi, **42 configurations de rôles** et les contrôles d’animation/commandes | [ui-fixtures.txt](ss24-evidence/ui-fixtures.txt), [ui-fixtures-report.json](ss24-evidence/ui-fixtures-report.json) |
| Test ciblé de l’aide native SS24 | Réussi ; les **37 découvertes** publiques et les identifiants attendus sont présents | [native-help.txt](ss24-evidence/native-help.txt) |
| `npm run typecheck` à la racine | Réussi | [typecheck.txt](ss24-evidence/typecheck.txt) |

Les tests moteur couvrent la traction dans les quatre directions, les refus atomiques, l’eau et les appuis, les relais de poids, le transport des trois partenaires sans pouvoir secondaire, les échanges et virages du Magicien, le rayon revenant, le chant et l’ancrage des appuis, les presses et les combats simultanés. Les cas croisés vérifient notamment le Voleur échangé sans prise arrière, le Magicien tiré sans échange, le Barde extrait sans chant et le Voleur chanté sans entraîner une caisse hors de l’aura.

Les 42 fixtures pédagogiques passent au détecteur des copies JSON contenant uniquement `level`, `frame`, `frames` et `levelsCompleted`. Elles vérifient le nombre de 37 découvertes distinctes et la reconnaissance des quatre formes de héros, y compris face aux boutons verts/violets et aux monstres rouges. `single-pull` exige la présence visible d’une seconde pièce adjacente restée en place ; une traction isolée, une pièce distante ou un appui ne suffisent pas. `release-by-pull` exige de tirer le Barde en laissant une caisse, un monstre ou un appui dans sa portée initiale : tirer un autre partenaire, un Barde isolé ou un Barde proche seulement d’un miroir ne démontre pas cet enseignement. Les déplacements imposés du Voleur ne donnent pas de leçon de traction active, et la marche du Magicien sans cible ne tire pas sa caisse arrière. Aucun changement du détecteur n’a été nécessaire.

Seules ces fixtures pédagogiques ont été exécutées par la commande suivante ; les deux tests du parcours réel N1 restent préparés pour la synchronisation finale :

```sh
node --test --test-reporter=tap --test-skip-pattern='the real first workshop|the complete workshop route' tests/tutorial.test.mjs
```

Le contrôle du HTML utilise **Happy DOM**, le tampon de pixels réellement peint et une file d’animation contrôlée. Il compare les images et les durées, puis contrôle Undo. Il exerce les quatre touches/boutons/clics, Tab et Maj+Tab, les reflets bloqués, les retours de rayon, les commandes interrompues, la défaite, la victoire et la réduction des animations. Ce contrôle est distinct d’une vérification visuelle dans Chrome. Le HTML de ces fixtures porte le SHA256 `cd9ce55a3d3598700dc871a0731fe3deb1c705b1f0d93227c6bd0ce7eb2c37ff` ; cette empreinte intermédiaire sera remplacée par celle du HTML contenant les cartes finales.

## Qualification de campagne à effectuer

Après synchronisation des huit références et témoins définitifs, exécuter les validations des niveaux et du HTML complet, puis les tests natifs. `tests/ss24-native.test.ts` doit comparer chaque observation des huit témoins depuis N1, toutes les images et durées, les sélections et Undo après chaque victoire ; il doit constater 37 découvertes en N1 seulement.

La commande native doit nommer explicitement `tests/custom4-native.test.ts`, que le glob `tests/ss*-native.test.ts` n’inclut pas. Les régressions SS21, SS22 et SS23 doivent préserver leurs campagnes. Les mesures de commandes, images, sélections, découvertes et empreintes seront consignées à partir des rapports réels ; aucun parcours provisoire n’a été rejoué pour qualifier SS24.

Le build final, `npm run test:sic-continuity`, le contrôle Chrome de l’interface native, la sauvegarde GitHub, l’intégration sur `main` et la publication restent à consigner. Les outils d’auteur et les témoins ne sont pas importés dans le jeu livré. Leur rejeu n’établit pas une résolution autonome par SRA et ce lot ne modifie aucun apprentissage, planificateur ni arbitrage SIC.

## Traçabilité

Branche de travail : `feat/sinking-star-ss24-20261126`. Base historique d’ouverture : `7ba57180f543b0954fc98d1f3f1e016c8f161508`, état de SS23 déjà intégré. Les changements SS24 de cette étape sont locaux ; les commits, pushes, intégration et publication sont centralisés par l’agent principal. Aucun checkpoint final SS24 ni version publiée n’est revendiqué ici.

Une reprise inspecte la branche canonique et le Site courants, préserve toute version plus récente et ne traite pas la base historique comme une cible de retour arrière. À la clôture effective de SS24, le programme de création atteindra 24/25 jeux, 192/200 niveaux, soit 96 % ; ce jalon ne mesure pas les capacités de résolution autonome de SRA.
