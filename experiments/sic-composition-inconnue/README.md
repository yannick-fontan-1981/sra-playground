# Premier essai sur des situations inconnues

Le même terrain public et les mêmes quotas alimentent deux politiques. La procédure figée observe la cible dès qu’elle le peut, essaie les commandes dans un ordre déterminé et attend leur effet avant d’avancer. Le candidat compose un préfixe de résolution à partir des effets possibles. Il anticipe les observations qui sépareront les hypothèses, choisit une suite pour chacun des retours encore compatibles et relit le résultat après chaque geste. Seul le terrain applique la commande et fournit son retour. Cet essai comparatif porte sur un simulateur original et les deux politiques de ce dossier. La qualification du branchement sur le moteur SIC fait l’objet des lots natifs du chantier.

## Données accessibles et objectif

Le candidat reçoit le mécanisme public, les commandes disponibles, le nombre de pas jusqu’à la porte, la règle de révélation de la cible, les quotas et les observations successives. Il doit atteindre la sortie désignée. La commande active, le délai, la durée d’ouverture et la sortie restent dans le terrain tant qu’aucun retour ne permet de les établir. Le domaine public contient des retards de 1 ou 2 gestes et des fenêtres de 3 à 5 gestes. Une impulsion peut être renouvelée. Une charge est utilisable une fois depuis la position initiale.

L’agent apprend la commande à partir d’un retour qui exclut les autres. Pour le transfert entre mécanismes, cette preuve rend une commande prioritaire dans le choix du prochain essai. Le nouveau monde conserve toutes ses hypothèses jusqu’au retour. Un contrôle inverse la commande active pour vérifier que le rappel demeure révisable.

## Exécuter

```powershell
node --test experiments/sic-composition-inconnue/rejouer.test.mjs
node experiments/sic-composition-inconnue/rejouer.mjs --cases experiments/sic-composition-inconnue/developpement.json --report "$env:TEMP/sic-composition-developpement.json"
```

Le rapport associe chaque décision au retour effectué, aux hypothèses encore compatibles et à la première décision différente entre les deux politiques. Le compteur de recherche du candidat borne les états développés sur la totalité d’un départ. Le rapport de transfert rejoue la seconde situation avec et sans la preuve acquise, à quotas identiques.

Le candidat recherche d’abord une suite qui réussit dans chaque hypothèse encore compatible. Si cette suite manque, il peut retenir une expérience qui permet d’avancer dans une partie du domaine et indique cette portée dans le reçu. Il ne traverse une sortie qu’après observation de la cible. Ces deux règles permettent de distinguer une expérience prudente sur la charge d’un pari irréversible sur la sortie.

Le fichier de développement sert à tester le lanceur et les deux politiques. L’opérateur conserve les situations réservées, enregistre leur empreinte avant évaluation et substitue ce fichier au fichier de développement une fois le candidat figé. Deux mondes qui restent indiscernables tout en exigeant des sorties incompatibles doivent conduire à une abstention et à l’identification de l’observation manquante.

## Rejeu par le service V6

Avec Node 24, `node --test experiments/sic-composition-inconnue/natif.test.mjs` fait passer les mêmes commandes de développement par le service V6. L’adaptateur transforme le terrain en observations raster et présente chaque sortie sous une coordonnée distincte. Une famille expérimentale demande un ticket par geste, puis contrôle et enregistre le retour. Le test compare les gestes autorisés, leurs propres références et les retours au comparatif direct. Les scènes restent celles du simulateur de ce dossier.

## Contre-épreuve sur l’accusé d’armement

Avec une charge unique, deux pas d’approche et une fenêtre de trois gestes, attendre la porte ouverte peut consommer le temps nécessaire pour lire la cible et sortir. L’essai `mesure-armement.json` compare deux observations d’un même terrain. L’option `armingSignal: true` rend visible le fait que la charge vient d’être consommée, alors que la porte est encore fermée. Le test vérifie d’abord l’égalité des retours physiques pour la même suite imposée, puis mesure si l’accusé change une décision et permet le franchissement.
