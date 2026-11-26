# SS23 — intégration native dans SRA Playground

SS23, **Les Chambres de Résonance**, est inscrit après SS22 dans Custom 4. Le quatuor associe le Marchand, le Guerrier, le Magicien et le Barde. L’adaptateur natif utilise directement `experiments/sinking-star-ss23/src/core.ts` et ses niveaux, sans iframe ni Python.

## Raccordements

- `src/games/sinking-star-ss23.ts` adapte ACTION1–ACTION6, Undo, Reset, Restart et le choix de niveau au dispatcher natif. ACTION6 conserve les coordonnées pixels 0–63.
- `src/runtime/native-game-dispatcher.ts` charge cet adaptateur pour SS23 ; le contrat de `browser-games.ts` est conservé : images 64 × 64, palette de 16 couleurs, séquences et durées, état officiel et progression.
- `src/games/catalog.ts` ajoute `ss23-c4000001` à la famille `sinking_star_quartet`, avec huit niveaux, sans changer les entrées précédentes.
- `src/main.ts` importe uniquement les observations pédagogiques publiques et les métadonnées de sources. Les touches 1/2/3/4 correspondent au Marchand/Guerrier/Magicien/Barde ; Tab, les boutons et les clics utilisent la sélection publique. Les quatre destinations sont nécessaires à la victoire.
- `src/games/sinking-star-ss23-help.ts` décrit les quatre pouvoirs et leurs interactions. Les 36 textes de découverte sont construits à partir de `lessonIds` et `lessonPrompt` du laboratoire. Les descriptions des miroirs distinguent le rayon violet du Magicien et le reflet global ; les appuis immergés restent mobiles par le chant.
- `src/styles.css` conserve les boutons de rôle sur deux colonnes, les couleurs de sélection et la typographie lisible des quatuors.
- `scripts/native-game-gallery.mjs` est raccordé à la session SS23. La génération de la galerie attend les huit cartes finales.
- `tests/custom4-native.test.ts` et `scripts/verify-ss01-browser.mjs` attendent SS01 à SS23 dans Custom 4, sans retirer les collections précédentes.

## Validation effectuée à ce stade

Le contrôle TypeScript `npm run typecheck` est passé. Sa sortie originale est enregistrée dans `docs/migration/ss23-evidence/typecheck.txt`.

Les 81 tests moteur et monstres ont réussi. Ils conservent les protections du Barde et des appuis de SS22, la poussée atomique des files du Guerrier, les cibles et virages du Magicien, les échanges sans pouvoir passif, le combat simultané et le rayon revenant avec Undo. Sortie : `docs/migration/ss23-evidence/engine-fixtures.txt`.

Les 31 tests pédagogiques indépendants de la carte finale ont réussi. Ils distinguent notamment la marche et l’échange adjacents du Magicien, le Barde échangé d’un Barde chantant, le Magicien chanté d’un lanceur actif, le Guerrier des monstres et le Magicien des boutons violets. Sortie : `docs/migration/ss23-evidence/tutorial-fixtures.txt`. Les deux tests du parcours réel N1 ont ensuite réussi : 221 commandes conduisent à `WIN` avec les 36 découvertes, et le même parcours placé au niveau 2 n’attribue aucune découverte. Leur sortie est conservée dans `docs/migration/ss23-evidence/tutorial-route.txt`. Le total des tests pédagogiques exécutés est donc de 33.

Le contrôle DOM du HTML compilé a réussi avec `--fixtures-only`. Il vérifie 34 configurations de rôles, les échanges et rayons revenants, les reflets bloqués, les pixels et durées, la sélection des quatre héros, les commandes interrompues, la défaite, la victoire et le mode de réduction des animations. Ce résultat ne porte pas encore sur les huit salles finales. Le rapport est conservé dans `docs/migration/ss23-evidence/ui-fixtures-report.json`.

L’aide native expose exactement les 36 découvertes et ses identifiants attendus ; son test ciblé a réussi (`docs/migration/ss23-evidence/native-help.txt`).

## Contrôles préparés et qualification en attente

`tests/ss23-native.test.ts` compare chaque observation des huit témoins depuis le niveau 1 à la session du laboratoire, par l’adaptateur direct et le dispatcher. Il couvre les images intermédiaires, leurs durées, les sélections, les transitions et Undo sur chacune des huit victoires. Il exige les 36 découvertes au niveau 1 et aucune acquisition dans une autre salle.

Les validateurs du laboratoire contrôlent le contrat MWZB, les causes physiques des déplacements, les références, le HTML et la présence de 36 découvertes. Le contrôle DOM ajoute les échanges, les rayons revenants, les appuis mobiles et les commandes du quatuor. La qualification complète reste en attente de la synchronisation des huit cartes et témoins ; aucune réussite complète de campagne, de build final ou de navigateur n’est annoncée à ce stade.

Avant intégration : exécuter les tests natifs avec `tests/custom4-native.test.ts` explicitement (ce fichier n’est pas couvert par le glob `tests/ss*-native.test.ts`), le contrôle DOM complet, le build et `npm run test:sic-continuity`. Les résultats et mesures réels remplaceront cette section après leur exécution.

## Portée et livraison

Les témoins et outils d’auteur servent à créer et valider les niveaux ; ils ne sont pas importés par le jeu livré. Leur rejeu n’établit pas une résolution autonome par SRA. Aucun apprentissage, raisonnement, planificateur ou arbitrage SIC n’est modifié.

Branche de travail : `feat/sinking-star-ss23-20261126`. Base canonique : `0ca0ec0235ba455af2e9600a7019044d1e9957f6` (SS22, Site 195). Les commits, pushes, intégration sur main et publication sont centralisés par l’agent principal ; cette base ne constitue pas un checkpoint final SS23.
