# SS01 L5 · Découverte et réutilisation du transport d’une pièce

SIC révision 197 gagne le L5 en **62 coups** après une campagne commencée au L1. Sur le site local 64925, l’interface affiche cinq niveaux crédités, le L6 ouvert et 251 actions au total. Les scores successifs sont 36, 32, 42, 79 et 62. Le témoin, révision 195, gagnait les quatre premiers dans les mêmes budgets et échouait au L5 à 120 coups. Les deux campagnes ont utilisé SIC, le moteur natif et un seul pilote. Le paquet livré est `index-Wcfc-UcC.js`. [Rejouer depuis le L1](http://127.0.0.1:64925/?game=SS01&runThrough=5#playground)

| Coup du L5 | Décision ou retour mesuré |
|---|---|
| 26–27 | Le marchand traverse puis revient. Ces deux observations fournissent des exemples locaux du geste autour du mécanisme dans deux directions. La loi héritée utilisée à l’entrée ouvrait les directions opposées. |
| 28 | Première différence de commande ou d’image avec le témoin, au coup total 217. SIC part préparer une expérience de 14 commandes. Son reçu désigne la pièce, sa position de départ, sa réception en (12,7) et quatre directions de poussée prédites. |
| 41 | Le marchand reste en (13,9), le miroir en (12,9). La caisse disparaît de (10,9) et apparaît en (12,7). Le reçu avait annoncé les deux issues possibles. Un contrôle indépendant du moteur vérifie les quatre poussées depuis des positions que le marchand peut effectivement rejoindre. |
| 42 | SIC utilise l’observation du coup 41 comme preuve dans un plan vers la sortie. Le second transfert prévoit cette fois une arrivée sur l’île de gauche. La case y devient utile lorsque le marchand peut lui-même rejoindre l’autre rive. |
| 50–53 | La caisse traverse seule en (7,11). Le marchand traverse au coup 52 puis pousse la caisse à gauche au coup 53. Dans la même fenêtre, le témoin condamnait le miroir par une poussée vers le bas. |
| 58–62 | La caisse devient une plateforme en (6,8). SIC vérifie l’entrée sur le nouvel appui au coup 59 puis atteint la sortie au 62. Aucun reset. |

## Ce qui a changé dans SIC

Le candidat conserve l’apparence d’une pièce dont il a déjà vérifié l’effet sur un terrain. Une variante visuelle proche fournit une raison de la tester. Quand la composition connue échoue, SIC essaie la loi d’un transport déjà observé avec cette pièce comme sujet de l’effet. Il recalibre les directions avec les observations du niveau courant. Il projette des placements du mécanisme, écarte les arrivées occupées et privilégie un essai réversible qui laisse le sujet contrôlé immobile. Il classe les arrivées selon les directions de poussée nouvellement accessibles, puis selon le nombre de commandes nécessaires.

Le reçu fixe l’issue attendue avant l’activation. La confirmation exige que la pièce soit présente au départ, absente de la destination avant l’action, puis présente à la destination et absente du départ après l’action. Le marchand doit conserver sa position. Le témoin est rattaché au sujet contrôlé, au rôle de la pièce, au rôle du mécanisme et à la commande. Une fois cet effet vérifié, SIC peut composer le déplacement du marchand, celui du mécanisme, le transport de la pièce et sa poussée à destination. Le changement de terrain reste à vérifier par une entrée effective sur la case. [Planification générique](../../../src/sic/passenger-transport.ts) · [Acquisition et vérification](../../../src/sic/contact-frontier.ts)

La stratégie exploite les acquis de la campagne et respecte les bornes du pack de recherche existant. Le moteur de jeu, les cibles, les positions et l’oracle restent du côté de la qualification. Une seconde scène de test utilise un échangeur horizontal, un autre plateau et des commandes nommées différemment. Le planificateur y choisit une arrivée donnant quatre poussées, puis compose un passage vers le but. Les contre-épreuves vérifient l’abstention quand le transport ne possède pas d’inverse ou que le budget de profondeur est nul. Ce test isole le planificateur. Le transfert autonome du comportement complet à un second jeu reste à mesurer. [Test indépendant](../../../tests/sic-passenger-transport.test.ts)

## Reproduire la mesure

Avec Node 24 depuis la racine, utiliser un fichier de sortie neuf. Le second argument facultatif du vérificateur est la trace du témoin. Il permet de comparer les commandes et les images avant et après chaque geste jusqu’à la première divergence.

```powershell
$env:SIC_STUDY_SOLVER = 'sic'
$env:SIC_STUDY_WORKERS = '1'
$env:SIC_STUDY_RECORD_COMMANDS = '1'
node scripts/compare-source100.mjs . . campagne-l5-197.jsonl SS01 1 5 120
node docs/diagnostics/sic-plan-arbitration/ss01-l5-verifier-campagne.mjs campagne-l5-197.jsonl
```

Le vérificateur rejoue uniquement les décisions enregistrées après la campagne. Il contrôle les crédits du moteur, les retours physiques aux deux transferts, le lien entre le premier témoin et sa réutilisation, les poussées accessibles et l’entrée sur la plateforme. Le meilleur chemin connu et vérifié par recherche exhaustive compte 38 coups. La différence de 24 coups mesure ici le coût total supplémentaire de la campagne autonome au L5. [Vérificateur](./ss01-l5-verifier-campagne.mjs) · [Oracle et diagnostic du témoin](./ss01-l5-oracle-caisse-marquee.md)
