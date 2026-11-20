# Poursuivre un plan ou expérimenter

## Traces utilisées

Le banc relit les six partitions historiques `projection-v1-source-*.jsonl` par ordre chronologique dans chaque jeu. Il y a 100 jeux de niveau 1, 2 926 commandes et 60 commandes au plus par niveau. Les scores finaux servent uniquement à grouper les résultats après mesure. L’empreinte SHA-256 des transitions réduites est `9e8000a1d1da27f3e9ca3473ecbac3f7775012a742658f2aa1becb4af40783a7`.

| Issue du niveau | Niveaux | Commandes | Nouvelles images | Occasions d’expérimenter | Niveaux avec une occasion |
|---|---:|---:|---:|---:|---:|
| Victoire | 66 | 952 | 643 | 23 | 2 |
| Niveau inachevé | 34 | 1 974 | 947 | 269 | 12 |

Une occasion exige que le dernier coup n’ait ouvert aucune nouvelle image. Elle demande également trois répétitions de transitions ayant changé l’image dont une récente, ou six retours vers des images connues dont deux récents. La fenêtre récente couvre huit commandes. Ces seuils proviennent du travail antérieur sur les 100 sources. Une répétition peut être utile jusque dans une partie gagnante. Elle ouvre donc une possibilité d’essai dont la place dépend des autres plans.

## Décision intégrée dans SIC Fallback

1. Conserver les stratégies ordonnées de `main`, y compris la poursuite d’un plan en cours. Si une autre stratégie vient d’ouvrir un état public inédit, lui laisser proposer la suite.
2. Accorder une priorité précoce à une prédiction que SIC peut mettre à l’épreuve maintenant. Sont admissibles un contact qui a précédé une terminaison officielle, un effet visible confirmé au niveau précédent ou un programme qui annonce une arrivée hors de la zone accessible. Après l’exécution d’un pas, la suite reste soumise aux observations du sujet et du repère. Une contradiction invalide l’engagement concerné.
3. Lorsque les stratégies spécialisées ont décliné, considérer les retours mesurés avant de reprendre l’exploration générale des commandes. En dernier recours, tester une autre préparation disponible. Les branches d’arbitrage consultent la même mémoire du niveau.
4. Réévaluer à la commande suivante. Un seul état nouveau suffit à suspendre la priorité acquise par répétition. L’apprentissage passif se poursuit, quelle que soit la stratégie qui agit.

L’analyse chronologique se reproduit avec `node scripts/audit-plan-arbitration.mjs <six fichiers JSONL>`. Les exemples sources peuvent réfuter le déclencheur. Ils ne donnent aucune garantie de victoire individuelle.

## Protocole arrêté avant l’essai Custom 4

Le témoin de préservation est `main` au commit `f3b4edc227b0f375108002d0243539901a2d5cf9`. Le témoin du transfert est v30, `124a8322c73bff333dac919c8a62e8b29318076c`. Le moteur d’évaluation est `f4d28aee9ebbb35533bb97a26968efd22887473d`. Le candidat combine ces deux lignées sur une branche de travail. Le tag avant évaluation est `sic-source100-plan-arbitration-v31`.

- Précondition source avant le gel. SKBN, SWCH, KEYD et GABA L1 doivent reproduire les victoires de `main` au budget de 90 commandes par jeu. Les quatre trajectoires de qualification sont identiques commande par commande et image par image.
- Transfert. Rejouer les 19 commandes publiques de la leçon historique du L1, puis laisser le sélecteur natif décider seul au L2. Comparer le score, les commandes et les images au parcours publié de 32 commandes.
- Départ direct. Entrer directement au niveau 2 avec une nouvelle mémoire et les seules observations publiques du niveau. Autoriser jusqu’à 1 200 commandes avec l’horloge normale du moteur. Vérifier le score et le nombre de commandes effectivement exécutées.
- SS09 L2 reste en réserve. Chaque essai du niveau cible sert uniquement à mesurer la version figée.
