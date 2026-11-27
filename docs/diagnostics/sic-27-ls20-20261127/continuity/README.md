# LS20 : retours exécutés et contrôle des phases

Le collecteur standard a reproduit les **sept scores en 393 commandes**, depuis le niveau 1 dans une seule session SIC, avec un seul worker. Les comptes sont **15, 45, 41, 43, 48, 94 et 107**. L'empreinte de la suite des commandes, images, animations et scores est exactement celle du rejeu strict `af3e957f` : `6541166c4d64796d06e108954750d594316b53e70ce94d0f11001fadce5d2eb7`.

La source du collecteur est `de683d72d652dab4913d99984039054c314ec13c`, sauvegardée sur GitHub sous `2d0a2542b2c0a4a289994be32224550858dd282d`, arbre `c9ea787743b347cf59a2f406bb93c940ba5b58f3`. Les mécanismes SIC et les scripts de qualification stricte sont identiques à ceux du passage strict. Le raccord ajoute seulement la collecte passive, avant l'envoi d'une commande, après son retour réel puis après la réconciliation native.

## Preuve physique conservée

Le niveau 6 comporte **11 séries de marche à phase connue**, de longueurs **5, 7, 2, 3, 2, 2, 7, 3, 5, 7 et 5** : **48 gestes et 37 continuations**. La période observée comporte huit phases. Le contrat relie chaque ticket à son plan et à son index, puis contrôle l'acteur, les trois stations, le glyphe affiché, le débit réel de réserve et les références effectivement acquises dans l'ordre à l'unique clôture.

Aux commandes globales 223, 248 et 265, une station est entièrement masquée par l'acteur avant le premier geste de la série. Ces trois mesures restent `null` dans les données. Le contrat autorise ce manque uniquement à l'index zéro, pour une seule station dont la position déjà acquise coïncide avec l'acteur mesuré. Les deux autres stations doivent être visibles ; les trois doivent être visibles après ce geste et pendant chaque continuation comptée. Aucune position prévue ne remplace une mesure absente.

Le niveau 7 est unitaire dans ce passage. Aucune marche de phase n'est revendiquée pour les niveaux 1 à 5 ou 7. Le nouveau contrôle exige les 37 continuations physiques au niveau 6, proportionnellement au nombre de commandes du niveau, et permet les décisions unitaires aux autres niveaux.

## Limites et qualification

Cette collecte sert à vérifier les commandes et leurs effets. La qualification du temps reste le passage strict archivé dans le dossier parent : le score L6 est obtenu à 48,956 s sous 50 s, et L7 à 58,454 s sous 67 s. Le coût du collecteur n'est pas utilisé pour requalifier ces temps.

Les plafonds de commandes restent **20, 54, 50, 52, 58, 113 et 129**. Les 108 niveaux des 18 jeux déjà couverts gardent leurs cohortes et leurs plafonds ; LS20 ajoute sept niveaux, soit **115 niveaux, 19 jeux et 17 cohortes**. Chaque cohorte part du niveau 1 avec un worker. Les contrats exigent les scores, l'identité des tickets et une seule réconciliation de chaque série.

Les 50 tests passifs et contractuels LS20 passent. Le manifeste donne les empreintes des fichiers archivés. Les données brutes `results.jsonl.gz` sont celles du collecteur, sans réécriture ; le résultat n'expose pas de compteur d'undo, qui reste donc inconnu dans ce rapport. Le passage strict distinct atteste zéro reset et zéro undo. La CI complète et le viewer publié sont des contrôles d'intégration ultérieurs, non revendiqués par cette archive.
