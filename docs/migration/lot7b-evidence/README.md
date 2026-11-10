# Preuves du lot 7B

État courant : **développement fonctionnel vérifié ; publication 5A/Site 84
intégrée** après la base 7A/Site 83. La clôture documentaire 5A/Site 85 est
également vérifiée. L'intégration de 4B, le gel final, la validation navigateur,
le coût et la publication 7B restent à faire.

| Répertoire ou fichier | Contenu |
| --- | --- |
| `coordination/published-7a-site83.json` | Publication réelle de la base 7A |
| `coordination/published-5a-site84.json` et `published-5a-site85.json` | Publications 5A effectivement vérifiées auprès de Sites |
| `coordination/published-5a-source-verification.json` | Identité native du prédécesseur publié et conservation de la fusion examinée |
| `candidate-selection.json` | 100 observations initiales publiques, source froide, unique candidat CRAF, zéro action |
| `attempt1/source-manifest.json` | Digest du premier gel de développement : 284 fichiers natifs |
| `attempt1/source-archive.json` et parties | Octets des 295 entrées gelées et transport exact |
| `attempt1/execution-craf.json` | Campagne froide réussie : 3 niveaux, 36 actions, sources inchangées |
| `attempt1/craf-campaign.json.gz` | Rapport complet : 36 actions Symbols, états et appels réellement capturés |
| `attempt1/craf-public-trace.json.gz` | Commandes et retours publics complets, sans état privé |
| `attempt1/original/craf-public-parity.json` | 144 appels source et 432 comparaisons exactes, couverture positive non vide |
| `attempt1/original/craf-contribution.json.gz` | Acquisition active unique et ablations depuis les états originaux reconstruits |
| `attempt1/refined-original/` | Rejeu renforcé réussi des mêmes 144 appels, 36 liens ordonnés proposition/gardes/commande/retour et ablations mieux distinguées |
| `craf-case-checkpoint.json` | Horloge cumulée, actuellement suspendue, sans remise à zéro |
| `diagnostic/` | Essais de développement, contrôles ciblés et versions d'analyse conservées |

Le premier rapport ne capture pas encore un bloc `symbolAcquisition` par
préfixe. Ses états `sourceBefore/sourceAfter` et les tests Kernel prouvent leurs
contrats propres ; ils ne sont pas présentés comme une capture native complète
qui n'aurait pas eu lieu. Le helper final ajoute ce bloc de lecture seule, et le
validateur final exige les enveloppes, faits et événements effectivement retenus.
Il observe aussi le véritable appel `restoreNative`, son argument et son état de
sortie, puis lit l'état de l'instance après le préfixe. Les curseurs relient cette
restauration au dernier record, y compris au préfixe terminal. Ce renforcement
est préparé avant le gel et attend sa validation exécutée sur le candidat intégré.

Le validateur renforcé relie la proposition source entière aux gardes, au retour
et au checkpoint. Il réapplique le domaine de point original ; quatre annotations
nommées de l'appelant restent hors de la comparaison avec la proposition source,
mais doivent rester identiques entre garde, enregistrement et état conservé.
Une réécriture par préservation est refusée explicitement par ce validateur de
composant. Il ne revendique pas la parité de sélection de tout l'appelant Python.

`diagnostic/compare-symbol-transactions-public-parity-initial.py` conserve les
octets exacts du premier analyseur exécuté. Sa classification de quatre ablations
du compteur inclut les références de règles dans la décision ; elle ne démontre
pas quatre commandes physiques différentes. Le rejeu renforcé distingue le
choix, les changements de justification et la disparition d'une proposition,
sans réécrire ce premier résultat. Les quatre cas modifient seulement les preuves
associées à la même décision. Les méthodes restent nécessaires à 27 propositions
et la liaison courante à 18. La première exécution de ce validateur s'est arrêtée
sur une variable locale masquant les options de ligne de commande ; son script,
son exception et le rejeu corrigé sont conservés séparément.
`diagnostic/compare-symbol-transactions-public-parity-refined.py` conserve le
comparateur exact de ce rejeu réussi avant l'ajout du témoin de restauration.

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
conservés. Ces premiers compteurs précèdent l'intégration effective de 5A et 4B.

Après intégration de la publication 5A/Site 84, les audits donnent **58 entrées
sur 76**, **178 composants vérifiés, 146 transferts partiels et 1 045 modules en
attente**, sans module entièrement vérifié et sans échec d'inventaire. Le digest
natif combiné sur 288 fichiers est
`4b2f3c698d73a78c79f2e7ffd9486620b2a391a69e5575d0e3d7c75e3597f7cb`.
Ces audits ne remplacent pas les validations finales après intégration de 4B.

La fusion préparatoire `2c2da44` reste dans un bundle incrémental de 21 559 octets,
avec ses prérequis et son reçu de vérification. La branche de livraison part du
prédécesseur réellement publié ; elle n'hérite pas de l'ancien objet Git 5A
surdimensionné. Les parties du bundle d'histoire original 5A et leur restaurateur
sont conservés dans les preuves 5A. Restaurer ces objets pour inspection ne
requiert pas de les fusionner dans l'ascendance de livraison.

Les rapports complets et les archives restent distincts des preuves de
publication et de coût, qui ne sont pas encore acquises pour 7B.
