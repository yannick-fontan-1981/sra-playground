# SS21 — intégration native dans SRA Playground

SS21, **Les Quatre Destinations**, est le vingt-et-unième jeu de Custom 4. Les huit salles utilisent le laboratoire TypeScript `experiments/sinking-star-ss21` sans copie du moteur, sans iframe et sans Python pour ce jeu.

## Raccordements

- `src/games/sinking-star-ss21.ts` adapte les six commandes publiques, Undo, Reset, Restart et le choix de niveau au contrat du dispatcher.
- `src/runtime/native-game-dispatcher.ts` charge cet adaptateur pour SS21. Le format de `browser-games.ts` reste inchangé : images 64 × 64, palette de 16 couleurs, séquences et durées d’animation.
- `src/games/catalog.ts` place le jeu dans Custom 4, famille `sinking_star_quartet`.
- `src/main.ts` réutilise directement les détecteurs pédagogiques publics et les métadonnées de sources du laboratoire. Les quatre rôles sont Marchand, Guerrier, Voleur, Magicien, dans cet ordre. Les touches 1 à 4, Tab, le clic sur le plateau et les quatre boutons sélectionnent un héros via ACTION6 en coordonnées pixels.
- `src/games/sinking-star-ss21-help.ts` conserve les 31 découvertes et les explications du laboratoire dans le panneau natif. Les aides de presses, plateformes et monstres sont contextuelles. L’appui immergé est fixe ; aucun Barde ni pouvoir de chant n’est ajouté.
- `scripts/native-game-gallery.mjs` produit les huit vignettes depuis les observations réelles du moteur.

## Contrôles d’intégration

Vérifiés le 24 novembre 2026 : `npm run typecheck` réussi ; `node --test tests/ss21-native.test.ts tests/custom4-native.test.ts` réussi, **86 tests sur 86**. Ce contrôle couvre la nouvelle intégration et les campagnes natives SS01–SS20 existantes. La vérification visuelle dans le navigateur est un contrôle distinct du rejeu ci-dessous.

`tests/ss21-native.test.ts` compare chaque observation des huit témoins depuis le niveau 1 avec la session du laboratoire, aussi bien via l’adaptateur direct que via le dispatcher. Les comparaisons comprennent toutes les images intermédiaires, leurs durées, les transitions, la sélection, l’annulation des huit fins de niveaux et le WIN final. Les tests supplémentaires contrôlent les entrées invalides, les quatre sélections, le rayon bouclé et les éléments nécessaires au panneau d’aide.

Parcours de référence : 260 / 143 / 103 / 182 / 224 / 202 / 153 / 219 commandes publiques, dont 208 sélections sur 1 486 commandes au total. Le tutoriel obtient 31 découvertes uniquement au niveau 1. Les témoins et les outils d’auteur ne sont importés que par les tests, jamais par l’application.

Ces témoins établissent la jouabilité et l’équivalence de l’intégration native. Ils ne constituent pas une résolution autonome par SRA. Aucun mécanisme d’apprentissage, de planification ou d’arbitrage SIC n’est modifié. La qualification de continuité SIC et la compilation finale sont exécutées avant intégration et publication ; la version Site et les SHA sont consignés dans le compte rendu de livraison.

## Qualification finale

Le contrôle obligatoire `npm run test:sic-continuity` a réussi sur ses huit jeux protégés et ses 41 niveaux. `npm run build` a réussi. La campagne manuelle a été reproduite dans Chrome par les boutons et touches de l’interface native, du niveau 1 jusqu’à **VICTORY**, avec les 1 486 commandes des témoins et les 31 découvertes. La dernière victoire a été annulée puis reproduite. Les huit étapes correspondent à 260 / 143 / 103 / 182 / 224 / 202 / 153 / 219 entrées ; hors sélection : 234 / 113 / 93 / 160 / 190 / 180 / 121 / 187.

Les preuves sont `docs/migration/ss21-evidence/browser-campaign.json` et `sic-continuity.txt`. La revue visuelle a été faite sur ordinateur ; le viewport mobile n’a pas été exercé dans cette session. Les styles des quatre commandes sont néanmoins adaptés aux deux colonnes tactiles existantes.
