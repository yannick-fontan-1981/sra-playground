# Reprise SIC locale à preuve observée

## Reprise locale après un effet qui ferme une voie

Les deux premières cohortes comparent le moteur figé à l’option de composition déjà disponible. La seconde donne exactement 36 niveaux sur 36 à chaque bras et les mêmes commandes sur les douze jeux. Sur SS01 N6, le premier témoin standard joue 80 commandes et effectue une réinitialisation du niveau, à victoires égales dans les deux bras.

Le nouveau candidat vérifie une hypothèse différente. L’acquisition de la poussée détecte la perte de mobilité et construit une réparation dans le modèle tiré des retours. Quand l’interface autorise l’annulation, le service vérifie l’ancienne image, les commandes disponibles, le niveau et le score, conserve la seule réparation rattachée à ces deux observations, puis recalcule le ticket. La poussée réfutée est exclue du nouveau plan. Les commandes déjà dépensées restent au compteur. Sans preuve actuelle ou sans annulation disponible, la reprise ordinaire s’applique.

SS01, SS04, COMB et DC22 repartent du niveau 1. Les deux bras gardent les plafonds archivés et le même moteur de jeu. Le bras actif combine `motion_contrast`, qui conserve la comparaison du sujet contrôlé, et la reprise locale expérimentale. L’activation large précédente a remplacé un clic de composition DC22 au geste 391 par une préparation de placement et perdu le niveau 6. DC22 sert de contrôle de cette régression. Sur SS01, un troisième bras active le même contraste et conserve la réinitialisation pour attribuer séparément tout changement au mode de reprise. Aucun jeu SS08 à SS25 n’est utilisé.

## Reçus vérifiés à budget égal

La [campagne de qualification](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46137244356) exécute `42f0bf1512730db1cdd843714e60bc2a0df09c60`, arbre moteur `bbf754a3df5c720680e9c7186d16895980668cb3`. Sur SS01 et COMB, les empreintes des reçus et du fichier de budgets concordent. Tous les gestes sont autorisés par SIC dans les reçus.

| Jeu ou portion | Figé | Actif | Actif sans reprise locale |
|---|---:|---:|---:|
| SS01, niveaux 1–6 | 6 victoires / 366 gestes | 6 / 338 | 6 / 366 |
| SS01, niveau 6 seul | 116 gestes, 1 réinitialisation | 88 gestes, 1 annulation | 116 gestes, 1 réinitialisation |
| COMB, niveaux 1–6 | 6 / 90 | 6 / 85 | — |
| SS04, niveaux 1–6 | 6 / 280 | 6 / 280 | — |

Sur SS01, le reçu lie la perte de mobilité observée au retour qui la révèle et atteste une réparation de 53 gestes à partir de l’image précédente. Le reçu natif `action_undo` cite exactement le retour de perte. L’ablation reproduit les 116 gestes et les mêmes effets que le figé. Sur COMB, le deuxième geste compare le sujet contrôlé et le retour suivant valide le contrôle au passage de niveau. Les deux gains portent sur des mécanismes différents, avec autant de niveaux franchis dans chaque bras.

DC22 garde la régression avec ce premier candidat. Au geste 391, le clic de composition factuelle du témoin change 120 pixels. Le clic de sélection actif est stationnaire, et le retour du geste suivant ne confirme pas le transfert de contrôle. Le témoin gagne le niveau 6 en 258 gestes, le candidat s’interrompt au plafond de 271. Le candidat suivant essaie d’abord la continuation de composition acquise dans cette situation avant la nouvelle expérience de contraste, avec le même garde qui vérifie son applicabilité. Il doit préserver les deux gains et rétablir DC22 avant le rejeu sous scellés.

La [campagne de contrôle](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46138012897) exécute `cf27054ad34ed8faab0ad8b9e053418a07c8b452`, arbre moteur `4dbd9ec542f2050acebe80eef9a199edd35d7693`. Les sept contrats d’arbitrage, les 32 contrats de reprise et le typecheck passent. Un rejeu local sur `cf27054a` garde les deux premiers passages de COMB en 10 gestes avec les mêmes types de reçus de sélection et de contrôle. Le protocole SS08–SS25 est préparé sur une branche locale. Sa publication et son exécution attendent le contrôle de la régression DC22 et la reproduction des deux gains sur `cf27054a`.
