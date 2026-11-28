# SIC SYNC — reçu indépendant P05 / P07 / P14

**Verdict : réserve certifiée et scellée ; qualification SIC non ouverte.**

Scellement **SIC-OP-20261128-01**, fixé le **2026-11-28T14:20:29Z**, avant réception de tout SHA candidat pour cette évaluation.

## Effectifs

| Primitive | Positifs actifs | Remplaçants | Négatifs | Paires / membres | Gestes max du témoin | Croyances max de l’oracle |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| P05 | 2 000 | 400 | 200 | 200 / 400 | 45 | 1809 |
| P07 | 2 000 | 400 | 200 | 200 / 400 | 46 | 100 |
| P14 | 2 000 | 400 | 200 | 200 / 400 | 22 | 201 |

Chaque primitive comprend huit familles, avec 250 positifs actifs par famille. Chaque positif est certifié sur deux mondes initialement indiscernables ; ces deux exécutions ne doublent pas le quota. Les contrôles et remplaçants sont séparés des positifs actifs.

**Contrôles accomplis :** 8 400 unités relues et régénérées exactement ; 7 200 politiques positives, remplacements compris, rejouées dans leurs 14 400 mondes ; 442 470 transitions de certificats vérifiées ; 6 951 592 transitions de tables contrôlées ; 85 tests réussis ; aucune erreur de corpus ni arrêt mural de certification. Il s’agit des preuves de l’oracle et des tests de l’évaluateur. **Aucun succès du vrai SIC et aucune victoire native ne sont encore mesurés.**

## Référence et limites

- SHA moteur de référence : `20433007224accc36e3d7976696d9ee7a783a227` ; pack strict `solver: sic`.
- Arbre source : `401f4046ff47087b627ec5022d291db343cfc26d`.
- SHA candidats reçus / évalués : **aucun / aucun**.
- Simulateur : **64 gestes, 12 000 états explorés, 10 s murales** par monde et bras ; démarrage froid du raisonnement plafonné séparément à 30 s.
- Natifs réservés : **6 familles mécaniques distinctes, 6 jeux, 36 niveaux**, parcours chronologiques depuis L1 ; plafonds exacts sous engagement privé.
- Temps du jeu, temps du raisonnement, chargement, rejeu et durée totale jusqu’au dernier contrôle mesurés séparément.

Les [critères complets](PROTOCOLE.md) fixent l’observation accessible, le vrai retour, l’égalité des bras, les citations de preuve, l’ablation ciblée, les arrêts muraux, les résultats non vérifiables et la réconciliation terminale. Le [reçu JSON](SCELLEMENT.json) contient les comptes par primitive et famille ainsi que les empreintes des composants.

## Conditions encore nécessaires à la qualification

1. **Registre de développement complet et audité.** Les signatures de la réserve sont distinctes entre elles et résistent aux changements de présentation. Leur absence des lots de développement et des familles natives utilisées par le candidat reste **non vérifiée** jusqu’au contrôle de ces registres. Aucune différence de graine n’est acceptée comme preuve de séparation.
2. **Adaptateur public du véritable SIC.** La capsule de référence est figée ; le passage entre l’interface des simulateurs et l’entrée réelle de SIC doit être qualifié, y compris l’acquisition du dernier retour. Aucun témoin scripté n’est substitué au moteur.
3. **Instrumentation des états explorés.** Elle n’est pas présente dans le moteur de référence audité. Le superviseur prépare un compteur hôte, mais il faut prouver la couverture du moteur. Une autodéclaration du candidat ne suffit pas.
4. **Exécuteur effectivement confiné et testé.** Le superviseur refuse les capsules non approuvées. Docker est absent de l’environnement de préparation ; les tests purs ne prouvent pas l’isolement ni les délais réels d’un candidat.

Les codes et données de l’opérateur sont conservés sous scellés. Ce dossier public ne contient ni scène, ni graine, ni solution, ni identité native réservée. La comparaison ne sera qualifiante qu’après satisfaction de ces conditions ; les échecs techniques et les résultats non vérifiables resteront séparés.

## Empreintes SHA-256

| Engagement | SHA-256 |
| --- | --- |
| Corpus privé P05 | `f95191b4a1ebf85483d1ef6db22e4778354fdfa93f6bd702a72de1748a6e966b` |
| Corpus privé P07 | `875ec56b1ec078a30d1cb5a06501fa09c004e8720771ed41255f6f96b439c290` |
| Corpus privé P14 | `75c22e7b70c7f65cbad777016e6e32377b7d9cebb652738bef8fc8d2f171ba0e` |
| Manifeste privé de scellement | `e023449ac79bf82db4b5f45061bd92eac4d6677e577cef7c98b66d83c59248fa` |
| Archive chiffrée | `9b5f95588eacbb9000348bc0af696ea0d390087420e95c97e8f91e2e4dfc99b7` |
| Manifeste des sources de l’opérateur | `30adf1af9b5df8128d6340bc6af540d17f0b9630d5e3d88ad012f5eda2fffbcf` |
| Manifeste natif réservé | `655c74ba4b1d5ceafe02fefe2122ee7df39ff7a96b31382df705470a44edeb30` |
| Relecture et régénération intégrales | `3b2a72681b1d568f86fddf28875e46489f27a584583dc8b485b0f27e1e96f025` |
| Protocole public | `49b7c7d4290a5bae8cd30c762b536d41a06354b61e978b08d33ed35406487490` |

## Barrière SS08–SS25 et suite

**SS08–SS25 restent sous scellés.** Un même SHA doit gagner des niveaux natifs supplémentaires sur au moins deux familles réservées distinctes, à budget égal, sans victoire de référence perdue ni commande illégale. Deux présentations d’une mécanique comptent une seule fois. Des succès simulés et des gains obtenus sur des SHA différents ne franchissent pas cette barrière.

Aucun cas n’a été dévoilé. Tout cas ultérieurement dévoilé passe irréversiblement au développement ; un remplaçant frais est contrôlé et un nouvel engagement est publié avant le prochain candidat.

**Prochaine entrée attendue :** les registres de développement, puis les SHA complets figés et les contrats d’adaptation/instrumentation, accompagnés de l’intervention d’ablation proposée. La référence, les scènes, les critères et les plafonds ne seront pas réajustés aux résultats d’un candidat.

Ce fichier est le paquet de relais public destiné à SIC SYNC. La livraison dans une conversation externe n’est annoncée que lorsqu’un canal adressable et son reçu existent.
