# Départage P05 entre deux directions de cavité

## Témoin et résultat attendus avant modification

Référence moteur `162e45506cd9196171c15cb2402cf2ca1ee4266d`. AS66 depuis N1, mode natif V6, au tour global 6 (N2/T1). Sur l’image `fb4c841eea2f859a`, la méthode de cavité récompensée est retenue, ACTION2 et ACTION3 ont un effet mesuré, le corps et la surface sont liés et la route reste à établir. Les commandes publiques ACTION1 et ACTION4 sont toutes deux sans mesure et sans essai à cette clé géométrique. Elles partagent les mêmes prémisses et coûtent chacune un geste.

Le moteur de référence atteint la même vue dans deux départs natifs. Au second, le dossier local marque seulement l’offre ACTION1 comme déjà essayée dans cette géométrie au moment de produire les offres. Le paquet envoyé au moteur et la disponibilité publique des commandes sont identiques. Cette intervention ne crée ni mesure de direction ni nouveau retour.

| À la vue du tour 6 | Offre attendue et action jouée | Vrai retour |
|---|---|---|
| Les deux offres sont ouvertes | ACTION1, première dans l’ordre historique | 80 pixels changés, empreinte `9e25d42a95c97b84`, direction mesurée [-1,0] en ordre ligne, colonne. T7 soumet ensuite ACTION4. |
| La seule offre ACTION1 est retirée | ACTION4 seule, même garde de cavité | 82 pixels changés, empreinte `1d4db55871a6a88a`, direction mesurée [0,1]. T7 libère ACTION2 sous `sliding_cavity_access` et en confirme le retour. |

Le classement doit considérer les offres effectivement admissibles à cette même observation et garder l’ordre historique à coût et preuves égaux. Le budget P05 nul s’abstient. Le shadow doit publier les deux évaluations en conservant le ticket natif. Une seule commande passe au garde et au retour. Au tour 7 nominal, ACTION1 est mesurée et la nouvelle observation ne fournit plus qu’ACTION4.

## Sélection et verdict

`SlidingCavity.proposeDirectionQuestion` réutilise `unmeasuredControls` et la clé calculée par `ControlDependencies.questionKey`. Le fournisseur écarte les commandes déjà mesurées, les commandes indisponibles et celles déjà essayées sous cette clé. En mode explicite, il remet les offres restantes à `selectControlTrialOffer`. Le sélecteur évalue les gardes P05 et le budget de chaque offre, puis conserve la première offre applicable et abordable à l’égalité. Le reçu `offers` donne le coût, les preuves et le rang de chaque offre. Le plan unitaire et le témoin natif sont construits pour l’unique commande libérée. [Fournisseur](../../src/logos-engine/v6-sliding-cavity.ts) · [Sélecteur](../../src/sic/control-effect-next.ts)

Le candidat et son parent concordent dans chaque bras sur les sept commandes, les sept retours et les huit observations. Depuis N1, le préfixe commun joue ACTION1, ACTION2, ACTION2, ACTION3 puis ACTION2. Au T6 nominal, le reçu place ACTION1 avant ACTION4 à preuves et coût égaux. Au T7, après la mesure d’ACTION1, il affiche la seule offre ACTION4. Dans le bras de retrait, le T6 n’affiche qu’ACTION4 et son vrai retour rend possible le pas d’accès ACTION2 au T7. Le départage est éprouvé à coûts égaux.

Pour recapturer le bras de retrait, repartir du même N1 avec sept gestes et le garde V6 natif. Au T6 sur `fb4c841eea2f859a`, prendre la `support_plan.question_key` de la première offre et l’ajouter temporairement à `control_questions.attempted` pendant la construction des offres. Restaurer ensuite cet ensemble et laisser le service autoriser, jouer et enregistrer le ticket alternatif. Le paquet du retour ACTION4 est conservé dans la fixture de test. [Retour capturé](../../tests/fixtures/sic-as66-p05-action4-return.json.gz) · [Tests du départage](../../tests/sic-p05-cavity-tiebreak.test.ts)

```powershell
$nodeSic = (Get-Command node.exe -All)[-1].Source
& $nodeSic --test tests/sic-p05-cavity-tiebreak.test.ts tests/sic-p05-agenda-shadow.test.ts tests/sic-p05-typed-child.test.ts tests/sic-native-resolution.test.ts
& $nodeSic --test --test-name-pattern='real public AS66|prefix' tests/v6-sliding-cavity.test.ts
npm.cmd run typecheck
```
