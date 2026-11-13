# Diagnostic limité du coût de reconnaissance des panneaux

## Question et protocole déclaré

Le premier [comparatif de boucle du lot 3A](../performance/comparison.json) relève notamment une hausse de médiane `new_decision` d'environ 50,47 ms sur STCK et 65,55 ms sur SMLP, avec bruit non résolu. Le diagnostic présent vérifie seulement le travail ajouté par la reconnaissance des panneaux et son double appel dans `SharedSeriesConstraint.observedPropose`. Il ne remplace pas ce comparatif officiel et n'en attribue pas la totalité des écarts à un composant.

Le protocole a été annoncé avant exécution : un seul processus Node ; les trois rasters initiaux publics archivés STCK, SMLP et RSWP ; quatre tours de chauffe puis vingt et un tours mesurés ; ordre tournant des vues et des opérations. Les lignes sont copiées puis gelées avant mesure, comme les observations publiques du runtime. Les imports, lectures de fichiers et vérifications de sortie restent hors de l'intervalle chronométré. Le diagnostic n'appelle aucun host de jeu, aucune campagne et aucune action physique. Les sources natives sont identiques avant et après l'exécution.

Les trois opérations mesurées sont `measurePanelService(rows, [])`, `panelServiceInputCandidates(rows, available)` et leur séquence actuelle, qui reconnaît la même scène deux fois lorsque la mémoire de silhouettes est vide. Les identifiants STCK, SMLP et RSWP servent uniquement à sélectionner les rasters archivés déclarés ; aucune fonction native chronométrée ne reçoit ce libellé.

Le [reçu original](panel-measurement-cost.json) conserve le protocole, les 189 échantillons mesurés, les empreintes des rasters, les sorties stables et les hashes de source avant et après. Son SHA-256 est `241be0bf21a06cbc6d0dfe3ebb9ae321ac577100c15a7ccf6aa72e0f6c40ef55`.

## Résultats observés

Les trois vues font 64 × 64 pixels et exposent `ACTION5`, `ACTION6`, `ACTION7`. Chaque cellule temporelle ci-dessous est la médiane de 21 mesures dans le processus déclaré.

| Raster public | Admission de scène | Points produits | Reconnaissance seule | Candidats avec reconnaissance | Séquence à deux reconnaissances |
| --- | --- | ---: | ---: | ---: | ---: |
| STCK, `0aff2f0878f2054d` | Refus | 0 | 1,994 ms | 2,021 ms | 4,265 ms |
| SMLP, `63772d1746311d0c` | Refus | 0 | 1,960 ms | 1,986 ms | 4,606 ms |
| RSWP, `3e364c99f049645b` | 3 panneaux | 20 | 4,093 ms | 4,406 ms | 9,284 ms |

Le travail du double appel existe aussi quand aucune scène de panneaux n'est admise. Sur les deux rasters refusés de ce diagnostic, éviter une seule reconnaissance représente un ordre de grandeur d'environ 2 ms. Le gain d'une optimisation n'a pas été mesuré. Ces valeurs ne suffisent pas à expliquer les hausses globales de 50 à 65 ms : les périmètres sont différents, et les autres observations, répétitions de sélection, acquisitions et coûts du runtime ne sont pas profilés ici.

La vue admise coûte davantage parce que la fonction poursuit les correspondances de silhouettes, les services et la construction de la scène. Le calcul ne consulte aucun libellé de jeu. Les sorties et leurs empreintes sont identiques lors de toutes les répétitions. Aucune correction native n'est introduite à partir de ces seules mesures.

## Conservation et reproduction

Le script exécuté initialement dans scratch a été copié octet pour octet dans [scripts/diagnose-panel-measurement-cost.mjs](../../../../scripts/diagnose-panel-measurement-cost.mjs). Les deux copies ont le SHA-256 `960079e28e34361c7839bd07f7c3c6a3aac9c6387887a16d5dcb96b2fb52814f`. Le [reçu de relocation](panel-measurement-cost-relocation.json) conserve les deux chemins et confirme l'absence de nouvelle exécution. Le reçu original continue de nommer le chemin réellement exécuté ; il n'a pas été réécrit.

Une reproduction future utilise le même script et un checkout isolé contenant les sources et le corpus épinglés dans le reçu :

```bash
node scripts/diagnose-panel-measurement-cost.mjs /chemin/du/checkout-isole
```

Le chemin de sortie `docs/migration/lot3a-evidence/diagnostics/panel-measurement-cost.json` doit être libre dans ce checkout isolé. L'écriture exclusive du script protège un reçu antérieur contre l'écrasement. Cette commande n'a pas été relancée après la conservation du script ; le diagnostic reste une exécution unique.

## Piste future de cache, sans modification de production

Si une mesure ultérieure justifie cette optimisation, la donnée à mémoriser est la **mesure pure de scène**, y compris un résultat `null`. Le journal de `PanelServiceMemory`, la sélection des actions et les gardes restent leurs propriétaires actuels. Une première variante peut limiter ce cache à une seule décision, sans conservation après son terme. Un cache réutilisable devrait être borné par raster et laisser libérer les anciens rasters, par exemple avec une `WeakMap`.

La clé requise est le couple **identité du raster possédé et immuable, représentation exacte de la liste ordonnée des silhouettes**. L'identité du raster n'est recevable qu'après validation d'un arbre JSON numérique profondément immuable, ou dans le contrat interne du runtime qui clone et gèle cette observation. Un simple gel du tableau extérieur ne suffit pas. Une API recevant un raster mutable conserve le calcul ordinaire ; un cache ne doit pas accepter silencieusement sa réutilisation après mutation.

La partie silhouettes doit préserver l'ordre de la liste, l'ordre des points et les valeurs exactes. Une sérialisation canonique complète peut servir de clé ; un identifiant d'observation, le hash public raccourci, un numéro de révision ou l'identité d'une liste mutable ne suffisent pas seuls. La mesure sans silhouettes utilisée par `input_candidates` et celle avec silhouettes acquises utilisée par `propose` ont des clés différentes lorsque leurs arguments diffèrent. Elles ne doivent pas partager une scène positive par simple identité de raster.

Le résultat possédé par le cache doit rester immuable. Les appels publics renvoient une copie indépendante, afin qu'une modification d'une proposition ou d'une scène de test ne corrompe pas une mesure suivante. Les candidats finaux continuent à être reconstruits avec les actions disponibles et les candidats hérités courants ; ce diagnostic ne justifie pas de les mémoriser sous la seule clé de scène.

Une nouvelle identité de raster ou une nouvelle représentation de silhouettes oblige à recalculer. La fin de décision libère un cache local ; une restauration ne doit pas importer ce cache comme connaissance acquise. Les gardes continuent à examiner le raster actuel, la projection complète, les points et les métadonnées propres à chaque primitive. Une mesure mémorisée ne fournit aucune autorité d'exécution supplémentaire.

Avant toute adoption, les preuves devraient couvrir les rasters mutables et profondément gelés, les changements de silhouettes, leurs permutations et doublons, les résultats positifs et négatifs, la mutation d'une sortie exportée, ainsi que la parité de toutes les scènes, propositions, gardes et acquisitions existantes. **Ces conditions décrivent une piste future ; aucun cache ni test supplémentaire n'a été exécuté ou ajouté au moteur dans ce diagnostic.**
