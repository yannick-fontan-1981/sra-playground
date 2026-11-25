# SS21 — qualification du laboratoire 0.1.0

**Les Quatre Destinations** comporte huit salles pour Marchand, Guerrier, Voleur et Magicien. Le laboratoire est qualifié : **103 tests réussis, huit victoires depuis N1, 31/31 découvertes, 68 contrôles de conception et 1 486 commandes publiques sans refus ni perte**. Ces résultats sont distincts de la qualification native et de la publication du Site.

## Reproduction

Avec Node ≥ 22, TypeScript 5.9.3 et Happy DOM 21.0.4 :

```sh
npm ci
npm test
npm run validate
npm run validate:ui
npm run validate:design
```

`npm run build` produit `dist/SS21-demo.html`. `scripts/package-delivery.mjs` lie cet HTML aux rapports réussis. Les tests unitaires et leur sortie sont conservés dans `validation/unit-tests.json` et `validation/unit-tests.txt`.

## Identité du fichier livré

- HTML autonome : **140,256 octets** ; aucune connexion nécessaire pour jouer.
- SHA-256 : `b4f720f6eda4412319235e8a2cfec97d7ad86d94e513179712705f9107884ee3`.
- Le HTML n’embarque ni témoins d’auteur, ni solveur, ni commandes de solution.
- Les rapports de campagne et d’interface portent la même empreinte que le manifeste de livraison.

## Huit témoins gagnants

| Niveau | Titre | Entrées | Sélections | Actions physiques | Images |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | L’école des quatre | 260 | 26 | 234 | 742 |
| 2 | Trois caisses, deux chambres | 143 | 30 | 113 | 371 |
| 3 | Les quatre balcons | 103 | 10 | 93 | 290 |
| 4 | Le rectangle sans issue | 182 | 22 | 160 | 515 |
| 5 | Le dernier intercepteur | 224 | 34 | 190 | 606 |
| 6 | Le compte des îlots | 202 | 22 | 180 | 574 |
| 7 | L’écluse à deux étages | 153 | 32 | 121 | 417 |
| 8 | Le verrou à trois poids | 219 | 32 | 187 | 613 |
| **Total** | | **1 486** | **208** | **1 278** | **4 128** |

Le résultat officiel de la campagne est `WIN`, avec huit salles achevées. Chaque témoin se termine sans refus ni perte. Chaque transition de victoire est annulée et rejouée. Les comptes incluent les sélections ACTION6 et les démonstrations facultatives du tutoriel ; ils ne sont pas des records, des minima ou des conditions de victoire.

Le tutoriel observe uniquement les images publiques. Il acquiert les **31 découvertes au niveau 1** et n’en attribue aucune dans les salles suivantes. Les tests distinguent poussée simple, file mixte, traction simple, transport d’un partenaire, échange avec la première cible, rayon dévié, appui permanent, presses et contacts.

## Revues de conception

| Revue | Contrôles réussis | Portée |
| --- | ---: | --- |
| Introduction, N1–N2 | 14 | Quatre rôles, rencontre commandée, chambres isolées et remplacement des prisonniers. |
| Milieu, N3–N5 | 22 | Quatre stations du miroir, balcons isolés, rayon bouclé, injection de cible et relèves de commandes. |
| Finale, N6–N8 | 16 | Comptabilité des caisses, écluse permanente, gardien maintenu et extraction optique. |
| Indépendante, N1–N8 | 16 | Rejeu direct des actions avec `stepDetailed`, sans l’auteur ni le solveur ; causalité particulière et quatrième destination. |
| **Total** | **68** | Conclusions limitées aux faits effectivement vérifiés. |

Les rapports sont `reference/intro-ss21-review.json`, `middle-ss21-review.json`, `final-ss21-review.json` et `independent-ss21-review.json`. Les scripts correspondants sont dans `reference/author/`.

Des variantes légales gagnent N1 en 265 entrées, N2 en 148, N7 en 148 et N8 en 218. La revue du milieu inclut aussi des variantes sur N3, N4 et N5. Elles démontrent que le jeu ne force pas le témoin d’auteur. Une contre-branche locale qui échoue ne prouve pas l’impossibilité de toute récupération.

La comparaison de terrains couvre **56 cartes, SS14 à SS20**. Elle conserve sol et eau, normalise les pièces, retire la bordure et compare les huit symétries du plan. Aucun terrain SS21 ne répète exactement une ancienne carte ou une autre carte de SS21. Cette méthode ne mesure pas la difficulté subjective ni toute ressemblance thématique. Les thèmes des cellules et des îlots sont repris avec de nouvelles géométries et un quatrième rôle.

Au départ, aucun héros n’accède à une destination par simple marche dans la géométrie figée, même en ignorant les autres héros. Cela ne remplace pas une recherche complète de solutions ; le rapport explicite cette limite.

## Interface compilée et rendu natif

`validation/ui-dom-report.json` exécute le vrai HTML compilé dans Happy DOM. Il compare les pixels canvas et les durées de chaque animation, contrôle les quatre sélections clavier/bouton/clic/Tab, les dispositifs, les avertissements optiques, la boucle du rayon, Undo, Reset, Restart et les huit parcours.

Les actions ordinaires sont verrouillées pendant l’animation ; les commandes d’interruption invalident les callbacks antérieurs. Victoire et défaite apparaissent après leur dernière image. La réduction des animations est conservée. Les boutons, centres des presses et marques de destination sont comparés sur leurs pixels.

La vérification native dans SRA Playground est consignée dans `docs/migration/ss21-native-integration.md` à la racine du dépôt. Elle compare le dispatcher au laboratoire et fait l’objet d’un contrôle distinct dans le navigateur. Les tests DOM ne sont pas présentés comme une campagne exécutée dans un navigateur réel. Le fichier `validation/delivery-manifest.json` qualifie uniquement l’artefact autonome.

## Limites

- Une victoire par témoin démontre la solvabilité et la conformité du moteur, pas la résolution autonome par SRA.
- Aucune optimalité ni unicité n’est affirmée.
- Les quatre personnages doivent arriver, mais chaque salle n’impose pas artificiellement les quatre pouvoirs. Par exemple, le témoin N3 n’utilise pas d’échange du Magicien et celui de N5 n’utilise pas de poussée du Marchand.
- Les mécaniques sont celles de SRA : monstres stables, pas de duplication par miroir, appuis persistants sous plateforme et quatuor sans Barde. Les différences avec les guides sont explicitées dans `source-audit.md`.
