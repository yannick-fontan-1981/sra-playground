# SS01 L6 · Revenir avant une poussée qui supprime une capacité

## Annuler la poussée depuis le point de blocage

En campagne SIC depuis le L1, la révision 217 gagne le L6 en **88 commandes de jeu et une annulation**, contre **116 commandes de jeu et un reset** en r215. Les 29 premières commandes et leurs retours sont identiques. La poussée 29 immobilise le miroir. Le moteur renvoie alors à SIC exactement l’image qui précédait cette poussée. Au coup 30, SIC prend la branche alternative auparavant jouée au coup 58. Toute la suite jusqu’à la victoire est identique.

SIC autorise l’annulation lorsque la perte de mobilité est attribuée à la dernière action acquise, que le point de reprise est identifié et que le jeu propose un undo public. Le retour doit correspondre à l’image, au niveau, au score et aux commandes disponibles avant le geste. Le raisonnement reprend au même point avec la poussée perdante exclue et le plan alternatif conservé. La commande tentée reste comptée. Quand le jeu ne propose pas l’annulation, SIC peut reprendre par reset.

Le test de continuité contrôle le budget de 88 commandes du L6, l’absence de reset et, pour chaque annulation, le retour à la même image suivi d’un choix différent. Les tests du protocole couvrent également le refus d’un retour erroné ou répété et le repli vers le reset.

## Mesure historique avec reset


La révision 199 de SIC gagne le L6 en campagne en **116 coups**, reprise comprise. Le site local 64925 ouvre le L7 avec six niveaux crédités à 36, 68, 110, 189, 251 et 367 actions cumulées. Le témoin en révision 197 restait au L6 à la limite de 120 coups. Le moteur de jeu est identique. [Lancer SIC depuis le L1](http://127.0.0.1:64925/?game=SS01&runThrough=6#playground)

## La décision perdante

Après le coup 28 du L6, le miroir est en (3,5) et le marchand en (3,6). SIC prépare une expérience pour déplacer une pièce à distance. Sa poussée vers le haut au coup 29 fonctionne exactement comme prévu. Le miroir arrive en (3,4). Sur le terrain alors disponible, il reste **zéro direction de poussée** permettant à la fois une position d’appui et une destination sur le sol. Le détecteur précédent laissait passer ce retour puisqu’il s’agissait d’un déplacement expérimental réussi.

Le témoin continue pourtant à produire des effets intéressants. Au coup 31, il téléporte la caisse et au 41 il crée une plateforme. Une recherche indépendante dans le moteur explique pourquoi ces effets ne suffisent plus. Les **5 259 configurations physiques atteignables** après la poussée perdante ne contiennent aucune victoire. En sacrifiant une ressource, le miroir peut encore prendre trois positions sur la même ligne, sans pouvoir revenir en (3,5). Juste avant cette poussée, chacune des quatre autres commandes laisse une suite gagnante. Le bouton manuel *Undo* restitue exactement l’image d’avant la poussée.

## Décider et vérifier la reprise

SIC examine maintenant aussi les poussées expérimentales dont le déplacement est confirmé. Il compare les directions de poussée avant et après, d’après les cases de sol, et cherche si la sortie peut encore être atteinte dans le modèle acquis. Cette recherche accorde même aux pièces des transferts indépendants et autorise les immersions hors de l’itinéraire prévu. Un budget épuisé ou une route encore possible laisse l’essai continuer.

Pour engager le reset, SIC doit également projeter une suite jusqu’au but **depuis l’état antérieur en excluant la poussée perdante**. Il peut utiliser le transport passif d’une pièce vérifié lors du niveau précédent, après avoir recalibré les directions du mécanisme sur les observations du niveau courant. Le reçu garde les références aux deux observations, les possibilités de poussée perdues et la longueur de l’alternative. La projection reste soumise aux retours de chaque action.

Le reset automatique déjà disponible restitue l’entrée du niveau, conserve les cinq crédits précédents et transmet au pilote la poussée à écarter ainsi que l’alternative. Les commandes jusqu’au point de décision sont à nouveau choisies par SIC. En retrouvant l’image du point de décision, il peut reprendre le plan préparé depuis cette image. La logique de décision ne reçoit ni identifiant de jeu, ni position du miroir, ni séquence de solution. [Détection et reprise](../../../src/sic/contact-frontier.ts) · [Recherche des possibilités restantes](../../../src/sic/compose-support-plan.ts)

| Coup du L6 | Preuve dans la campagne autonome |
|---|---|
| 29 | Les commandes et images sont identiques au témoin jusqu’à la poussée comprise. SIC demande son unique reset. Le retour montre l’image initiale du L6 et toujours cinq crédits. |
| 58 | L’image publique est exactement celle d’avant le coup 29. Le reçu exclut la poussée vers le haut et annonce une alternative de 53 commandes. Cette fois, SIC descend et laisse le miroir en (3,5). |
| 70 | Un nouveau reçu annonce 47 commandes restantes. Le pilote a réajusté le plan en cours de partie. |
| 116 | Le moteur crédite le niveau et ouvre le L7. La seconde tentative a pris 87 coups. |

Le paquet JavaScript vérifié sur le port 64925 est `index-DuzbDRd7.js`. En entrée directe au L6 avec une mémoire neuve, les deux révisions donnent les mêmes commandes et les mêmes images pendant 120 coups. La première caisse tombe dans l’eau au coup 51 et SIC reste sur l’île de départ, avant de pouvoir pousser le miroir. Cet essai à froid se termine sans crédit et sans reset.

## Reproduction

Avec Node 24, exécuter les deux révisions séparément depuis leur racine et utiliser un fichier de sortie neuf pour chacune. Fixer les variables PowerShell `$env:SIC_STUDY_SOLVER='sic'`, `$env:SIC_STUDY_WORKERS='1'` et `$env:SIC_STUDY_RECORD_COMMANDS='1'`, puis lancer `node scripts/compare-source100.mjs . . campagne.jsonl SS01 1 6 120`.

Sur le candidat, exécuter `node docs/diagnostics/sic-plan-arbitration/ss01-l6-verifier-reprise.mjs temoin.jsonl candidat.jsonl`. Le vérificateur compare les premières commandes et images, rejoue les commandes des deux côtés du reset, contrôle le retour du même niveau, le changement de décision au point critique et le sixième crédit. Il vérifie aussi le bouton *Undo* indépendamment de la méthode de reprise choisie par SIC. Un atelier séparé vérifie qu’un mécanisme immobile peut toujours livrer une pièce qui débloque la sortie ; dans ce cas la preuve d’impasse s’abstient. [Vérificateur de campagne](./ss01-l6-verifier-reprise.mjs) · [Test de la livraison encore possible](../../../tests/sic-cumulative-support.test.ts)
