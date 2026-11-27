# Corrections SIC des 27 jeux incomplets

## Point de départ vérifié

La campagne complète du commit `4a546a139f9064422c078ef5f40b8c22133c39a8` donne **80 jeux complets sur 107**, **605 niveaux gagnés sur 692**, et 27 premiers arrêts. Les résultats, plafonds, empreintes et commandes sont archivés dans `docs/diagnostics/sic-107-4a546a13-20261126/` (branche initiale `audit/sic-107-4a546a13-20261126`). Aucun arrêt n'est une erreur de moteur ou une absence de verdict.

Le travail correctif part de `main` au commit `d258b5b900c9f042b8535f75fee2c976ec5c71a5`, qui conserve les ajouts SS25. Les comparaisons réutilisent les plafonds archivés, une session SIC depuis le niveau 1 et un seul worker. Les profils instrumentés servent au diagnostic ; les victoires chronométrées doivent être rejouées avec le runner de production. Les parties chronométrées locales sont sérialisées.

## État des 27 jeux

Les nombres ci-dessous restent ceux de la campagne de départ tant qu'un rejeu complet n'est pas qualifié. Un correctif local ou un test synthétique réussi ne change pas le verdict du jeu.

| Jeu | Niveaux gagnés | Premier arrêt | Limite atteinte | Travail en cours |
|---|---:|---:|---|---|
| CASC | 3/6 | 4 | 25 commandes | Conditions des effets transférés et priorité des rôles acquis |
| CGWL | 4/6 | 5 | 45 s | Continuité des plans observés, à diagnostiquer |
| CLRS | 5/6 | 6 | 29 commandes | Conditions des effets transférés et invalidation de pose |
| COLM | 1/6 | 2 | 34 commandes | Transfert des commandes et placement de file |
| CRAF | 5/6 | 6 | 33 commandes | Repères de sélection/stock ; premiers essais sans effet reproduits |
| CWSE | 2/6 | 3 | 80 commandes, référence de secours | Victoire exécutée par une autre famille ; passage de niveau reproduit |
| DC22 | 5/6 | 6 | 271 commandes | À diagnostiquer après le premier lot commun |
| ESCT | 1/6 | 2 | 22 commandes | Reconnaissance et priorité de l'intervention de route |
| ETAG | 3/6 | 4 | 80 commandes, référence de secours | À diagnostiquer ; référence historique à vérifier |
| FOGW | 1/6 | 2 | 19 commandes | Transfert des rôles de réception |
| GRAV | 4/6 | 5 | 28 commandes | Transfert du rôle d'attachement/interrupteur |
| GRIL | 1/6 | 2 | 10 commandes | Réutilisation de sélection hors du protocole de catalogue |
| LF52 | 5/10 | 6 | 76 s | Continuité des plans observés, à diagnostiquer |
| LKEY | 5/6 | 6 | 18 s | Continuité des plans observés, à diagnostiquer |
| LS20 | 5/7 | 6 | 50 s | Continuité des plans observés, à diagnostiquer |
| MIND | 1/6 | 2 | 9 s | Coût de la décision et premiers essais à diagnostiquer |
| PORT | 5/6 | 6 | 12 s | Continuité des plans observés, à diagnostiquer |
| RSWP | 4/6 | 5 | 36 commandes | Effets transférés avant les réservations propres au rôle |
| SB26 | 6/8 | 7 | 22 commandes | Dépôt réutilisé sans repère de sélection ; reproduit |
| SK48 | 5/8 | 6 | 34 s | Continuité des plans observés, à diagnostiquer |
| SNAR | 3/6 | 4 | 24 s | Continuité des plans observés, à diagnostiquer |
| SPOR | 1/6 | 2 | 18 commandes | Acquisition publique de la réception à la victoire |
| TRCP | 3/6 | 4 | 80 commandes, référence de secours | Reconnaissance des canaux et acquisition publique |
| UPST | 0/6 | 1 | 36 commandes | Rencontre atteignable : premier correctif, rejeu réel en attente |
| VOIS | 1/6 | 2 | 23 commandes | Transfert des déplacements de population entre niveaux |
| WA30 | 7/9 | 8 | 103 s | Profil natif des routes parallèles et gardes |
| WEAV | 1/6 | 2 | 34 commandes | Effets extérieurs et conservation du rôle de croisement |

