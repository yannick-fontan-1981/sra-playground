# SS23 — intégration native dans SRA Playground

SS23, **Les Chambres de Résonance**, est inscrit après SS22 dans Custom 4. Le quatuor associe le Marchand, le Guerrier, le Magicien et le Barde. L’adaptateur natif utilise directement `experiments/sinking-star-ss23/src/core.ts` et ses niveaux, sans iframe ni Python.

## Raccordements

- `src/games/sinking-star-ss23.ts` adapte ACTION1–ACTION6, Undo, Reset, Restart et le choix de niveau au dispatcher natif. ACTION6 conserve les coordonnées pixels 0–63.
- `src/runtime/native-game-dispatcher.ts` charge cet adaptateur pour SS23 ; le contrat de `browser-games.ts` est conservé : images 64 × 64, palette de 16 couleurs, séquences et durées, état officiel et progression.
- `src/games/catalog.ts` ajoute `ss23-c4000001` à la famille `sinking_star_quartet`, avec huit niveaux, sans changer les entrées précédentes.
- `src/main.ts` importe uniquement les observations pédagogiques publiques et les métadonnées de sources. Les touches 1/2/3/4 correspondent au Marchand/Guerrier/Magicien/Barde ; Tab, les boutons et les clics utilisent la sélection publique. Les quatre destinations sont nécessaires à la victoire.
- `src/games/sinking-star-ss23-help.ts` décrit les quatre pouvoirs et leurs interactions. Les 36 textes de découverte sont construits à partir de `lessonIds` et `lessonPrompt` du laboratoire. Les descriptions des miroirs distinguent le rayon violet du Magicien et le reflet global ; les appuis immergés restent mobiles par le chant.
- `src/styles.css` conserve les boutons de rôle sur deux colonnes, les couleurs de sélection et la typographie lisible des quatuors.
- `scripts/native-game-gallery.mjs` est raccordé à la session SS23. Le build a généré la galerie depuis les cartes définitives : 123 jeux et 820 aperçus de niveaux.
- `tests/custom4-native.test.ts` et `scripts/verify-ss01-browser.mjs` attendent SS01 à SS23 dans Custom 4, sans retirer les collections précédentes.

## Huit cartes définitives et observations exactes

Les cartes expédiées correspondent aux huit références JSON et à leurs témoins. `scripts/validate-levels.mjs` a terminé avec succès, sans refus ni mort. `tests/ss23-native.test.ts` a comparé chaque observation depuis N1 à la session du laboratoire, par l’adaptateur direct et le dispatcher. Les contrôles portent sur toutes les images intermédiaires, leurs durées, les sélections, les transitions et Undo sur chacune des huit victoires.

| Salle | Commandes | Sélections incluses | Images publiques |
| --- | ---: | ---: | ---: |
| 1. Le conservatoire des échanges | 221 | 34 | 612 |
| 2. La grille des places libres | 91 | 12 | 250 |
| 3. La case de trop | 43 | 12 | 106 |
| 4. Le poste emprunté | 132 | 17 | 363 |
| 5. Les deux côtés du sort | 50 | 16 | 124 |
| 6. Le poste derrière la file | 126 | 28 | 328 |
| 7. Le pas qui laisse un appui | 172 | 33 | 459 |
| 8. La forme et la place vide | 112 | 21 | 295 |
| **Total** | **947** | **173** | **2 537** |

Le résultat officiel final est `WIN`. Les **36 découvertes** sont acquises sur les 221 commandes de N1 ; aucune autre salle n’en attribue. Les rapports [levels-report.json](ss23-evidence/levels-report.json) et [native-tests.txt](ss23-evidence/native-tests.txt) consignent les mesures, les contrôles et, pour les cartes et observations, les empreintes SHA256. Les totaux incluent les sélections et ne revendiquent pas l’optimalité.

## Tests, HTML, build et continuité

| Contrôle exécuté | Résultat | Preuve originale |
| --- | --- | --- |
| `npm test` dans le laboratoire | **114/114**, zéro échec ni test ignoré | [lab-tests.txt](ss23-evidence/lab-tests.txt) ; copies `validation/unit-tests.txt` et `unit-tests.json` dans le laboratoire |
| `node scripts/validate-levels.mjs` | **8/8**, 947 commandes, zéro refus/mort, toutes les fins annulées et rejouées | [levels-validation.txt](ss23-evidence/levels-validation.txt), [levels-report.json](ss23-evidence/levels-report.json) |
| `node scripts/verify-ui-dom.mjs` | HTML compilé : 34 configurations de rôles et **8/8 salles** avec pixels/durées exacts | [ui-dom.txt](ss23-evidence/ui-dom.txt), [ui-dom-report.json](ss23-evidence/ui-dom-report.json) |
| Tests natifs Custom 4 + SS21 + SS22 + SS23 | **94/94**, zéro échec ni test ignoré | [native-tests.txt](ss23-evidence/native-tests.txt) |
| `npm run typecheck` | Réussi | [typecheck.txt](ss23-evidence/typecheck.txt) |
| `npm run build` à la racine | Réussi ; galerie de 123 jeux / 820 aperçus | [site-build.txt](ss23-evidence/site-build.txt) |
| `npm run test:sic-continuity` | Exit 0, contrat des **41 niveaux protégés** préservé | [sic-continuity.txt](ss23-evidence/sic-continuity.txt) |

