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
