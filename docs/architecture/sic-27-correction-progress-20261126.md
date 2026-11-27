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

Ce tableau qualifie le rejeu natif de ce lot. Le contrôle des 107 jeux sur l'intégration finale et les vérifications de l'interface publiée restent à effectuer. La réfutation d'un geste est bornée à son niveau et son raster ; elle ne bloque pas un nouveau niveau qui réutilise la même image. Les 21 tests ciblés et TypeScript passent. Les nouveaux contrats de transfert sont ajoutés au workflow de continuité.

### Continuité des porteurs

Le profil WA30 vérifie la route réelle et ses gardes avant de modifier les coupures de série. Les coûts de persistance, de restauration et de clôture sont inclusifs : ils ne doivent pas être additionnés. La qualification conservera les mêmes plafonds et contrôlera les gestes réellement exécutés, leurs positions et les effets physiques.

## Intégration et publication

Chaque lot validé suit : tests → sauvegarde GitHub → contrôle de continuité → intégration sur `main` → publication du Site → vérification du SHA et du parcours dans l'interface. Les modifications des plafonds ne constituent pas une correction. La campagne finale doit couvrir les 107 jeux sur une révision unique et préserver les 80 victoires de départ.

Site de départ : version 199, source canonique `d258b5b900c9f042b8535f75fee2c976ec5c71a5`. Aucune correction des 27 jeux n'est encore annoncée comme intégrée ou publiée à ce premier checkpoint.
