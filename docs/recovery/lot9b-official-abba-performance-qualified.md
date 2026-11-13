# Lot 9B — qualification officielle fonctionnelle et performance

Date : 13 novembre 2026

## Verdict

Le sous-lot **9B `region_intervention` reste qualifié fonctionnellement et en performance** après intégration du contrat canonique de configuration du benchmark.

- **STCK : -1,355014 % — PASS** ;
- **SMLP : +2,140884 % — PASS**.

Le seuil est strictement inférieur à +10 % pour chaque jeu. Aucun jeu ne compense l’autre et aucun échantillon n’a été supprimé.

## Identités mesurées

- A : `lot9b-region-v1:A:99faf15665a8401a4b5e9867f1cfd1935d68f6171c46c839c34818f04b51f231` ;
- B : `lot9b-region-v1:B:8e23f39ba219a43a3d5b7cc7644551dea24ca0fc0216d5b58a8c808fdc315a83` ;
- corpus : `native-region-action6-corpus-v1` ;
- commit mesuré : `1428683411e91423747ef5021b30d96d528dc362` ;
- protocole : A1 → B1 → B2 → A2 ;
- invocations : 40 ;
- sessions mesurées : 32 ;
- actions mesurées : 400.

## Résultats

| Jeu | Médiane A | Médiane B | Delta global | Verdict |
| --- | ---: | ---: | ---: | --- |
| STCK | 36,9000 ms | 36,4000 ms | -1,3550 % | PASS |
| SMLP | 72,4000 ms | 73,9500 ms | +2,1409 % | PASS |

## Activité Region conservée

- STCK : 86 ACTION6 vues, 86 acquisitions et 86 méthodes ;
- SMLP : 126 ACTION6 vues, 126 acquisitions et 126 méthodes.

## Qualification fonctionnelle

- typecheck : réussi ;
- régression TypeScript : 355/355 ;
- build : réussi ;
- parité Worker/Pyodide : 4 échantillons, 31 étapes ;
- contrats natifs : 24/24 ;
- preuve et manifeste : vérifiés après mesure.

## Exécution

- run : `43363531876` ;
- job : `131682410527` ;
- artefact : `14008784912` ;
- SHA-256 de l’artefact ZIP : `fbbf982a13defb6e5ea7da80e85b3cf3c7f21cbe86fa49466f46f93dd92293f8` ;
- isolation déclarée : `non-isolated-shared-github-actions-runner-no-repository-concurrency` ;
- Chrome : `Google Chrome 157.0.8103.50`.

## Portée

Cette requalification couvre le coût du hook Region natif pour l’identité A/B ci-dessus. Elle ne revendique ni la parité complète des 76 entrées V6, ni l’identité binaire avec Site 109. Aucun Site n’est publié par cette étape.

## Suite

Le résultat C7 reste clos pour cette identité. Les dettes fonctionnelles séparées restent le candidat produit Region complet, les acquisitions passives multi-propriétaires, la sauvegarde/restauration et le propriétaire produit OP31.
