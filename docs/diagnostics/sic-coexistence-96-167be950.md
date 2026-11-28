# Coexistence de 96 lignes SIC sur 167be950

**96 lignes distinctes, dont 64 qualifiées au gel et 32 sur branches.** Le lot commun SYME/78, RECR/70 et CRAF/73 a franchi le seuil de 95. Les neuf ajouts depuis le jalon 87 sont **17, 70, 73, 74, 76, 78, 79, 85 et 95**. Leurs deux verdicts individuels et les 96 numéros figurent dans le manifeste. [Périmètre figé](sic-coexistence-96-167be950/perimetre.json)

## Moteur et entrées

Le banc a rejoué les neuf témoins sur `167be950334988ffbc46a04bc26de60c74fea527`, le SHA exact testé pour les 87. Les preuves individuelles des neuf lignes ont chacune l'arbre `src` du gel. L'arbre moteur commun demeure `8eb1d3d453c29d0254a7a22183bf9b1fa0886f45`. Le commit de la campagne ne diffère de ce moteur que par le workflow. Le catalogue, les jeux, les scripts exécutés et les paramètres sont ainsi ceux déjà audités au jalon 87. [Assemblage 87 et première campagne](sic-coexistence-167be950.md)

## Neuf témoins supplémentaires

Les **41 préfixes** de référence concordent avec les reçus individuels. Le retour physique supplémentaire de HOLE au T8 concorde également, reçu complet à l'appui. [Index des rejeux et empreintes](sic-coexistence-96-167be950/index.json)

| Ligne | Contrôle effectué sur 167be950 |
|---|---|
| DAME · 17 | Le T1 sélectionne et enregistre deux invitations. Le T2 fait passer la population de cinq à quatre. Remettre le seul intermédiaire bloque l'acquisition. La relation de même rang est réutilisée en N2. |
| RECR · 70 | La permutation des sujets invalide le suffixe et change le premier duel simulé à commande identique. Les survivants prévus passent de un à trois. Le plateau officiel joué atteste ses propres retours, dont le survivant observé en N2/T7. |
| CRAF · 73 | Le T5 convertit réellement les charges `[11,9]` en `[14]`. Présenter l'autre produit retire l'acquisition à même paquet physique. Le même clic T6 change de justification et la décision en N2 conserve cette différence. |
| HOLE · 74 | Un pixel dans la vue présentée change le clic T8 de `(20,32)` à `(43,11)` après le même T6–T7. Le ticket alternatif joué sur le plateau officiel fermé recolore 92 pixels. La vue présentée en expose 91 et le retour est scellé avec `matched:null`, score inchangé. |
| LF52 · 76 | Huit pixels sont masqués après sélection. Le seul appui mémorisé autorise le saut réellement joué. Son retrait à même vue donne `ACTION1`. |
| SYME · 78 | Le miroir compte 27 paires égales et neuf contrastes. La valeur prévue change à même clic dans la variante. Deux interprétations de périodicité donnent des réparations disjointes dans les grilles de contrôle. |
| TRIA · 79 | Déplacer un sujet à apparence locale identique change le sujet choisi au T3. Son déplacement propre est observé au T4. |
| SB26 · 85 | Échanger les bordures à inventaire fixe change la source, et leur ordre d'énumération laisse le choix invariant. Le rejeu nominal dépose 9. Le verdict opérateur joue le T4 alternatif au même clic et dépose 14. |
| TR87 · 95 | Le retrait de la liaison des cinq glyphes conserve `ACTION1` et le retour physique, avec une autre famille. Sept éditions et projections sont confirmées de T10 à T16, sans score dans la fenêtre. |

## Campagne rattachée

Le run **46106829666** est réaudité sur ses 107 reçus d'origine. Il couvre **107/107 jeux, 692 niveaux et 18 560 commandes**, sans écart au grain des reçus du gel. Il n'a été exécuté qu'une fois pour ce moteur. La reprise déjà éprouvée importe 3 puis 104 reçus et réutilise ensuite les 107. [Run d'origine](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46106829666) · [Verdict par jeu](sic-coexistence-167be950/qualification.json)

```powershell
py -3.11 scripts/check-sic-coexistence.py docs/diagnostics/sic-coexistence-167be950/recus.zip --candidate 167be950334988ffbc46a04bc26de60c74fea527 --workflow 4a12aaea0bf6a59d155bc9cca3200ee47b9c4f89 --run 46106829666
```

Depuis le banc, utiliser Node 24. `$m` désigne le checkout de `167be950` avec Pyodide et `$out` un nouveau dossier de reçus locaux.

```powershell
foreach ($jeu in 'DAME','RECR','CRAF','HOLE','SYME','SB26','TR87') {
  py -3.11 scripts/test-sic-coexistence-recall.py $jeu $m "$out/$jeu"
}
foreach ($jeu in 'LF52','TRIA') {
  py -3.11 scripts/test-sic-coexistence-catalogue.py $jeu $m "$out/$jeu"
}
py -3.11 scripts/test-sic-hole-projected-return.py $m "$out/HOLE-T8"
```
