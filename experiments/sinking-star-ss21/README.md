# SS21 — Les Quatre Destinations

Laboratoire autonome **0.1.0**, huit salles pour **Marchand / Guerrier / Voleur / Magicien**. Le Marchand ouvre la campagne ; le niveau 1, **L’école des quatre**, porte **31 découvertes** observées depuis les pixels publics.

Les huit cartes et leurs témoins gagnants sont présents dans `reference/`. Ce checkpoint sauvegarde le moteur, l’interface, les cartes et le tutoriel pendant la qualification complète. Les revues de conception, les rapports finaux et la documentation de livraison sont complétés dans la même branche.

## Exécuter le laboratoire

Avec Node 24 et les dépendances déclarées :

```sh
npm ci
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

`npm run build` produit `dist/SS21-demo.html`, autonome et jouable sans réseau. Les témoins d’auteur et le solveur ne sont pas inclus dans ce HTML.

## Sauvegarde

Le dépôt canonique est `yannick-fontan-1981/sra-playground`. Cette livraison est développée sur `feat/sinking-star-ss21-20261124`, depuis main après l’intégration native de SS20 (PR #124). L’intégration native et la publication de SS21 constituent une phase distincte, à qualifier depuis le main courant.
