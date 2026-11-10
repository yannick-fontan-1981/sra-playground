# Lot 5A — Préparation temporelle liée et travail incrémental

## État du travail

**Le lot 5A, native 0.53.0, est prêt pour publication : les validations fonctionnelles passent et le budget global est accepté sur les deux jeux, sous la qualification structurelle déclarée avant mesure.** Les temps globaux augmentent de **9,62 % sur STCK** et de **4,66 % sur SMLP** ; cette mesure n'établit aucun gain de vitesse global. La [revue indépendante des coûts](lot5a-evidence/performance/owner-growth-review.json) passe **4 669 contrôles sur 4 669**. La publication reste à effectuer.

Le candidat raccorde `linked_temporal_preparation` : chemins temporels appris, gardes, acquisition des effets et conservation conditionnelle entre niveaux. Il accompagne ce transfert de corrections génériques destinées à réduire les copies répétées, les écritures intermédiaires et certaines recherches déjà décidables à partir de l'état courant. Les résultats détaillés ci-dessous montrent les gains locaux et les régressions réellement observés.

Le propriétaire temporel passe désormais **51 tests sur 51**, avec typecheck transitif réussi ; le résultat antérieur 49/49 reste conservé. Sur la source intégrée gelée, la preuve commune passe **16 contrôles sur 16** : deux branches synthétiques, douze retours acquis une seule fois, dont quatre touches exécutées dans deux préfixes de deux actions. La [suite large finale](lot5a-evidence/final/test-expectation-correction/validation/delta-tests-run.json) passe **3 835 tests sur 3 835 dans 102 fichiers**, après correction d'une attente de compteur dans le seul test ; son premier résultat **3 834/3 835** reste conservé. Les cinq contrôles statiques et de compilation passent aussi, avec `failures: []` à l'audit. Les [sept régressions enregistrées](lot5a-evidence/final/regressions/regression-summary.json) passent **119 contrôles sur 119**, sur **292 actions et 210 préfixes**. Les [reçus ciblés](lot5a-evidence/diagnostic/linked-temporal-20261110T203811Z-validation.json), la [preuve commune](lot5a-evidence/final/linked-temporal-common-loop.json.gz) et le [reçu de correction](lot5a-evidence/diagnostic/validation-correction.json) distinguent ces étapes.

Le suivi WEAV ne démontre pas six niveaux résolus : son dernier retour donne **105 actions, trois niveaux résolus et le niveau 4 courant**, puis un arrêt sur le budget cumulé du cas. Les travaux génériques continuent ; aucun nouvel essai live WEAV n'est prévu après cette limite. Le [résultat conservé](lot5a-evidence/weav/native050-delta-diagnostic/result.json) est détaillé plus bas.

Le [manifeste natif final](lot5a-evidence/final/source-manifest.json) identifie **283 fichiers** par le digest `d30dedc767c588b0fdf33ea398a4ad207b07b027e8b3642b3b262c625c52387f`. L'[archive source](lot5a-evidence/final/source-archive.json) conserve **294 fichiers**, avec les entrées supplémentaires nécessaires à la reproduction. La [réconciliation du prédécesseur publié](lot5a-evidence/final/published-predecessor-reconciliation.json) atteste la fusion de **Site 82**, commit `0ca36b0a6a358e1e89420753bbcec4a33f028e0a`, puis de sa clôture documentaire **Site 83**, commit `bed48116585da864dd5c412ed11dd6990a950e8e`. La référence de coût reste explicitement **Site 82 / native 0.52.0** : aucun fichier d'entrée d'exécution contrôlé n'a changé entre ces deux publications. Le digest du candidat 0.53 reste inchangé. La [fenêtre officielle de coût](lot5a-evidence/performance/exclusive-window-execution.json) est terminée et l'[intégrité fonctionnelle finale](lot5a-evidence/final/delivery-integrity.json) passe ; 5A n'est pas encore publié. Les lots 4B et 7B restent sous la responsabilité des deux autres conversations.

## 1. Périmètre du lot 5

La [feuille de route](v6-delivery-roadmap.md) distingue trois entrées. Le découpage de suivi est le suivant :

| Sous-lot | Entrée | État dans ce rapport |
| --- | --- | --- |
| 5A | `linked_temporal_preparation` | Validations et intégrité acquises ; budget global qualifié accepté 2/2 avec revue 4 669/4 669. Prêt pour publication, réserves de latence et de sessions longues conservées. |
| 5B | `observed_addressed_material` | Ouvert. L'adressage doit être lié à l'objet et au contexte courants et invalidé lorsque cette liaison ne tient plus. |
| 5C | `observed_object_binding` | Ouvert. La liaison et le contrat de conservation/retour de composition restent à transférer et à éprouver. |