## Lots et preuves

### Rencontre atteignable sans objectif terminal connu

Le retour public 15 d'UPST établit une ouverture et une alimentation. Le retour 18 montre une forme compatible avec l'unique référence isolée et une porte accessible entre leurs régions. La décision 19 précédente clique sans effet sur le nouveau participant et perd l'essai de rencontre. Le premier correctif conserve cette hypothèse bornée, vérifie ses prémisses et n'acquiert un objectif terminal que sur un score officiel.

- Branche : `fix/sic-27-observed-compositions-20261126`.
- Commit local : `2a3b665c5e436d97932e6cbad152f9186508cd90`.
- Commit GitHub : `79fb7f8432f6c3fe6d1af10484e926ad78d6aacb`.
- Arbre identique : `7e233ec8546647ffdfdf14a298662f4524b429ab` ; les métadonnées de création du commit diffèrent.
- TypeScript et sept tests ciblés réussis, dont deux transferts natifs avec variations de formes, palettes et ports, et des cas ambigu/contradictoire.
- Rejeu des observations archivées : l'essai attendu est proposé à la décision 19. Le premier rejeu réel est décrit ci-dessous ; contrôle complet de continuité, intégration et publication encore à faire.

Premier rejeu réel sur cet arbre : L1 gagné en 19 commandes (score 8,429 s), L2 gagné en 4 commandes (score 2,071 s), puis arrêt L3 à 19 commandes sans changement de raster. Le clic gagnant L2 a été exécuté par une autre famille ; la capture suivante montre que le modèle conserve `completed: 1`. Le jeu reste incomplet et la frontière publique de progression fait l'objet du lot suivant.

### Sélection avec déplacements de population déjà acquis

VOIS conserve bien ses quatre déplacements à la victoire L1, mais l'admission de la stratégie acquise exigeait un pion déjà sélectionné. Son premier clic L2 revenait donc à une stratégie sans calibration. Le correctif admet cette sélection lorsque la scène mesurée peut réutiliser le témoin de déplacement ; les gardes de sélection et de mouvement restent actifs.

Le premier rejeu depuis L1 sur `5d2e49f4` gagne les cinq premiers niveaux en **14, 18, 34, 23 et 36 commandes**. Il s'arrête au L6 sur son plafond de temps, après 47 commandes. Les dernières commandes sont des effets transférés `witnessedPreview` : le lot d'interface doit être testé conjointement avant de conclure. Neuf tests ciblés passent, avec deux parcours natifs L1→L2 variant la taille, la palette, les positions et les commandes, une sélection absente/ambiguë et un déplacement contradictoire.

### Conditions des effets transférés

Les captures CRAF et SB26 reproduisent exactement les commandes initiales de la campagne. Un dépôt appris avec une sélection visible est réutilisé alors que ce repère est absent. Des gestes identiques sans effet sont ensuite répétés pour plusieurs associations. Le correctif doit conserver les interfaces source/cible observées, retenir la réfutation du geste et laisser les rôles spécialisés acquis traiter leur domaine.

La première cohorte stricte de huit jeux est terminée sur l'arbre `c296191cd767d2be7b39cff1a91fcb81b115dc80` (local `79e6cce7`, GitHub `4612293c`). Les plafonds archivés sont inchangés ; aucune relance n'est substituée au premier résultat.

