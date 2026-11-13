# Lot 9B — qualification officielle fonctionnelle et performance

Date : 13 novembre 2026

## Verdict

Le sous-lot **9B `region_intervention` reste qualifié fonctionnellement et en performance** après intégration du contrat canonique de configuration du benchmark.

- **STCK : +2,222222 % — PASS** ;
- **SMLP : +1,869477 % — PASS**.

Le seuil est strictement inférieur à +10 % pour chaque jeu. Aucun jeu ne compense l’autre et aucun échantillon n’a été supprimé.

## Identités mesurées

- A : `lot9b-region-v1:A:99faf15665a8401a4b5e9867f1cfd1935d68f6171c46c839c34818f04b51f231` ;
- B : `lot9b-region-v1:B:8e23f39ba219a43a3d5b7cc7644551dea24ca0fc0216d5b58a8c808fdc315a83` ;
- corpus : `native-region-action6-corpus-v1` ;
- commit mesuré : `ea6bc872b90261133dfc8780664b487f5917653f` ;
- protocole : A1 → B1 → B2 → A2 ;
- invocations : 40 ;
- sessions mesurées : 32 ;
- actions mesurées : 400.

## Résultats

| Jeu | Médiane A | Médiane B | Delta global | Verdict |
| --- | ---: | ---: | ---: | --- |
| STCK | 72,0000 ms | 73,6000 ms | +2,2222 % | PASS |
| SMLP | 147,1000 ms | 149,8500 ms | +1,8695 % | PASS |

## Activité Region conservée

- STCK : 86 ACTION6 vues, 86 acquisitions et 86 méthodes ;
- SMLP : 126 ACTION6 vues, 126 acquisitions et 126 méthodes.

## Qualification fonctionnelle

- typecheck : réussi ;
- régression TypeScript : 367/367 ;
- build : réussi ;
- parité Worker/Pyodide : 4 échantillons, 31 étapes ;
- contrats natifs : 24/24 ;
- preuve et manifeste : vérifiés après mesure.

## Exécution

- run : `43364316353` ;
- job : `131685000996` ;
- artefact : `14009866905` ;
- SHA-256 de l’artefact ZIP : `fcba80e7831e477f3746cc0bd45d1c6214371579749271be0e2b5ae73f65ef5d` ;
- isolation déclarée : `non-isolated-shared-github-actions-runner-no-repository-concurrency` ;
- Chrome : `Google Chrome 157.0.8103.50`.

## Portée

Cette requalification couvre le coût du hook Region natif pour l’identité A/B ci-dessus. Elle ne revendique ni la parité complète des 76 entrées V6, ni l’identité binaire avec Site 109. Aucun Site n’est publié par cette étape.

## Suite

Le résultat C7 reste clos pour cette identité. Les dettes fonctionnelles séparées restent le candidat produit Region complet, les acquisitions passives multi-propriétaires, la sauvegarde/restauration et le propriétaire produit OP31.

## Mesure canonique rejetée conservée

La première mesure indépendante de l’identité courante a été rejetée et reste intégralement conservée :

- run : `43364040206` ;
- job : `131684105998` ;
- commit mesuré : `f172f1ad504742a7a84d3373d7a2da2bfb19ef77` ;
- STCK : +1,9900 %, accepté ;
- SMLP : +11,3795 %, rejeté ;
- seuil : strictement inférieur à +10 % par jeu ;
- suppression ou substitution d’échantillon : aucune ;
- nouvelle tentative à l’intérieur du run : aucune.

La qualification acceptée documentée ci-dessus provient d’une exécution indépendante ultérieure. Elle ne remplace ni ne masque cette mesure rejetée.
