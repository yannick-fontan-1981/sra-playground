# ZIPP, lignes 67 et 71 — trace et contour

## Critères préenregistrés

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Reprendre ZIPP
depuis N1 avec la même configuration que la ligne 1, session conservée
après le changement de niveau, plafond historique de 16 gestes.

| Ligne | Témoin | Preuve et variation |
|---|---|---|
| 67 | N1/T1 ACTION6, `public_occurrence_recall / trace_field_composition / trace_field_experiment` | Retrouver la géométrie du champ, la trace courante, le point lié et la mesure de l'extension. Vérifier que deux extensions observées dans des contextes distincts changent la forme du préfixe autorisé. Contraster la même commande avec une trace ou une liaison de point différente. Distinguer le retour local du gain officiel. |
| 71 | N2/T14 ACTION5, `public_outline_service / observed_outline_service` | Retrouver le contour, le sujet et le type d'accès réellement offert. Identifier les transitions antérieures consommées, le retour et le premier besoin suivant. Éprouver la même commande avec un contour ou un historique pertinent modifié. Garder séparés les effets terminal et local. |

Contrôler au passage si la première famille transmet réellement une
preuve à la seconde, et si l'offre de T15 conserve son propriétaire.
Le témoin de T15 reste attribué à la ligne 1. Décrire les recaptures
et le second contexte propre à chaque numéro. Le code du gel reste
la référence pour le choix et les retours avant tout changement.

## Ligne 67 — relier une extension de trace à son champ

À N1/T1, `public_occurrence_recall` sélectionne la sous-question
`trace_field_composition`, qui appelle `TraceFieldMemory.proposeTrace`.
`measureTraceField` décrit un champ 3×3 de pas 16 dans
(8,4)–(56,52), une tête en cellule (0,0) et un récepteur hypothétique
en (2,2). `constructTraceField` trouve une couverture conditionnelle
sans revisite. Cette couverture prépare le prochain point, sans
attester de rôle terminal.

| Ticket | Liaison et acquisition | Suite |
|---|---|---|
| T1, ACTION6 (32,12) | La commande est le centre de la cellule (1,0), lié à la tête et à l'observation courantes. Le retour déplace l'anneau de (0,0) à (1,0), sans autre changement dans le champ hors de la zone d'extension. Le producteur remesure la trace ordonnée. | Reçu local `observed_trace_extension`. À T2, la trace mesurée vaut 12 et la tête relocalisée ouvre un essai depuis un autre bord. |
| T2, ACTION6 (48,12) | Extension réelle de (1,0) à (2,0), avec son propre couple de références. | Deux arêtes orientées distinctes sans contre-exemple suffisent pour proposer un préfixe conditionnel. |
| T3–T8 | T3 lie le premier coude vers (2,1) au même champ et prépare six gestes. Chaque clic reste lié au point et à la tête retrouvée. | Sept retours locaux sont conformes avant la frontière. À T8, le jeu marque N1. Le reçu local porte `matched:null` à la frontière. Le premier ticket de N2 est `containment` ACTION1. |

