# Lot 3A : première branche des compositions observées

## Périmètre déclaré avant les campagnes

Base : publication 64, commit `3b5cb28a594e8570253371aeeb24444361df3cb0`, moteur `0.36.0`, inventaire natif `ac7225dd2e5f51551881f0c1d5eba284c64c2f019b08f00e572900319e89255b`.

Le sous-lot porte entièrement `panel_service_plan`, première des six branches internes choisie pour `observed_composition_services`. Il reprend `panel_service_access.py`, `panel_service_projection.py` et le contrat de `common_observed_compositions.py` des agents originaux V6, avec leurs dépendances V5 effectivement consommées. Les originaux du commit `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` restent inchangés. Aucune implémentation ni spécification de jeu n'est consultée.

Le propriétaire existant `SharedSeriesConstraint`, exposé sous `public_occurrence_recall`, conserve les événements. L'entrée nouvelle et les entrées Coupled/Graph interrogent la même chaîne de mémoires. Acquisition unique, gardes, refus, restauration atomique et certificat de mémoire inchangée restent obligatoires. Sans événement Panel, le digest historique doit rester compatible ; après acquisition, le nouvel état participe au digest et à son certificat.

La couverture globale d'`observed_composition_services` reste partielle. Les cinq branches `exposed_reception_plan`, `chamber_relation_plan`, `rooted_line_plan`, `reception_service_plan` et `reference_population_plan` ne sont pas revendiquées. Le compteur des entrées complètement raccordées reste **50/76** tant que les six contrats ne sont pas couverts.

## Sélection d'un cas public

Le corpus `tests/fixtures/v6-linked-packet-initial-public.json.gz`, SHA-256 `3f82fb0b60a104095623216023054ef438ca4cc516941c671c385ebcbf1e54f2`, contient 100 observations initiales publiques. Un scan des projections originales, sans proposition, acquisition, action ou hôte de jeu, reconnaît une scène par branche : CWSE, CATR, RSWP, SK48, FOGW et VOIS respectivement. Les 1 786 fichiers originaux ont été vérifiés avant et après ce scan.

**RSWP** est retenu pour la campagne Panel. Sa vue initiale publique contient trois panneaux, chacun avec une correspondance locale unique entre matériau et récepteur. Ce constat est une condition d'éligibilité, pas une preuve de réussite. La recherche des reçus de sélection et de résolution antérieurs n'a trouvé aucun temps RSWP à reprendre. L'horloge commence le 9 novembre 2026 à 22:30:12 UTC, dès la décision de retenir ce jeu, et expire à 23:10:12 UTC. La préparation du port ne remet pas cette horloge à zéro. CATR est le prochain candidat si RSWP reste bloqué ; son temps déjà cumulé de 107,399326 secondes doit alors être conservé.

## Preuves fonctionnelles attendues

1. Comparaisons avec les sorties des originaux inchangés : projections, sélection locale, réécriture, paramètre de destination, préfixes et application commune.
2. Une première sélection confirmée acquiert la possibilité d'en préparer plusieurs ; un retour contraire ou sans information est retenu et interdit de répéter aveuglément le même essai.
3. Points courants, commande, disposition, projection de tous les panneaux, époque, score et observation restent gardés. Une frontière ou une réponse inconnue scelle le préfixe.
4. Le propriétaire commun conserve les anciens acquis et les nouveaux événements, reconstruit exactement son état et refuse une restauration altérée sans perdre l'état valide. Une mutation de la nouvelle couche invalide le certificat de restauration rapide.
5. Campagne froide par le caller commun et l'hôte opaque : viser trois niveaux naturels dans une même session, journaliser les commandes et tous les paquets publics. Aucune route, solution, connaissance préparée ou attente d'action n'entre dans le moteur.
6. Une comparaison à la base 0.36, ou une ablation déclarée, attribue la nouvelle décision à la branche transférée. Une non-régression sur un ancien jeu ne remplace pas cette preuve.
7. Contrôle navigateur du résultat et des actions Pause/Reprise, puis intégrité du gel, des preuves et du build réellement livré.

## Coût déclaré avant mesure

La comparaison de non-régression utilise le même outil `measure-native-loop-costs.mjs`, trois sessions froides par version et les mêmes cas publics **STCK10** et **SMLP15**. La base est la publication 64, pas une ancienne version plus lente. Les huit médianes de la politique commune par cas sont soumises au budget inchangé de **+10 %**, soit 16 comparaisons. Les fenêtres avant/après sont isolées des builds, tests, exports, autres campagnes et contrôles navigateur. Les sources, entrées, environnement, effectifs et éventuels dépassements sont conservés.

Le chemin Panel ajouté est mesuré séparément avec ses nouveaux préfixes et acquisitions. Comme la base peut produire un travail différent, aucun ratio de vitesse sur une campagne différente n'est présenté comme une comparaison équivalente. Les distributions, la restauration, les continuations et les limites d'effectif restent visibles ; un p95 est omis sous 20 échantillons.

## Limites de clôture

La livraison de ce sous-lot ne clôt ni le lot 3, ni la façade à six branches, ni la migration globale V5/V6. Toute campagne échouée, divergence source ou réserve de coût est conservée avec son statut réel et son horloge. Le journal source possède par ailleurs une collision de nom `reception_events` entre ExposedReception et ReceptionService : elle devra être traitée explicitement lors de leur port, sans être imputée à Panel.
