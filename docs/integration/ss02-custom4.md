# SS02 — La force rouge dans Custom 4

SS02 est le deuxième jeu de Custom 4, après SS01. Son moteur, sa palette et les huit cartes importées sont ceux du [laboratoire 0.4.0](../../experiments/sinking-star-ss02/README.md), livré par la PR [#93](https://github.com/yannick-fontan-1981/sra-playground/pull/93). L’ordre et les positions des cartes sont ceux de la campagne HTML, avec le tutoriel au niveau 1. La [provenance des cartes](../../experiments/sinking-star-ss02/docs/provenance.md) est documentée dans le laboratoire.

## Runtime et commandes

Le worker charge à la demande un backend autour de `PushPuzzleSession`. L’observation transmet les pixels, les durées et les métadonnées publiques du runtime. Le tutoriel manuel utilise les mêmes indices visuels que le laboratoire. Ses explications sont ouvertes au niveau 1. Les solveurs et les parcours témoins restent dans les outils de validation.

Les flèches servent à marcher et à pousser une file. Chaque poussée rend le déplacement à 1, 2 puis 3 pixels en conservant les délais du moteur. Une présentation en cours bloque les directions. Undo, Reset, Restart et le sélecteur de niveau peuvent l’interrompre. La galerie génère ses seize tuiles initiales à partir des deux moteurs natifs.

## Validations

| Contrôle | Résultat |
|---|---|
| Laboratoire TypeScript | 61 tests moteur et animation, 9 contrôles DOM, 8 parcours et 536 directions |
| `tests/custom4-native.test.ts` | 11 tests, dont parité SS02 sur les 536 retours, état de victoire, transitions, commandes permises et basculements vers le runtime historique |
| Build du Playground | TypeScript et Vite réussis, 102 jeux et 652 aperçus |
| SS02 dans Edge Chromium | Campagne complète de 536 directions, trois images de poussée observées sur le Canvas, quatre interruptions sans image tardive, vérification au format mobile 390 px |
| Galerie | Les 16 tuiles de Custom 4 sont identiques pixel par pixel aux états initiaux des moteurs. Le lien de SS02 ouvre directement le niveau choisi |
| Régression dans Edge Chromium | SS01 termine ses 8 niveaux en 369 commandes. CASC et LS20 se chargent et répondent à une direction. Les chargements de SS01 et SS02 n’ont déclenché aucune requête Python |

## Performance

Chaque fenêtre utilise le runner `scripts/measure-native-loop-costs.mjs` dans l’ordre A1/B1/B2/A2, avec 32 sessions mesurées, 400 commandes et 8 chauffes séparées. La référence A est le SHA de Site 123, `7bb9f15298c4e7d93a5c55f6f71ffa2fbe6acdaa`. Le protocole mesure séparément la médiane des sessions complètes de STCK et de SMLP sur leurs traces publiques. Le budget est strictement inférieur à +10 % pour chaque jeu.

| Candidat | STCK | SMLP |
|---|---:|---:|
| Raccordement SS02 `2787e0415d8e8d822e8c2cb067e45d4a949a87a6` | +5,32 % | +2,11 % |
| Candidat combiné `715f438eb20522f891ec3c87c4fb5f5597139373`, affinité libre | −3,98 % | +14,56 % |
| Même candidat combiné, affinité fixée | −0,99 % | −1,91 % |

Le candidat combiné `715f438eb20522f891ec3c87c4fb5f5597139373` contient aussi le commit `2801751b5824f162c318e30e94cfe28d43b4d225` du lot SIC arrivé sur `main` pendant la qualification. Les tests ciblés, le build et le contrôle navigateur ont été rejoués sur ce candidat.

Le laboratoire SS03 arrivé ensuite via `9b5513249ff56ec90e9093a80f40d5f0b3e43fd7` est conservé. Le build et les contrôles du Playground ont aussi été rejoués après l’arrivée du commit SIC `7883ab35eb34ee7e4109196470d5437d0a4a04f3` sur `main`.

La fenêtre du candidat combiné à affinité libre dépasse le seuil sur SMLP. Ses deux séries SMLP sur le même binaire ont des médianes de 18 096 ms et 20 897 ms, soit 15,5 % d’écart. La reprise conserve les quatre séries de chaque fenêtre et fixe la même affinité aux processeurs logiques 12 et 14 pour A et B. Les deux jeux satisfont le seuil lors de cette reprise.

Sur la dernière base, une comparaison appariée mesure l’effet propre de SS02 entre `7883ab35eb34ee7e4109196470d5437d0a4a04f3` et `e28de7855f256b2ccabd75a2b61f587c264c5fe6`. Le code SIC et Logos est identique entre les deux. Le même runner et la même affinité couvrent 12 sessions mesurées, 150 commandes et 4 chauffes. Les commandes et les retours de référence concordent dans toutes les sessions.

| Jeu | Médiane de `main` | Médiane avec SS02 | Variation |
|---|---:|---:|---:|
| STCK | 9 820,92 ms | 9 826,03 ms | +0,05 % |
| SMLP | 15 285,98 ms | 15 624,30 ms | +2,21 % |
