# Preuves du lot 4C

## Livré dans Site 92 / native 0.57 : fonctionnel validé et coût accepté

Le transfert `facet_example`, simple et composé, est validé dans **native 0.57.0** sur le gel `eebd099808672be934389020c8f9061df4fdacab28cd7d60c00cd1b080464c04`. Le [rapport](../lot4c-facet-examples.md) et la [filiation](../lot4c-facet-examples-lineage.md) distinguent contrats source, connaissances acquises, contribution aux choix et limites. Les dates affichées dans ces documents utilisent **UTC−03** ; les reçus gardent leurs horodatages bruts.

## Publication de référence et gel

| Preuve | Portée |
| --- | --- |
| [Site 89 au démarrage](planning/published-start-site89.json) | Publication native 0.55 effectivement disponible au début du développement ; historique conservé |
| [Site 90](planning/published-predecessor-site90.json), [Site 91](planning/published-predecessor-site91.json) | Prédécesseur réel 10A/native 0.56 ; Site 91, commit `5659ddc9420c7624df4865f0afc628782296a186`, déployé le 10 novembre 2026 à 21:42:39 UTC−03 |
| [Clôture Sites 90–91](planning/published-predecessor-source-closure.json) | Même archive d'application, changements uniquement documentaires et 298 fichiers du candidat toujours conformes au gel |
| [Manifeste natif final](integrated-final/source-manifest.json), [archive](integrated-final/source-archive.json) | 298 fichiers natifs et 309 entrées d'archive au commit `6065d67c18b1ad85bd62b60c36c6962f18bfeab3` |
| [Publication réelle Site 92](publication/native-publication.json) | **Native 0.57.0**, source `d06620d1e4ca2c9758cc693b1ced9eeeddccb7e6`, déploiement `succeeded` le **10 novembre 2026 à 22:45:49 UTC−03** ; URL et audience propriétaire privé révision 3 inchangées |
| [Plan de transport](publication/lot4c-source-push-plan.json), [vérification finale](publication/final-source-build-verification.json), [preuves conservées](publication/retained-transport-evidence.json) | **Cinq envois ordinaires**, sans force ni publication intermédiaire ; **75 membres applicatifs identiques dans chacune des cinq archives**, **746 entrées gelées par checkout**, sources/tests/build/worker inchangés |

## Résultats finaux exécutés

| Preuve | Résultat |
| --- | --- |
| [Suite formelle](integrated-final/validation/delta-tests-run.json) | **4 838/4 838 tests dans 121 fichiers**, zéro échec, annulation, test ignoré ou TODO |
| [Contrôles du projet](integrated-final/validation/checks-run.json) | **5/5** : typage, deux audits, diff et build ; sources inchangées |
| [Dix régressions strictes](integrated-final/regressions/regression-summary.json) | **170/170 contrôles**, 357 actions, 275 préfixes, 367 paquets, 1 676 images, 632 requêtes et 30 frontières ; entrées et sources inchangées |
| [LKEY partiel](integrated-final/lkey-partial/qualification.json), [contrat final](integrated-final/lkey-partial-contract.json) | **157/157 contrôles**, 25 actions et deux niveaux ; le brut reste `failed` et l'arrêt `frontier_unknown` au troisième niveau reste non résolu |
| [Parité source froide](integrated-final/isos-facet-source-parity.json.gz), [diagnostic](integrated-final/isos-facet-source-parity-diagnostic.json), [exécution](integrated-final/isos-facet-source-parity-execution.json) | **48 appels, 24 gardes, douze acquisitions, 36 restaurations, douze préfixes, treize observations et zéro différence** ; 1 786 originaux inchangés |
| Ablations dans le même rapport source | **60 interventions** : neuf changements d'action/refus, quatre de métadonnées seulement, 47 propositions inchangées ; 41 champs déjà vides |
| [Navigateur réel](integrated-final/browser/browser-qa.json), [preuve PNG](integrated-final/browser/isos-three-levels.png) | **ISOS trois niveaux, douze actions et douze plans**, Pause 1→1, action unique 1→2 et frontières 3/7/12 dans la même session froide |
| [Horloge cumulative](case-clock.json) | **1 259,938444409 / 2 400 secondes** après l'intervalle 04 ; **1 140,061555591 secondes restantes**, sans reset, chevauchement 02/03 intégralement facturé |
| [Intégrité de livraison](integrated-final/delivery-integrity.json) | **Passée** : 298 fichiers natifs, 309 entrées d'archive, 684 entrées source/tests, 363 entrées de build, dix entrées de rejeu et 1 786 originaux inchangés |

