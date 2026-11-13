# Registre V6 reconstruit des points d’entrée

Date de consolidation : 13 novembre 2026 (America/Recife).

Branche canonique auditée : `recovery/site109-reconstruction-20261112`  
Commit canonique audité : `68cdddc92b4b7f0214a2d7e5a5f0ffe6c94e7216`

## Verdict

Le dépôt possède désormais un **registre courant fondé sur les preuves GitHub durables**. Il inventorie les capacités réellement reconstruites et distingue explicitement :

1. présence de l’implémentation ;
2. calcul qualifié ;
3. producteur démontré ;
4. appel observé ;
5. résultat consommé ;
6. effet sur une décision ;
7. qualification officielle de performance.

Ce registre **n’est pas** la table historique perdue des 76 points d’entrée. Les identités de ces 76 emplacements et leur correspondance avec les capacités présentes ne sont pas disponibles dans une preuve GitHub durable. Par conséquent :

- `historical76.currentCount` reste `null` ;
- `historical76.mappedSlots` reste `0` ;
- les anciens nombres `70/76` et `71/76` sont conservés comme faits historiques, pas comme état courant ;
- aucune parité avec Site 109 n’est revendiquée.

## Résumé machine

| Mesure | Valeur |
| --- | ---: |
| `operationRecords` | 31 |
| `capabilityRecords` | 16 |
| `inventoryRecords` | 47 |
| `operationsCalculationQualified` | 31 |
| `operationsProductActive` | 2 |
| `capabilitiesFunctionalQualified` | 16 |
| `capabilitiesProductActive` | 8 |
| `capabilitiesSupportingActive` | 5 |
| `capabilitiesOfficialPerformanceQualified` | 2 |
| `historicalMappedSlots` | 0 |
| `historicalCount` | `null` |
| `historicalParityClaimed` | false |

Le total de 47 est un **inventaire de preuves** composé de 31 opérations et 16 capacités de haut niveau. Il ne doit jamais être présenté comme `47/76`.

## Disposition OP01–OP31

| OP | Statut runtime actuel | Produit | Effet décisionnel |
| --- | --- | --- | --- |
| OP01 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP02 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP03 | producteur manquant | non | not-demonstrated |
| OP04 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP05 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP06 | effet spécialisé démontré | non | demonstrated-specialized |
| OP07 | producteur manquant | non | not-demonstrated |
| OP08 | recouvert familialement, aucun appel générique | non | not-demonstrated |
| OP09 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP10 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP11 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP12 | recouvert familialement, aucun appel générique | non | not-demonstrated |
| OP13 | spécialisé borné, consommateur générique absent | non | bounded-specialized-only |
| OP14 | bridge présent, release native absente | non | not-demonstrated |
| OP15 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP16 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP17 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP18 | produit actif | oui | demonstrated |
| OP19 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP20 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP21 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP22 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP23 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP24 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP25 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP26 | recouvert familialement, aucun appel générique | non | not-demonstrated |
| OP27 | calcul disponible, usage décisionnel non démontré | non | not-demonstrated |
| OP28 | produit actif | oui | demonstrated |
| OP29 | effet spécialisé démontré | non | demonstrated-specialized |
| OP30 | effet spécialisé démontré | non | demonstrated-specialized |
| OP31 | appel disponible, propriétaire d’objectif absent | non | not-demonstrated |

Les deux seules opérations actuellement promues comme actives dans le produit sont :

- **OP18**, lorsque FieldStock possède un stock courant retenu et revalidé ;
- **OP28**, pour l’action publique simple unique, la décision conjointe SMLP et la carte STCK publique unique.

OP06, OP29 et OP30 possèdent des effets spécialisés démontrés, mais ne sont pas comptées comme points d’entrée produit génériques. OP31 reste disponible au niveau calcul, sans propriétaire d’objectif capable de maintenir, suspendre ou réorienter la campagne.

## Capacités reconstruites

| Identité | Fonctionnel | Produit | Performance |
| --- | --- | --- | --- |
| `logos.operation-catalog` | `qualified` | `supporting-active` | `not-measured-separately` |
| `logos.composition-authority` | `qualified` | `supporting-active` | `covered-by-qualified-scopes` |
| `logos.operation-observability` | `qualified` | `supporting-active` | `not-measured-separately` |
| `campaign.common-owner` | `qualified` | `active` | `covered-by-qualified-scopes` |
| `runtime.campaign-checkpoint-core` | `qualified-bounded` | `active` | `not-measured-separately` |
| `campaign.field-stock-op18` | `qualified-bounded` | `active` | `not-measured-separately` |
| `campaign.public-simple-op28` | `qualified-bounded` | `active` | `not-measured-separately` |
| `campaign.joint-channels-op28` | `qualified-bounded` | `active` | `official-qualified` |
| `learning.addressed-field-stock` | `qualified-bounded` | `supporting-active` | `not-measured-separately` |
| `learning.region-intervention` | `qualified-bounded` | `available-not-main` | `official-qualified` |
| `runtime.public-observation` | `qualified` | `supporting-active` | `covered-by-qualified-scopes` |
| `runtime.browser-campaign-host` | `qualified` | `active` | `covered-by-qualified-scopes` |
| `runtime.browser-agent-controller` | `qualified` | `active` | `not-measured-separately` |
| `runtime.worker-campaign` | `qualified` | `available-not-main` | `covered-by-qualified-scopes` |
| `runtime.product-dispatch-presentation` | `qualified` | `active` | `covered-by-qualified-scopes` |
| `qualification.native-abba-harness` | `qualified` | `benchmark-only` | `not-applicable` |