5A reprend exactement l'alias source `LinkedPreparation.propose → PhaseRelations.linked_contact.propose`. Il comprend les propositions de contact, leurs gardes et obligations, l'acquisition passive de `PhaseRelations`, et l'acquisition conditionnelle de `PhaseTransfer` aux frontières. Les politiques de proposition autonomes des deux derniers modules ne sont pas consommées par cet alias ; elles ne sont donc pas activées dans 5A. La [filiation détaillée](lot5a-linked-temporal-lineage.md) identifie les quatre modules originaux, leurs empreintes, l'ordre des appels et les limites de cette portée.

Les rôles, déplacements, positions, couleurs et effets sont mesurés à partir des observations publiques. Un changement distant après contact reste une hypothèse locale ; le départ et la réentrée permettent d'observer une persistance ou une réversibilité. Une répétition de chemin peut être étayée, puis réfutée par une observation incompatible. Les états incertains et les contre-exemples restent des données acquises.

L'audit courant donne **57 entrées raccordées sur 76**, aucune entrée partielle dans ce registre et **19 en attente**. Le groupe `surface` passe à **9/10**. Le comptage des modules Python reste distinct : **174 `component_verified`, 145 `partial_transfer`, 1 050 en attente et aucun `verified`**. Les six critères de clôture de la migration globale restent faux. Ces chiffres décrivent le [registre audité](lot5a-evidence/final/test-expectation-correction/validation/entry-audit-output.log.gz) et le [map de transfert audité](lot5a-evidence/final/test-expectation-correction/validation/migration-audit-output.log.gz) ; ils ne sont pas un score de jeu ni une clôture de la parité V5/V6.

## 2. Réduire le travail répété

### Écritures du magasin regroupées

Le [Kernel](../../src/logos-engine/kernel.ts) prépare les modifications d'un lot dans une transaction, conserve chaque révision, delta, cause et maillon de hash, puis publie les conteneurs finaux ensemble. Une écriture invalide tardive fait échouer le lot entier. Le [magasin natif](../../src/logos-engine/v6-knowledge-store.ts) utilise ce chemin pour ses fragments et métadonnées de checkpoint. Le gain recherché vient de la réduction des copies répétées de grands conteneurs, tout en gardant la même suite d'écritures logiques.

Le [reçu ciblé de 125 tests](lot5a-evidence/diagnostic/performance-targeted-tests.tap) comprend les cas de batch identique aux écritures séquentielles, les identités répétées, les entrées invalides, la limite de nœuds, l'échec tardif et la conservation de l'ancien graphe. Il comprend aussi les contrôles de CrossedPrefix décrits plus bas. Ce reçu fonctionnel n'est pas une mesure du gain de temps de 5A.

### Frontière observée mise à jour par delta

Le chemin natif de [ObservedFrontier](../../src/logos-engine/v6-observed-frontier.ts) remplace les seules branches touchées par un événement et partage les branches immuables inchangées. Le [caller](../../src/logos-engine/v6-native-caller.ts) active explicitement ce mode à l'initialisation, à la restauration complète et au rejeu de frontière. Les snapshots publics restent détachés ; les snapshots natifs peuvent partager les valeurs dont la fermeture immuable est vérifiée.

Les séquences de l'oracle existant sont comparées avec le mode ordinaire et le mode natif, y compris l'état, les résultats et les deltas ordonnés. Le [reçu ciblé](lot5a-evidence/diagnostic/frontier-snapshot-targeted-tests-initial.tap) conserve **43 tests réussis sur 43**. La [revue de portée](lot5a-evidence/diagnostic/frontier-delta-review.json) précise que la restauration relit toujours les valeurs du magasin et leurs fragments : l'identité d'une racine hydratée n'autorise pas à sauter les contrôles.

Cette modification conserve les observations, transitions, essais et événements historiques. Les copies des maps de premier niveau restent proportionnelles au nombre d'entrées retenues ; les recherches historiques et les rejeux de frontière gardent leur propre coût. La durée totale d'une session et sa mémoire ne deviennent pas constantes par cette seule modification.

### Copies de diagnostic libérées

Le [runtime](../../src/logos-engine/v6-native-runtime.ts) conservait des copies complètes de retours dont il ne relisait que le nombre, ainsi que des compositions dont il ne relisait que le nombre d'identifiants. Le candidat retient un compteur pour les premiers et un ensemble d'identifiants pour les secondes. La validation par copie et fermeture demeure avant l'incrément ; les acquisitions et compositions utiles au raisonnement restent dans leurs propriétaires et dans le graphe. Cette portée est consignée dans la [revue du runtime](lot5a-evidence/diagnostic/frontier-delta-review.json).