Les rejeux calculent chaque commande avant de recevoir son retour public conservé. Le pilote garde un seul rejeu en mémoire à la fois, puis compare après sa sortie. Les journaux bruts, reçus de démarrage, rapports, comparaisons et empreintes sont conservés dans `integrated-final/regressions/`. Ces régressions et la comparaison Python ne sont pas de nouveaux jeux exécutés. La QA navigateur est une exécution réelle distincte sur le build final ; ses trois niveaux ne valent pas victoire sur les six niveaux d'ISOS.

## Développement, références et échecs conservés

- [Revue source](planning/source-review.json) : propriétaires, ordre source, contrats et portée de transfert.
- `development/oracle-attempt-01/` conserve l'échec initial de sérialisation avant écriture d'attentes. `development/oracle-attempt-02/` conserve les 93 tests préliminaires, antérieurs à la correction de moyenne compensée. Les [99 tests du troisième essai](development/oracle-attempt-03/resume-run.json) et la [première intégration commune](development/integration-attempt-01/execution.json) restent des preuves de développement.
- [Campagne froide de développement](development/isos-live-01/execution-isos.json) : trois niveaux, douze actions, douze préfixes, gel antérieur à l'intégration finale de 10A.
- [Premier comparateur en échec](development/isos-live-01/isos-facet-source-parity-attempt-01.json.gz), [correction documentée](development/isos-live-01/isos-facet-source-parity-snapshot-correction.json) et [deuxième essai](development/isos-live-01/isos-facet-source-parity-attempt-02.json.gz) : deux différences historiques de `boundary_ref`, dues à la comparaison d'une preuve immuable avec un objet vivant après acquisition. L'instantané complet de l'offre et son alias vivant sont ensuite distingués sans suppression de champ ni modification native.
- [Référence native 0.56 bornée](reference-isos-056/reference-case-execution.json) et [diagnostic du journal public](development/isos-reference-056-public-diagnostic.json) : huit retours réels, zéro niveau, rasters observés inchangés ; le plafond externe laisse le contrôleur à sept préfixes. Le résultat brut reste `failed`, sans conclusion générale d'incapacité ni mesure de gain de vitesse.
- [Préparation du coût](planning/cost-tool-adaptation-start.json), [revue statique](planning/cost-source-review.json) et [revue du lancement](planning/readiness-launch-source-review.json) : outils et contrôles préparés ; leur présence n'établit pas une mesure officielle.

## Coût officiel accepté

La [fenêtre exclusive A1/B1/B2/A2](performance-integrated/window.json) s'est tenue le **10 novembre 2026 de 22:11:49 à 22:20:32 UTC−03**, sur la référence fraîche Site 91/native 0.56 et le gel final 0.57. Elle conserve **32 sessions mesurées / 400 actions** ; seules huit chauffes / 24 actions sont exclues. La [revue indépendante](performance-integrated/owner-growth-review.json) passe **7 630/7 630 contrôles**, avec **2/2 jeux acceptés** : STCK **11 253,251434999998 → 11 046,9208325 ms (−1,833520 %)** ; SMLP **16 297,509763000002 → 16 272,070031000007 ms (−0,156096 %)**.