| Jeu | Résultat du rejeu natif | Commandes par niveau tenté |
|---|---|---|
| CRAF | 6/6, toutes les commandes réconciliées | 9, 11, 16, 19, 24, 27 |
| SB26 | 8/8, toutes les commandes réconciliées | 9, 15, 15, 15, 17, 19, 17, 17 |
| CASC | 6/6, toutes les commandes réconciliées | 6, 14, 22, 20, 11, 22 |
| GRIL | 1/6 ; arrêt L2 au plafond de commandes | 5, 10 |
| CLRS | 6/6, toutes les commandes réconciliées | 8, 10, 13, 15, 14, 24 |
| RSWP | 4/6 ; arrêt L5 au plafond de commandes | 3, 8, 8, 14, 36 |
| COLM | 1/6 ; arrêt L2 au plafond de commandes | 17, 34 |
| WEAV | 1/6 ; arrêt L2 au plafond de commandes | 27, 34 |

Ce tableau qualifie le rejeu natif de ce premier arbre. Le contrôle des 107 jeux sur l'intégration finale et les vérifications de l'interface publiée restent à effectuer. Les 21 tests ciblés et TypeScript passent. Les nouveaux contrats de transfert sont ajoutés au workflow de continuité.

#### Contre-exemple GABA et correction de la portée des refus

La première CI de PR132 a détecté une régression au L6 de GABA : les 346 premières commandes restaient identiques, puis la réfutation partagée d'une commande sans effet changeait l'hypothèse choisie. Les deux associations en jeu n'avaient aucune interface de sélection identifiée. Le second essai du témoin réfutait une autre association et rendait ensuite la main au rôle de transport déjà acquis.

Le correctif distant `f20cb3c160b6f1dbc14a5b0cfb5c696d07d0c4a5` réserve la réfutation partagée aux interfaces acquises, visibles et univoques. Sa clé inclut les rôles et positions de cette interface, le niveau, le raster et la commande. Sans cette preuve, les refus restent locaux à l'association essayée. Le contrat de transport et les plafonds sont inchangés.

Le rejeu strict corrigé gagne les six niveaux de GABA en **47, 37, 67, 88, 106 et 102 commandes**. Ses 447 entrées d'effets et ses six empreintes de parcours sont strictement identiques au témoin gagnant `4a546a13` ; 447 autorisations et acquisitions, aucun reset ou undo. Le score L6 arrive à 25,806 s sous le plafond de 37 s. L'archive et le contre-exemple CI sont dans `docs/diagnostics/sic-preview-cargo-regression-20261127/`.

Cette intégration conserve aussi le lot de transmission publique fusionné par PR133. CRAF, SB26, CASC et CLRS doivent être recontrôlés sur l'arbre combiné ; la CI complète reste obligatoire avant de reprendre la fusion de PR132.

### Continuité des porteurs

Le profil WA30 vérifie la route réelle et ses gardes avant de modifier les coupures de série. Les coûts de persistance, de restauration et de clôture sont inclusifs : ils ne doivent pas être additionnés. La qualification conservera les mêmes plafonds et contrôlera les gestes réellement exécutés, leurs positions et les effets physiques.

### Saisie ordonnée déjà acquise

La capture MIND L3 montre une interface compatible avec les retours acquis au L2, mais une preview est choisie avant que le rôle de saisie soit consulté. Sa première saisie partielle empêche ensuite la reconnaissance initiale des rangées. Deux reconnaisseurs de recoloration sans proposition consomment alors environ 11,23 s du plafond de 15 s. Le correctif `dc3f51ae712d2f5dc7e795d023c79d51063d647e` permet au rôle déjà acquis de continuer dans le groupe de pression, avant cette preview, uniquement si son interface, ses preuves et la commande requise restent compatibles.

Le rejeu strict depuis L1 termine les six niveaux en **8, 8, 15, 20, 18 et 24 commandes**, soit **93**. Les scores arrivent à 3,426 / 1,394 / 4,236 / 5,898 / 5,634 / 7,612 s sous les plafonds 11 / 9 / 15 / 18 / 18 / 19 s. Les deux premiers parcours restent identiques au témoin `ee9dad5f` ; aucune reprise par reset ou undo. Neuf tests ciblés passent, dont les deux transferts dans le moteur natif et les refus de rôle absent, d'interface ambiguë et de retour contradictoire. Les tests utilisent l'ordre réel des groupes de production. L'intégration combinée et le viewer restent à vérifier.

