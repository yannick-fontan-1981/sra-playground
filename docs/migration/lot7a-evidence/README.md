# Index des preuves du lot 7A

Le [bilan du lot](../lot7a-ranked-workshop.md) décrit le comportement et les
réserves ; la [filiation](../lot7a-ranked-workshop-lineage.md) précise les
originaux consommés. Les pièces ci-dessous gardent leurs identités distinctes.
Une preuve du port isolé n'est pas réattribuée au candidat intégré.

## Candidat intégré 0.52 : preuves fonctionnelles

Le gel vérifié contient **279 fichiers natifs**, digest
`f5f4a67d68f867d3a37ef66fd7c07b9e75b9d201daceb732038f8fa71caa59eb`.
Il intègre les commits effectivement publiés de 3I puis 4A. La référence directe
4A est **Site 81 / native 0.51**, commit
`4dafc40c53ed4406ee7cd148e3e6995a2eb4185e`. Le
[rattachement après fusion](coordination/published-base-binding.json) confirme
l'identité des sources et de toutes les entrées fonctionnelles déjà vérifiées.

| Pièce | Résultat et portée |
| --- | --- |
| [Constats fonctionnels indépendants](integrated-final/functional-findings.md) | Synthèse du gel et des limites ; distinction composant, Kernel, partie réelle, ablations et navigateur |
| [Manifeste natif](integrated-final/source-manifest.json) et [archive](integrated-final/source-archive.json) | 279 fichiers natifs et 290 entrées archivées, sans état appris injecté |
| [Tests intégrés](integrated-final/validation/delta-tests-run.json) | 3 745/3 745 tests, 97 fichiers ; comprend 155 comparaisons Workshop et 4 contrats Kernel |
| [Cinq contrôles du projet](integrated-final/project-checks-retry/validation/checks-run.json) | TypeScript, registre, audit de migration, différences et compilation réussis |
| [Incident du helper Sites](integrated-final/build-helper-path-resolution.json) | Échec initial du chemin 1.1.5 avant compilation, conservé ; reprise avec 1.1.6 |
| [Réutilisation du reçu de tests](integrated-final/project-checks-retry/test-receipt-reuse.json) | Copie identique octet pour octet ; aucun résultat synthétisé |
| [Intégrité de livraison](integrated-final/delivery-integrity.json) | Inventaires, archive, sources originales et reçus fonctionnels concordants |
| [Campagne réelle intégrée](integrated-final/execution-lkey.json) | LKEY froid : 25 actions, 25 préfixes, deux niveaux terminés ; cible 3/3 non atteinte |
| [Parité source intégrée](integrated-final/diagnostic/integrated-public-parity.json) | 49 appels / 147 comparaisons exactes ; un propriétaire Python froid, aucun état natif injecté |
| [Contribution et ablations intégrées](integrated-final/diagnostic/contribution.json.gz) | 14 propositions sélectionnées ; 14 retours actifs et 11 passifs, aucun doublon ; limites causales conservées |
| [Sept régressions intégrées](integrated-final/regressions/regression-summary.json) | 119/119 contrôles, 292 commandes, 210 préfixes et 21 frontières ; aucune nouvelle réussite de jeu revendiquée |
| [Navigateur intégré](integrated-final/browser/browser-qa.json), [états observés](integrated-final/browser/observed-states.json) et [capture](integrated-final/browser/final.png) | Pause, action unique, reprise, deux frontières naturelles puis `frontier_unknown` au troisième niveau |
| [Horloge figée du gel](integrated-final/lkey-case-checkpoint.json) | 1 341,623 s consommées et 1 058,377 s restantes sur 40 min ; aucun effacement des tentatives antérieures |

La réserve LKEY demeure **2/3 niveaux**. Le dernier paquet réel permet au
propriétaire Python de formuler une question de revalidation, mais aucun appel
natif de proposition Workshop n'est capturé à l'époque 3. Ce diagnostic n'a
envoyé aucune action supplémentaire et ne démontre pas une résolution du niveau.
Les observations d'opérateurs sont acquises ; leur ablation laisse ici les
14 propositions sélectionnées inchangées. La parité de tout l'appelant et une
latence maximale de Pause restent ouvertes.

