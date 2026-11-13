# Lot 2C : diagnostic séparé des coûts communs

## Protocole déclaré avant la première exécution

Ce diagnostic localise le travail effectué par la version native 0.35.0, puis par une correction ciblée. Il ne remplace ni `measure-native-loop-costs.mjs`, ni `compare-native-loop-costs.mjs`, ni le budget officiel de +10 %. Ces deux scripts officiels restent inchangés.

Le cas est STCK, limité aux dix actions de la trace publique déclarée dans `docs/migration/lot2c-evidence/performance/stck-followup/cases.json`. La trace est vérifiée par son SHA-256. Une exécution comporte **une session froide, sans échauffement**, avec le véritable `V6AgentService` et le runtime commun. Le moteur recalcule chaque commande ; l'hôte ne lui fournit le retour public correspondant qu'après comparaison exacte de cette commande. Aucune implémentation de jeu, spécification, oracle, solution ou mémoire préparée n'entre dans l'agent.

La référence est le checkout isolé de la publication 63, commit `1193377f1d574451740a7409a4102833ef868310`, natif `0.35.0`, digest **`3cd17565b114a40ed71870bf8d7875a1b91102440b92d14a9258bfa98d4f7779`**. Le script et ce protocole sont copiés à l'identique dans ce checkout avant exécution. La correction emploiera les mêmes octets de script, de protocole, de déclarations et de trace, avec son propre digest natif gelé. Chaque reçu utilise un nom nouveau ; aucun résultat antérieur n'est écrasé.

## Mesures

Les observateurs chronomètrent les méthodes sans changer leurs arguments, résultats ou ordre d'acquisition :

- Runtime : `snapshot`, `authorize`, `advance`, `persistFamilies`, `restoreFamilies`, `plan`, `seal`, et `authorizationIdentity` lorsque cette lecture spécialisée existe.
- Service : `snapshot`, `accept`.
- Caller : `checkpointWrites`.
- Stockage : `commit`, `stateValue`.
- Chaque famille : `state`, `nativeState`, `restore`, `restoreNative`, lorsqu'elles existent.

Les échantillons gardent la requête, sa séquence, l'action et le propriétaire concernés. Les appels de stockage/caller créés pendant l'initialisation sont observés par leur prototype ; les méthodes de runtime, service et familles le sont sur leurs instances. Les wrappers retournent les résultats originaux et sont retirés après le replay.

**Les mesures sont imbriquées et non additives.** Un parent comprend son travail enfant et le coût des observateurs. Les totaux par méthode ne sont pas des temps exclusifs et ne doivent pas être additionnés. Une seule session ne produit ni percentile élevé, ni intervalle de confiance, ni validation du budget.

Les appels directs du service excluent le contrôleur `BrowserV6Agent`, le transport entre workers, Pause, le rendu navigateur et l'exécution du jeu. Leurs durées ne sont pas comparables directement aux métriques de requête/session du runner officiel. La création de runtime est mesurée séparément ; les imports sont effectués avant le replay.

## Conservation et contrôles

Le script vérifie les empreintes natives, son propre fichier, le protocole, le manifeste, les déclarations et la trace avant/après. La campagne s'arrête après dix actions acquises et conserve les compteurs de décision/niveau. Le snapshot final, les états de propriétaires, les identités du graphe et les empreintes de valeur par nœud sont collectés **après** le replay chronométré. Les calculs de taille JSON restent hors des intervalles mesurés.

La référence n'est exécutée qu'une fois dans ce protocole. Le reçu compressé est vérifié par décompression exacte, puis copié sans modification depuis le checkout isolé vers le dépôt de livraison. Une observation diagnostique permet de choisir et d'expliquer une correction ; la clôture du coût exige ensuite le protocole officiel inchangé, avec conservation de tous les essais précédents.

Commande de référence :

```sh
node scripts/profile-native-loop-costs.mjs docs/migration/lot2c-evidence/performance/stck-followup/cases.json STCK docs/migration/lot2c-cost-evidence/diagnostic/baseline.json.gz 3cd17565b114a40ed71870bf8d7875a1b91102440b92d14a9258bfa98d4f7779
```
