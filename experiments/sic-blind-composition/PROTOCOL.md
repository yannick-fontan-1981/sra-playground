# Banc à l’aveugle de composition entre mécaniques

Le moteur de référence est `fb8d6913addd23f5dd1cc375f96f9a69b2410b21`. SS08 à SS25 sont exclus des entrées, du développement et du rejeu. Ce lot ne modifie aucune source de production.

L’opérateur de réserve conserve hors dépôt les instances, les mondes vrais et ses attendus. Il scelle le fichier d’instances par SHA-256 avant de lire et d’exécuter le candidat figé. Il ne transmet que l’empreinte, la taille du lot et le verdict agrégé. Un seul passage du candidat sur cette réserve est créditable. Toute correction après le verdict demande une nouvelle réserve pour prétendre au même degré d’aveugle.

## Protocole

- Les deux bras reçoivent le même modèle hypothétique public, le même objectif, les mêmes commandes et les mêmes retours dans la mesure où ils exécutent le même préfixe. Au départ, toutes les hypothèses du domaine sont compatibles. Seul le simulateur connaît le monde vrai. Les deux bras sont froids et lancés dans des processus distincts.
- Chaque bras dispose de 12 commandes physiques et 12 000 états de recherche pour la partie. Les deux utilisent le `composePlan` de production pour rechercher un plan linéaire. Le bras figé peut suivre un préfixe commun ou jouer une sonde partagée puis réévaluer. Le bras actif cherche aussi une suite conditionnelle aux retours publics, avec au plus une branche par observation distincte. Une projection n’est jouée que sur le retour qu’elle attend. Les deux refusent un geste immédiatement perdant dans un monde encore compatible.
- La politique reçoit des vues symboliques et des hypothèses déclaratives. Elle n’extrait pas les faits d’un raster réel dans ce lot. Le bras figé modélise un répertoire à préfixes linéaires dans le banc. Ce protocole ne rejoue pas l’intégralité des 98 démarches dans les moteurs de jeux.
- Le passage à un autre terrain repart à froid. Dans le bras transfert, un retour source ayant départagé une commande pour un rôle compatible peut ordonner des plans de coût égal. Toutes les hypothèses de la cible restent en jeu. Un transfert est compté comme consommé si le retrait du seul acquis change une décision réellement exécutée.
- Le protocole compare les victoires officielles du terrain, les gestes, les états de recherche, la première décision divergente, les refus sous ambiguïté et les transferts effectivement consommés. Les témoins résolubles robustement et les paires sans décision commune ont des dénominateurs distincts.
- Le seuil de passage du pilote est un gain net de victoires dans au moins deux familles réservées distinctes, aucune victoire du bras figé perdue, aucun geste illégal et aucun engagement préjudiciable dans les paires à vérifier. Pour rouvrir SS08–SS25, le gain doit aussi être confirmé par un candidat raccordé au moteur natif. Sur le lot pilote, une économie de gestes à victoires égales documente le coût et reste en dehors du seuil de gain.

## Format remis à l’opérateur

Fichier JSON v1 avec `cases` et `transfers`. Chaque cas porte `id`, `family`, `domain`, l’index privé `actualWorld` et éventuellement `pair`. Le domaine public porte `objective: "win"`, la liste ordonnée `actions`, `budget: {commands: 12, states: 12000}`, les `worlds`, et éventuellement `scope`. Chaque monde fournit `start`, `nodes` et les liaisons d’hypothèse facultatives `roles`. Chaque nœud porte une `view` publique et, soit son `outcome` terminal, soit une transition `next` totale sur les commandes. Les mondes d’un même domaine ont la même vue de départ. Une paire indiscernable réemploie le même domaine dans deux mondes vrais différents. Un transfert porte `from`, `to` et `role`.

## Confirmation avec tickets V6

Le deuxième lot utilise des instances fraîches et scellées séparément. Avec `--native`, les deux bras passent par le même `V6AgentService` et le même `NativeV6Runtime`. Un adaptateur représente le signal public et les commandes du terrain construit dans un raster. Chaque geste doit avoir un ticket natif lié à un point autorisé. Chaque retour est mesuré par le comparateur natif et scellé avant le suivant. Le même seuil et les mêmes budgets s’appliquent.

Ce lot confirme la chaîne autorisation, jeu, retour et reprise sur des terrains construits. Les modèles déclaratifs publics restent fournis aux deux bras. L’acquisition de ces modèles par la perception d’un jeu source fera l’objet d’une validation distincte avant la première campagne SS08–SS25.
