# Deuxième candidat SIC · mesure d’un déplacement axial

## Révisions pour le Banc

**A** est le premier candidat, `3c2d6bcfd4a7d7abf28650e2f8ffed3d3510c3b4`, qui porte la campagne des 107. **B** est son enfant direct sur `refactor/sic-deplacement-axial-un-pas`, le commit qui introduit cette fiche. Cette commande PowerShell imprime les deux SHA complets, même si d’autres commits sont ensuite ajoutés à la branche.

```powershell
$candidat = git log -1 --format=%H --diff-filter=A origin/refactor/sic-deplacement-axial-un-pas -- docs/architecture/sic-candidat-deplacement-axial.md
git show -s --format="B %H%nA %P" $candidat
git diff "$candidat^" $candidat -- src/sic
```

Les trois fichiers de production du diff sont [observed-translation.ts](../../src/sic/observed-translation.ts), [replay-access.ts](../../src/sic/replay-access.ts) et [reception-access.ts](../../src/sic/reception-access.ts). Les assertions de la [cartographie `e79b828d`](https://github.com/yannick-fontan-1981/sra-playground/blob/e79b828d66c7c22e244c3be19d2d19a9bd52ac76/docs/architecture/sic-navigation-preuve-deplacement.md) et sa fixture G50T sont reprises comme matériel de test. Le gel `d0e7527c` précède également le premier découpage P05. Prendre A comme référence isole l’effet de ce deuxième changement.

## Contrat extrait

`singleStepDisplacement(from, to, stepSize)` reçoit deux positions écran (x, y) déjà attribuées au porteur par la famille. La famille fournit le pas de sa scène. La fonction rend le déplacement signé de l’origine à l’arrivée si un seul axe change d’exactement un pas. Dans tous les autres cas, elle rend `null`. L’utilitaire existant `motionIntoFootprint` filtre les translations d’un reçu par leur emprise et leur concordance. Il répond à une autre question, en amont de cette mesure.

| Appel dans `record` | Ce que la famille garde |
|---|---|
| G50T · `createSicVerifyRemoteReplay` | `actorPosition` retrouve l’unique signature attendue. La famille fournit `scene.body.quantum` et inscrit la mesure dans `controls` avec sa référence dans `controlEvidence`. Elle peut conserver dans `samples` un mouvement trop long pour enseigner un contrôle. Le chemin et la décision P07 restent locaux. |
| FOGW · `createSicReceptionAccess` | `carrier` retrouve une ancre unique par le motif des quatre coins. La famille fournit `local.scene.pitch`, conserve le vecteur dans `controls` et la référence dans l’historique des retours. Les essais, la réception officielle, le transfert et la sélection du pas restent locaux. |

Le test géométrique couvre gauche, droite, haut et bas aux deux pas observés (4 et 6), ainsi que l’immobilité, un pas court, un double pas et une diagonale dont la distance de Manhattan égale le pas. Dans les contre-épreuves construites à partir des images réelles, les deux familles écartent le double pas. G50T perd son sujet après recoloration, alors que FOGW accepte toujours l’unique porteur aux quatre coins recolorés. [Test du calcul](../../tests/sic-single-step-displacement.test.ts) · [Caractérisation des appelants](../../tests/sic-control-to-access.test.ts)

## Entrées comparées et verdict local

A et B ont reçu les mêmes observations publiques à partir du L1, via `V6AgentService` et le pack SIC complet. Le test des deux préfixes fixe la cible à un niveau, le plafond à 80 commandes et le temps d’exécution déclaré à 1 ms par retour. Il reprend la session à chaque frontière rencontrée. Les deux préfixes ont produit les mêmes commandes et données, familles, stratégies, révisions et index de pas, références d’observation, liaisons, pas prévus, références de route, motifs de garde et retours disponibles jusqu’au dernier ticket délivré.

| Entrée locale | Préfixe de tickets identique sur A et B | Transition observée |
|---|---|---|
| [FOGW](../diagnostics/sic-reception-transfer-20261127/fogw-arrival-boundary-a10dde47.json.gz) · quatre premières entrées de `publicEvidence`, images et animations `publicBefore`, palette publique | `1/P05, 2/P05, 4/P05, 4/P07` | Tour 3, (30, 42) → (34, 42), vecteur [4, 0]. Tour 4, pas proposé vers (38, 42). |
| [G50T](../../tests/fixtures/sic-replay-control-g50t-l1.json.gz) · six images finales publiques, de l’initialisation au retour du tour 5, chacune dans un paquet d’une image | `1/P05, 2/P05, 1/P05, 3/P05, 4/P05, 4/P07` | Tour 5, (14, 8) → (20, 8), vecteur [6, 0]. Tour 6, pas proposé vers (26, 8). |

Les chiffres de la colonne centrale sont les identifiants `ACTION`. SHA-256 des fixtures compressées : `f25353d0662d36a81ac5038990855a0b31603be4c2ad5ffaf5dd8a9e004bc179` pour FOGW et `a3d1378f949e4f677ce02fc788dd80cdf29ecc61aac49882920ed84c962fbbe5` pour G50T. Sur un checkout jetable de A, copier depuis B uniquement `tests/sic-control-to-access.test.ts` et la fixture G50T permet de rejouer à l’identique les cinq tests comportementaux. La fixture FOGW est déjà présente sur A.

**Vérification de B.** Avec Node 24.22.3 et TypeScript 5.9.3, `npm run typecheck` réussit et les 48 tests suivants passent depuis la racine du dépôt.

```sh
npm run typecheck
node --test tests/sic-single-step-displacement.test.ts tests/sic-control-to-access.test.ts tests/sic-reception-control-transfer.test.ts tests/sic-reception-sequence.test.ts tests/sic-directional-reception-transfer.test.ts tests/sic-recorded-pulse.test.ts tests/sic-continuity-contract.test.mjs tests/sic-continuity-evidence.test.mjs tests/sic-verified-walking-series.test.ts
```

## Critères du futur A/B natif

1. Figer A et B aux SHA ci-dessus. Pour chaque jeu, partir du L1 dans une session neuve, en mode `sic`, cible `auto`, avec un seul worker. Utiliser les mêmes versions du moteur de jeu, entrées de catalogue, graine, UUID de session, plafonds et références de rejeu pour les deux captures. Conserver les reçus dans un dossier distinct de la campagne des 107. [Protocole du banc](https://github.com/yannick-fontan-1981/sra-playground/blob/afa15e45d1a87a80868901890347e1e16b6e4b92/docs/diagnostics/sic-comparaison-decisions.md)
2. Comparer les événements dans l’ordre avec le comparateur du banc, y compris les observations et animations réelles, tickets, pas des préfixes, commandes et données, gardes, acquisitions et clôtures. Inspecter en particulier les tours 3–4 de FOGW et 5–6 de G50T. Conserver le premier événement et le chemin du champ en cas d’écart.
3. Pour qualifier le parcours complet, exiger l’égalité des traces, des commandes par niveau, des empreintes de trajectoire et du motif d’arrêt sur les deux révisions, ainsi que l’atteinte de la cible officielle (FOGW 6 niveaux, G50T 7). Un arrêt sur plafond doit figurer dans le verdict. Le présent reçu couvre les préfixes sur fixtures et les contrats locaux. La qualification chronométrée de B reste à établir.
