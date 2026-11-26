# SS22 — qualification de la livraison 0.1.0

## Résultat

Les huit salles de **Les Cortèges Mécaniques** sont gagnées depuis le niveau 1 par leurs témoins d’auteur. Le laboratoire, le dispatcher natif et la campagne manuelle dans Chrome concordent : **1 414 entrées**, dont **173 sélections** et **1 241 actions physiques**, **33 découvertes** au tutoriel et victoire finale officielle. Aucun refus ni décès dans les huit témoins qualifiés.

| Contrôle | Résultat | Preuve |
| --- | --- | --- |
| Moteur, monstres et tutoriel | 104 tests réussis | `../validation/unit-tests.json` et `unit-tests.txt` |
| Rejeu public des huit salles | 8/8, 3 932 images, durées contrôlées, Undo des huit victoires | `../validation/levels-report.json` |
| HTML compilé dans Happy DOM | 8/8, pixels et durées exacts, contrôles de rôles, animations interrompues et reflets refusés | `../validation/ui-dom-report.json` |
| Conception | 69 contrôles dans quatre revues ; variantes gagnantes conservées | `../validation/design-report.json` et `../reference/*-ss22-review.json` |
| Géométrie | 8 terrains distincts, aucun doublon exact parmi 64 terrains SS14–SS21 sous les huit symétries planes et translation | `../reference/independent-ss22-review.json` |
| Adaptateur et dispatcher natifs | 90 tests SS01–SS22 réussis ; observations SS22 identiques au laboratoire | `../../../docs/migration/ss22-evidence/native-tests.txt` |
| Typage global | `npm run typecheck` réussi | qualification native |
| Build du Site | `npm run build` réussi ; galerie 122 jeux, 812 aperçus | `../../../docs/migration/ss22-evidence/build.txt` |
| Continuité SIC obligatoire | `npm run test:sic-continuity` terminé avec code 0 | `../../../docs/migration/ss22-evidence/sic-continuity.txt` |
| Chrome, interface native | N1→N8 gagné par flèches, Tab et Espace ; 33/33 découvertes ; Undo/rejeu de N1 et de la victoire finale | `../../../docs/migration/ss22-evidence/browser-campaign.json` |

Les chemins vers le dossier `docs/migration` sont relatifs au laboratoire ; les liens complets sont aussi donnés dans le document d’intégration native du dépôt.

## Parcours mesurés

| Niveau | Entrées | Images | Résultat |
| --- | ---: | ---: | --- |
| L’école des cortèges | 321 | 861 | Victoire, 33/33 découvertes |
| La marche à deux temps | 185 | 490 | Victoire |
| L’atelier du décrochage | 106 | 305 | Victoire |
| La frontière du chant | 203 | 581 | Victoire |
| Les entrées décalées | 198 | 552 | Victoire |
| Le quartier des reprises | 136 | 395 | Victoire |
| Les cales du bassin | 149 | 428 | Victoire |
| La dernière traverse | 116 | 320 | Victoire finale |
| **Total** | **1 414** | **3 932** | **8/8** |

La campagne montre notamment 32 poussées du Marchand, 25 du Guerrier, 8 poussées de file dont 3 mixtes, 34 tractions, 74 chants, 51 mouvements d’appuis immergés vides, 7 reflets et 3 poussées de presse. Ces compteurs décrivent le témoin ; aucun n’est une condition de victoire.

## Portée des preuves

La comparaison du dispatcher vérifie les observations publiques complètes : images 64 × 64, palette, séquences, durées, actions, états et progression. Les témoins et outils d’auteur restent hors du bundle jouable et ne sont pas fournis au raisonnement SRA.

La revue dans Chrome utilise l’interface native servie par l’aperçu du checkout qualifié. Elle établit une campagne manuelle complète dans cette interface, et ne constitue pas un essai de résolution autonome par SRA. Le contrôle de continuité SIC protège le contrat existant ; il ne qualifie pas l’autonomie de SIC sur SS22.

Les revues de conception évaluent des branches précises. N3 admet une variante sans presse ; N4 peut finir par une poussée du Marchand ; N5 accepte l’entrée basse avec extraction du Barde par le Voleur. Ces solutions restent légales. L’absence de copie géométrique exacte ne prouve pas une originalité absolue de tous les raisonnements, et la marche initiale figée ne remplace pas une recherche exhaustive.

Les tests DOM du fichier autonome et la revue Chrome de l’interface native sont deux qualifications distinctes. Le manifeste du laboratoire lie son HTML aux rapports et aux empreintes de ses sources. La publication hébergée doit ensuite relier le commit GitHub intégré au SHA source du Site ; le compte rendu final en consigne les identités vérifiées.