## Intégration et publication

Chaque lot validé suit : tests → sauvegarde GitHub → contrôle de continuité → intégration sur `main` → publication du Site → vérification du SHA et du parcours dans l'interface. Les modifications des plafonds ne constituent pas une correction. La campagne finale doit couvrir les 107 jeux sur une révision unique et préserver les 80 victoires de départ.

Site de départ : version 199, source canonique `d258b5b900c9f042b8535f75fee2c976ec5c71a5`. Aucune correction des 27 jeux n'est encore annoncée comme intégrée ou publiée à ce premier checkpoint.

### Livraison du lot de transmission publique

PR133 est fusionnée sur `main` au commit **`8ec8886de88c5d0e69abfc4ac650a8043448740c`**, arbre `18babde84afc25501eec1fc7dbcafd181a5503e1`. Les treize contrôles de la CI 45918144966 passent, dont `npm run test:sic-continuity` exécuté sur tous les bruts de cette révision. Le Site est publié en **version 200**, avec ce même SHA source vérifié.

Le viewer local du même code publié a reproduit UPST depuis L1 dans une seule session SIC : message officiel `The game reports WIN.`, six niveaux, **72 commandes**, soit **19, 4, 11, 7, 14 et 17**. Les boutons `Run to next level` ont été utilisés, sans nouvelle session ni reset entre niveaux. Le contrôle CWSE de cette version est en cours à ce checkpoint. Les mesures natives strictes de UPST et CWSE restent archivées séparément et ne constituent pas un nouveau bilan des 107.

Les corrections en préparation restent explicitement incomplètes : FOGW atteint désormais trois niveaux (18, 7, 18 commandes) avant un arrêt L4 ; VOIS a atteint cinq niveaux avant L6 ; WA30 garde son arrêt L8. Le prochain bilan complet conservera un verdict par jeu sur une révision unique.

### Lot commun publié en version 201

PR132 est fusionnée sur `main` au commit `f4e7a3bd760b9bcdbbb15c00f850f055fbeaaaa1`, arbre `0b4662930918e6515d651096d09e63c27b84360b`. Les 13 jobs de la CI 45920939273 réussissent, dont la réconciliation complète `npm run test:sic-continuity` (job 140253616747). La version Site **201** porte exactement ce SHA source.

Le rejeu combiné du même arbre termine CRAF 6/6 (106 commandes), SB26 8/8 (124), CASC 6/6 (95), CLRS 6/6 (84) et MIND 6/6 (93), soit 32 niveaux et 502 commandes SIC. Les plafonds sont inchangés, un seul worker et aucun reset/undo. Les bruts, budgets et empreintes sont archivés dans `docs/diagnostics/sic-27-common-integration-20261127/`.

La version 200 a été reproduite entièrement par le viewer pour UPST (72) et CWSE (195), depuis L1 en une session SIC chacun. La version 201 a déjà été reproduite pour MIND (93), CRAF (106) et CASC (95) ; CLRS et SB26 sont en cours à ce checkpoint. Ce sont les commandes visibles de l'interface locale servant le code publié, et non une nouvelle mesure des plafonds chronométriques.

### Lot suivant : réceptions et mélanges acquis publiquement

FOGW termine le banc strict depuis L1 en 173 commandes : 18, 7, 18, 29, 38 et 63, avec la même limite de temps à chaque niveau. Le rôle de réception transmet ses commandes compatibles, conserve un score sur une arrivée mesurée et reprend après un retour courant avant les previews étrangères. Quatorze tests ciblés passent. Archive : `docs/diagnostics/sic-reception-transfer-20261127/`.

TRCP termine le banc strict en 240 commandes : 24, 30, 37, 46, 54 et 49. La recette d'un mélange réellement observé est acquise même lorsque l'ouverture a été exécutée par une autre famille. Les deux premiers parcours sont identiques au témoin ; le troisième garde le même nombre de commandes mais change de parcours. Les tests varient les formes, couleurs, positions et clics et refusent les participations ambiguës, absentes ou contradictoires. Archive : `docs/architecture/sic-public-mixtures-20261127/`.

