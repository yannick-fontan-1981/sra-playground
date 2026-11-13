# V54 : régressions sur les retours publics archivés

Les **10 replays passent**, avec **170 contrôles de comparaison réussis sur 170**.
Ils couvrent 495 commandes, 505 paquets publics complets, 1 723 images dans ces
paquets, 344 préfixes acquis, 839 requêtes au common caller et 36 frontières de
niveau. Le paquet initial est inclus dans les nombres de paquets et d’images.

La source native comprend 210 fichiers et conserve le même digest avant et après
le lot :

```text
059d6204097fae6749138b9afc650ccc54867886bda3887ef6f978f6afdf393a
```

Le [résumé avec les reçus d’exécution](regression-summary.json) contient les
empreintes de la source, du comparateur, du replay, du harness, des baselines et
des traces. Il confirme leur stabilité pendant les exécutions.

| Jeu | Commandes | Paquets complets | Préfixes acquis | Niveaux terminés | État public final | Comparaison |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| STCK | 35 | 36 | 15 | 3 | `NOT_FINISHED` | [17/17](stck-comparison.json) |
| CATL | 48 | 49 | 48 | 6 | `WIN` | [17/17](catl-comparison.json) |
| SELE | 44 | 45 | 44 | 3 | `NOT_FINISHED` | [17/17](sele-comparison.json) |
| COLM | 45 | 46 | 21 | 3 | `NOT_FINISHED` | [17/17](colm-comparison.json) |
| ZIPP | 101 | 102 | 40 | 6 | `WIN` | [17/17](zipp-comparison.json) |
| GRIL | 19 | 20 | 19 | 3 | `NOT_FINISHED` | [17/17](gril-comparison.json) |
| LIFE | 49 | 50 | 47 | 3 | `NOT_FINISHED` | [17/17](life-comparison.json) |
| VALV | 28 | 29 | 28 | 3 | `NOT_FINISHED` | [17/17](valv-comparison.json) |
| GARE | 53 | 54 | 53 | 3 | `NOT_FINISHED` | [17/17](gare-comparison.json) |
| CN04 | 73 | 74 | 29 | 3 | `NOT_FINISHED` | [17/17](cn04-comparison.json) |

## Exécution

Chaque jeu démarre avec une session native froide et conserve cette session entre
les niveaux. Le script existant `scripts/replay-v53-public-regression.mjs`
recalcule chaque commande avant que son hôte fournisse le retour public archivé
correspondant. Les commandes attendues restent dans cet hôte : aucun état appris,
plan ou résultat attendu n’est injecté dans le moteur de décision.

Les neuf premières baselines sont les rapports v53 `attempt7` effectivement
réussis. CN04 utilise la campagne réelle v53 `attempt7`, avec ses 73 actions et sa
trace publique complète. Les anciennes comparaisons v53, y compris leurs échecs
initiaux puis leurs qualifications LIFE/GARE, restent inchangées.

Le lot utilise au maximum deux replays simultanés. Il conserve pour chaque jeu le
rapport complet `*-replay.json.gz`, la sortie `*-output.log.gz`, le reçu
`*-execution.json` et la comparaison `*-comparison.json`. Aucune exécution de jeu
n’a lieu dans cet hôte de replay ; ce lot ne constitue donc pas dix nouvelles
réussites en jeu réel ni une mesure comparative de vitesse.

## Périmètre de la comparaison

Les 17 contrôles comparent les commandes, les hashes SHA-256 de tous les paquets
publics complets, les nombres d’images et les frontières primitives, puis les
familles, groupes, types de proposition et sous-questions sélectionnés. Ils
vérifient aussi les entrées et gardes de coordination conservées, les longueurs
des préfixes acquis, les ancres d’époque, les nombres d’événements des couches
source, les compteurs du common caller, les frontières naturelles des niveaux et
le résultat public final. Les listes exactes de champs figurent dans chaque
comparaison.

Seul le préfixe de la nouvelle session d’observation est normalisé dans ces
projections. Les durées, le nom de l’implémentation et les indications de statut
de migration sont exclus. Les payloads complets des fournisseurs, leurs identités
dérivées, les chaînes et révisions du graphe, ainsi que la parité du caller V6
original complet ne font pas partie de cette assertion.

Les identités de recettes Typed Material de LIFE et les payloads FieldService
déjà non vides de GARE restent présents dans les rapports complets. Ce comparateur
n’affirme ni leur égalité intégrale ni leur vacuité. Il n’utilise donc pas les
anciennes prémisses de comparaison inapplicables à ces deux jeux.

Les 344 préfixes retiennent chacun `reactiveAcquisition`, les treize champs de
l’état source ReactiveContact et le même nombre de transitions que le préfixe
acquis. Cette nouvelle couche est conservée comme preuve distincte. Son égalité
avec une couche absente de v53 n’est pas affirmée par ces régressions.