## Port isolé et résultats conservés

| Pièce | Portée |
| --- | --- |
| [Campagne initiale](attempt1/execution-lkey.json) | Partie LKEY froide : 25 actions, deux niveaux officiels, cible de trois niveaux non atteinte |
| [Parité indépendante](diagnostic/attempt1-public-parity.json) | 49 appels du propriétaire Python froid, 147 comparaisons exactes, aucun état natif injecté |
| [Ablations](diagnostic/contribution.json.gz) | Contribution des couches apprises à la décision du composant ; résultats négatifs conservés |
| [Validation élargie initiale](final/validation/delta-tests-run.json) | 2 960/2 961 tests ; l'échec d'une attente d'adjacence Inventory reste conservé |
| [Correction Inventory](diagnostic/inventory-order-expectation-correction.json) | Vérification de l'ordre déclaré, sans modification native |
| [Correction du test de registre](diagnostic/radial-alias-correction.json) | Alias Workshop et contrôle de l'entrée explicite ajoutés |
| [Régressions initiales](final/regressions/regression-summary.json) | CATR, RSWP, FOGW et VOIS : 68/68 contrôles, 159 actions et 88 préfixes |
| [Navigateur isolé](final/browser/browser-qa.json) | Pause, pas unique et reprise ; arrêt à 25 actions, deux niveaux et 25 plans |
| [Horloge LKEY](lkey-case-checkpoint.json) | Budget cumulé de 40 minutes, tentatives et intervalles conservés sans remise à zéro |
| [Ancienne déclaration de coût](performance/superseded-before-measurement.json) | Préparation isolée remplacée avant mesure : zéro session exécutée |

## Intégration et provenance publiées

L'ordre coordonné de publication est **3I → 4A → 7A**. La préparation source
préserve les propriétaires, les positions DRM et les retours actifs/passifs de
chaque lot. La fusion du prédécesseur publié est
`1ceea98d31e659dfed618d121ee4410c88fda378` ; elle ne modifie pas les octets du
gel fonctionnel ni les sources, tests et entrées de compilation vérifiés.

- [Revue des points de fusion](coordination/integration-review-plan.md).
- [Intégration du commit publié 3I](coordination/published-3i-integration.json).
- [Préparation additive de 4A](coordination/prepared-4a-integration.json).
- [Publication 4A effectivement vérifiée](coordination/published-4a-site81.json)
  et [rattachement des octets publiés](coordination/published-base-binding.json).
- [Périmètre formel déclaré](coordination/integrated-test-scope-plan.json) : union
  de 97 fichiers, sans retrait des contrats précédents.
- [Choix du runner final](coordination/final-validation-runner-plan.json) : outil
  officiel existant, avec son schéma vérifié par le contrôle d'intégrité.
- [Manifeste des sept rejeux](recorded-regression-cases-integrated.json) et
  [provenance de leurs entrées](coordination/integrated-regression-provenance.json) :
  six rapports natifs 0.51 et CONN publié en 0.50 ; leurs identités restent explicites.

Le registre intégré est **56/76**, avec 20 entrées ouvertes. L'audit de migration
conserve 172 modules vérifiés au niveau composant, 143 partiellement transférés
et 1 054 en attente, sur 1 369 modules Python et 417 fichiers de données.
**7B n'est pas inclus dans ce lot.**

## Coût : protocole et structure fixés avant mesure