L'intégration retient le code TRCP sans le candidat SPOR encore partiel. La source combinée FOGW/TRCP doit passer son propre rejeu et le contrôle complet de continuité avant fusion et publication. Les 22 tests de ces deux rôles passent ensemble ainsi que TypeScript.

VOIS demeure 5/6 sur le dernier passage (L6 : 42 commandes puis 27 secondes). GRIL atteint 2/6 avant une nouvelle interface élargie ; SPOR atteint 3/6 avant un contrôle non réassocié. WA30 reste 7/9. Ces étapes ne sont pas comptées comme jeux complets. Le bilan définitif de 107 jeux reste à exécuter sur une seule révision finale.

### Réceptions et mélanges publiés en version 202

PR134 est fusionnée sur `main` au commit `f38b03c52e92483c11e915a759323ba6aebc223c`, arbre `99a85b13fb3ce8d46bafc58b52252b07536c4e68`. Les 13 jobs de la CI 45924787064 passent, dont le contrôle complet de continuité (job 140265915755). La version Site **202** est publiée avec exactement ce SHA source ; aucune divergence GitHub/Site.

Le rejeu strict de l'intégration termine FOGW et TRCP avec les mêmes 173 et 240 commandes, toutes autorisées et acquises par SIC, sous les budgets archivés. Les bruts, budgets et empreintes figurent dans `docs/diagnostics/sic-channel-reception-integration-20261127/`.

Les deux parcours ont ensuite été reproduits par les boutons du viewer local servant cette source publiée, chacun depuis L1 en une seule session SIC, sans reset ni nouvelle session intermédiaire. Le message officiel est `The game reports WIN.` pour les deux : FOGW **18, 7, 18, 29, 38, 63** ; TRCP **24, 30, 37, 46, 54, 49**. La version 201 est également terminée dans l'interface pour CLRS **84** et SB26 **124**, ce qui complète ses cinq vérifications. Les compteurs sont conservés dans les fichiers `viewer-201.json` et `viewer-202.json` de leurs archives respectives.

Neuf des 27 jeux de départ sont donc corrigés, intégrés, publiés et reproduits dans le viewer : UPST, CWSE, CRAF, SB26, CASC, CLRS, MIND, FOGW et TRCP. Ce suivi des corrections ne remplace pas la campagne finale des 107 jeux sur une seule source.

### Interfaces de catalogue et transport de panneaux

Les candidats suivants passent leur banc strict depuis L1 : GRIL **6/6 en 74 commandes** (5, 5, 8, 8, 13, 35) et RSWP **6/6 en 110 commandes** (3, 8, 8, 11, 30, 50). Les 184 commandes sont autorisées et acquises par SIC ; aucun reset/undo, aucun score tardif et aucun plafond modifié. Les décisions restent unitaires ; ce lot ne qualifie pas de nouvelles séries.

GRIL conserve le rôle d'une vue déjà observée lorsque l'interface compatible s'élargit avec un sélecteur encore inconnu. RSWP réemploie le transport de panneau avant les previews indépendantes qui faisaient perdre trois commandes au début du L4. Les deux correctifs sont réunis sur la source de la version 202 ; la validation combinée, la CI, la fusion et le viewer restent à faire à ce checkpoint. Archives : `docs/diagnostics/sic-catalogue-view-transfer-20261127/` et `docs/diagnostics/sic-panel-transport-transfer-20261127/`.

### Préparations de profil maintenues jusqu’au retour

LKEY termine son banc strict en **119 commandes**, soit **8, 8, 20, 29, 24 et 30**, et six scores sous les plafonds originaux. Le L6 marque à **9,612 s sous 18 s**, après 30 commandes sur 36. Les cinq premiers préfixes restent identiques au diagnostic préalable. La préparation garde son préfixe connu, au plus 16 commandes, et vérifie le travail, la sélection, la prise, les profils, récepteurs et outils entre les retours ; les expériences dont la suite dépend d’un nouvel effet restent unitaires.