## 3. Libérer les données des niveaux précédents

Le nouveau propriétaire temporel possède ses snapshots. Une fois retenus comme immuables, les anciens rasters peuvent être partagés entre checkpoints successifs. Les snapshots et masques déjà validés disposent de reçus de validation attachés aux objets immuables ; le lien entre masque, digest et dimensions reste vérifié. Une copie publique d'état reste modifiable sans altérer le propriétaire natif. Les dernières améliorations de ce partage et leurs tests supplémentaires sont incluses dans le [passage ciblé 51/51](lot5a-evidence/diagnostic/linked-temporal-20261110T203811Z-validation.json).

À une frontière d'époque ou d'état, la source remet à zéro l'historique actif de phase : anciens rasters, commandes, géométries, essais et contact. Le nouvel historique commence par le seul snapshot AFTER. Une progression officielle peut conserver une hypothèse portable, selon les conditions source : modèle acquis, contraste distant et soutien d'un nouvel endpoint, ou reprise d'un `prior` portable existant lorsque la branche le permet. Ce `prior` contient des formes, vecteurs, patches locaux et références de preuve ; il ne retient pas l'ensemble des rasters des anciens niveaux. Les mesures et essais locaux de la nouvelle époque repartent à zéro. Ces règles et leur nuance concernant une hausse de score sans changement d'époque ou d'état figurent dans la [filiation](lot5a-linked-temporal-lineage.md).

L'historique d'événements de l'adaptateur, les témoins de score et les preuves déjà persistées demeurent disponibles. Cette libération concerne le propriétaire temporel actif ; elle ne supprime pas arbitrairement les faits historiques des autres familles. L'oracle contient deux frontières scorées successives avec conservation conditionnelle du modèle portable. Le test supplémentaire exécuté vérifie l'absence de clé de raster historique dans l'état portable et le rejet atomique de templates incohérents.

## 4. Chemins continus et actions certaines

### Key-paths acquis

`LinkedTemporalContact` reprend les chemins de touches de la source : jusqu'à **`min(16, remaining)` actions**, avec vecteurs appris et patch de destination gelé pour chaque pas. Le chemin s'arrête lorsqu'un vecteur manque ou qu'une destination exige un nouveau contact conditionnel. Une entrée non liée est d'abord mesurée par une question unitaire. Le [code transféré](../../src/logos-engine/v6-linked-temporal-contact.ts) conserve les références d'observation, l'époque, le score, les poses attendues et les conditions de rejeu.

Chaque pas est autorisé sur son contexte courant. Un changement de destination, une commande devenue indisponible, une pose différente ou une frontière officielle interrompt le préfixe. Les retours déjà exécutés sont acquis. L'oracle contient deux chaînes froides où quatre calibrations mesurées conduisent à un chemin de deux touches ; l'une observe un effet distant et l'autre son absence.

La [preuve finale dans la boucle commune](lot5a-evidence/final/linked-temporal-common-loop.json.gz) reprend ces deux branches avec les priorités réelles, l'autorité WHY/ACT et un propriétaire initialement vide. Les contrôles disponibles viennent des observations publiques synthétiques ; une table de réponses indexée par les pixels, le protocole et la commande fournit ensuite les retours, indépendamment de la famille sélectionnée. Aucun état appris ni choix de famille n'est injecté.

| Branche synthétique | Retours exécutés et acquis | Décision suivante, proposée mais non comptée comme retour supplémentaire |
| --- | --- | --- |
| Effet distant observé | Six : cinq propres au propriétaire, dont deux dans son préfixe final, et un passif. | `linked_temporal_preparation` propose `ACTION2` pour le contraste de départ. |
| Absence d'effet distant | Six : cinq propres au propriétaire, dont deux dans son préfixe final, et un passif. | Le propriétaire n'a plus de proposition propre ; le sélecteur commun choisit `observed_frontier` et `ACTION1`. |

Les **douze retours** comprennent donc **dix acquisitions propres et deux passives** ; les **quatre touches** des deux préfixes finaux sont un sous-ensemble de ces retours. Les seize contrôles vérifient l'ordre source, le propriétaire unique, la garde intermédiaire, l'acquisition différée du préfixe et la restauration depuis le Kernel. La source native, le script de preuve et ses entrées restent identiques pendant l'exécution, selon le [reçu associé](lot5a-evidence/final/linked-temporal-common-loop-execution.json). Cette preuve directe du runtime ne couvre pas le transport navigateur, Pause ni une campagne réelle.

