# Preuves du lot 7B

État courant : **développement fonctionnel vérifié**, depuis la publication
7A/Site 83. L'intégration des publications effectives de 5A/4B, le gel final,
la validation navigateur, le coût et la publication 7B restent à faire.

| Répertoire ou fichier | Contenu |
| --- | --- |
| `coordination/published-7a-site83.json` | Publication réelle de la base 7A |
| `candidate-selection.json` | 100 observations initiales publiques, source froide, unique candidat CRAF, zéro action |
| `attempt1/source-manifest.json` | Digest du premier gel de développement : 284 fichiers natifs |
| `attempt1/source-archive.json` et parties | Octets des 295 entrées gelées et transport exact |
| `attempt1/execution-craf.json` | Campagne froide réussie : 3 niveaux, 36 actions, sources inchangées |
| `attempt1/craf-campaign.json.gz` | Rapport complet : 36 actions Symbols, états et appels réellement capturés |
| `attempt1/craf-public-trace.json.gz` | Commandes et retours publics complets, sans état privé |
| `attempt1/original/craf-public-parity.json` | 144 appels source et 432 comparaisons exactes, couverture positive non vide |
| `attempt1/original/craf-contribution.json.gz` | Acquisition active unique et ablations depuis les états originaux reconstruits |
| `craf-case-checkpoint.json` | Horloge cumulée, actuellement suspendue, sans remise à zéro |
| `diagnostic/` | Essais de développement, contrôles ciblés et versions d'analyse conservées |

Le premier rapport ne capture pas encore un bloc `symbolAcquisition` par
préfixe. Ses états `sourceBefore/sourceAfter` et les tests Kernel prouvent leurs
contrats propres ; ils ne sont pas présentés comme une capture native complète
qui n'aurait pas eu lieu. Le helper final ajoute ce bloc de lecture seule, et le
validateur final exige les enveloppes, faits et événements effectivement retenus.

Le validateur préparé relie la proposition source entière aux gardes, au retour
et au checkpoint. Il réapplique le domaine de point original ; quatre annotations
nommées de l'appelant restent hors de la comparaison avec la proposition source,
mais doivent rester identiques entre garde, enregistrement et état conservé.
Une réécriture par préservation est refusée explicitement par ce validateur de
composant. Il ne revendique pas la parité de sélection de tout l'appelant Python.

`diagnostic/compare-symbol-transactions-public-parity-initial.py` conserve les
octets exacts du premier analyseur exécuté. Sa classification de quatre ablations
du compteur inclut les références de règles dans la décision ; elle ne démontre
pas quatre commandes physiques différentes. La version préparée pour le gel
final distingue le choix, les changements de justification et la disparition
d'une proposition, sans réécrire ce premier résultat.

Les échecs de développement restent disponibles. Le raster synthétique initial
est réellement préempté par Recall ; le test positif final de la boucle commune
emploie le raster public CRAF, sans remplacer les familles ni injecter une méthode.
Les logs de génération Interface et du propriétaire conservent les corrections
de construction d'oracle, de types readonly et de détachement local des arguments
SRC immuables. Les résultats courants sont 124 tests géométriques, 78 tests
d'interface, 73 tests du propriétaire et quatre tests Kernel, tous réussis.

L'audit de développement raccorde **57 entrées sur 76**. L'inventaire des modules
compte **176 composants vérifiés, 144 transferts partiels et 1 049 modules en
attente**, sans module entièrement vérifié. Le premier contrôle a signalé une
fixture historique Feedback non restaurée ; les fixtures Feedback et Outline
ont été reconstituées à partir de leurs parties exactes, puis le nouvel audit
ne contient aucun échec. Les deux résultats et le reçu de restauration sont
conservés. Ces compteurs précèdent l'intégration effective de 5A et 4B.

Les rapports complets et les archives restent distincts des preuves de
publication et de coût, qui ne sont pas encore acquises pour 7B.
