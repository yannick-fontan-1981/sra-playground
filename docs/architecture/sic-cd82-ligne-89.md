# CD82, ligne 89 — composer les transformations locales d'une surface

## Critères préenregistrés

Référence `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Catalogue
`8ce7ee35`, CD82 N1/T1 ACTION1, `surface_program /`
`surface_rewrite / surface_rewrite_program`. Rejouer depuis N1,
graine 0 et plafond 16.

- Identifier la surface de référence, celle qui est écrite, les
  empreintes disponibles et ce que T1 établit sur sa commande. Suivre
  une écriture locale jusqu'à son retour et à l'étape qui réutilise
  le moyen appris. Distinguer l'hypothèse de transformation et la
  transformation réellement observée.
- Sur une vue publique comparable, retirer soit un modèle acquis, soit
  l'admissibilité d'une empreinte de surface. Décrire la première
  différence de plan ou le refus du ticket. Conserver la même commande
  lorsque le départ pertinent le permet, et mesurer son vrai retour.
- Rejouer une seconde configuration de la surface dans laquelle la
  même transformation ou composition a un autre domaine. Décrire
  les pixels visibles, la garde courante, le retour physique et la
  reprise. Garder les états construits distincts du catalogue.
- Relever le premier instant du rejeu et le verdict de chaque groupe.
  Attribuer au gel les décisions déjà présentes et limiter tout
  changement à un défaut causal reproduit.

## Trajectoire officielle

Le catalogue et le gel retrouvent les 16 commandes sous
`surface_program` et les 16 verdicts de retour. Le premier rejeu
du gel a commencé à 00:50:27 le 28 novembre UTC−3 et a rendu les
16 décisions après 27 s. Le moteur mesure la référence [3,3,12,12]
et la zone éditable [27,34,36,43]. Les deux boîtes et leurs rôles
sont réévalués avec la vue de chaque niveau.

| Tour | Surface et décision | Retour et reprise |
| --- | --- | --- |
| N1 T1 ACTION1 | 240 modèles de commandes à la pose 6, encre 15. Le dessin cible demande une écriture à la pose 2. | Aucune modification de la zone éditable. Le retour sans prédiction réduit les modèles à 96. |
| N1 T3–T9 | Les retours de pose et les contrôles compatibles ramènent l'essai vers la pose 2. Au T9, ACTION5 est choisie avec un seul modèle. | Le T9 donne le passage officiel en N2. Le moteur retient l'affectation des commandes. |
| N2 T10 ACTION5 | Nouvelle référence, pose 6 et encre 15. Le programme composé demande les écritures [6,15] puis [1,12]. Le modèle réutilisé donne le premier pas. | 50 pixels de la zone éditable changent, aucun du modèle fixe. Le pas est confirmé. |
| N2 T11–T15 | T11 clique la nuance en (46,4), puis les directions préparent la pose requise pour la deuxième écriture. | Le T15 ACTION5 mène au deuxième passage officiel. La première décision de N3 sert une autre nuance. |

`SurfaceProgram.start` relève `measureSurfaceLayout`, les
empreintes et les commandes disponibles. Il ne réutilise
l'affectation que pour le même domaine d'entrées. `options`
interroge `surfaceProgram` sur les pixels du travail et la
référence, puis prépare soit la pose, soit la nuance, soit
l'écriture. `record` réduit les affectations compatibles à
partir du retour et mémorise celles qui franchissent une limite
du jeu. `after` compare la pose, la nuance et la surface ou
signale le passage officiel.

## Contre-épreuves

À vue N2/T10 identique, retirer seulement l'affectation acquise
au premier niveau laisse les deux écritures visées. Le moteur
réouvre 240 modèles et choisit ACTION1 à la place d'ACTION5. Ce
vrai geste laisse la zone éditable intacte et le retour
`matched:null` conduit à ACTION2 avec 96 candidats. La commande
d'écriture est donc réutilisée avant que la nouvelle surface ne
montre son effet.

À ticket nominal identique, changer un seul pixel de la référence
courante fait refuser le pas par `SurfaceProgram.before`. Le
vrai paquet conserve la référence et autorise le premier pas.
Cette intervention éprouve la garde de portée. Le rejeu avec
mémoire retirée éprouve le choix lui-même.

Le gel contient la composition et son point de réemploi. Le lot
porte sur les deux surfaces effectivement résolues dans ce
préfixe et le début du niveau suivant.

## Reproduction

Node 24. `SIC_CD82_GAME_ROOT` indique le checkout des actifs officiels
et de Pyodide. `SIC_CD82_ENGINE_ROOT` permet de répéter les assertions
contre un autre moteur.

```powershell
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/sic-cd82-line-89.test.ts tests/sic-native-resolution.test.ts
```

[Test du service](../../tests/sic-cd82-line-89.test.ts) ·
[Transformation et garde](../../src/logos-engine/v6-surface-program.ts) ·
[Catalogue](sic-v8-strategies-observees.md#L115)