Les seules qualifications officielles de performance attachées à une capacité reconstruite sont :

- `learning.region-intervention`, preuve ABBA officielle Lot 9B ;
- `campaign.joint-channels-op28`, preuve ABBA officielle Lot 9C4.

Les autres statuts `covered-by-qualified-scopes` signifient que le composant a été traversé dans un périmètre qualifié. Ils ne constituent pas une mesure isolée de son coût.

Le noyau `runtime.campaign-checkpoint-core` conserve atomiquement la campagne commune, le `needId`, l’action en attente, la déduplication et l’état exact de FieldStock, avec rollback intégral. Il est maintenant raccordé au host produit et au contrôleur Agent : un host frais peut reprendre une frontière réglée, et un retour déjà physiquement envoyé peut être acquis avec le même `needId` sans rejouer l’action ni la présentation. Un checkpoint réglé devenu obsolète est refusé avant toute nouvelle décision.

La qualification correspondante est durable :

- `docs/recovery/op01-op31-browser-session-resume-20261113.md` ;
- `docs/recovery/op01-op31-browser-session-resume-qualified.json` ;
- run GitHub Actions `43431242149`, job `131904989533` ;
- **25/25** tests ciblés ;
- **396/396** régressions TypeScript ;
- build de production réussi.

La frontière reste bornée : le checkpoint du contrôleur est en mémoire, `dispose()` l’invalide, et aucun stockage IndexedDB/localStorage, `pagehide`, crash, nouveau processus ou cycle de réactivation Chrome persisté n’est encore qualifié.

## Gardes ouvertes

| Garde | État | Raison du blocage |
| --- | --- | --- |
| `historical-slot-schema` | `open` | Le schéma canonique des 76 emplacements V6 n'a pas été récupéré. |
| `site109-source-identity` | `open` | Le SHA/source exact de Site 109 reste non résolu. |
| `browser-checkpoint-persistence` | `open` | La reprise dans un host frais est qualifiée en TypeScript, mais aucun stockage durable, `pagehide`, crash, nouveau processus ou cycle Chrome réel n’est encore démontré. |
| `op31-objective-owner` | `open` | Aucun propriétaire d'objectif produit ne maintient, termine, suspend ou réoriente la suite. |
| `region-product-owner` | `open` | Region est qualifiée dans le runtime natif/Worker, mais pas comme propriétaire physique du contrôleur produit. |
| `full-product-composition-performance` | `open` | Les preuves Region et joint_channels qualifient leurs seams; elles ne mesurent pas la composition produit complète des quatre propriétaires. |
| `site-publication` | `blocked` | Aucune publication avant intégration canonique, qualification fraîche et liaison explicite GitHub ↔ Site. |

## Contrôle automatique

Le script `scripts/check-v6-entry-point-progress.mjs` vérifie :

- exactement OP01 à OP31, sans doublon ;
- les 16 capacités de cette reconstruction, y compris le checkpoint navigateur maintenant actif ;
- la cohérence des totaux dérivés ;
- l’existence de chaque source, test et preuve référencés ;
- l’absence de mapping historique inventé ;
- le maintien du compteur historique à `null` ;
- la limitation des opérations produit à OP18 et OP28 ;
- la limitation des qualifications officielles de performance à Region et `joint_channels` ;
- la fermeture du garde de réactivation TypeScript et le maintien du garde de persistance navigateur ;
- le blocage de la publication Site.

Le test `tests/v6-entry-point-progress.test.ts` rejette notamment un compteur gonflé, une identité OP dupliquée ou une preuve absente.

## Conséquence

Le projet peut désormais répondre précisément à deux questions différentes :

- **Qu’est-ce qui est présent et qualifié dans la reconstruction actuelle ?** Le registre machine fournit cette réponse.
- **Combien des 76 points d’entrée historiques sont restaurés ?** La réponse reste inconnue tant que la table historique des emplacements n’est pas retrouvée ou reconstruite avec une preuve indépendante.

## Étape suivante

La priorité fonctionnelle suivante est la persistance sûre du checkpoint déjà actif : politique d’expiration, liaison à l’identité du jeu et à la génération produit, capture à `pagehide`, puis vraie désactivation/réactivation dans Chrome contre Pyodide sans double action, double acquisition, double présentation ni perte de `needId`. Le coût de snapshot/restauration devra être mesuré séparément avant toute revendication de performance. En parallèle, toute preuve durable permettant de reconstruire l’identité des 76 emplacements pourra être ajoutée sans modifier rétroactivement les statuts actuels.

Aucune publication Site n’est incluse dans cette étape.
