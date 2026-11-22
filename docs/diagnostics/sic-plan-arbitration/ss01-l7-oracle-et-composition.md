# SS01 L7 · Créer une case pour le miroir et une case pour le marchand

## Oracle reproductible

Coordonnées logiques à partir de zéro, origine en haut à gauche, x vers la droite et y vers le bas. H, B, G et D sont les quatre déplacements. X active le miroir. Chaque lettre compte pour une action.

| Coups | Commandes | Résultat constaté dans le moteur |
|---|---|---|
| 1–10 | `B G B B B G H G H X` | Déplacer le miroir à gauche. X place la caisse de l’îlot de droite en (11,8) et laisse le marchand en (11,9). |
| 11–18 | `H X D H G B G H` | Le coup 11 crée le sol en (11,7). Le coup 18 pousse le miroir sur ce sol, au bord **supérieur gauche de l’îlot de droite**. |
| 19–21 | `B B X` | Depuis (11,10), le marchand rejoint (8,7) sur l’îlot du haut à gauche. |
| 22–30 | `H G H G H G B B X` | Amener la dernière caisse en (5,7). Le marchand reste en (5,6) pendant que X envoie la caisse en (11,13), dans l’eau au contact de l’îlot de sortie. |
| 31–32 | `B X` | Le marchand prend la place de départ de la caisse en (5,7), puis se téléporte sur le nouveau sol en (11,13). |
| 33–37 | `G G G H G` | Descendre de la plateforme sur l’îlot et rejoindre la sortie en (7,12). |

L’oracle a été recherché dans le moteur en imposant l’ordre des deux supports et l’usage de la seconde plateforme par le marchand. Sa longueur porte sur ce parcours. Le pilote SIC reçoit uniquement les observations et commandes publiques.

## La déduction spatiale

L’îlot du départ compte 19 cellules sèches, celui du haut à gauche 17 et celui de sortie 15. Le miroir échange l’ouest et le sud à distance égale. En partant des cases d’eau qui jouxtent l’îlot de sortie, on peut remonter du point d’arrivée au point de départ. Si le point de départ doit appartenir à l’îlot du haut et si le miroir doit rester sur l’îlot de droite ou sa première couronne, une seule disposition convient. Le miroir doit être en (11,7), la charge en (5,7), et la réception en (11,13). Les deux bras mesurent six cases. Depuis (11,10), trois cases sous ce même miroir, le marchand peut déjà accéder à (8,7) pour préparer la charge.

Un parcours exhaustif des quatre déplacements seuls visite **11 797 configurations physiques** sans atteindre la sortie. Le vérificateur retire ensuite, depuis trois états de l’oracle, le premier support, la capacité de transport de la deuxième caisse, puis le support d’arrivée. Le même geste perd à chaque fois son effet attendu.

La première caisse crée une position jusque-là interdite **au mécanisme**. La seconde crée une destination jusque-là interdite **au marchand**. Le gain de la première poussée ne se mesure donc ni à la distance du marchand à la sortie, ni au nombre d’îlots qu’il peut immédiatement atteindre.

## Ce qui manquait dans SIC

Le témoin en révision 199 entre au L7 avec des observations de transfert passif et de conversion d’une caisse en support. Dès le premier coup il prévoit une victoire en 21 actions avec une liste de préparations vide. Au coup 2, il active le miroir, prédit un changement de cellule du marchand, et l’image suivante le montre resté sur place. Le témoin épuise ses 120 coups. Son ajustement géométrique mélange les orientations rencontrées en campagne.

La révision 201 associe à chaque observation de transfert la silhouette du pivot. Elle transpose les écarts de départ et d’arrivée selon les rotations et symétries compatibles avec la silhouette courante. Pour les transferts réciproques, elle remonte depuis le bord d’une région isolée, cherche une source et un emplacement de pivot compatibles, puis affecte les ressources nécessaires à ces deux préparations. Les gestes de marche, poussée et activation doivent rester réalisables dans la recherche bornée par le pack.

