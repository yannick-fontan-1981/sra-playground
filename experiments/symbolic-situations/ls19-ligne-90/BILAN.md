# LS19 · verdict indépendant sur la ligne 90

**Les trois situations construites passent avec le candidat `975d9d809ba1cb41dd8c63414586cb95498018b1`.** Les deux situations de développement totalisent quatre départs conformes. La situation réservée totalise deux départs conformes. Les 55 vérifications préenregistrées passent (37 en développement, 18 en réserve). Le premier écart attendu d'une répétition du ticket historique a été effectivement observé en D2.

| Situation | Besoin et sous-objectif | Retour observé et décision | Verdict |
| --- | --- | --- | ---: |
| D1 · vue qui s'étend ou reste fixe | Même besoin `observe_view_access` et même sous-objectif jusqu'au troisième geste, `ACTION3`. | L'image nouvelle apporte 192 pixels. L'image immobilisée donne zéro pixel et clôt le plan sans prochain ticket. Chacun des deux reçus désigne le sous-objectif libéré. | 2/2 |
| D2 · accès puis obstruction | Le même besoin porte deux accès successifs et une confirmation d'obstruction. Les trois sous-objectifs libérés sont distincts. | Sur le parcours long, les trois premières poses sont confirmées sous le premier plan. Les trois clôtures à zéro pixel sont rattachées aux bons plans. Au retour du troisième geste, la continuation est `ACTION1` si la pose avance, `ACTION2` si elle reste fixe. | 2/2 |
| Situation réservée | Le besoin, l'admission, le maintien du sous-objectif et la liaison de la clôture ont été vérifiés dans les deux histoires. | Les préfixes observables et les décisions concordent jusqu'au changement de preuve. Les deux commandes suivantes satisfont leur critère respectif. | 2/2 |

Le but supérieur est `G_official_completion`. Le besoin de vue est `observe_view_access`. Sur D2, ses trois sous-objectifs libérés sont successivement `C_view_393ef3c4a66c1034`, `C_view_1f30513c2e1b350c` et `C_view_0a23c68fc4b5a765`. Aux gestes 6, 12 et 13, la mesure de surface du retour désigne respectivement le premier, le deuxième et le troisième. Le gain conditionnel de 512 pixels de la première offre reste une prévision.

**Contrôles indépendants.** Un audit après mesure a comparé les entrées et les décisions jusqu'à la première image discriminante dans les trois paires. Dans chacune, les actions disponibles et l'index restaient identiques tandis que l'image changeait. Six reçus altérés ont été rejetés : trois copies de la continuation de l'autre histoire et trois réattributions du retour à un ancien plan. Le gel antérieur `13ebd79d` passe aussi 4/4 en développement, avec les mêmes observations de décision résumées par le banc opérateur.

Le générateur et les critères étaient figés à `a2a38a57e5cf1185a5a85f5fc5c015dd8ccd2262`, l'engagement de réserve publié à `0059d8c770b8e934f6674588a1d31e7d765051d5` avant chargement du candidat. Le reçu de développement a pour SHA-256 `b7512423b2616abd29193987f9efef9c501fb1583e050f81d8584d048a71b0d4`, le reçu réservé `a5be36d5c00e47587a9330ba7d9aec5f7a16ccdfdfac8614fcb6838c256d4960`.

**Portée pour les 98.** Ce résultat qualifie le comportement observable de la ligne 90 sur ces trois situations via le service natif. Les fixtures fournissent des transitions partielles. La réussite d'un niveau LS19, la non-régression du Banc et l'intégration canonique ont chacune leur propre verdict.

Depuis ce répertoire dans le checkout expérimental, avec Node 24 et le commit candidat disponible dans Git, on peut reproduire les quatre départs publics :

```powershell
node qualifier.mjs --sha 975d9d809ba1cb41dd8c63414586cb95498018b1 --depot . --rapport dev-ls19.json
node auditer.mjs dev-ls19.json
```

[Contrat et conditions de développement](CONTRAT.md) · [Cas publics](fixture.mjs) · [Gel de sélection](GEL.md)