Le collecteur indépendant reproduit les 119 commandes, avec 78 commandes de continuation après index 0. Le contrat vérifie les tickets, les retours exacts, la clôture après contradiction, la réconciliation unique et les préparations avec prise et pixels modifiés. Les seuils des 78 niveaux déjà protégés restent inchangés ; les six niveaux LKEY portent le contrôle à **84 niveaux et 14 jeux**, répartis en 12 cohortes. L’intégration commune GRIL/RSWP/LKEY doit encore passer son rejeu strict et la CI complète avant publication.

### Interfaces et préparations publiées en version 203

PR135 est fusionnée sur `main` au commit **`c97797426f619db16de5b29738a8d4209c78ebca`**, arbre `487bf0c739ba57dccfbb7cb9255e8eb6b0a4b3ce`. La branche de travail est `fix/sic-27-interface-profiles-20261127`, avec le commit local `fe822410b2d544553d6b8b2536c3af45cfb9e10f` et la tête GitHub `f52dca20974a95a07f43ad5a38f71a3a8d36800d`, de même arbre. Les **14 jobs** de la CI 45928738911 réussissent, dont `npm run test:sic-continuity` (job 140278610260). La version Site **203** est publiée avec exactement le SHA intégré ; aucune divergence GitHub/Site.

Le rejeu strict de l’intégration gagne les 18 niveaux de GRIL, RSWP et LKEY en **303 commandes**, toutes autorisées et acquises par SIC, sans reset/undo ni modification des budgets. Le viewer local servant cette source publiée reproduit ensuite les trois victoires officielles, depuis L1 dans une seule session SIC par jeu :

| Jeu | Commandes par niveau | Total | Plans terminés dans le viewer |
|---|---|---:|---:|
| GRIL | 5, 5, 8, 8, 13, 35 | 74 | 74 |
| RSWP | 3, 8, 8, 11, 30, 50 | 110 | 110 |
| LKEY | 8, 8, 20, 29, 24, 30 | 119 | 41 |

Les trois interfaces affichent `The game reports WIN.`. L’archive `docs/diagnostics/sic-interface-profile-integration-20261127/viewer-203.json` conserve ces observations et la provenance de publication. Ces contrôles du viewer ne sont pas des mesures de temps et ne constituent pas un rejeu hébergé.

**12 des 27 jeux sont maintenant intégrés, publiés et confirmés dans le viewer** : UPST, CWSE, CRAF, SB26, CASC, CLRS, MIND, FOGW, TRCP, GRIL, RSWP et LKEY. La campagne finale des 107 jeux sur une source unique reste nécessaire pour établir le nouveau total global.

### Candidats encore hors livraison après la version 203

| Jeu | Dernier résultat qualifié disponible | Prochaine étape |
|---|---|---|
| COLM | 6/6 en 103 commandes sur le candidat intégré `b653fada` ; collecteur identique | Ajouter le contrat de réception, CI complète, fusion puis viewer |
| ESCT | 5/6 sur `11634ac4` ; L6 arrêté à 25 commandes sous le plafond de 18 s | Diagnostiquer la première perte de priorité L6 |
| VOIS | 5/6 ; L6 arrêté sous le plafond de 27 s | Capturer la première perte au L6 sur le code courant |
| SPOR | 3/6 sur le candidat `287d5fe6` | Réassocier l’interaction après le dernier contact observé |
| ETAG | 3/6 sur `85883aa7` ; le rôle de passage est conservé mais L4 atteint encore 80 commandes | Reprendre le diagnostic du parcours L4 |
| WA30 | 7/9 ; L8 reste arrêté sous 103 s | Reprendre les gardes des porteurs et leurs retours |
| CGWL | 4/6 dans le témoin ; L5 arrêté sous 45 s | Premier diagnostic public |
| DC22 | 5/6 dans le témoin ; L6 atteint 271 commandes | Diagnostiquer le rôle de support distant au passage L5→L6 |
| GRAV | 4/6 dans le témoin ; L5 atteint 28 commandes | Premier diagnostic public |
| LF52 | 5/10 dans le témoin ; L6 arrêté sous 76 s | Premier diagnostic public |
| LS20 | 5/7 dans le témoin ; L6 arrêté sous 50 s | Premier diagnostic public |
| PORT | 5/6 dans le témoin ; L6 arrêté sous 12 s | Premier diagnostic public |
| SK48 | 5/8 dans le témoin ; L6 arrêté sous 34 s | Premier diagnostic public |
| SNAR | 3/6 dans le témoin ; L4 arrêté sous 24 s | Capturer le premier préfixe connu interrompu |
| WEAV | 1/6 dans le témoin ; L2 atteint 34 commandes | Premier diagnostic public |

