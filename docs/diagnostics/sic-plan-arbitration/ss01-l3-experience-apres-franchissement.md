# SS01 L3 — Éprouver un objet pour ouvrir une région

**SIC gagne le L3 en campagne en 42 commandes.** Le témoin du site 185 gagne L1 et L2 en 36 et 32 commandes puis épuise ses 120 commandes au L3. Le code du pilote a été figé au commit `e73e52ea97314a7a50c660cd5121f87a86688f9a`, sur la branche `codex/sic-purposeful-contact`. La conception a été guidée par le diagnostic de SS01.

## Campagnes comparées

Même moteur de jeu, même sélection SIC, départ au L1, budget de 120 commandes par niveau, un seul worker. Les décisions du candidat utilisent les observations publiques, les commandes disponibles et leurs retours. Le décompte physique des poussées, traversées et commandes stationnaires intervient après le jeu.

| Mesure au L3 | Témoin 185 | Candidat |
|---|---:|---:|
| Première poussée de caisse | Aucune | Coup 6 |
| Première arrivée sur l’îlot du haut | Coup 117 | Coup 10 |
| Première poussée sur cet îlot | Aucune | Coup 13 |
| Commandes qui laissent le marchand sur place | 81 | 0 |
| Plateformes créées puis foulées | 0 | 2 |
| Résultat du moteur | Plafond de 120 coups | L4 ouvert au coup 42 du L3 |

L1 et L2 conservent exactement les mêmes commandes et images. Au L3, la première commande est encore identique. Au coup 2, le témoin essaie de nouveau d’aller à droite contre le bord. Le candidat repart vers la gauche pour se placer derrière un objet. Son reçu annonce six commandes jusqu’au premier essai de transformation du terrain.

Le reçu du coup 2 cite la révision publique 44, acquise au L2, pour justifier qu’un contact peut déplacer un autre objet. Il n’a encore aucune preuve qu’une case d’eau deviendra praticable.

Aux coups 6 et 7, il déplace l’objet puis le pousse à la limite de deux régions. Le changement de l’image déclenche une question distincte. Au coup 8 le marchand marche effectivement sur la case modifiée. Dès le coup 9, le plan pour un autre objet et une autre limite cite ce retour dans `previousEntry` (révision publique 77). Le marchand atteint l’îlot du haut au coup 10. Le second objet sert à créer un passage au coup 38, suivi d’une vérification par déplacement au coup 39. L’agent entre sur la rive de sortie au coup 40 et gagne au coup 42. Cela représente six commandes de plus que la variante d’oracle de 36 coups vérifiée hors ligne. Les séquences d’oracle sont réservées au diagnostic.

## Comparaison depuis le coup 117 du témoin

Dans ce contrôle distinct, l’évaluateur suspend les propositions du nouveau mécanisme pendant les 68 commandes des L1 et L2 et les 117 premières du L3. L’agent acquiert chaque retour public. Les 185 commandes et les empreintes de leurs images avant et après coïncident avec le témoin. Le budget prolongé de ce contrôle permet de mesurer la continuation jusqu’au crédit officiel.

Au coup 118, le témoin réactive le reflet et revient sur l’îlot de départ. Le candidat monte vers l’objet encore intact. Il le pousse au coup 120, crée deux plateformes aux coups 126 et 147, puis gagne au coup 151. Il a donc choisi et exécuté 34 commandes après l’arrivée. Le point de comparaison appartient uniquement à l’évaluateur.

## Entrée directe au L3, mémoire de campagne vide

Même candidat, même moteur et 120 commandes. SIC arrive sur l’îlot du haut au coup 17. Au coup 18 il ouvre le projet `test_contact`, qui prévoit trois commandes. Il pousse l’objet au coup 20. Cela vérifie directement sur le jeu que l’exploration d’une nouvelle région peut se déclencher sans avoir joué L1 ni L2.

Au coup 21, le contrôle revient à `sic_public_input_exploration`. Une autre famille, `sic_test_observed_compositions`, crée une plateforme au coup 48 et le marchand la foule au coup 68. Le journal ne contient aucun nouveau projet de la stratégie de contact après le coup 20. Le second passage ne s’ouvre pas. **Échec à froid au plafond de 120 coups.** Ce qui reste à expliquer est la reprise, par le planificateur, d’une capacité observée pendant l’exécution d’une autre stratégie lorsque la sortie n’a encore jamais donné de crédit.