Dans la contre-épreuve construite, le jeu exécute toujours T2 et la
trace visible au moment de T3 est identique. Seule la contribution
du reçu de T2 à l'ensemble des arêtes acquises est retirée. T3 garde
ACTION6 (48,28) mais autorise un seul pas. Son retour est mesuré, puis
T4 ouvre un nouveau préfixe de cinq gestes lié à la nouvelle
observation. Une trace visible suffit à formuler la question. Deux
extensions acquises justifient de libérer un préfixe plus long.
`localTraceEffect` mesure la relocalisation de la tête et la
localité dans le champ. Un effet hors du champ reste de rôle inconnu.
[Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L107)
· [Catalogue](sic-v8-strategies-observees.md?plain=1#L93)
· [Appel commun](../../src/logos-engine/v6-shared-series.ts?plain=1#L955)
· [Mesure et acquisition](../../src/logos-engine/v6-trace-field-access.ts?plain=1#L42)

## Ligne 71 — qualifier l'accès à partir du contour courant

`OutlineService.recordSource` reçoit les déplacements directionnels
observés dans les retours du niveau courant, y compris quand
`containment` est propriétaire des tickets. Le contour est relié à
une identité unique par sa signature, des déplacements axiaux et
un contraste intérieur. Avant T14, les références de cette mesure
portent sur les révisions 9 à 13 en époque 2. La première désigne
le plateau d'entrée de N2, qui sert d'avant-image à la première mesure.

À T14, l'outline courant de valeur 0 a une boîte 7×7 en
(11,43)–(17,49). `OutlineService.measure` établit que le contour est
déjà au locus compatible exact. `proposeSource` choisit
`local_operator_hypothesis` et soumet `ACTION5` sous
`observed_outline_service`. Le témoin porte donc sur l'admission
d'un essai au locus, sans segment de déplacement prévu. La garde
vérifie le contour et la commande scellée. Dans le contrôle isolé,
changer le périmètre du même contour fait refuser le même ACTION5.
Retirer le fait de correspondance exacte de l'entrée de la politique
fait aussi disparaître l'offre d'opérateur local.

T13 et T14 utilisent la même commande sur deux questions distinctes.
Le vrai T13 est un essai de `containment` et change le raster. Le vrai
T14 garde le raster entier identique. Le reçu du propriétaire
`no_visible_local_change` porte zéro pixel local et la référence
de retour de l'époque 2. Le résultat de comparaison du ticket reste
`matched:null`. Le retour n'atteste ni ouverture ni accès franchi.
T15 reprend dans `acquire_control_for_target` avec ACTION2. Ce ticket
appartient à la ligne 1.

Les contrats de `v6-outline-kernel.test.ts` apportent une seconde
configuration construite sur le vrai noyau. Deux transitions acquises
y rendent l'offre admissible et le même propriétaire enregistre
un retour inchangé. ZIPP apporte une occurrence du catalogue sur
onze pour ce numéro. La comparaison avec T13 sert à distinguer les
effets physiques et les propriétaires dans le contexte officiel.
[Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L111)
· [Catalogue](sic-v8-strategies-observees.md?plain=1#L97)
· [Proposition et mesure](../../src/logos-engine/v6-outline-service.ts?plain=1#L141)
· [Garde](../../src/logos-engine/v6-outline-service.ts?plain=1#L597)
· [Acquisition](../../src/logos-engine/v6-outline-service.ts?plain=1#L632)
· [Contrat du noyau](../../tests/v6-outline-kernel.test.ts?plain=1#L161)

## Contrôle de transmission entre familles

Une variante construit la même partie officielle, avec les mêmes huit
clics, le même changement de niveau et les mêmes gestes de N2. Elle
retire seulement l'événement de trace qui aurait enregistré la
frontière de T8 dans le producteur de la ligne 67. T14 retient
le même contour et le même essai local, puis T15 conserve son
propriétaire. Le mécanisme de reprise de trace peut consulter un
événement de frontière propre à la trace. Le ticket de contour dans
ce témoin dépend des déplacements et de la géométrie remesurés en N2.
[Reprise de trace](../../src/logos-engine/v6-acquired-continuation.ts?plain=1#L84)
· [Ligne 1](https://github.com/yannick-fontan-1981/sra-playground/blob/16f3c5e8d300903e475400fb9b67a513f2834663/docs/architecture/sic-zipp-ligne-1.md)

## Reproduction

Avec Node 24 et les actifs du jeu préparés sous `public/` :

```powershell
node --test tests/sic-zipp-lines-67-71.test.ts
node --test tests/v6-trace-field-support.test.ts tests/v6-trace-field-kernel.test.ts tests/v6-outline-access.test.ts tests/v6-outline-kernel.test.ts tests/v6-outline-public-context.test.ts
```

`SIC_ZIPP_67_71_GAME_ROOT` désigne au besoin le checkout des actifs.
`SIC_ZIPP_67_71_ENGINE_ROOT` permet d'utiliser le moteur d'un checkout
du gel. Les tests de caractérisation utilisent le jeu officiel.
Le préfixe part du même N1 que le dossier de la ligne 1, avec plafond
de 16 gestes, puis compare le jeu du gel et `8ce7ee35`. Seize
commandes, propriétaires, types, sous-questions et retours concordent.
La métadonnée `palette` diffère entre les révisions.

La portée directe est de **8/8 occurrences pour 67** et **1/11 pour 71**.
La branche ajoute le dossier et les assertions. Les qualifications
indépendantes des deux lignes restent ouvertes.

Les quatre tests de caractérisation passent sur le jeu officiel et les
cinq suites de contrats totalisent **519/519**. Branche ouverte à
23:16:34, critères à 23:17:15, premier préfixe du gel à 23:17:31 et
première série complète verte à 23:21:53 (UTC−3).
