# SMLP · composer les trajets par leurs premières arrivées

## Critères avant intervention

Le catalogue donne la ligne 6 à SMLP N1/T2, `configured_arrivals / configured_first_arrival_composition`, `ACTION6(32,26)`. Le départ est N1, six niveaux, 600 gestes par niveau, 16 actions au total et sans curiosité ciblée. Le ticket T2, ses images et la décision T3 doivent fixer le sens de « composer ». Les niveaux suivants servent à vérifier une configuration avec trois acteurs. [Catalogue](sic-v8-strategies-observees.md?plain=1#L32) · [Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L46)

| Point de décision | Preuve attendue |
|---|---|
| Acquisition initiale | Relever le propriétaire du lancement, les trajectoires publiques, leur première arrivée, l’unité de mesure et les ordres encore compatibles. Comparer avec le même ticket et la seule image finale. |
| Premier ticket de la ligne | Vérifier le rôle de la cellule (32,26), la disponibilité du contrôle et le retour local. Distinguer l’édition mesurée de la prédiction de concordance au lancement suivant. |
| Configuration suivante | Suivre le calcul utilisé et sa consommation avec trois acteurs, l’ordre des éditions et le résultat officiel. Distinguer une configuration qui sépare les politiques restantes d’une configuration où elles prédisent toutes une coïncidence. |
| Indétermination | Vérifier qu’un paquet insuffisant ne permet pas d’ordonner les arrivées. Lorsqu’une même date regroupe des acteurs, la cohorte conserve leur égalité de date. Retirer le support de l’ordre et vérifier le repli ou l’abstention. |

Les références doivent relier la mesure au paquet et au besoin de l’époque courante. Les temps de la mécanique sont des intervalles du trajet modélisé. Le score est lu dans le retour officiel du jeu. [Famille](../../src/logos-engine/v6-configured-arrivals.ts) · [Mécanique des arrivées](../../src/logos-engine/v6-arrival-mechanics.ts)

## Témoins sur le gel

Les 16 décisions du catalogue concordent entre `8ce7ee35` et `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. La recapture retrouve les 13/13 tickets de la ligne 6. Les 16 observations jusqu’à T15 concordent avec l’archive publique v57, séquences d’images incluses. T16, sur le niveau suivant, est conservé dans la fixture complémentaire. [Archive publique](../migration/native-campaigns-v57/baseline-smlp/smlp-public-trace.json.gz) · [Fixture complémentaire](../../tests/fixtures/sic-smlp-alternate-returns.json.gz)

| Étape | Mesure, offre consommée et résultat |
|---|---|
| **N1/T1 · acquisition du lancement** | La frontière libère `ACTION5`. `ConfiguredArrivals.record` reçoit 75 images publiques. `configuredTrajectories` suit les croix 9 et 12, mesure les passages sur les centres du réseau et rattache le paquet à la date du retour. La reconstruction donne des premières arrivées aux échantillons 52 et 68, avec 4 échantillons par intervalle de base et 24 priorités directionnelles compatibles. Quand un acteur cesse d’être visible à un pas du but, la reconstruction peut inférer le dernier segment à partir de sa trace. La date reste exprimée en échantillons publics. |
| **N1/T2 · témoin de la ligne 6** | `ConfiguredArrivals.propose` voit un lancement acquis, une course observée et une cellule exceptionnelle à sonder. Il libère `ACTION6(32,26)` avec `v5_proof = null`. La garde lie les poses des acteurs et la configuration actuelle. Le retour change 216 pixels et établit une modification locale à (32,26). La question de l’effet de cette modification sur le trajet reste ouverte jusqu’au lancement suivant. |
| **N1/T3 · composition et résultat** | `bindings` relie l’ancien et le nouveau motif. `configuredRoute` réalise les routes minimales de chaque priorité directionnelle encore compatible. `qualifyRoutes` consomme `measureArrivalPolicyRoutes` et `measurePrescribedArrivals`. Les 24 priorités prédisent [17,17]. La preuve contient une seule cohorte {9,12} à l’intervalle 17. `ACTION5` ouvre N2 et le reçu valide la progression officielle. |
| **N2/T4–T7 · seconde configuration** | Trois acteurs sur un autre réseau. T4 relance le contrôle acquis et date 9 à 84, 12 à 148 et 15 à 68, sur une base de 4 échantillons. Il reste 12 priorités. T5 prépare deux modifications en (44,38) et (52,30), puis le lancement. Les mêmes opérateurs produisent [17,17,17] pour chacune des 12 priorités. Les deux éditions sont confirmées par la garde de retour. T7 ouvre N3. |
| **N3/T9–T15 · discriminer puis composer** | T9 date trois acteurs et laisse six priorités. Pour la configuration viable à T10, elles prédisent deux triplets, [8,17,16] et [8,18,16], l’ordre des entrées suivant les acteurs courants. La qualification de coïncidence rejette ce trajet. La question de discrimination libère une édition en (22,21) et le lancement de T11. Les dates 9→54, 12→24 et 15→48, sur une base de 3, ne laissent que trois priorités. T12 prépare trois éditions et toutes les priorités restantes donnent [18,18,18]. La preuve conserve une cohorte unique {9,12,15}. T15 ouvre N4. |

## Cas où la preuve ne permet pas de départager

**Même lancement et même image finale.** Le jeu exécute le T1 historique. Le service reçoit la dernière image seule. Il ne produit aucun `public_configured_arrival_packet`. Les premières arrivées restent indéterminées. Le vrai T2 est alors `ACTION6(10,32)` par la frontière, avec un retour stationnaire. Le geste suivant sonde (11,26).

**Même vue et preuve de priorité retirée.** À N3/T10, la copie utilisée par le producteur représente l’absence de priorité spatiale compatible. La configuration de discrimination est suspendue. La frontière reçoit `ACTION6(10,18)`. Le jeu renvoie la même image. À la décision suivante, la preuve conservée permet `ACTION6(22,21)`, puis le vrai lancement fournit le paquet qui mène à la question de coïncidence.

La première épreuve retire les dates du paquet présenté. La seconde change le champ `compatible_orders` d’une copie de l’ajustement, en gardant le journal acquis du service. Les retours des commandes alternatives ont été capturés dans le jeu.

**Attribution.** La ligne 6 réutilise déjà les calculs de route et de première arrivée sur plusieurs situations actives du gel. La famille garde la mesure des acteurs, le réseau candidat, les modifications autorisées et l’acquisition du score. Les opérateurs apportent les routes réalisables et les cohortes conditionnelles. Un ensemble de politiques en désaccord produit une question de discrimination. Plusieurs acteurs à la même date restent dans la même cohorte. Cette qualification rétrospective ajoute une preuve reproductible sur branche. [Famille et journal](../../src/logos-engine/v6-configured-arrivals.ts) · [Opérateurs de route et de temps](../../src/logos-engine/v6-arrival-mechanics.ts)

## Rejouer

Depuis la racine du lot, sous Node 24. Définir `SIC_SMLP_GAME_ROOT` sur le checkout qui contient les archives Python et Pyodide pour rejouer les commandes physiquement. Définir `SIC_SMLP_ENGINE_ROOT` pour importer explicitement le moteur du gel.

~~~powershell
node --test tests/sic-smlp-line-6.test.ts tests/v6-configured-arrivals.test.ts
$env:SIC_SMLP_GAME_ROOT = (Get-Location).Path
node --test tests/sic-smlp-line-6.test.ts
~~~

Les trois tests de caractérisation avec rejeu physique et les 133 contrats existants passent. Critères figés à `25fe4be8`. Le 27 novembre 2026 (UTC−3), préparation à 22 h 25 min 15 s, premier rejeu à 22 h 26 min 00 s, contrat à 22 h 26 min 41 s et verdict local à 22 h 30 min 05 s, soit 4 min 50 s.