### Click-paths et chemins mixtes

Le contrôleur, le service et le runtime possèdent déjà le transport d'une suite d'actions gardées. La [preuve synthétique dédiée](../../tests/v6-native-mixed-path.test.ts) utilise une famille explicitement déclarée pour exercer une séquence touche/clic/touche, Pause et reprise du même ticket, la liaison au point courant, une action devenue indisponible, une garde tardive refusée, un retour de clic divergent et une frontière de niveau. Son [reçu conserve six tests réussis sur six](lot5a-evidence/diagnostic/mixed-path-targeted-tests.tap).

Cette preuve vérifie le contrat générique de transport et d'acquisition. Elle ne crée pas à elle seule une politique WEAV proposant plusieurs clics ou un chemin mixte. L'entrée temporelle transférée ici produit ses propres key-paths ; les familles d'adressage et de liaison d'objets restent à traiter en 5B et 5C. Le [reçu de développement du test mixte](lot5a-evidence/diagnostic/mixed-path-test-development.json) conserve aussi l'échec initial d'une attente de forme de commande, puis sa correction dans le test.

### Décisions rapides démontrées par l'état courant

Le candidat [CrossedPrefix](../../src/logos-engine/v6-crossed-prefix-access.ts) ajoute une conclusion rapide précise : si les apparences actuellement mesurées satisfont toutes les clauses de croisement, conserver chacune de ces apparences donne l'unique affectation de coût nul. Comme le coût est un nombre de recolorations, cette affectation est déjà l'optimum de la recherche source. Le contrôle des bornes et du délai précède cette conclusion. Si ce test échoue, l'énumération et l'ordre source continuent.

Cette propriété concerne l'affectation d'apparences. Elle ne certifie pas qu'un déplacement physique est obligatoire, qu'une seule case est libre ou que le prochain clic réussira. Le [reçu ciblé](lot5a-evidence/diagnostic/performance-targeted-tests.tap) conserve les cas de coût nul, de budget indisponible, de recherche inachevée et de liaison au point courant. Une règle plus générale de « seul emplacement possible » devra produire son certificat à partir des contraintes mesurées et conserver les mêmes gardes ; elle n'est pas déclarée livrée par 5A.

## 5. Bornes de calcul et restauration

Le constructeur compatible source n'ajoute pas de borne implicite. Le candidat de production fournit explicitement **65 536 nœuds** et **2 000 000 unités de travail** pour la proposition temporelle, avec le délai courant et le signal d'interruption. Si une borne est atteinte, le propriétaire rétablit l'état de contact antérieur à la tentative, rend un refus courant `unknown` et indique que la recherche est incomplète. Il n'acquiert ni impossibilité ni réfutation à partir d'un calcul interrompu. Le refus conserve `release_authority: false` et `block_unrelated_probe: true` ; le sélecteur ordonné le transforme en offre inconnue sans actions, puis s'arrête avant l'autorisation d'un préfixe. Les [neuf tests de routage et d'enregistrement](lot5a-evidence/diagnostic/blocking-and-registration-tests.tap) couvrent ce contrat d'adaptateur et son enregistrement ; ils restent distincts de la preuve commune des chemins. Le [reçu de développement](lot5a-evidence/diagnostic/linked-temporal-development.json) décrit les extensions natives.

Les contrôles de délai et d'interruption sont effectués dans la recherche synchrone. Ils ne constituent pas une garantie nouvelle de latence maximale de Pause pour l'ensemble du moteur, de l'acquisition ou de la sérialisation. Les bornes ne sont pas élargies pour faire passer un résultat de jeu.

La restauration valide le schéma, les historiques contigus, les géométries et leurs dimensions, les curseurs, la politique, les collections et les templates portables avant de publier le nouveau propriétaire. Les dernières modifications ajoutent la concordance du masque du receveur avec le masque canonique acquis. Une entrée AFTER malformée sans `entities` conserve une qualification explicite : Python ajoute une commande puis lève `KeyError`, avec mutation partielle conservée dans l'oracle ; le natif refuse cette entrée par `TypeError` avant mutation. Les attentes admises restent comparées exactement. Les deux comportements sont documentés dans le [reçu](lot5a-evidence/diagnostic/linked-temporal-development.json).

## 6. Preuves disponibles et validations restantes

L'oracle indépendant importe les quatre modules Python du commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Le [reçu d'export](lot5a-evidence/diagnostic/source-oracle-export.json) conserve les inventaires de 1 786 fichiers inchangés avant/après, les empreintes des modules et celles du fixture. Il comprend **14 helpers, neuf chaînes froides et 165 opérations, treize composants directs et deux exceptions explicites**. Les états complets des chaînes sont comparés sur un propriétaire continu et sur un propriétaire restauré après chaque opération.

