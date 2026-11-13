# Diagnostic de l'observateur : résultat et correction bornée

## Résultat mesuré

Le [protocole](observer-protocol.md) a été exécuté une seule fois, avant modification de production. Le [reçu exact](observer-attempt-01.json.gz) passe toutes ses comparaisons. Fenêtre du 9 novembre 2026 : **18:11:36.640 à 18:11:41.208, UTC−3**, soit **4 567,011 ms** ; les timestamps originaux UTC sont conservés dans le reçu.

Les paquets publics reçus après les actions STCK 5 à 8 contiennent 198 à 208 composants. Chaque description de signature était parcourue par le canonicaliseur générique, bien que ses quatre clés et ses valeurs numériques soient construites par l'observateur. Le candidat local au diagnostic sérialise ces seuls champs dans leur ordre canonique exact, puis appelle le même SHA-256.

| Paquet public | Composants | Texte générique, médiane | Texte fermé, médiane | Observation complète V63, médiane | Observation candidate, médiane | Variation complète |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Après action 5 | 198 | 8,211 ms | 0,190 ms | 14,656 ms | 5,660 ms | −61,38 % |
| Après action 6 | 202 | 8,231 ms | 0,222 ms | 14,778 ms | 5,637 ms | −61,85 % |
| Après action 7 | 207 | 7,491 ms | 0,164 ms | 14,289 ms | 5,379 ms | −62,35 % |
| Après action 8 | 208 | 7,686 ms | 0,166 ms | 13,952 ms | 5,099 ms | −63,46 % |

Le reçu conserve **560 appels mesurés**, vingt tours par méthode et par paquet, après trois tours d'échauffement. L'ordre est inversé un tour sur deux. Les signatures isolées utilisent les composants déjà calculés ; les deux observations complètes recalculent toute la géométrie. Ces mesures de composants chauds ne s'additionnent pas et ne constituent ni une mesure du service complet ni une validation de son budget.

## Égalités et refus

Les **quatre paquets publics et quatre cas de référence source** conservent exactement les octets de description, les signatures SHA-256 et l'ensemble de l'observation. Les cas source conservent leurs sorties attendues, y compris les identités, ambiguïtés et masques. Chaque tour mesuré compare également les sorties après les intervalles chronométrés.

Les rejets de palette **−0, 256, NaN** et de raster irrégulier conservent le même type d'erreur et le même message. Le garde de scalaire portable reste nécessaire : `validateRows` admet le zéro négatif JavaScript, tandis que la signature canonique historique le refuse.

Le script, le protocole, le fichier observateur V63 et les autres entrées gardent leurs empreintes pendant la mesure. Le script exige explicitement le fichier observateur du commit V63 avant exécution ; une reproduction du diagnostic antérieur doit donc utiliser ce checkout avec les mêmes fichiers de diagnostic. Le résultat est conservé sans réécriture après la modification de production.

| Artefact de diagnostic | SHA-256 |
| --- | --- |
| `scripts/profile-native-observer-costs.mjs` | `59b4697263a58c959aa9fba896174e0dea237bf0996801dc827015538406d8e6` |
| `observer-attempt-01.json.gz` | `ed358100e04d7ca9e1d2fad1e0cf3298d0f2efcab9f6833a88bf9f200e92eb89` |
| Observateur V63 mesuré | `5ccedcf3126832036bcb639978db5b6b888936141befa2fa6b6f9b79d701ec19` |

## Correction de production appliquée après le diagnostic

`measureNativeObservation` appelle maintenant le helper privé `measuredComponentSignature` pour les composants qu'il vient de construire. Les clés ASCII suivent l'ordre `area`, `normalized_mask`, `palette_value`, `scale`. Aire, échelle et coordonnées normalisées sont des entiers issus de la géométrie validée. `assertPortableNumber` conserve le refus de palette −0 et des scalaires non portables, y compris si un getter de matrice change après la première validation.

**`v6Canonical`, `v6Digest`, `validateRows`, l'extraction des composants, les signatures produites et les observations publiques gardent leurs contrats.** Aucun identifiant de jeu ni état de jeu privé n'entre dans le helper.

Les tests de l'observateur passent **12/12**, dont **six nouveaux tests**, en 1,050 s. Ils comparent la signature privée au digest générique existant sur palettes extrêmes, nombreuses composantes, blocs répétés à différentes échelles, masques irréguliers et raster unidimensionnel maximal de 65 536 pixels. Les refus de palette, révision et getter modifié sont également couverts. Le typecheck et `git diff --check` passent. Ces résultats locaux précèdent la validation formelle de livraison.

| Fichier modifié | SHA-256 après correction |
| --- | --- |
| `src/logos-engine/v6-native-observer.ts` | `3e3ac9beb47d008af9d330a8497051bd1a91c59e93650d0a59aa9a47b5483e63` |
| `tests/v6-native-observer.test.ts` | `7f153e7e8ead635ac7e0bfb050f6dc58ca3f96cfa51a89216eb6bb133158e528` |

Ce diagnostic établit un travail redondant et le gain de sa suppression sur les observations choisies. Il ne prouve pas que ce mécanisme, déjà présent avant 2C, explique à lui seul la différence historique V62/V63. Le profil du service et les mesures de budget communes après correction restent des preuves distinctes.
