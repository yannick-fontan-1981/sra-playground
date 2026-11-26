# SS24 — intégration native dans SRA Playground

**SS24 — Les Voies de Traverse** est raccordé après SS23 dans Custom 4. Le quatuor est **Marchand / Voleur / Magicien / Barde**, sans Guerrier. L’adaptateur utilise directement le moteur TypeScript du laboratoire, sans iframe ni Python.

Les huit cartes finales et leurs témoins sont synchronisés. La campagne est vérifiée par **98 tests natifs**, les revues locales et une exécution indépendante des **1 051 entrées** d’auteur. N1 expose **37 découvertes par les observations publiques**. Le rejeu Chrome Manual N1→N8, le build et les 41 niveaux protégés de SIC ont également réussi. La traçabilité GitHub/Site est conservée dans le reçu de publication de la PR 128 ; ces preuves de jouabilité ne constituent pas une qualification de résolution autonome SRA.

## Raccordements réalisés

| Fichier | Rôle |
| --- | --- |
| `src/games/sinking-star-ss24.ts` | Adapte ACTION1–ACTION6, Undo, Reset, Restart et choix de niveau à `QuartetPuzzleSession` et `SS24_LEVELS` ; contrôle les coordonnées pixels 0–63 et les chargements invalides avant d’accepter une nouvelle session |
| `src/runtime/native-game-dispatcher.ts` | Charge SS24 nativement et conserve le contrat public de `browser-games.ts` |
| `src/games/catalog.ts` | Ajoute `ss24-c4000001`, famille `sinking_star_quartet`, huit niveaux et source du laboratoire SS24, après SS23 |
| `src/main.ts` | Raccorde les quatre rôles, les observations pédagogiques, les feedbacks, les aides, les sources, les commandes, les animations interrompues et la réduction des animations |
| `src/games/sinking-star-ss24-help.ts` | Expose les quatre capacités et les 37 prompts publics, issus de `lessonIds` et `lessonPrompt` ; nomme N1 « L’atelier des départs » |
| `src/styles.css` | Conserve les boutons sur deux colonnes, les quatre couleurs et la typographie lisible des quatuors |
| `scripts/native-game-gallery.mjs` | Raccorde la session SS24 ; la galerie finale est générée par le build racine à partir des huit cartes synchronisées |
| `tests/custom4-native.test.ts`, `scripts/verify-ss01-browser.mjs` | Attendent SS01 à SS24 dans Custom 4 sans retirer de jeu existant |
| `tests/ss24-native.test.ts` | Compare les huit parcours complets laboratoire/adaptateur/dispatcher, les transitions, Undo, les sélections et l’aide native |

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

Le premier lot de fixtures pédagogiques a été exécuté séparément des deux tests du parcours d’auteur, par la commande suivante. La revue du N1 final, décrite ci-dessous, vérifie ensuite les 37 découvertes sur sa carte réelle :

```sh
node --test --test-reporter=tap --test-skip-pattern='the real first workshop|the complete workshop route' tests/tutorial.test.mjs
```

Le contrôle du HTML utilise **Happy DOM**, le tampon de pixels réellement peint et une file d’animation contrôlée. Il compare les images et les durées, puis contrôle Undo. Il exerce les quatre touches/boutons/clics, Tab et Maj+Tab, les reflets bloqués, les retours de rayon, les commandes interrompues, la défaite, la victoire et la réduction des animations. Ce contrôle est distinct d’une vérification visuelle dans Chrome. L’empreinte du premier HTML de fixtures figure dans son rapport ; elle ne doit pas être confondue avec celle du HTML final contenant les huit cartes.

## Campagne finale vérifiée

| Niveau | Salle | Entrées | Sélections incluses |
| --- | --- | ---: | ---: |
| N1 | L’atelier des départs | 212 | 38 |
| N2 | L’escalier à rebours | 154 | 36 |
| N3 | Les tiroirs décalés | 118 | 21 |
| N4 | Le pas et la visée | 85 | 21 |
| N5 | Le relais interrompu | 127 | 21 |
| N6 | Trois postes, un seul retour | 122 | 15 |
| N7 | La place qui restera sûre | 92 | 11 |
| N8 | Le dernier pas sans échange | 141 | 13 |
| **Total** | **Huit victoires** | **1 051** | **176** |

Ces nombres décrivent les témoins livrés, sélections comprises. Ils ne sont ni des minima ni une mesure de difficulté. Les huit parcours terminent avec quatre héros vivants sur quatre buts, sans entrée refusée ni décès. Les empreintes de chaque carte et de ses actions numériques figurent dans le [rapport indépendant](../../experiments/sinking-star-ss24/reference/independent-ss24-review.json).

La commande native finale, exécutée après la synchronisation de N5 à 127 entrées et N8 à 141, est :

```sh
node --test --test-reporter=tap tests/ss24-native.test.ts tests/custom4-native.test.ts tests/ss21-native.test.ts tests/ss22-native.test.ts tests/ss23-native.test.ts
```

Résultat : **98/98 tests, exit 0**, zéro échec, annulation ou test ignoré. Preuves : [native-tests.txt](ss24-evidence/native-tests.txt) et [native-tests-report.json](ss24-evidence/native-tests-report.json). Le test SS24 compare chaque observation des huit témoins depuis N1, les **2 875 images** produites et leurs durées, les 176 sélections, les passages de niveau et Undo après les victoires. Les 37 découvertes sont acquises en N1 seulement. Les requêtes invalides restent atomiques ; les contrôles Reset, Restart et changement de niveau sont conservés. Custom 4 et les régressions SS21, SS22 et SS23 passent dans la même exécution.

