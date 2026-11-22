# SS01 L4 · Planifier le pont et récupérer après un blocage

**SIC gagne le L4 en 79 coups en campagne.** Sur le site local, port 64925, Chrome affiche les crédits cumulés aux coups 36, 68, 110 et 189 puis ouvre le L5. Le pilote livré correspond au commit `4a2b4bbc`, à la révision native SIC 195 et au paquet JavaScript `index-CzM2sZRq.js`. [Rejouer la campagne](http://127.0.0.1:64925/?game=SS01&runThrough=4#playground)

## Ce que décide SIC

L’entrée sur une case transformée au L3 fournit un témoin de capacité. Le L4 hérite du rôle de l’objet, de l’aspect du terrain, du sujet qui a vérifié l’entrée et des références aux observations correspondantes. Les anciennes coordonnées de plateforme restent dans le niveau précédent. La même apparence peut servir à la fois d’indicateur et d’objet manipulable.

Le pilote cherche des groupes de cases dont la transformation relierait deux régions. Il attribue chaque case à une pièce physiquement distincte. Pour un terrain futur donné, il calcule à rebours les positions d’où une pièce pourrait être poussée, y compris la case nécessaire derrière elle. Il compare ensuite des suites de poussées, de déplacements et de transports appris. Chaque transformation retire l’objet consommé et ajoute un appui hypothétique pour les opérations suivantes. Le reçu expose les cases à préparer ainsi que leurs usages futurs. Le pilote confronte chaque déplacement au retour public, distingue une conversion prévue d’une entrée effectivement observée et réexamine la suite si le résultat contredit la prédiction.

Le choix au L4 se lit avant la première immersion. Le plan réserve (9,6) au passage du miroir et au placement du pousseur. Il réserve (9,8) pour faire passer la seconde caisse du bas et pour la descente ultérieure du miroir. Il prévoit ensuite (9,7), qui complète la voie. Les coordonnées ici servent au compte rendu. La logique de décision les déduit de la scène publique et du témoin acquis au L3.

| Coup du L4 | Décision ou retour mesuré |
|---|---|
| 1 | Le reçu annonce 79 commandes jusqu’au but, les trois immersions et leurs usages. Il cite l’entrée vérifiée au L3 (révision publique 108). La première commande est gauche. |
| 4 | Le marchand monte de (11,5) à (11,4). Le miroir reste en (12,5). |
| 11 | La caisse du haut crée le pont en (9,6). Le miroir le traverse au coup 20. |
| 26 | Le marchand atteint l’îlot inférieur gauche par reflet. |
| 33 | La première caisse du bas crée (9,8). Le reçu associait déjà cette case au transit de la deuxième caisse et à celui du miroir. |
| 52 | La seconde caisse crée (9,7) et complète la voie descendante. |
| 77–79 | Le reflet envoie le marchand en (14,10), puis il rejoint la sortie. Le moteur ouvre le L5. |

Les 110 premières commandes et leurs images avant et après sont identiques au témoin. Les 79 commandes du L4 déplacent toutes le marchand. L’oracle manuel précédent compte 77 commandes.

## Prévenir et récupérer

Le témoin de l’étude poussait le miroir au coup 4 dans une position qui rendait le bas inaccessible. Dans la campagne libre, le nouveau pilote conserve une suite jusqu’à la sortie avant d’engager les transformations. Dans une expérience séparée, l’évaluateur a laissé les anciennes décisions s’exécuter jusqu’au coup 4, y compris la poussée perdante. L’acquisition de connaissances est restée active à chaque commande.

Pour demander un reset, SIC doit observer le déplacement du sujet et du mécanisme, retrouver un plan témoin avant la poussée et épuiser les possibilités du modèle acquis après celle-ci. La recherche de blocage accepte tous les dépôts de pièces sur une frontière et les transports du modèle. Si elle atteint son budget avant d’avoir terminé, elle s’abstient. Le contrôle de reprise existant restaure l’entrée du niveau et le pilote mémorise le geste à écarter dans cette disposition. Une même preuve ne déclenche pas une boucle de resets.

La campagne libre consomme zéro reset. Dans le contrôle tardif, les 114 commandes et empreintes d’images sont identiques au témoin jusqu’à la poussée perdante incluse. SIC déclenche un reset immédiatement après le coup 4, préserve les trois crédits antérieurs puis gagne au coup 83 du budget L4 (4 avant le reset, 79 après). La commande de contrôle RESET est comptée séparément.

## Vérifier

Les essais utilisent le même moteur de jeu et un budget de 120 actions par niveau pour le témoin et le candidat. Le site a été vérifié par son parcours normal en mode SIC, depuis le L1. La recherche emploie les limites `maxDepth` et `maxNodes` du pack. Elle privilégie les couloirs courts entre régions et peut manquer une construction qui exigerait un détour ou des capacités encore inconnues.

À la racine du checkout, avec Node 24 et des chemins JSONL neufs :

```powershell
$env:SIC_STUDY_SOLVER = 'sic'
$env:SIC_STUDY_WORKERS = '1'
$env:SIC_STUDY_RECORD_COMMANDS = '1'
node scripts/compare-source100.mjs . . campagne.jsonl SS01 1 4 120 0/1

$env:SIC_STUDY_CONTACT_CHECKPOINT_EPOCH = '4'
$env:SIC_STUDY_CONTACT_FROM_REVISION = '115'
node --import ./scripts/sic-study-contact-checkpoint.mjs scripts/compare-source100.mjs . . reprise.jsonl SS01 1 4 120 0/1
```

Un test indépendant utilise un atelier sans miroir avec deux dalles et un fossé de deux cases. Le premier reçu prévoit le transit de la seconde dalle sur la première. Un inventaire réduit à une seule dalle ne fournit pas de plan. Un autre test compare la fermeture exhaustive d’une région à l’arrêt d’une recherche par manque de budget. [Tests de composition et de récupération](../../../tests/sic-cumulative-support.test.ts) · [Diagnostic du témoin et oracle manuel](./ss01-l4-oracle-pont-du-miroir.md)