Ces résultats proviennent de révisions différentes et restent un suivi des corrections. Les candidats partiels ne sont pas annoncés comme des jeux corrigés. Les prochaines fusions conservent les seuils de la continuité existante et les budgets de la campagne de départ.

### Préparations de file publiées en version 204

PR136 est fusionnée sur `main` au commit **`0dc7f2eeccdcf29f27564d279750cc5fb1c10e1e`**, arbre `d77d7610fc47e81d3515f065dfed5c69cdd1799e`. La branche de travail `fix/sic-27-queue-integration-20261127` est sauvegardée sur GitHub au commit `51e5bffc9a4670766431633c7b24af094ab5d480` (local `232d24b5b1a3133e9f70787e9e46fde2e623ad65`). Les 15 jobs de la CI 45932306615 passent, dont le contrôle complet de continuité, job 140290343275 : 90 niveaux protégés dans 15 jeux, avec les 84 plafonds antérieurs inchangés.

Le Site **204** porte exactement ce SHA source. Le viewer local servant cette source publiée affiche `The game reports WIN.` pour COLM, depuis L1 en une seule session SIC, sans reset ni nouvelle session intermédiaire : **17, 17, 20, 23, 10 et 16 commandes**, soit **103** et 46 plans terminés. L’archive `docs/diagnostics/sic-queue-continuity-20261127/viewer-204.json` conserve les compteurs et la provenance ; la mesure chronométrée et les 29 réceptions préparées sont archivées séparément.

**Treize des 27 jeux initiaux sont corrigés, fusionnés, publiés et reproduits dans le viewer** : UPST, CWSE, CRAF, SB26, CASC, CLRS, MIND, FOGW, TRCP, GRIL, RSWP, LKEY et COLM. La campagne définitive des 107 jeux sur une même révision reste à exécuter.

### Routes, placements et passages : qualification combinée

La source locale `7443033e17f166777a811ea7de05524407ec5330`, sauvegardée sur GitHub sous `feebe6632e229dd3b544948749e12b72b23b6119`, termine ESCT, VOIS et PORT en **118, 196 et 116 commandes**. Les 18 niveaux sont gagnés sous les plafonds de départ, depuis L1 en une session SIC par jeu, sans reset ni undo. Les 430 commandes sont toutes autorisées et acquises. Les parcours reproduisent les qualifications individuelles.

Le score L6 arrive à **16,245 s / 18 s pour ESCT**, **17,816 s / 27 s pour VOIS** et **9,040 s / 12 s pour PORT**. Les collecteurs indépendants mesurent les retours physiques de chaque commande ; leur rapprochement avec le contrôle complet de continuité porte la cible à 108 niveaux protégés. Les bruts sont archivés dans `docs/diagnostics/sic-population-route-integration-20261127/`. La fusion, la publication et les trois parcours du viewer restent à effectuer à ce checkpoint. Le nombre de jeux livrés demeure donc 13 sur 27.

SNAR a progressé à 4/6 dans sa branche isolée, puis s'arrête au niveau 5 sous le plafond de 28 secondes. Ce candidat reste partiel. LS20 a livré une première contradiction de garde au deuxième retour d'une série, tandis que DC22 fait l'objet d'une capture de ses premières compositions de panneau ; aucun nouveau verdict complet n'est annoncé pour ces jeux.