| Revue de conception exécutée | Résultat | Preuve |
| --- | --- | --- |
| `reference/author/review-intro-ss24.mjs` | **13 contrôles**, N1 en 212 entrées, **37/37 découvertes**, 574 images publiques et Undo final exact | [intro-ss24-review.json](../../experiments/sinking-star-ss24/reference/intro-ss24-review.json) |
| `reference/author/review-level2-ss24.mjs` | **9 contrôles**, N2 en 154 entrées et variante gagnante sans chant en 180 | [level2-ss24-review.json](../../experiments/sinking-star-ss24/reference/level2-ss24-review.json) |
| `reference/author/independent-review-ss24.mjs` | **8 niveaux, 17 contrôles, 6 pistes de raccourci ou variantes examinées** | [independent-ss24-review.json](../../experiments/sinking-star-ss24/reference/independent-ss24-review.json) |

La revue indépendante exécute directement les actions numériques avec `stepDetailed`, sans importer `Author`, le solveur ou son outil de rejeu. Elle vérifie les destinations, les ressources conservées, les transports autorisés par chaque rôle, l’absence de transport des appuis par la traction, les déplacements de monstres et l’ancrage des appuis occupés. Elle compare également les positions et circuits consignés à chaque étape avec les états réellement obtenus.

N1 possède deux portes du circuit `relai` : quitter la commande initiale sans y laisser la caisse ferme les passages inférieur et droit. La traction unique assure cette relève tout en laissant la seconde caisse alignée en place. La revue des marches seules, autres acteurs figés, ne donne aucun but accessible au Voleur ni au Barde ; elle ne prétend pas explorer toutes les coopérations possibles.

Les variantes restent explicitement documentées. Dans N2, le Marchand peut ranger le dernier bloc par poussée : cette route de 180 entrées omet le chant à travers la cloison, mais conserve la charge, le passage et les transports silencieux. Dans N5, tirer le Magicien hors de la commande provoque aussi la rupture préparée ; le chant n’est donc pas présenté comme le seul déclencheur possible. Dans N8, **échanger puis chanter la caisse** gagne en **137 entrées**, contre 141 pour le témoin qui chante le Magicien puis échange. Les dépôts, le miroir, la case hydraulique et le chant restent présents, mais le transport chanté du Magicien n’est pas globalement nécessaire. Une sélection redondante a été omise dans cette variante.

Les contre-branches confirment aussi deux contraintes différentes : livrer trop tôt dans N6 ferme le couloir de retour du miroir ; dans N7, trois stationnements précis sont détruits par les commandes que la charge doit traverser. Ces résultats locaux ne sont pas transformés en affirmations d’impasse définitive ou de solution unique.

## Clôture de qualification

Les **129 tests** du laboratoire, le rejeu des huit niveaux, les **42 configurations de rôles et huit parcours HTML**, les cinq revues (92 contrôles) et le manifeste final ont réussi. Le HTML autonome mesure 153 039 octets, SHA-256 `1871dfedeffe3e5992b260bb75733c724ca60605b63ecda957f2523ec3d169b7`. La [validation du laboratoire](../../experiments/sinking-star-ss24/docs/validation.md) fournit les liens et la portée de chaque preuve.

Le build racine réussit avec TypeScript, **124 jeux et 828 aperçus** : [build.txt](ss24-evidence/build.txt). Le contrôle de continuité SIC a produit sa table finale des **41 niveaux protégés**, après toutes les assertions de séries et d’effets physiques : [rapport](ss24-evidence/sic-continuity-report.json), [log](ss24-evidence/sic-continuity.txt). Aucun apprentissage, planificateur ou arbitrage SIC n’est modifié.

Le [rejeu Chrome](ss24-evidence/chrome-manual-report.json) utilise l’interface native en **Manual depuis N1**, dans une seule session. Les huit transitions sont observées, **37/37 découvertes** sont acquises au premier niveau, puis le panneau **VICTORY · Les quatre destinations sont occupées** apparaît à la fin de N8. L’annulation du dernier geste masque ce panneau ; sa reprise le rétablit. Les commandes de ces deux vérifications sont séparées des 1 051 entrées du témoin. Le contrôle du navigateur porte sur l’aperçu natif ; la publication et son SHA sont vérifiés séparément.

Les outils d’auteur et les témoins sont absents du jeu expédié. Ces preuves de jouabilité ne qualifient pas une résolution autonome de SS24 par SRA.

## Traçabilité GitHub et Site

Branche : `feat/sinking-star-ss24-20261126`. Base historique : `7ba57180f543b0954fc98d1f3f1e016c8f161508`, SS23 déjà intégré. Premier checkpoint SS24 poussé : `bcb3e0828472e0cee9cc6de31a7a4945ccd01951`, antérieur aux cartes et preuves finales.

La [PR 128](https://github.com/yannick-fontan-1981/sra-playground/pull/128) conserve le reçu final : commit local, SHA poussé, commit intégré sur `main`, version Site et SHA source de la publication. La chaîne reste travail → tests → commit → push GitHub → intégration canonique → publication → contrôle de concordance. Les accès du Site sont conservés.

La création qualifiée de SS24 porte le programme à **24/25 jeux, 192/200 niveaux, 96 %** ; sa clôture de livraison est attestée par le reçu de la PR. **SS25 — Guerrier / Voleur / Magicien / Barde** reste à créer. Une reprise inspecte l’état canonique courant et conserve les campagnes plus récentes.