| Vérification | Dernière preuve disponible | Limite actuelle |
| --- | --- | --- |
| Propriétaire temporel et oracle indépendant | [51/51 et typecheck transitif de sortie 0](lot5a-evidence/diagnostic/linked-temporal-20261110T203811Z-validation.json). | Résultat de développement exécuté après les ultimes correctifs ; historique 49/49 conservé. |
| Transactions, magasin et CrossedPrefix | [125/125](lot5a-evidence/diagnostic/performance-targeted-tests.tap). | Validation ciblée antérieure au gel intégré. |
| Frontier natif et conformité source | [43/43](lot5a-evidence/diagnostic/frontier-snapshot-targeted-tests-initial.tap). | Validation ciblée ; les limites de complexité sont conservées. |
| Runtime, magasin et service | [21/21](lot5a-evidence/diagnostic/runtime-store-targeted-tests.tap). | Ce reçu inclut des rejeux déjà exécutés ; ce n'est pas la gate finale du candidat fusionné. |
| Transport mixte et Pause/reprise | [6/6](lot5a-evidence/diagnostic/mixed-path-targeted-tests.tap). | Famille synthétique déclarée ; sélection commune de production distincte. |
| Routage des refus et enregistrement | [9/9](lot5a-evidence/diagnostic/blocking-and-registration-tests.tap). | Adaptateur ciblé, sans extrapolation à toutes les coordinations. |
| Contribution temporelle dans la boucle commune | [16/16 sur native 0.53 gelée](lot5a-evidence/final/linked-temporal-common-loop.json.gz). | Deux branches publiques synthétiques ; douze retours, aucune campagne de jeu. |
| Première suite large du périmètre affecté | [3 834/3 835, échec conservé](lot5a-evidence/final/validation/delta-tests-run.json), dans 102 fichiers. | Une attente ancienne de compteur ; correction du seul test documentée, code natif inchangé. |
| Reprise officielle après correction | [3 835/3 835 dans 102 fichiers](lot5a-evidence/final/test-expectation-correction/validation/delta-tests-run.json) et [cinq contrôles réussis](lot5a-evidence/final/test-expectation-correction/validation/checks-run.json) : typage, deux audits, diff et build. | Audit `failures: []` ; suite du périmètre affecté, distincte de l'intégralité des tests historiques. |
| Régressions enregistrées | [Sept cas sur sept, **119/119 contrôles**](lot5a-evidence/final/regressions/regression-summary.json), **292 actions et 210 préfixes**. | Retours archivés ; WEAV fournit ses 81 actions historiques, aucune nouvelle campagne live. |
| Vérification navigateur | [Indisponible](lot5a-evidence/final/browser/browser-qa.json), deux timeouts CDP. | Aucun jeu UI démarré, aucune observation rendue de 0.53 ou réussite Pause/reprise annoncée. |
| Attribution structurelle préalable | [64/64 contrôles et revue indépendante passée](lot5a-evidence/performance/diagnostic/shared-fragment-independent-review.json). | 14 créations de fragments appariées, 70 deltas du candidat et 58 points ; aucune conclusion de vitesse. |
| Préflight et readiness | [65/65 au préflight](lot5a-evidence/performance/static-preflight.json) et [readiness exécutée avec succès](lot5a-evidence/performance/readiness-execution.json). | Réserves navigateur et WEAV conservées séparément ; aucune mesure produite par ces vérifications. |
| Coût global qualifié | [Accepté 2/2 ; revue 4 669/4 669](lot5a-evidence/performance/owner-growth-review.json). | Qualification structurelle prémesure et réparation de garde de dossier après mesure explicites ; diagnostic 10/16 et rejet strict conservés. |
| Intégrité fonctionnelle finale | [Réussie](lot5a-evidence/final/delivery-integrity.json) : 283 fichiers natifs, 294 archivés, 647 entrées source/tests, 348 entrées build, 1 786 originaux inchangés. | Vérification des octets et des reçus ; aucune nouvelle campagne ni garantie de sessions longues. |
| Publication 5A | À effectuer. | Aucun identifiant Sites final 5A annoncé avant son reçu. |