## Mécanisme transférable et limites

- Une fois les déplacements élémentaires étalonnés, une arrivée lointaine est comparée aux régions accessibles par marche ordinaire. Dans une région encore inexplorée, un objet compact permet de formuler une expérience locale avec une position d’approche, une commande de contact et un déplacement attendu.
- Lorsqu’un objectif a déjà été reconnu et que le pilote possède des observations de poussée, il compare les frontières qui séparent des régions. Il inclut la position requise du pousseur, les autres pièces à préserver et les transports appris par observation. Un objet déplacé jusqu’à une telle frontière peut ouvrir un passage. Cette hypothèse appartient au pilote. Le code fournit l’hypothèse générale qu’une frontière peut devenir praticable après un contact. L’objet à essayer, la case, les gestes et la confirmation effective sont déterminés en jeu.
- Les reçus distinguent l’approche, l’essai de contact, la vérification d’entrée et la réutilisation du retour antérieur. Une observation contraire retire le plan. Une pièce éloignée temporairement masquée n’invalide pas à elle seule l’action locale en cours.
- Un scénario de test indépendant, sans miroir, sans objectif annoncé et sans niveau précédent, envoie un sujet dans une pièce par un ascenseur. SIC y choisit un contact avec un bloc inconnu. Un déplacement de même amplitude dans la même pièce ne déclenche pas cet essai. Un second scénario compare une entrée réussie et une entrée refusée après un changement d’image. Seule l’entrée réussie autorise la réutilisation de la capacité.
- La perception suppose des contrôles spatiaux suffisamment étalonnés et des objets discernables sur une grille. La victoire de SS01 porte sur la campagne après L1 et L2. Les 100 jeux sources restent à requalifier.

## Contrôle sur un autre jeu

Sur SS03, le premier prototype engageait une série de poussées au troisième coup du L2 et perdait une victoire du témoin. La correction conserve la distinction entre essayer un contact à proximité et engager une longue préparation. Pour lancer cette dernière dès un nouveau niveau, SIC demande deux contacts antérieurement observés en des positions distinctes. Le sujet doit entrer dans la case de l’objet pendant que celui-ci avance dans la même direction. Un objet qui suit le sujet ne fournit pas cette preuve. Une expérience de contact engagée par SIC dans une région nouvelle peut produire sa propre preuve locale et autoriser sa continuation au même niveau.

Le candidat corrigé gagne SS03 L1 en 47 coups et L2 en 97. Les 144 commandes, leurs paramètres et les empreintes des images avant et après chaque action coïncident avec le témoin. Ce contrôle porte sur la conservation d’une victoire existante. Le scénario synthétique de l’ascenseur teste séparément le déclenchement de la nouvelle capacité.

## Reproduire la campagne

Essais effectués avec Node 24.22.1. Lancer depuis le checkout du candidat et choisir un chemin de sortie neuf. Le fichier JSONL est alimenté en ajout.

```powershell
$env:SIC_STUDY_SOLVER = 'sic'
$env:SIC_STUDY_WORKERS = '1'
$env:SIC_STUDY_RECORD_COMMANDS = '1'
node scripts/compare-source100.mjs . . ss01-campagne.jsonl SS01 1 3 120 0/1
node scripts/compare-source100.mjs . . ss01-depart-direct.jsonl SS01 3 3 120 0/1
```

Pour reproduire la comparaison tardive, utiliser la même campagne avec la sonde ci-dessous. La première observation a la révision 1. La révision 186 arrive après les 185 commandes du préfixe. Seule l’offre du nouveau mécanisme est suspendue avant cette observation. L’acquisition des effets et les stratégies concurrentes restent actives à chaque coup.

```powershell
$env:SIC_STUDY_CONTACT_FROM_REVISION = '186'
node --import ./scripts/sic-study-contact-checkpoint.mjs scripts/compare-source100.mjs . . ss01-continuation.jsonl SS01 1 3 170 0/1
```

Le champ `contactFrontier` des commandes concernées contient la case visée, les retours discriminants attendus et la référence du déplacement antérieur exploité. L’interface locale permet également de jouer la campagne avec `?game=SS01&runThrough=3#playground`.