Les 114 tests comprennent 81 contrats moteur/monstres et 33 cas pédagogiques. Ils conservent les protections du Barde et des appuis de SS22, la poussée atomique du Guerrier, les cibles et virages du Magicien, les transports sans pouvoir passif, le combat simultané et le rayon revenant avec Undo. Ils distinguent la marche d’un échange adjacent, le Barde échangé d’un Barde chantant, le Magicien chanté d’un lanceur actif, le Guerrier des monstres et le Magicien des boutons violets. Le parcours réel N1 placé artificiellement au niveau 2 n’attribue aucune découverte.

La revue indépendante de N5 a fermé un raccourci d’ouverture par ACTION5 qui supprimait les gardiens. La correction porte sur sa carte et son témoin, désormais de 50 commandes. La validation des niveaux, le contrôle DOM complet et les 94 tests natifs ont été réexécutés avec succès sur cette version ; les mesures de campagne et l’empreinte du HTML correspondent à ce nouveau rejeu. Les résultats des 114 tests moteur/pédagogie et de SIC sont réutilisés : le moteur, le tutoriel, N1, les tests concernés et le contrat des niveaux protégés n’ont pas changé.

Les 94 tests natifs ont été exécutés par la commande suivante :

```sh
node --test --test-reporter=tap tests/custom4-native.test.ts tests/ss21-native.test.ts tests/ss22-native.test.ts tests/ss23-native.test.ts
```

Le fichier Custom 4 est nommé explicitement car le glob `tests/ss*-native.test.ts` ne l’inclut pas. Ces tests vérifient également les commandes et chargements invalides, les quatre sélections, Undo, Reset, Restart et l’aide native avec ses 36 identifiants. SS21 et SS22 conservent leurs campagnes et leurs découvertes respectives.

Le contrôle DOM utilise **Happy DOM**, le HTML autonome compilé, son tampon de pixels et une file d’animation contrôlée. Il couvre le chant, les échanges, les retours de rayon, les reflets bloqués, les appuis, les quatre touches/boutons/clics, les interruptions, les aides, les liens, la défaite, la victoire et la réduction des animations. Il termine les huit salles, annule puis rejoue chaque fin. Le HTML testé porte le SHA256 **`2c3d7cf83a71a82860376809f318583738adcd041f4e33ff368d81b0a7d9d5ce`**.

Le parcours natif a ensuite été reproduit dans **Chrome, mode Manual, depuis un redémarrage propre N1 jusqu’à N8**. Les 947 entrées passent par les flèches, Tab et X de l’interface. Les huit confirmations de salle et les transitions sont observées ; N1 atteint 36/36 découvertes. Le panneau final visible annonce **« VICTORY · Les quatre destinations sont occupées »**. Le [rapport Chrome](ss23-evidence/chrome-manual-report.json) conserve ces résultats et les empreintes des sources ; il n’appelle aucune interface privée du moteur et n’injecte aucun état.

Le build signale l’avertissement habituel sur la taille de certains bundles ; il termine avec succès. Le contrôle SIC porte sur les niveaux protégés existants et ne qualifie pas une résolution autonome de SS23. Les preuves intermédiaires des fixtures restent disponibles, mais les résultats de campagne ci-dessus reposent sur les huit cartes définitives.

## Portée et livraison

Les témoins et outils d’auteur servent à créer et valider les niveaux ; ils ne sont pas importés par le jeu livré. Leur rejeu n’établit pas une résolution autonome par SRA. Aucun apprentissage, raisonnement, planificateur ou arbitrage SIC n’est modifié.

Branche de travail : `feat/sinking-star-ss23-20261126`. Une sauvegarde intermédiaire a été poussée et vérifiée sur GitHub au SHA **`ee6880f27f2e9f36c7606dae011820e6322d781b`**. La [PR 127](https://github.com/yannick-fontan-1981/sra-playground/pull/127) suit l’intégration sur `main` et conserve le relevé de publication : SHA intégré, version du Site et SHA source vérifié. Le [dossier de validation](../../experiments/sinking-star-ss23/docs/validation.md) et son manifeste identifient les octets qualifiés.

La base `0ca0ec0235ba455af2e9600a7019044d1e9957f6` et le Site 195 désignent l’état historique de SS22 à l’ouverture du chantier. Une reprise inspecte GitHub et le Site actuels ; ces repères ne sont pas des cibles de retour arrière.
