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
- Rejeu des observations archivées : l'essai attendu est proposé à la décision 19. Rejeu réel L1→6, contrôle complet de continuité, intégration et publication encore à faire.

### Conditions des effets transférés

Les captures CRAF et SB26 reproduisent exactement les commandes initiales de la campagne. Un dépôt appris avec une sélection visible est réutilisé alors que ce repère est absent. Des gestes identiques sans effet sont ensuite répétés pour plusieurs associations. Le correctif doit conserver les interfaces source/cible observées, retenir la réfutation du geste et laisser les rôles spécialisés acquis traiter leur domaine.

### Continuité des porteurs

Le profil WA30 vérifie la route réelle et ses gardes avant de modifier les coupures de série. Les coûts de persistance, de restauration et de clôture sont inclusifs : ils ne doivent pas être additionnés. La qualification conservera les mêmes plafonds et contrôlera les gestes réellement exécutés, leurs positions et les effets physiques.

## Intégration et publication

Chaque lot validé suit : tests → sauvegarde GitHub → contrôle de continuité → intégration sur `main` → publication du Site → vérification du SHA et du parcours dans l'interface. Les modifications des plafonds ne constituent pas une correction. La campagne finale doit couvrir les 107 jeux sur une révision unique et préserver les 80 victoires de départ.

Site de départ : version 199, source canonique `d258b5b900c9f042b8535f75fee2c976ec5c71a5`. Aucune correction des 27 jeux n'est encore annoncée comme intégrée ou publiée à ce premier checkpoint.