Ces suites se recouvrent et leurs nombres ne sont pas additionnés pour fabriquer un total final. L'[échec initial](lot5a-evidence/final/validation/delta-tests-run.json) reste échoué : le test comptait 56 entrées et huit entrées `surface`, contre 57 et neuf après l'ajout de 5A. Le [reçu de correction](lot5a-evidence/diagnostic/validation-correction.json) borne l'édition aux attentes et au libellé de ce test ; les ordres, le dénominateur 76, les six branches de composition et `fullV6Parity: false` restent contrôlés. Il conserve aussi le premier audit signalant le fixture Feedback absent. Ce fixture a été reconstruit à partir de ses deux parties, avec son empreinte originale, avant la reprise. Le digest natif et l'archive de 294 fichiers sont inchangés. La [suite officielle reprise](lot5a-evidence/final/test-expectation-correction/validation/delta-tests-run.json) s'est terminée avec 3 835 réussites, aucun échec ni test ignoré, et des entrées de source et de tests inchangées pendant son exécution.

Les sept comparaisons terminées sont [CATR](lot5a-evidence/final/regressions/catr-052-comparison.json), [RSWP](lot5a-evidence/final/regressions/rswp-052-comparison.json), [FOGW](lot5a-evidence/final/regressions/fogw-052-comparison.json), [VOIS](lot5a-evidence/final/regressions/vois-052-comparison.json), [CONN](lot5a-evidence/final/regressions/conn-052-comparison.json), [MIND](lot5a-evidence/final/regressions/mind-052-comparison.json) et [WEAV](lot5a-evidence/final/regressions/weav-052-comparison.json). Chacune passe les dix-sept contrôles historiques de commandes, paquets publics complets, animations, champs déclarés de coordination et de garde, limites de préfixe, sélection, compteurs et frontières. La [revue du bloc fonctionnel](lot5a-evidence/final/functional-block-review.json) confirme 292 actions, 299 paquets publics complets, 1 405 frames d'animation, 210 préfixes, 502 requêtes et 21 frontières naturelles, avec source et entrées d'exécution inchangées. Les [sept rapports sont conservés en 61 parties vérifiées](lot5a-evidence/final/regression-evidence-parts.json), sans régénération de résultat. Les identités de session fraîche sont normalisées dans les champs déclarés ; les temps, labels d'implémentation et états privés complets ne sont pas comparés. Ce sont des rejeux de retours archivés. Le [rejeu WEAV](lot5a-evidence/final/regressions/weav-052-execution.json) a terminé ses 81 actions historiques de trois niveaux ; il ne constitue pas un nouveau live ni une reprise de l'objectif six niveaux.

Le [reçu navigateur](lot5a-evidence/final/browser/browser-qa.json) distingue le démarrage réussi de la preview et l'échec de rattachement à l'onglet : deux appels ont expiré sur `Emulation.setFocusEmulationEnabled` avant toute navigation ou session de jeu. Les tests de contrôleur et la preuve commune ne remplacent pas cette vérification UI indisponible.

La règle de coût courante est celle autorisée dans la [feuille de route](v6-delivery-roadmap.md) : **médiane de session complète strictement inférieure à +10 % pour chaque jeu testé**. Une phase peut dépasser +10 % sous cette condition, en conservant son résultat et sa distribution dans le rapport. Les phases imbriquées ne sont pas additionnées et un jeu ne compense pas un autre. La [réconciliation publiée](lot5a-evidence/final/published-predecessor-reconciliation.json) fixe la référence à Site 82 / native 0.52.0, digest `f5f4a67d68f867d3a37ef66fd7c07b9e75b9d201daceb732038f8fa71caa59eb`.

