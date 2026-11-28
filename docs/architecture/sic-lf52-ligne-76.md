# LF52, ligne 76 — réduire trois éléments avec un appui

## Critères préenregistrés

Gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Catalogue
`8ce7ee35`, LF52 N1/T1 ACTION6, `reduction_transport /
supported_ternary_reduction`. Départ N1, graine 0 et plafond 16.

- Distinguer la sélection du premier pion, la mesure d'une
  réduction effective et la continuation jusqu'au passage
  officiel. Identifier le pion de départ, l'intermédiaire et
  l'arrivée, ainsi que l'appui nécessaire pour ce geste.
- À population et points disponibles comparables, conserver
  ou retirer l'appui d'arrivée dans la scène présentée au
  service. Vérifier le premier ticket qui diffère ou la raison
  du refus. Ne déduire aucun saut d'une simple sélection.
- Mesurer une autre réduction sur le vrai parcours. Distinguer
  l'appui fixe observé, un éventuel support mobile et la
  réutilisation de la règle de réduction.
- Séparer les paquets officiels, les modifications d'observation
  et tout changement éventuel du moteur. Préenregistrer la
  première divergence avant un correctif causal si nécessaire.

## Appui, sélection et réduction dans le jeu officiel

Le gel et le catalogue retrouvent les 16 décisions et retours.
Les huit premières commandes sont les huit occurrences de
`supported_ternary_reduction`. Les commandes suivantes
appartiennent à une autre famille. À N1, la géométrie mesurée
a un pas de six pixels et des cases de côté quatre. Le fond
de support fixe est de valeur 1. Aucun support mobile n'est
impliqué dans les quatre réductions de cette fenêtre.

| Tours | Triplet retenu | Retour officiel |
| --- | --- | --- |
| T1–T2 | Départ [2,3], intermédiaire [3,3], arrivée [4,3]. | La sélection ACTION6(18,19) garde cinq pions et confirme la sélection. ACTION6(29,19) réduit la population à quatre et laisse un pion en [4,3]. |
| T3–T4 | Départ [4,3], intermédiaire [5,3], arrivée [6,3]. | La prochaine sélection réutilise le pion arrivé. Le deuxième saut réduit la population à trois. |
| T5–T6 | [6,3] par [6,4] jusqu'en [6,5]. | La même règle vaut sur l'autre axe. Deux pions restent après le saut. |
| T7–T8 | [6,5] par [6,6] jusqu'en [6,7]. | Le retour du dernier saut est un passage officiel. Le reçu le distingue des comparaisons locales. |

`reductionLayout` et `reductionScan` identifient terrain et
pions. La recherche de `ReductionTransport.propose` ne retient
un saut que si l'arrivée a un appui et si l'intermédiaire et
l'arrivée satisfont les conditions de population.
`packageProposal` sépare la sélection et le saut.
`before` compare la population et le contexte du ticket et
`after` mesure le résultat physique. Un retour de sélection
confirmé conserve la population.

## Le même retour de sélection, avec ou sans preuve d'appui

Dans le retour officiel de T1, huit pixels de l'appui en [4,3]
restent visibles. Les huit autres forment le guide de sélection.
Le test construit une vue qui masque seulement les pixels
d'appui. Les pions, le guide au point (29,19) et ACTION6
restent disponibles. Les deux bras gardent le vrai retour de
sélection et cinq pions.

- Si l'appui fixe acquis au départ demeure en mémoire, le
  service lie un point courant dans la même case, (30,19).
  Le vrai jeu exécute le saut et la population passe à quatre.
- Dans la même vue, retirer le seul appui [4,3] de la mémoire
  retire le saut. Le service libère `observed_frontier`
  ACTION1, joué sans passage de niveau.

`mergeReductionScene` conserve les appuis fixes déjà mesurés
pour les vues suivantes. La disparition de pixels sous un
guide ne suffit donc pas à invalider cette mesure. L'intervention
isole la dépendance à l'appui, tandis que le vrai LF52 atteste
sa conservation. Le lot ne contient pas de disparition physique
d'un appui fixe dans un épisode officiel, ni d'attribution du
même contrat à un support mobile.

## Reproduction

Node 24. `SIC_LF52_GAME_ROOT` désigne les actifs et Pyodide.
`SIC_LF52_ENGINE_ROOT` permet de rejouer contre un autre SHA.

```powershell
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/sic-lf52-line-76.test.ts
node --experimental-strip-types --disable-warning=ExperimentalWarning --test '--test-name-pattern=finite source support mechanics|source dispatch guard|source physical outcome' tests/v6-reduction-transport-parity.test.ts
```

[Test du service](../../tests/sic-lf52-line-76.test.ts) ·
[Mesure, choix et garde](../../src/logos-engine/v6-reduction-transport.ts) ·
[Catalogue](sic-v8-strategies-observees.md#L102)