Chaque médiane de session complète reste **strictement sous +10 %**. Une phase au-dessus de 10 % n'est pas un veto si ce critère global passe. Les diagnostics restent **15/16** en agrégat, restauration SMLP **+25,066387 %**, et **15/16 dans chaque cohorte**, nouvelle décision STCK **+10,782328 %** puis restauration SMLP **+42,839691 %**. Le p95 de restauration STCK augmente de **+13,878385 %** en agrégat et **+22,824004 %** en cohorte 2. Le [rapport complet](performance-integrated/results.md) conserve tous les échantillons, p95 disponibles, inspections, pauses, mémoires et limites ; il ne prouve ni un coût de longue composition Facet, ni une stabilité de plusieurs heures, ni une Pause immédiate pour toute recherche.

| Preuve de coût et de qualification | Portée conservée |
| --- | --- |
| [Contrat déclaré](performance-integrated/owner-growth-contract.json), [attribution fonctionnelle](performance-integrated/owner-graph-attribution.json) | **37 deltas attribués / 64 contrôles non chronométrés**, quatre chemins structurels qualifiés avant mesure ; aucune identité des feuilles privées déduite des seuls compteurs |
| [Contrôle préalable](performance-integrated/static-preflight.json), [readiness](performance-integrated/readiness.json) | **65/65 contrôles statiques** et preuves fonctionnelles liées avant la fenêtre |
| [Isolation clôturée](performance-integrated/coordinated-isolation-completion.json) | **Passée**, verrou tenu pendant toute la fenêtre, signaux inchangés et intégrité finale passée |
| [Agrégateur historique](performance-integrated/aggregation-failure.json) | Échec strict conservé, **code 1** ; identité intégrale des métadonnées de travail non acquise |
| [Consolidation complémentaire](performance-integrated/owner-growth-comparison.json) | **432 écarts structurels** énumérés sur les quatre chemins déclarés ; formes exactes vérifiées pour chaque chauffe et session, autres champs stricts |
| [Préparation post-mesure, essai 01](performance-integrated/post-window-analysis/preparation-attempt-01.json) | `FileNotFoundError` conservé : sorties de comparaisons de cohortes cherchées avant leur génération ; outils déclarés exécutés ensuite, aucune mesure répétée ni entrée modifiée |

Les huit sessions par jeu/version alimentent la médiane commune, sans compensation entre jeux, suppression de session mesurée, somme de phases imbriquées ni moyenne de ratios. Le moteur de jeu, le réseau de production et le rendu navigateur restent hors mesure ; le rapport distingue les observations corrélées et les variations possibles de GC/JIT ou d'ordonnancement. L'acceptation ne remplace aucune preuve de parité source ou de contribution en jeu.

## Livraison et suite documentaire

**4C est livré dans Site 92, avec coût accepté et publication privée réussie. Les trois sous-lots 4A/4B/4C sont livrés ; le lot 4 est clos dans ses périmètres annoncés.** Le registre publié atteint **61/76 entrées, 80,3 %, avec 15 restantes** ; les six portes de migration complète demeurent fausses. La présente clôture documentaire consigne la publication effective sur les mêmes entrées natives et applicatives ; son reçu terminal est communiqué séparément. Le prochain travail concret hors lot 4 est l'intégration finale de **5B, `observed_addressed_material`, native 0.58**, déjà préparé en parallèle, en conservant cette clôture ; aucune nouvelle implémentation n'est ajoutée ici.

## Vérification des entrées de publication

Le [reçu final](integrated-final/publication-inputs.json) passe sur 920 entrées liées. L'[échec initial](publication-preflight/record-publication-inputs-execution.json), les scripts avant/après, le diff, la [correction documentée](publication-preflight/record-publication-inputs-correction.json), la [revue indépendante](publication-preflight/record-publication-inputs-compatibility-oracle-review.json) et la [tentative 02 passée](publication-preflight/attempt-02/record-publication-inputs-execution.json) restent conservés. La correction concerne uniquement la lecture des reçus de validation ; les journaux gelés et les résumés actuels sont distingués sans empreinte historique inventée. Le [transport des journaux](planning/closing-log-transport.json) conserve leurs octets exacts, sans répétition de test, build ou mesure.