L'attribution préalable est désormais validée : **64/64 contrôles**, **14 créations de fragments appariées**, **70 deltas attribués au candidat** et **58 points capturés**. La [revue indépendante](lot5a-evidence/performance/diagnostic/shared-fragment-independent-review.json) confirme la portée fermée de cette qualification : le candidat crée plus tôt ces fragments immuables pour le nouveau propriétaire, puis la référence crée les mêmes valeurs lorsqu'un appelant commun en a besoin. Les créations et leurs origines restent conservées ; seules les entrées exactement recensées bénéficient de cet appariement. Le [premier échec d'attribution](lot5a-evidence/performance/owner-structural-attribution.json) reste disponible. Le [contrat final](lot5a-evidence/performance/owner-growth-contract.json) lie le supplément déclaré avant mesure et les captures ; ce travail n'établit aucun gain de temps ni équivalence générale des états privés.

Deux incidents de préparation restent documentés. Le [premier préflight](lot5a-evidence/performance/diagnostic/static-preflight-initial-failure.json) détectait l'absence de la dépendance Pyodide côté référence ; la [réparation](lot5a-evidence/performance/dependency-preparation-repair.json) a relié les mêmes assets existants, sans modifier les sources natives. Le [premier lancement de readiness](lot5a-evidence/diagnostic/readiness-initial-failure.json) comparait un résumé `{fileCount, digest}` à un manifeste contenant aussi `files` ; seule cette lecture de métadonnées a été corrigée. Ces incidents ne sont pas des échecs du moteur. Le [préflight final passe 65/65](lot5a-evidence/performance/static-preflight.json), puis la [readiness réussie](lot5a-evidence/performance/readiness-execution.json) lie les preuves et les acquittements de calme en gardant les réserves navigateur et WEAV distinctes.

### Résultat officiel de coût et portée de l'acceptation

La [fenêtre officielle](lot5a-evidence/performance/exclusive-window-execution.json) s'est déroulée le 10 novembre 2026 de **21:29:50 à 21:38:25 UTC**, dans l'ordre **A1 / B1 / B2 / A2**. A désigne Site 82 / native 0.52.0 et B le candidat native 0.53.0. Le bilan conserve **32 sessions mesurées et 400 actions** ; les **huit sessions de chauffe et leurs 24 actions** restent séparées, conformément au protocole. Les médianes globales regroupent huit sessions par version et par jeu. La [consolidation qualifiée](lot5a-evidence/performance/owner-growth-comparison.json) et sa [revue indépendante](lot5a-evidence/performance/owner-growth-review.json) donnent :

| Jeu | Médiane globale A | Médiane globale B | Augmentation | Budget global qualifié |
| --- | ---: | ---: | ---: | --- |
| STCK | 9 872,156 ms | 10 821,705 ms | **+9,6185 %** | Accepté, strictement sous +10 %. |
| SMLP | 16 573,027 ms | 17 346,155 ms | **+4,6650 %** | Accepté, strictement sous +10 %. |

Cette acceptation est limitée au contrat déclaré et à ces traces. Le [comparateur historique strict reste en échec](lot5a-evidence/performance/aggregation-failure.json) sur l'identité structurelle ; son résultat et ses journaux sont conservés. Le calcul complémentaire applique la qualification des quatre chemins de compteurs et des fragments, définie avant mesure. Il ne réécrit aucune durée ni aucun échantillon.

Le premier analyseur qualifié a ensuite [refusé le nom de dossier](lot5a-evidence/performance/owner-growth-analysis-initial-failure.json) que son propre contrat avait déjà lié. Des variantes séparées ont fait l'objet d'une [réparation explicitement postérieure à la mesure](lot5a-evidence/performance/diagnostic/owner-cost-directory-correction-v1.json) : seule la garde admettant ce dossier exact et la traçabilité des générateurs changent. Les outils déclarés restent conservés ; les règles, données, calculs, contrôles structurels et résultats bruts sont inchangés. La revue Python effectivement exécutée vérifie **4 669 contrôles sur 4 669** et confirme l'acceptation qualifiée **2/2**. Cette réparation ne transforme aucun rejet historique en réussite.

### Régressions de phase et marge restante

Le diagnostic historique reste à **10 critères sur 16**. Les nouvelles décisions, la persistance et la restauration dépassent +10 % dans les deux jeux ; les résultats de phase restent publiés malgré l'acceptation globale.

| Médiane de phase | STCK | SMLP |
| --- | ---: | ---: |
| Nouvelle décision | **+22,74 %** | **+12,61 %** |
| Service d'un préfixe connu | +5,56 % | −1,90 % |
| Requête d'un préfixe connu | +3,48 % | −3,29 % |
| Garde d'un préfixe connu | +2,25 % | −4,48 % |
| Acquisition avec persistance | +6,10 % | −7,99 % |
| Persistance | **+18,97 %** | **+26,68 %** |
| Restauration | **+99,40 %** | **+69,50 %** |

Les pointes de restauration se dégradent aussi : le p95 STCK passe de **47,214 à 138,309 ms**, soit **+192,94 %** ; celui de SMLP passe de **24,601 à 57,703 ms**, soit **+134,56 %**. La seconde cohorte STCK, à **+11,6734 %** de temps global, reste intégralement incluse. Le résultat agrégé STCK ne conserve que **0,3815 point de pourcentage** de marge sous le seuil, soit environ **37,666 ms** de médiane globale. Ces variations limitent l'extrapolation à d'autres séquences ou à des sessions longues. Les chiffres complets sont dans le [rapport de coût](lot5a-evidence/performance/results.md) et la [revue numérique](lot5a-evidence/performance/owner-growth-review.json).

La [revue indépendante finale](lot5a-evidence/performance/diagnostic/final-cost-independent-review.json) reconstruit les résultats depuis les quatre rapports bruts et confirme l'acceptation avec la correction de dossier postmesure explicitement retenue. L'[intégrité finale](lot5a-evidence/final/delivery-integrity.json) confirme les inventaires et la reconstruction des preuves sans changer le digest natif. Le [transport final](lot5a-evidence/final/evidence-byte-transport.json) conserve **neuf grands fichiers gzip en 75 parties** : les sept rapports de régression et les deux captures structurelles. Les [quatre journaux de coût](lot5a-evidence/performance/log-transport.json) sont conservés et leur transport est vérifié octet pour octet. Le [contrôle des entrées de publication](lot5a-evidence/final/publication-inputs.json) passe ; il ne revendique pas la publication elle-même. Le résultat ne garantit ni une meilleure vitesse globale, ni une latence stable sur une longue session, ni la résolution du niveau 6 de WEAV.

## 7. WEAV : résultat et limite conservés

Le suivi a prolongé l'horloge historique du cas, sans la remettre à zéro. La [déclaration](lot5a-evidence/weav/native050-delta-diagnostic/declaration.json) décrit un diagnostic isolé sur native 0.50 et quatre fichiers modifiés pour les transactions, le magasin, la conclusion de coût nul et les copies redondantes du runtime. Il ne représente pas la source intégrée finale de 5A.

| Élément | Valeur conservée |
| --- | --- |
| Cible déclarée | Six niveaux dans une session commune froide. |
| Dernier retour public | 105 actions, 105 cycles, trois niveaux résolus, niveau 4 courant. |
| Temps actif indiqué par ce dernier retour | 329,272150311 secondes ; ce champ ne remplace pas l'horloge cumulée du cas. |
| Horloge antérieure | 1 277,782615 secondes. |
| Suivi écoulé | 1 123,445226 secondes. |
| Horloge cumulée à l'arrêt | **2 401,227841 secondes**, budget restant nul. |
| Statut | `case_budget_exhausted`. |
| Conclusion | La cible de six niveaux n'est pas établie. Aucun nouvel essai live sur ce suivi après la limite. |

Le [résultat](lot5a-evidence/weav/native050-delta-diagnostic/result.json), l'[horloge](lot5a-evidence/weav/followup-clock.json) et les journaux publics partiels sont conservés. L'horloge externe a interrompu le processus ; ce reçu ne décrit pas un nouvel essai parvenu au niveau 6 puis arrêté à ce niveau. Le travail fonctionnel 7A concurrent est également déclaré : les temps de ce diagnostic ne permettent pas une comparaison de performance isolée avant/après.

## 8. Feuille de route actualisée pour cette branche

| Priorité | Prochaine action | Critère de sortie |
| --- | --- | --- |
| Acquis | Suite large, preuve commune, sept régressions et réconciliation des publications 82 puis 83. | 3 835/3 835, 16/16, 119/119 ; référence de coût explicitement conservée à Site 82 / native 0.52.0. |
| Acquis | Attribution, fenêtre de coût, revue indépendante et intégrité. | 64/64 à l'attribution, budget global qualifié 2/2, revue 4 669/4 669 ; diagnostic 10/16, cohorte défavorable et incidents conservés. |
| 1 — prêt | Publier 5A et lier son identité Sites finale au commit et aux rapports. | Publication vérifiée sur le digest 0.53 gelé ; qualifications, réserves navigateur/WEAV et limites des sessions longues explicites. |
| 2 | Continuer avec 5B, `observed_addressed_material`. | Adressage courant, effets, invalidation et contribution en boucle commune démontrés. |
| 3 | Continuer avec 5C, `observed_object_binding`. | Contrat de liaison et retour de composition démontré, avec reprise et frontières. |
| Suivi de performance | Traiter les coûts des nouvelles décisions, de persistance et de restauration, en conservant le budget global et les distributions. | Comparaisons nouvelles explicitement déclarées ; aucun gain de vitesse globale ou comportement de longue session déduit de la seule acceptation 5A. |
| Suivi séparé | Conserver le résultat WEAV et poursuivre les optimisations génériques à partir des preuves acquises. | Aucun nouvel essai live après épuisement de l'horloge ; aucune promesse de résolution du niveau 6. |

L'[index des preuves](lot5a-evidence/README.md) distingue les reçus présents des éléments encore attendus. La [feuille de route globale](v6-delivery-roadmap.md) conserve les autres lots et les limites historiques ; ce rapport n'étend pas la clôture à la migration complète.