| Pièce | Engagement conservé |
| --- | --- |
| [Protocole intégré](performance-integrated/protocol.md) et [déclaration](performance-integrated/declaration.json) | Référence publiée 0.51 contre gel 0.52 ; STCK et SMLP ; ordre A1/B1/B2/A2 |
| [Politique globale](performance-integrated/global-budget-policy.json) | Médiane de durée complète strictement sous +10 % pour chaque jeu ; aucune compensation entre jeux ni somme des phases |
| [Contrôle statique](performance-integrated/static-preflight.json) | 65 contrôles réussis avant la fenêtre |
| [Readiness](performance-integrated/readiness.json) et [isolation](performance-integrated/coordinated-isolation.json) | Preuves fonctionnelles terminées, réserve LKEY, preview arrêté et coordination des autres fils |
| [Inventaire des propriétaires et programmes](performance-integrated/owner-source-inventory.json) | Ajout du propriétaire Workshop et de son programme ; aucune conclusion de contribution en jeu tirée du seul enregistrement |
| [Contrat structurel v2](performance-integrated/owner-growth-contract.json) | Quatre chemins de compteurs explicitement admissibles ; tous les autres champs de travail restent stricts |
| [Fixture fonctionnelle](performance-integrated/owner-structural-fixture.json) et [attribution](performance-integrated/owner-structural-attribution-02.json) | Quatre formes A/B observées avant mesure ; 64 contrôles et 55 deltas ou écritures de graphe attribués |
| [Incident de projection de commande](diagnostic/owner-structural-command-projection-incident.json) et [résolution](diagnostic/owner-structural-command-projection-resolution.json) | Comparaison corrigée avant mesure selon la conversion réelle de `data` absent vers `data: {}` ; source native, captures et refus initial conservés |

La fenêtre conserve **32 sessions et 400 actions mesurées**. Seules les
huit chauffes séparées, soit 24 actions, sont exclues. Aucun temps n'est corrigé
pour la structure supplémentaire du graphe. Le contrôle historique d'identité
du travail conserve son propre résultat ; la consolidation complémentaire ne
reclasse pas son refus comme une réussite.

Le **verdict terminal de coût et l'identité de publication propre à 7A** se lisent
dans le [bilan du lot](../lot7a-ranked-workshop.md), à partir de leurs reçus
effectivement produits. La préparation, les contrôles statiques et la readiness
ne constituent pas des résultats de performance.

## Résultats de coût et préparation de publication

| Pièce | Résultat retenu |
| --- | --- |
| [Fenêtre officielle](performance-integrated/window.json) | Quatre séries terminées, intégrité finale passée ; 32 sessions/400 actions |
| [Refus historique strict](performance-integrated/aggregation-failure.json) | Échec conservé, aucun agrégat strict réussi fabriqué |
| [Correction E/S après mesure](performance-integrated/diagnostic/owner-cost-io-correction-v1.json) | Cinq chemins déjà fixés ; outils d'origine et échec initial conservés, règles et calculs inchangés |
| [Consolidation complémentaire](performance-integrated/owner-growth-comparison.json) | 432 différences structurelles qualifiées selon la fixture pré-mesure ; phases groupées 16/16 |
| [Revue indépendante](performance-integrated/owner-growth-review.json) | 3 866 contrôles ; coût global accepté STCK +0,453255 %, SMLP −1,418017 % |
| [Résultats complets](performance-integrated/results.md) | 32 sessions affichées, 16 diagnostics groupés et 32 diagnostics de cohorte ; dépassements et p95 conservés |
| [Entrées de publication](integrated-final/publication-inputs.json) | Source, tests et build inchangés ; aucun nouveau test, jeu ou build déduit de ce reçu |

## Publication vérifiée

La première livraison est **Site 82/native 0.52**, commit
`0ca36b0a6a358e1e89420753bbcec4a33f028e0a`, déploiement `succeeded` et accès privé.
Le [reçu de publication](integrated-final/publication-site82.json), le
[transport normal des sources](integrated-final/publication-source-transport.json)
et son [plan conservé](coordination/publication-bounded-source-plan.json) gardent
les identités exactes, tous les commits et les cinq étapes sans déploiement
intermédiaire. Les 75 contenus de fichiers des archives sont identiques ; leurs
conteneurs et l'identité d'archive du serveur restent identifiés séparément.

## Conservation des octets

Les gros rapports compressés restent disponibles sous forme de parties exactes
accompagnées de leur manifeste et de leurs empreintes. Depuis la racine du
checkout, `python -B scripts/evidence-byte-parts.py restore
docs/migration/lot7a-evidence` reconstitue les originaux manquants sans remplacer
les fichiers existants. Les archives source utilisent leur manifeste séparé.
Les rapports complets, les refus et les résultats défavorables ne sont pas
filtrés pour produire les tableaux du bilan.
