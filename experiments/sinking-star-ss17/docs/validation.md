# SS17 — qualification de la version 0.1.0

La qualification porte sur les huit cartes finales, y compris le verrou de retrait hydraulique du niveau 6 et le verrou de libération de l’alcôve du niveau 8. Les rapports sont produits depuis les sources et le HTML livrés.

## Résultats

| Contrôle | Résultat |
|---|---|
| Compilation TypeScript stricte et construction autonome | Réussies |
| Tests moteur, session et outils | **53 / 53**, zéro échec, zéro test ignoré |
| Campagne de référence | **8 / 8**, résultat final **WIN** |
| Entrées rejouées | **1 466**, dont **152 sélections** |
| Coups comptés par l’interface | **1 314** |
| Images et durées contrôlées | **4 179 images** |
| Refus / pertes dans les huit références | **0 / 0** |
| Découvertes du tutoriel | **23 / 23**, observées dans le niveau 1 |
| Scénarios ciblés dans le HTML compilé | **35** : 22 rôles, 3 reflets, 1 boucle, 2 glyphes, 7 alertes miroir |
| Campagne dans le HTML compilé | **8 / 8**, pixels, durées, annulation et rejeu de chaque fin de salle |
| Revues d’auteur et indépendantes exécutées | **6 scripts**, tous réussis |
| Marche dans la géométrie initiale fixe | **24 graphes épuisés**, 2 309 positions et 9 236 transitions, aucune destination atteinte |

Commandes exécutées :

```sh
npm test
node scripts/validate-levels.mjs
node scripts/verify-ui-dom.mjs
node scripts/verify-design-constraints.mjs
```

Les commandes npm équivalentes sont `npm run validate`, `npm run validate:ui` et `npm run validate:design`. Le dernier contrôle exécute les six revues, dont les variantes gagnantes et les deux anciens raccourcis corrigés.

## Parcours vérifiés

| Salle | Entrées avec sélections | Coups affichés | Images |
|---|---:|---:|---:|
| 1 — Les trois cours de la forteresse | 120 | 100 | 331 |
| 2 — Les cellules de relève | 115 | 98 | 317 |
| 3 — Le compte des îles | 129 | 115 | 361 |
| 4 — Le miroir, puis le lest | 76 | 65 | 208 |
| 5 — La relève à angle droit | 241 | 225 | 714 |
| 6 — Les deux emplois des miroirs | 170 | 154 | 491 |
| 7 — Les trois vies de la clef | 410 | 379 | 1182 |
| 8 — La forteresse aux deux visées | 205 | 178 | 575 |

## Contrôles visuels et d’interface

Les boutons ont un fond gris opaque, un plus rose et le pixel du circuit au centre. Les presses pures ont le centre noir lorsqu’elles sont fermées et gris lorsqu’elles sont ouvertes. La campagne ne superpose aucun bouton à une presse. Les images publiques distinguent les trois héros et conservent les prévisions de reflet sous les occupants.

L’alerte de la vraie salle 8 est rejouée après cinq entrées du témoin. Les deux dos impliqués clignotent en rouge sans modifier leurs diagonales blanches : **110 / 70 / 110 / 0 ms**. Seuls six pixels noirs deviennent rouges sur chacune des images d’alerte. Répéter l’avertissement n’ajoute pas d’entrée Annuler. Les fixtures couvrent aussi les murs, presses fermées, conflits, miroirs non concernés et animations réduites.

Une boucle à quatre miroirs éclaire les segments puis fait clignoter le Magicien sur place pendant neuf images. Elle ne déplace pas les occupants et n’attribue pas une découverte de transposition réussie. Les commandes ordinaires restent verrouillées pendant la lecture ; Annuler, Recommencer et le changement de salle invalident les anciens callbacks. Les panneaux terminaux attendent la dernière image.

Les plateaux initiaux et les phases d’alerte font l’objet d’une inspection de rendus déterministes. Le contrôle interactif utilise Happy DOM, le véritable HTML compilé, son tampon canvas et une file de temporisations contrôlée. **Il ne constitue pas une revue du CSS dans un navigateur natif, ni une vérification de publication du Site.**

## Revues de conception et limites

Les graphes de marche initiaux conservent les ressources, les autres héros et l’état des circuits fixes. Leur épuisement exclut un accès immédiat aux destinations dans ce modèle ; il ne prouve pas l’impossibilité de toute stratégie coordonnée. La revue du tutoriel ajoute des recherches de marche réelle par rôle et un graphe encore plus permissif, portes ouvertes et occupants ignorés.

Les variantes validées demeurent acceptées : niveau 1 en 130 entrées ; niveau 5 en 215 ou 257 ; niveau 6 corrigé en 214 ; niveau 7 en 366. Leurs étapes peuvent éviter certaines utilisations du pont ou des miroirs du témoin principal. Elles ne sont pas présentées comme optimales.

Le niveau 6 rejette au tour 133 l’ancienne solution de 170 entrées qui maintenait le soutien actif jusqu’aux sorties. Le nouveau verrou supérieur exige son retrait. La variante avancée de 214 entrées utilise le gardien comme contrepoids et plusieurs échanges supplémentaires. La presse finale du Voleur reste contrôlée sur ses six images et son annulation.

Le niveau 8 rejette l’ancien parcours de 156 entrées qui ignorait la clef isolée : le sas cyan reste fermé tant que l’alcôve est occupée. La référence de 205 entrées conserve quatre échanges, trois reflets et quatre appuis. La correction autorise toute autre manière valable de libérer l’alcôve.

Les contre-branches sont des expériences locales rejouées, pas des preuves de nécessité globale. Aucun minimum de coups, aucune unicité de solution et aucune réussite autonome de SRA ne sont revendiqués. Les témoins et les outils d’analyse sont exclus du HTML.

## Empreinte de livraison

HTML autonome : **132 606 octets**. SHA-256 :

```text
c4a64aa85609c6a37683f5a74d8bb56a044f08bfd56f8ace6aad698da5975311
```

Le fichier est construit dans `dist/SS17-demo.html` puis livré sans changement de contenu sous le nom `SS17-demo.html`. `validation/delivery.json` conserve cette empreinte.
