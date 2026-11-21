# SS14 — validation du laboratoire 0.1.1

## Résultat vérifié

**Huit salles gagnantes, 1 028 entrées publiques, 3 039 images d’animation vérifiées, aucun refus et aucune perte de héros sur les parcours de référence.** Le premier atelier acquiert les **17 découvertes** depuis les images publiques. Les **33 tests du moteur** passent.

| Salle | Entrées, sélections incluses | Tractions | Chants entraînant un participant | Déplacements d’appui | Images |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 80 | 5 | 11 | 1 | 237 |
| 2 | 72 | 11 | 9 | 0 | 207 |
| 3 | 93 | 9 | 20 | 8 | 279 |
| 4 | 85 | 15 | 12 | 0 | 248 |
| 5 | 107 | 10 | 12 | 0 | 311 |
| 6 | 107 | 23 | 11 | 0 | 326 |
| 7 | 195 | 10 | 59 | 36 | 568 |
| 8 | 289 | 50 | 27 | 3 | 863 |
| **Total** | **1 028** | **133** | **161** | **48** | **3 039** |

Ces comptes décrivent les routes exécutées. Ils ne sont ni des minima ni une mesure de difficulté. `forcedBardMoves` et `partnerPulls` comptent les tractions du Barde dans le rapport ; les transports par reflet ou presse ont leurs métriques distinctes.

## Contrôles du moteur et de la session

`tests/core.test.mjs` couvre la traction unitaire, le relâchement, les déplacements forcés sans capacité supplémentaire, la portée carrée calculée avant le pas, les dépendances du chant, les appuis mobiles et ancrés, les refus d’arrivées dangereuses, les reflets et leurs conflits, les presses, la stabilisation hydraulique et les attaques simultanées.

`scripts/validate-levels.mjs` compare cartes, crédits et témoins à leurs références. Il contrôle les invariants d’acteurs, les images 64 × 64 et leur palette, la durée de chaque image, l’ordre des cascades, les sélections en coordonnées pixel et l’absence d’état privé dans les observations. Chaque fin de salle est annulée puis rejouée ; la progression et la victoire finale sont déterministes.

Rapport : `validation/levels-report.json`.

## Correction des glyphes et séparation au niveau 6

Les matrices 3 × 3 ont été extraites des images publiques des vraies salles et comparées pixel par pixel, puis rendues en agrandissement pour inspection :

| Élément | État contrôlé | Résultat |
| --- | --- | --- |
| L8, bouton en (11,14) | Initial | Fond gris 3, bras roses 7 et centre violet 15 ; aucun bleu 9. |
| L6, presse en (13,8) | Fermée, après 47 entrées | Centre noir 5 ; aucun bleu 9. |
| L6, presse en (13,8) | Ouverte, après 49 entrées | Centre gris 3 ; aucun bleu 9. |

Le bouton bleu de L6 est déplacé en (8,3) ; la case de la presse n’appartient plus à aucun bouton. Les huit séquences auteur sont inchangées. Le nouveau contrôle local `67 + CD` vérifie qu’un départ prématuré du Barde retire le quai sous le Voleur ; le parcours complet attend la fin de la traversée et reste gagnant en 107 entrées. La route comporte deux changements hydrauliques au lieu de cinq, soit neuf images en moins.

Rapport : `validation/pixel-fix-report.json`. Les occupants et les aperçus de reflet conservent leur priorité habituelle sur les dispositifs.

## Interface du HTML compilé

`scripts/verify-ui-dom.mjs` exécute le script réellement inclus dans le HTML avec Happy DOM. Il compare les buffers du canvas à chaque image publique du moteur et contrôle les temporisateurs.

- 23 situations de rôles : traction, chant, ancrage, dépendances, déplacement forcé, presses et combat.
- 3 situations de reflet : priorité du candidat proche, échange égal et aperçu d’arrivée.
- Miroir lisible sur un bouton, distinction entre changement de porte et poussée réelle.
- Conflits de miroirs, clignotement des seuls dos concernés et annulation pendant le signal.
- Clavier, clic, boutons de rôle, sélection de salle et contexte des aides et crédits.
- Verrouillage pendant l’animation ; Annuler, Recommencer, Repartir et changement de salle sans image périmée.
- Réduction des animations et affichage des écrans terminaux après la dernière image.
- Huit parcours complets, avec annulation et rejeu de chaque fin de salle.

Rapport final : `validation/ui-dom-report.json`, portée `focused-ui-and-full-campaign`. Les dix-sept découvertes y sont également vérifiées sur la vraie route du niveau 1.

Les huit images initiales du moteur ont été rendues et inspectées visuellement. Ces contrôles du laboratoire portent sur le DOM, les pixels calculés et les temporisations. Le contrôle natif a ensuite été effectué dans le Playground compilé avec Playwright et Microsoft Edge 158.0.4370.33, sur ordinateur et à 390 px.

## Revue des contraintes

Les générateurs des niveaux 2 à 6 exécutent **13 comparaisons locales**, enregistrées dans `adaptation.localChecks`. Les générateurs des finales ajoutent **4 branches pour L7 et 6 pour L8**, dans `adaptation.localCounterfactuals`.

`scripts/verify-design-constraints.mjs` apporte une revue indépendante des deux finales : **24 contrôles réussis, dont 11 pour L7 et 13 pour L8**. Elle conserve aussi les contre-exemples qui réussissent : héros utilisé temporairement comme poids, retrait anticipé possible d’une ressource ou autre départ de l’atelier. Le rapport indique pour chaque cas son état de départ, ses actions et son résultat. Les pertes d’appui et les erreurs d’ordre sont des conséquences exécutées, pas des hypothèses.

Les tests géométriques des chambres finales utilisent des supports et positions synthétiques explicitement déclarés. Ils vérifient uniquement le franchissement direct de chaque frontière avec la porte fermée : aucun transfert accepté parmi 23 candidats NW pour L7 et 11 candidats NE pour L8. Ils ne démontrent aucune propriété générale de toutes les stratégies.

Rapport : `validation/design-constraints-report.json`. Aucun résultat interrompu par une limite de temps ou de nombre d’états ne sert de preuve de nécessité.

## Reconstruire

```sh
npm install
npm test
npm run validate
node scripts/verify-design-constraints.mjs
node scripts/verify-ui-dom.mjs
```

Le dernier script requiert une installation de Happy DOM. `HAPPY_DOM_MODULE` peut indiquer le chemin absolu de son module `lib/index.js` si le paquet est fourni par l’environnement de validation.

Les générateurs `reference/author/build-level1.mjs` à `build-level8.mjs` reconstruisent leurs cartes et exécutent leurs assertions locales. Après une modification, lancer le générateur concerné, `node scripts/sync-levels.mjs`, puis les vérifications pertinentes.

## Empreinte et limites

Le HTML validé possède l’empreinte SHA-256 :

`39b393719bff52015ff7745f290f2f156bbabef159422aa4bbbba29f761b10a6`

Les rapports de campagne, d’interface et de correction des pixels portent la même empreinte. Le bundle est autonome : aucun script distant, témoin, solveur ou outil d’auteur n’est nécessaire pour jouer ou présent dans le code livré au joueur.

Les témoins prouvent la solvabilité, pas l’unicité, l’optimalité ou une réussite autonome de SRA. Les sources sont des adaptations déclarées, pas des reconstructions certifiées. La feuille de route consigne les non-régressions et la comparaison du coût global de l’intégration native.