Deux contrôles de perception maintiennent le plan pendant son exécution. Si un indicateur recouvre le marchand, sa couleur peut encore le localiser lorsqu’elle est confinée à une seule cellule avant et après l’action. Si la prévisualisation recouvre le terrain, le plan conserve l’observation du substrat antérieure au recouvrement. Le dépôt reste conditionnel jusqu’à l’entrée effective. Le reçu distingue le transfert sur sol, le dépôt sur terrain transformable et l’accès du marchand. Les emplacements, couleurs, rôles et commandes du jeu sont absents de la logique de choix.

## Attribution et résultat en campagne

À la même première image du L7, nous avons rejoué les observations publiques du préfixe pour rattacher les silhouettes aux témoins de transfert. Les quatre essais ci-dessous confrontent **la première proposition complète** au moteur, sans réajustement. Ils utilisent les mêmes limites de recherche, 1 000 configurations et 88 actions de profondeur. La campagne autonome autorise le réajustement à chaque action.

| Géométrie utilisée | Recherche | Longueur proposée | Supports prévus | Crédit au rejeu |
|---|---|---:|---:|---:|
| Témoins de toutes orientations mélangés | Composition précédente | 21 | 0 | 0 |
| Témoins de toutes orientations mélangés | Recherche d’un site de réception | 31 | 1 | 0 |
| Témoins rapportés à l’orientation visible | Composition précédente | Aucune proposition | — | 0 |
| Témoins rapportés à l’orientation visible | Recherche d’un site de réception | 37 | 2 | 1 |

Sur le site local 64925, une nouvelle session en mode **SIC**, démarrée au L1 avec sept niveaux demandés, affiche « Level completed. », sept crédits et le L8 à 404 actions. Les crédits précédents apparaissent à 36, 68, 110, 189, 251 et 367 actions. Le L7 coûte donc **37 actions autonomes**. Le témoin en révision 199 obtient six crédits au même budget de 120 actions par niveau. L’oracle est conservé dans les diagnostics, hors du chemin d’exécution du pilote.

Le rejeu instrumenté confirme les mêmes commandes et images sur les 367 premières actions du témoin et du candidat, reprise du L6 comprise. Le premier mouvement du L7 est également identique. Le premier reçu diffère dès ce mouvement, et la première commande différente arrive au coup 2, gauche pour SIC 201, activation pour SIC 199. SIC transfère la première caisse au coup 8, alors que l’oracle le fait au coup 10. Les deux réussites convergent sur les effets des coups 11, 18, 21, 30 et 32. Les 404 commandes de la campagne autonome ont été rejouées avec contrôle des empreintes d’image du moteur.

Le scénario à échange horizontal contrôle la réutilisation de la composition avec une autre géométrie et un seul support. L’essai officiel concerne SS01 après apprentissage des niveaux précédents. La campagne à froid au L7, les 100 jeux sources et les autres jeux Custom 4 restent hors de cette mesure.

## Reproduction

Avec Node 24, depuis la racine du checkout, exécuter `node docs/diagnostics/sic-plan-arbitration/ss01-l7-verifier-oracle.mjs`. Le vérificateur lit les actions du tableau, contrôle les effets critiques dans le moteur, retire chacune des trois conditions à tour de rôle et vérifie le crédit du niveau. Il explore aussi les configurations accessibles par les quatre déplacements seuls. Le scénario indépendant de `tests/sic-transport-landing.test.ts` utilise un échange horizontal et une seule charge. Il vérifie le dépôt, l’entrée et l’abstention quand une preuve ou le budget manque.

Pour la comparaison de campagne, fixer en PowerShell `$env:SIC_STUDY_SOLVER='sic'`, `$env:SIC_STUDY_WORKERS='1'` et `$env:SIC_STUDY_RECORD_COMMANDS='1'`. Avec le témoin `840aeb64852f` puis le candidat, lancer `node scripts/compare-source100.mjs . . campagne.jsonl SS01 1 7 120`, en choisissant deux sorties vierges distinctes. Passer les deux fichiers dans cet ordre au vérificateur, suivis de `120`, pour contrôler le préfixe et rejouer chaque empreinte d’image.
